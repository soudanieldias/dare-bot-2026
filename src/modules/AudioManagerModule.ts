import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import prism from 'prism-media';
import { RECORDING_START_SOUND, RECORDINGS_DIR } from '@/constants/index.js';
import { type IDareClient } from '@/interfaces/index.js';
import { logger, config } from '@/shared/index.js';

interface AudioQueueItem {
  source: string;
  name: string;
  type: 'MUSIC' | 'EFFECT';
}

interface ActiveUserRecording {
  opusStream: Readable;
  decoder: prism.opus.Decoder;
  writeStream: WriteStream;
}

interface GuildRecordingSession {
  speakingHandler: (userId: string) => void;
  userRecordings: Map<string, ActiveUserRecording>;
}

export type MusicOnIdleCallback = (guildId: string) => void;

export class AudioManagerModule {
  private connectionMap = new Map<string, VoiceConnection>();
  private playerMap = new Map<string, AudioPlayer>();
  private queueMap = new Map<string, AudioQueueItem[]>();
  private volumeMap = new Map<string, number>();
  private resourceMap = new Map<string, AudioResource>();
  private recordingMap = new Map<string, GuildRecordingSession>();
  private musicOnIdleCallback?: MusicOnIdleCallback;

  constructor(private readonly client: IDareClient) {
    this.client.audioManager = this;
  }

  public async bootstrap(): Promise<void> {
    if (!existsSync(RECORDINGS_DIR)) {
      mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
    logger.info('Audio', 'AudioManagerModule inicializado (Unificado).');
  }

  public getConnection(guildId: string): VoiceConnection | undefined {
    return this.connectionMap.get(guildId) ?? getVoiceConnection(guildId);
  }

  public isConnected(guildId: string): boolean {
    return Boolean(this.getConnection(guildId));
  }

  public isRecording(guildId: string): boolean {
    return this.recordingMap.has(guildId);
  }

  private getOrCreatePlayer(guildId: string, channelId: string, adapterCreator: any): AudioPlayer {
    let player = this.playerMap.get(guildId);

    if (!player) {
      player = createAudioPlayer();

      player.on(AudioPlayerStatus.Idle, () => {
        this.processQueue(guildId);
        const queue = this.queueMap.get(guildId);
        if ((!queue || queue.length === 0) && this.musicOnIdleCallback) {
          this.musicOnIdleCallback(guildId);
        }
      });

      player.on('error', (error) => {
        logger.error('Audio', `Erro no player da guilda ${guildId}: ${error.message}`);
        void this.reportAudioError(guildId, error, 'player');
      });

      this.playerMap.set(guildId, player);
    }

    if (!this.connectionMap.has(guildId)) {
      const connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      connection.subscribe(player);
      this.connectionMap.set(guildId, connection);

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        logger.warn('Audio', `Conexão de voz desconectada para a guilda ${guildId}.`);
        this.cleanup(guildId);
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        logger.warn('Audio', `Conexão de voz destruída para a guilda ${guildId}.`);
        this.cleanup(guildId);
      });

      connection.on('error', (error: Error) => {
        logger.error('Audio', `Erro na conexão de voz da guilda ${guildId}: ${error.message}`);
        void this.reportAudioError(guildId, error, 'connection');
        this.cleanup(guildId);
      });
    }

    return player;
  }

  private async reportAudioError(guildId: string, error: unknown, context?: string) {
    try {
      const raw = error instanceof Error ? (error.stack ?? error.message) : String(error);
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        logger.error(
          'Audio',
          `Não foi possível localizar a guilda ${guildId} para reportar erro: ${raw}`
        );
        return;
      }

      const candidateNames = [
        'dev',
        'development',
        'dev-log',
        'devs',
        'bot-dev',
        'bot-logs',
        'logs',
        'erros',
        'erro',
        'errors',
      ];

      const message = `📣 **Audio Error** (${context ?? 'unknown'}) guild: ${guildId}\n\n\`\`\`\n${raw}\n\`\`\``;

      try {
        await logger.critical('Audio', raw, error instanceof Error ? error : undefined);
      } catch {}

      const preferredGuildId = config.logging.preferredGuildId || '';
      const preferredChannelId = config.logging.preferredChannelId || '';
      if (preferredChannelId) {
        try {
          const ch = await this.client.channels.fetch(preferredChannelId).catch(() => null);
          if (ch && typeof (ch as any).send === 'function') {
            const chGuildId = (ch as any).guild?.id ?? '';
            if (!preferredGuildId || chGuildId === guildId || preferredGuildId === guildId) {
              await (ch as any).send({ content: message }).catch((sendErr: Error) => {
                logger.error(
                  'Audio',
                  `Falha ao enviar erro para canal preferencial ${preferredChannelId}: ${sendErr.message}`
                );
              });
              return;
            }
          }
        } catch {}
      }

      const channel = guild.channels.cache.find((c: any) => {
        try {
          const isText =
            (typeof c.isText === 'function' && c.isText()) ||
            (typeof c.isTextBased === 'function' && c.isTextBased()) ||
            c.type === 0 ||
            c.type === 'GUILD_TEXT';
          return isText && candidateNames.includes(c.name);
        } catch {
          return false;
        }
      }) as any | undefined;

      if (channel && typeof channel.send === 'function') {
        await channel.send({ content: message }).catch((sendErr: Error) => {
          logger.error(
            'Audio',
            `Falha ao enviar erro para canal DEV na guilda ${guildId}: ${sendErr.message}`
          );
        });
        return;
      }

      // fallback: tentar canal do sistema da guilda
      try {
        const sys = guild.systemChannel;
        if (sys && typeof sys.send === 'function') {
          await sys.send({ content: message }).catch(() => undefined);
          return;
        }
      } catch {
        // ignore
      }

      logger.warn('Audio', `Canal DEV não encontrado na guilda ${guildId}. Erro: ${raw}`);
    } catch (err) {
      logger.error(
        'Audio',
        `Erro ao reportar erro de áudio: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public playFromUrl(
    guildId: string,
    channelId: string,
    adapterCreator: unknown,
    url: string,
    volume?: number
  ): void {
    const player = this.getOrCreatePlayer(guildId, channelId, adapterCreator);
    const vol = volume ?? this.volumeMap.get(guildId) ?? 0.1;
    const resource = createAudioResource(url, { inlineVolume: true });
    resource.volume?.setVolume(vol);
    this.resourceMap.set(guildId, resource);
    player.play(resource);
  }

  public playFromStream(
    guildId: string,
    channelId: string,
    adapterCreator: unknown,
    stream: Readable,
    volume?: number
  ): void {
    const player = this.getOrCreatePlayer(guildId, channelId, adapterCreator);
    const vol = volume ?? this.volumeMap.get(guildId) ?? 0.1;
    const resource = createAudioResource(stream, { inlineVolume: true });
    resource.volume?.setVolume(vol);
    this.resourceMap.set(guildId, resource);
    player.play(resource);
  }

  public setVolume(guildId: string, volume: number): void {
    const vol = Math.max(0, Math.min(1, volume));
    this.volumeMap.set(guildId, vol);
    const resource = this.resourceMap.get(guildId);
    if (resource?.volume) {
      resource.volume.setVolume(vol);
    }
  }

  public getVolume(guildId: string): number {
    return this.volumeMap.get(guildId) ?? 0.1;
  }

  public setMusicOnIdleCallback(cb: MusicOnIdleCallback): void {
    this.musicOnIdleCallback = cb;
  }

  public skip(guildId: string): void {
    this.playerMap.get(guildId)?.stop();
  }

  public pause(guildId: string): boolean {
    const player = this.playerMap.get(guildId);
    if (!player) return false;
    player.pause();
    return true;
  }

  public resume(guildId: string): boolean {
    const player = this.playerMap.get(guildId);
    if (!player) return false;
    player.unpause();
    return true;
  }

  public hasPlayer(guildId: string): boolean {
    return this.playerMap.has(guildId);
  }

  public async play(guildId: string, channelId: string, adapterCreator: any, item: AudioQueueItem) {
    const player = this.getOrCreatePlayer(guildId, channelId, adapterCreator);
    const resource = createAudioResource(item.source, { inlineVolume: true });
    const vol = this.volumeMap.get(guildId) ?? 0.1;
    resource.volume?.setVolume(vol);
    this.resourceMap.set(guildId, resource);

    if (item.type === 'EFFECT') {
      logger.info('Audio', `Tocando efeito: ${item.name}`);
      player.play(resource);
    } else {
      const queue = this.queueMap.get(guildId) || [];
      queue.push(item);
      this.queueMap.set(guildId, queue);

      if (player.state.status === AudioPlayerStatus.Idle) {
        this.processQueue(guildId);
      }
    }
  }

  public async startCallRecording(
    guildId: string,
    channelId: string,
    adapterCreator: unknown
  ): Promise<{ started: boolean; message: string }> {
    if (this.recordingMap.has(guildId)) {
      return { started: false, message: 'Já existe uma gravação ativa neste servidor.' };
    }

    this.getOrCreatePlayer(guildId, channelId, adapterCreator);

    const connection = this.getConnection(guildId);
    if (!connection) {
      return { started: false, message: 'O bot não está conectado a um canal de voz.' };
    }

    if (!existsSync(RECORDINGS_DIR)) {
      mkdirSync(RECORDINGS_DIR, { recursive: true });
    }

    if (existsSync(RECORDING_START_SOUND)) {
      await this.play(guildId, channelId, adapterCreator, {
        source: RECORDING_START_SOUND,
        name: 'recording_start',
        type: 'EFFECT',
      });
    } else {
      logger.warn(
        'Audio',
        `Arquivo de aviso não encontrado: ${RECORDING_START_SOUND}. Continuando gravação sem aviso.`
      );
    }

    const userRecordings = new Map<string, ActiveUserRecording>();

    const speakingHandler = (userId: string) => {
      if (userRecordings.has(userId)) return;

      const opusStream = connection.receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1000,
        },
      });

      const decoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000,
      });

      const filename = path.join(RECORDINGS_DIR, `${guildId}-${userId}-${Date.now()}.pcm`);
      const writeStream = createWriteStream(filename);

      opusStream.pipe(decoder).pipe(writeStream);

      const active: ActiveUserRecording = { opusStream, decoder, writeStream };
      userRecordings.set(userId, active);

      const cleanupUser = () => {
        if (!userRecordings.has(userId)) return;
        userRecordings.delete(userId);
        try {
          opusStream.destroy();
        } catch {
          // ignore
        }
        try {
          decoder.destroy();
        } catch {
          // ignore
        }
        if (!writeStream.closed) {
          writeStream.end();
        }
        logger.info('Audio', `Gravação finalizada para user ${userId}: ${filename}`);
      };

      opusStream.on('end', cleanupUser);
      opusStream.on('close', cleanupUser);
      opusStream.on('error', (err) => {
        logger.error('Audio', `Erro no stream de ${userId}: ${err.message}`);
        cleanupUser();
      });

      logger.info('Audio', `Gravando user ${userId} → ${filename}`);
    };

    connection.receiver.speaking.on('start', speakingHandler);
    this.recordingMap.set(guildId, { speakingHandler, userRecordings });

    logger.info('Audio', `Gravação de call iniciada na guilda ${guildId}.`);
    return {
      started: true,
      message: `🎙️ Gravação iniciada. Arquivos em \`${RECORDINGS_DIR}/\`.`,
    };
  }

  public stopCallRecording(guildId: string): { stopped: boolean; message: string } {
    const session = this.recordingMap.get(guildId);
    if (!session) {
      return { stopped: false, message: 'Não há gravação ativa neste servidor.' };
    }

    const connection = this.getConnection(guildId);
    if (connection) {
      connection.receiver.speaking.off('start', session.speakingHandler);
    }

    for (const [userId, rec] of session.userRecordings) {
      try {
        rec.opusStream.destroy();
      } catch {
        // ignore
      }
      try {
        rec.decoder.destroy();
      } catch {
        // ignore
      }
      if (!rec.writeStream.closed) {
        rec.writeStream.end();
      }
      session.userRecordings.delete(userId);
    }

    this.recordingMap.delete(guildId);
    logger.info('Audio', `Gravação de call parada na guilda ${guildId}.`);
    return {
      stopped: true,
      message: `⏹️ Gravação finalizada. Arquivos salvos em \`${RECORDINGS_DIR}/\`.`,
    };
  }

  private processQueue(guildId: string) {
    const queue = this.queueMap.get(guildId);
    const player = this.playerMap.get(guildId);

    if (!queue || queue.length === 0 || !player) return;

    const nextItem = queue.shift();
    if (nextItem) {
      const resource = createAudioResource(nextItem.source, { inlineVolume: true });
      const vol = this.volumeMap.get(guildId) ?? 0.1;
      resource.volume?.setVolume(vol);
      this.resourceMap.set(guildId, resource);
      player.play(resource);
      logger.info('Audio', `Tocando agora (Fila): ${nextItem.name}`);
    }
  }

  private cleanup(guildId: string) {
    if (this.recordingMap.has(guildId)) {
      this.stopCallRecording(guildId);
    }

    const connection = this.connectionMap.get(guildId);
    if (connection) {
      try {
        connection.destroy();
      } catch {
        // ignore cleanup failures
      }
    }

    this.connectionMap.delete(guildId);
    this.playerMap.delete(guildId);
    this.queueMap.delete(guildId);
    this.resourceMap.delete(guildId);
    this.volumeMap.delete(guildId);
    logger.info('Audio', `Recursos limpos para a guilda: ${guildId}`);
  }

  public stop(guildId: string) {
    this.playerMap.get(guildId)?.stop();
    this.cleanup(guildId);
  }

  public getConnectionChannelId(guildId: string): string {
    return this.connectionMap.get(guildId)?.joinConfig.channelId || '';
  }

  public shutdown(): void {
    for (const guildId of [...this.recordingMap.keys()]) {
      this.stopCallRecording(guildId);
    }
    for (const guildId of this.connectionMap.keys()) {
      this.cleanup(guildId);
    }
  }
}
