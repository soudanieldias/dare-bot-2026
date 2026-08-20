import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import {
  EndBehaviorType,
  type VoiceConnection,
  type VoiceReceiver,
} from '@discordjs/voice';
import { Events, type Client, type VoiceState } from 'discord.js';
import prism from 'prism-media';
import { logger } from '@/shared/index.js';
import { PcmTrackWriter } from './pcmTimeline.js';

const PAD_INTERVAL_MS = 200;

export function didJoinRecordedChannel(
  oldChannelId: string | null,
  newChannelId: string | null,
  recordedChannelId: string
): boolean {
  return newChannelId === recordedChannelId && oldChannelId !== recordedChannelId;
}

interface UserRecordingTrack {
  userId: string;
  filename: string;
  writeStream: WriteStream;
  writer: PcmTrackWriter;
  opusStream: Readable | undefined;
  decoder: prism.opus.Decoder | undefined;
}

export class CallRecordingSession {
  private readonly tracks = new Map<string, UserRecordingTrack>();
  private readonly startedAt = Date.now();
  private readonly speakingHandler: (userId: string) => void;
  private readonly voiceStateHandler: (oldState: VoiceState, newState: VoiceState) => void;
  private padTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private channelId = '';
  private client: Client | undefined;

  constructor(
    private readonly connection: VoiceConnection,
    private readonly guildId: string,
    private readonly recordingsDir: string,
    private readonly botUserId: string | undefined
  ) {
    this.speakingHandler = (userId: string) => {
      this.ensureUserTrack(userId);
    };
    this.voiceStateHandler = (oldState, newState) => {
      this.handleVoiceStateUpdate(oldState, newState);
    };
  }

  start(channelId: string, client: Client): void {
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }

    this.channelId = channelId;
    this.client = client;
    this.connection.receiver.speaking.on('start', this.speakingHandler);
    client.on(Events.VoiceStateUpdate, this.voiceStateHandler);
    this.subscribeChannelMembers(channelId, client);

    this.padTimer = setInterval(() => {
      this.padIdleTracks();
    }, PAD_INTERVAL_MS);
    this.padTimer.unref();
  }

  stop(): string[] {
    if (this.stopped) return [];
    this.stopped = true;

    if (this.padTimer) {
      clearInterval(this.padTimer);
      this.padTimer = undefined;
    }

    this.connection.receiver.speaking.off('start', this.speakingHandler);
    this.client?.off(Events.VoiceStateUpdate, this.voiceStateHandler);
    this.client = undefined;

    const endedAt = Date.now();
    const files: string[] = [];
    for (const track of this.tracks.values()) {
      this.detachLiveStream(track);
      track.writer.padTo(endedAt, true);
      if (!track.writeStream.closed) {
        track.writeStream.end();
      }
      files.push(track.filename);
    }
    this.tracks.clear();
    return files;
  }

  private handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
    if (this.stopped || newState.guild.id !== this.guildId) return;
    if (newState.member?.user.bot) return;
    if (!didJoinRecordedChannel(oldState.channelId, newState.channelId, this.channelId)) {
      return;
    }

    this.ensureUserTrack(newState.id);
    logger.info(
      'Audio',
      `Usuário ${newState.id} entrou na call gravada; track sincronizado desde o início da sessão.`
    );
  }

  private subscribeChannelMembers(channelId: string, client: Client): void {
    const channel = client.channels.cache.get(channelId);
    if (!channel || !channel.isVoiceBased()) return;

    for (const member of channel.members.values()) {
      if (member.user.bot) continue;
      this.ensureUserTrack(member.id);
    }
  }

  private ensureUserTrack(userId: string): void {
    if (this.stopped || userId === this.botUserId) return;

    let track = this.tracks.get(userId);
    if (!track) {
      track = this.createTrack(userId);
      this.tracks.set(userId, track);
    }

    this.attachLiveStream(track);
  }

  private createTrack(userId: string): UserRecordingTrack {
    const filename = path.join(
      this.recordingsDir,
      `${this.guildId}-${userId}-${this.startedAt}.pcm`
    );
    const writeStream = createWriteStream(filename);
    const writer = new PcmTrackWriter({
      startedAt: this.startedAt,
      write: (chunk) => {
        if (!writeStream.closed && !writeStream.destroyed) {
          writeStream.write(chunk);
        }
      },
    });

    writer.padToNow(true);
    logger.info('Audio', `Gravando user ${userId} → ${filename}`);

    return { userId, filename, writeStream, writer, opusStream: undefined, decoder: undefined };
  }

  private attachLiveStream(track: UserRecordingTrack): void {
    if (track.opusStream && !track.opusStream.destroyed) return;

    const receiver: VoiceReceiver = this.connection.receiver;
    const opusStream = receiver.subscribe(track.userId, {
      end: { behavior: EndBehaviorType.Manual },
    });
    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48_000,
    });

    opusStream.pipe(decoder);
    decoder.on('data', (chunk: Buffer) => {
      if (this.stopped) return;
      track.writer.writeAudio(chunk);
    });

    const onDead = () => {
      this.detachLiveStream(track);
    };

    opusStream.once('end', onDead);
    opusStream.once('close', onDead);
    opusStream.once('error', (err: Error) => {
      logger.error('Audio', `Erro no stream de ${track.userId}: ${err.message}`);
      onDead();
    });
    decoder.once('error', (err: Error) => {
      logger.error('Audio', `Erro no decoder de ${track.userId}: ${err.message}`);
      onDead();
    });

    track.opusStream = opusStream;
    track.decoder = decoder;
  }

  private detachLiveStream(track: UserRecordingTrack): void {
    const { opusStream, decoder } = track;
    track.opusStream = undefined;
    track.decoder = undefined;

    try {
      opusStream?.unpipe(decoder);
    } catch {
      // ignore
    }
    try {
      opusStream?.destroy();
    } catch {
      // ignore
    }
    try {
      decoder?.destroy();
    } catch {
      // ignore
    }
  }

  private padIdleTracks(): void {
    if (this.stopped) return;
    for (const track of this.tracks.values()) {
      track.writer.padToNow();
    }
  }
}
