import type { Readable } from 'node:stream';
import type { GuildMember } from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { IConnectionParams } from '@/interfaces/IAudio.js';
import { logger } from '@/shared/index.js';
import ytdl from '@distube/ytdl-core';
import { YouTube } from 'youtube-sr';

export interface IMusicQueueItem {
  url: string;
  name: string;
  type?: 'youtube' | 'arbitrary';
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
    logger.info('Audio', 'MusicModule inicializado (YouTube).');
  }

  private normalizeYouTubeUrl(url: string): string {
    if (!url || typeof url !== 'string') return url;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const id = trimmed.replace(/^.*[?&]v=([^&]+).*$/, '$1').replace(/^\/watch\?v=/, '') || trimmed;
    return `https://www.youtube.com/watch?v=${id}`;
  }

  private createYouTubeStream(url: string): Readable {
    const fullUrl = this.normalizeYouTubeUrl(url);
    return ytdl(fullUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1024 * 512,
      playerClients: ['ANDROID', 'WEB_EMBEDDED', 'WEB'],
    });
  }

  private async resolveQuery(query: string): Promise<IMusicQueueItem[]> {
    const trimmed = query.trim();
    if (YouTube.validate(trimmed, 'VIDEO') || YouTube.validate(trimmed, 'VIDEO_ID')) {
      try {
        const video = await YouTube.getVideo(trimmed);
        if (!video?.url) throw new Error('Vídeo não encontrado');
        const url = this.normalizeYouTubeUrl((video as { url: string }).url);
        return [
          { url, name: (video as { title?: string }).title ?? 'Desconhecido', type: 'youtube' },
        ];
      } catch (e) {
        logger.error(
          'Music',
          `resolveQuery.getVideo falhou: ${e instanceof Error ? e.message : e}${e instanceof Error && e.stack ? `\nStack: ${e.stack}` : ''}`
        );
        throw new Error('Não foi possível obter informações do vídeo.');
      }
    }
    if (YouTube.isPlaylist(trimmed)) {
      try {
        const playlist = await YouTube.getPlaylist(trimmed, { fetchAll: false });
        if (!playlist?.videos?.length) throw new Error('Playlist vazia ou não encontrada');
        return playlist.videos.map((v: { url: string; id?: string; title?: string }) => ({
          url: this.normalizeYouTubeUrl(
            v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : '')
          ),
          name: v.title ?? 'Desconhecido',
          type: 'youtube' as const,
        }));
      } catch {
        throw new Error('Não foi possível obter a playlist.');
      }
    }
    try {
      const video = await YouTube.searchOne(trimmed, 'video');
      const rawUrl = (video as { url?: string })?.url;
      const rawId = (video as { id?: string })?.id;
      if (!rawUrl && !rawId) throw new Error('Nenhum resultado encontrado');
      const url = this.normalizeYouTubeUrl(rawUrl || `https://www.youtube.com/watch?v=${rawId}`);
      return [
        { url, name: (video as { title?: string }).title ?? 'Desconhecido', type: 'youtube' },
      ];
    } catch (e) {
      logger.error(
        'Music',
        `resolveQuery.searchOne falhou: ${e instanceof Error ? e.message : e}${e instanceof Error && e.stack ? `\nStack: ${e.stack}` : ''}`
      );
      throw new Error('Nenhum resultado encontrado para a busca.');
    }
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
      if (item.type === 'arbitrary') {
        this.client.audioManager.playFromUrl(
          guildId,
          connParams.channelId,
          connParams.adapterCreator,
          item.url,
          vol
        );
      } else {
        const stream = this.createYouTubeStream(item.url);
        stream.on('error', () => {
          logger.error('Music', `Erro no stream: ${item.name}`);
          this.playNext(guildId);
        });
        this.client.audioManager.playFromStream(
          guildId,
          connParams.channelId,
          connParams.adapterCreator,
          stream,
          vol
        );
      }
      logger.info('Music', `Tocando: ${item.name}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : '';
      logger.error('Music', `Erro ao tocar "${item.name}": ${errMsg}`);
      logger.error('Music', `URL que causou o erro: "${item.url}" (type=${item.type})`);
      if (errStack) logger.error('Music', `Stack: ${errStack}`);
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

    let items: IMusicQueueItem[];

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
