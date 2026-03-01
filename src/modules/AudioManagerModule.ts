import type { Readable } from 'node:stream';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { type IDareClient } from '@/interfaces/IDareClient.js';
import { logger } from '@/shared/index.js';

interface AudioQueueItem {
  source: string;
  name: string;
  type: 'MUSIC' | 'EFFECT';
}

export type MusicOnIdleCallback = (guildId: string) => void;

export class AudioManagerModule {
  private connectionMap = new Map<string, VoiceConnection>();
  private playerMap = new Map<string, AudioPlayer>();
  private queueMap = new Map<string, AudioQueueItem[]>();
  private volumeMap = new Map<string, number>();
  private resourceMap = new Map<string, AudioResource>();
  private musicOnIdleCallback?: MusicOnIdleCallback;

  constructor(private readonly client: IDareClient) {
    this.client.audioManager = this;
  }

  public async bootstrap(): Promise<void> {
    logger.info('Audio', 'AudioManagerModule inicializado (Unificado).');
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
      });

      this.playerMap.set(guildId, player);
    }

    if (!this.connectionMap.has(guildId)) {
      const connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator,
      });

      connection.subscribe(player);
      this.connectionMap.set(guildId, connection);

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        this.cleanup(guildId);
      });
    }

    return player;
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
    this.connectionMap.get(guildId)?.destroy();
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
    for (const guildId of this.connectionMap.keys()) {
      this.cleanup(guildId);
    }
  }
}
