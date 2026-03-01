import type { Readable } from 'node:stream';
import type { GuildMember } from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { ConnectionParams } from './SoundModule.js';
import { logger } from '@/shared/index.js';
import ytdl from 'discord-ytdl-core';
import { YouTube } from 'youtube-sr';

export interface MusicQueueItem {
  url: string;
  name: string;
  type?: 'youtube' | 'arbitrary';
}

export class MusicModule {
  private queueMap = new Map<string, MusicQueueItem[]>();
  private currentTrackMap = new Map<string, MusicQueueItem>();
  private connectionParamsMap = new Map<string, ConnectionParams>();

  constructor(private readonly client: IDareClient) {
    this.client.musicModule = this;
  }

  bootstrap(): void {
    this.client.audioManager.setMusicOnIdleCallback((guildId) => {
      this.playNext(guildId);
    });
    logger.info('Audio', 'MusicModule inicializado (YouTube).');
  }

  private createYtdlStream(url: string): Readable {
    return ytdl(url, {
      filter: 'audioonly',
      opusEncoded: false,
      fmt: 'mp3',
    });
  }

  private createArbitraryStream(source: string): Readable {
    return ytdl.arbitraryStream(source, {
      opusEncoded: false,
      fmt: 'mp3',
    });
  }

  private async resolveQuery(query: string): Promise<MusicQueueItem[]> {
    const trimmed = query.trim();
    if (YouTube.validate(trimmed, 'VIDEO') || YouTube.validate(trimmed, 'VIDEO_ID')) {
    try {
      const video = await YouTube.getVideo(trimmed);
        if (!video?.url) throw new Error('Vídeo não encontrado');
        return [{ url: video.url, name: video.title ?? 'Desconhecido', type: 'youtube' }];
      } catch {
        throw new Error('Não foi possível obter informações do vídeo.');
      }
    }
    if (YouTube.isPlaylist(trimmed)) {
      try {
        const playlist = await YouTube.getPlaylist(trimmed, { fetchAll: false });
        if (!playlist?.videos?.length) throw new Error('Playlist vazia ou não encontrada');
        return playlist.videos.map((v: { url: string; title?: string }) => ({
          url: v.url,
          name: v.title ?? 'Desconhecido',
          type: 'youtube' as const,
        }));
      } catch {
        throw new Error('Não foi possível obter a playlist.');
      }
    }
    try {
      const video = await YouTube.searchOne(trimmed, 'video');
      if (!video?.url) throw new Error('Nenhum resultado encontrado');
      return [{ url: video.url, name: video.title ?? 'Desconhecido', type: 'youtube' }];
    } catch {
      throw new Error('Nenhum resultado encontrado para a busca.');
    }
  }

  private async playNext(guildId: string, params?: ConnectionParams): Promise<void> {
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
      const stream =
        item.type === 'arbitrary'
          ? this.createArbitraryStream(item.url)
          : this.createYtdlStream(item.url);
      stream.on('error', () => {
        logger.error('Music', `Erro no stream: ${item.name}`);
        this.playNext(guildId);
      });
      const vol = this.client.audioManager.getVolume(guildId);
      this.client.audioManager.playFromStream(
        guildId,
        connParams.channelId,
        connParams.adapterCreator,
        stream,
        vol
      );
      logger.info('Music', `Tocando: ${item.name}`);
    } catch (err) {
      logger.error('Music', `Erro ao tocar ${item.name}: ${err}`);
      this.playNext(guildId);
    }
  }

  async play(
    params: ConnectionParams,
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

    let items: MusicQueueItem[];

    if (isFile) {
      items = [{ url: query, name: query.split('/').pop() ?? 'Arquivo', type: 'arbitrary' }];
    } else {
      items = await this.resolveQuery(query);
    }

    const queue = this.queueMap.get(guildId) ?? [];
    for (const item of items) {
      queue.push(item);
    }
    this.queueMap.set(guildId, queue);

    if (!this.client.audioManager.hasPlayer(guildId) || !this.currentTrackMap.has(guildId)) {
      this.currentTrackMap.delete(guildId);
      await this.playNext(guildId, params);
    }

    if (items.length === 1) {
      return {
        added: 1,
        message: items[0]!.name
          ? `${items[0]!.name}${queue.length > 1 ? ` (${queue.length} na fila)` : ''}`
          : 'Adicionado à fila.',
      };
    }
    return {
      added: items.length,
      message: `Playlist: ${items.length} músicas adicionadas (total: ${queue.length})`,
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

  getQueue(guildId: string): { current: MusicQueueItem | null; queue: MusicQueueItem[] } {
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
