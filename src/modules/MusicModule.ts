import type { GuildMember } from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { IConnectionParams } from '@/interfaces/IAudio.js';
import { logger } from '@/shared/index.js';

export interface IMusicQueueItem {
  url: string;
  name: string;
  type: 'arbitrary';
}

export class MusicModule {
  private queueMap = new Map<string, IMusicQueueItem[]>();
  private currentTrackMap = new Map<string, IMusicQueueItem>();
  private connectionParamsMap = new Map<string, IConnectionParams>();

  constructor(private readonly client: IDareClient) {
    this.client.musicModule = this;
  }

  bootstrap(): void {
    this.client.audioManager.setMusicOnIdleCallback((guildId) => {
      this.playNext(guildId);
    });
    logger.info('Audio', 'MusicModule inicializado (playfile).');
  }

  private async playNext(guildId: string, params?: IConnectionParams): Promise<void> {
    const queue = this.queueMap.get(guildId);
    if (!queue || queue.length === 0) {
      this.currentTrackMap.delete(guildId);
      this.connectionParamsMap.delete(guildId);
      return;
    }
    const item = queue.shift();
    if (!item) return;
    this.queueMap.set(guildId, queue);
    this.currentTrackMap.set(guildId, item);

    const connParams = params ?? this.connectionParamsMap.get(guildId);
    if (!connParams) return;

    try {
      const vol = this.client.audioManager.getVolume(guildId);
      this.client.audioManager.playFromUrl(
        guildId,
        connParams.channelId,
        connParams.adapterCreator,
        item.url,
        vol
      );
      logger.info('Music', `Tocando: ${item.name}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('Music', `Erro ao tocar "${item.name}": ${errMsg}`);
      this.playNext(guildId);
    }
  }

  async play(
    params: IConnectionParams,
    member: GuildMember,
    query: string,
    isFile = false
  ): Promise<{ added: number; message: string }> {
    const { guildId } = params;
    this.connectionParamsMap.set(guildId, params);

    const existingChannelId = this.client.audioManager.getConnectionChannelId(guildId);
    if (existingChannelId && existingChannelId !== member.voice.channel?.id) {
      throw new Error('O bot já está em outro canal de voz.');
    }

    if (!isFile) {
      throw new Error('YouTube está em implementação. Use /music playfile com link de áudio (mp3, mp4, etc.).');
    }

    const items: IMusicQueueItem[] = [
      { url: query, name: query.split('/').pop() ?? 'Arquivo', type: 'arbitrary' },
    ];

    const queue = this.queueMap.get(guildId) ?? [];
    for (const item of items) {
      queue.push(item);
    }
    this.queueMap.set(guildId, queue);

    if (!this.client.audioManager.hasPlayer(guildId) || !this.currentTrackMap.has(guildId)) {
      this.currentTrackMap.delete(guildId);
      await this.playNext(guildId, params);
    }

    return {
      added: 1,
      message: items[0]!.name + (queue.length > 1 ? ` (${queue.length} na fila)` : ''),
    };
  }

  stop(guildId: string): void {
    this.queueMap.delete(guildId);
    this.currentTrackMap.delete(guildId);
    this.connectionParamsMap.delete(guildId);
    this.client.audioManager.stop(guildId);
  }

  skip(guildId: string): void {
    this.client.audioManager.skip(guildId);
  }

  getQueue(guildId: string): { current: IMusicQueueItem | null; queue: IMusicQueueItem[] } {
    const current = this.currentTrackMap.get(guildId) ?? null;
    const queue = this.queueMap.get(guildId) ?? [];
    return { current, queue };
  }

  setVolume(guildId: string, volume: number): void {
    this.client.audioManager.setVolume(guildId, Math.max(0, Math.min(1, volume / 100)));
  }

  getVolume(guildId: string): number {
    return Math.round(this.client.audioManager.getVolume(guildId) * 100);
  }
}
