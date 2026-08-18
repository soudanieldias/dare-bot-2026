import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { type GuildMember } from 'discord.js';
import type { IConnectionParams, IDareClient } from '@/interfaces/index.js';
import { logger } from '@/shared/index.js';

export type JukeboxPlayMode = 'ordered' | 'random';

export interface IMusicQueueItem {
  url: string;
  name: string;
  type: 'arbitrary' | 'jukebox';
}

interface IJukeboxState {
  folderPath: string;
  history: string[];
  totalFiles: number;
  mode: JukeboxPlayMode;
}

export function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = result[i]!;
    result[i] = result[j]!;
    result[j] = current;
  }
  return result;
}

export async function collectJukeboxAudioFiles(folderPath: string): Promise<string[]> {
  const resolvedPath = path.resolve(folderPath);

  let entries: Array<{ name: string; isFile: () => boolean }> = [];
  try {
    entries = (await readdir(resolvedPath, { withFileTypes: true })) as Array<{
      name: string;
      isFile: () => boolean;
    }>;
  } catch {
    throw new Error(`Pasta de jukebox não encontrada: ${folderPath}`);
  }

  const supportedExtensions = new Set([
    '.mp3',
    '.wav',
    '.m4a',
    '.ogg',
    '.opus',
    '.flac',
    '.mp4',
    '.webm',
    '.aac',
  ]);

  return entries
    .filter(
      (entry) => entry.isFile() && supportedExtensions.has(path.extname(entry.name).toLowerCase())
    )
    .map((entry) => path.join(resolvedPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export class MusicModule {
  private queueMap = new Map<string, IMusicQueueItem[]>();
  private currentTrackMap = new Map<string, IMusicQueueItem>();
  private connectionParamsMap = new Map<string, IConnectionParams>();
  private jukeboxStateMap = new Map<string, IJukeboxState>();

  constructor(private readonly client: IDareClient) {
    this.client.musicModule = this;
  }

  public async bootstrap(): Promise<void> {
    this.client.audioManager.setMusicOnIdleCallback((guildId) => {
      void this.playNext(guildId);
    });
    logger.info('Audio', 'MusicModule inicializado (playfile + jukebox).');
  }

  public async getNextMusicInQueue(guildId: string): Promise<IMusicQueueItem | undefined> {
    const queue = this.queueMap.get(guildId);
    return Promise.resolve(queue?.[0]);
  }

  private buildJukeboxBatch(files: string[], state: IJukeboxState): string[] {
    const availableFiles = files.filter((file) => !state.history.includes(file));
    let nextFiles = availableFiles.length > 0 ? availableFiles : [...files];

    if (availableFiles.length === 0) {
      state.history = [];
    }

    if (state.mode === 'random') {
      nextFiles = shuffleArray(nextFiles);
    }

    return nextFiles;
  }

  private async refillJukeboxQueue(guildId: string): Promise<void> {
    const state = this.jukeboxStateMap.get(guildId);
    if (!state) return;

    const files = await collectJukeboxAudioFiles(state.folderPath);
    if (files.length === 0) {
      return;
    }

    state.totalFiles = files.length;
    const nextFiles = this.buildJukeboxBatch(files, state);

    const queue = this.queueMap.get(guildId) ?? [];
    for (const file of nextFiles) {
      queue.push({
        url: file,
        name: path.parse(file).name,
        type: 'jukebox',
      });
    }
    this.queueMap.set(guildId, queue);
  }

  private async playNext(guildId: string, params?: IConnectionParams): Promise<void> {
    let queue = this.queueMap.get(guildId);
    if (!queue || queue.length === 0) {
      const jukeboxState = this.jukeboxStateMap.get(guildId);
      if (jukeboxState) {
        await this.refillJukeboxQueue(guildId);
        queue = this.queueMap.get(guildId);
      }
    }

    if (!queue || queue.length === 0) {
      this.currentTrackMap.delete(guildId);
      this.connectionParamsMap.delete(guildId);
      return;
    }

    const item = queue.shift();
    if (!item) return;
    this.queueMap.set(guildId, queue);
    this.currentTrackMap.set(guildId, item);

    const jukeboxState = this.jukeboxStateMap.get(guildId);
    if (jukeboxState) {
      jukeboxState.history = [...jukeboxState.history, item.url];
      if (jukeboxState.history.length > jukeboxState.totalFiles) {
        jukeboxState.history = jukeboxState.history.slice(-jukeboxState.totalFiles);
      }
    }

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
      await this.playNext(guildId);
    }
  }

  public async play(
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
      throw new Error(
        'YouTube está em implementação. Use /music playfile com link de áudio (mp3, mp4, etc.).'
      );
    }

    const items: IMusicQueueItem[] = [
      { url: query, name: path.parse(query).name || 'Arquivo', type: 'arbitrary' },
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

  public async playJukebox(
    params: IConnectionParams,
    member: GuildMember,
    folderPath: string,
    mode: JukeboxPlayMode = 'random'
  ): Promise<{ added: number; message: string }> {
    const { guildId } = params;
    this.connectionParamsMap.set(guildId, params);

    const existingChannelId = this.client.audioManager.getConnectionChannelId(guildId);
    if (existingChannelId && existingChannelId !== member.voice.channel?.id) {
      throw new Error('O bot já está em outro canal de voz.');
    }

    const resolvedFolderPath = path.resolve(folderPath);
    const files = await collectJukeboxAudioFiles(resolvedFolderPath);
    if (files.length === 0) {
      throw new Error(`Nenhum arquivo de áudio encontrado na pasta: ${folderPath}`);
    }

    const state: IJukeboxState = {
      folderPath: resolvedFolderPath,
      history: [],
      totalFiles: files.length,
      mode,
    };
    this.jukeboxStateMap.set(guildId, state);

    const queue = this.queueMap.get(guildId) ?? [];
    const nextFiles = this.buildJukeboxBatch(files, state);

    for (const file of nextFiles) {
      queue.push({
        url: file,
        name: path.parse(file).name,
        type: 'jukebox',
      });
    }

    this.queueMap.set(guildId, queue);

    if (!this.client.audioManager.hasPlayer(guildId) || !this.currentTrackMap.has(guildId)) {
      this.currentTrackMap.delete(guildId);
      await this.playNext(guildId, params);
    }

    const modeLabel = mode === 'random' ? 'aleatório' : 'em ordem';
    return {
      added: nextFiles.length,
      message: `${path.basename(resolvedFolderPath)} (${nextFiles.length} arquivos, modo ${modeLabel}, sem repetir até percorrer tudo)`,
    };
  }

  stop(guildId: string): void {
    this.queueMap.delete(guildId);
    this.currentTrackMap.delete(guildId);
    this.connectionParamsMap.delete(guildId);
    this.jukeboxStateMap.delete(guildId);
    this.client.audioManager.stop(guildId);
  }

  skip(guildId: string): void {
    this.client.audioManager.skip(guildId);
  }

  jumpTo(guildId: string, trackNumber: number): { message: string } {
    const queue = this.queueMap.get(guildId);
    if (!queue || queue.length === 0) {
      throw new Error('Não há músicas na fila para pular.');
    }

    if (!Number.isInteger(trackNumber) || trackNumber < 1 || trackNumber > queue.length) {
      throw new Error(`Número inválido. Informe um valor entre 1 e ${queue.length}.`);
    }

    const targetIndex = trackNumber - 1;
    const target = queue[targetIndex]!;
    const newQueue = queue.slice(targetIndex);
    this.queueMap.set(guildId, newQueue);

    this.skip(guildId);

    return {
      message: `⏭️ Pulando para: **${target.name}**`,
    };
  }

  pause(guildId: string): boolean {
    return this.client.audioManager.pause?.(guildId) ?? false;
  }

  resume(guildId: string): boolean {
    return this.client.audioManager.resume?.(guildId) ?? false;
  }

  getQueue(guildId: string): { current: IMusicQueueItem | null; queue: IMusicQueueItem[] } {
    const current = this.currentTrackMap.get(guildId) ?? null;
    const queue = this.queueMap.get(guildId) ?? [];
    return { current, queue };
  }

  public async clearQueue(guildId: string): Promise<void> {
    await this.queueMap.delete(guildId);
    await this.currentTrackMap.delete(guildId);
    await this.connectionParamsMap.delete(guildId);
    await this.jukeboxStateMap.delete(guildId);
    await this.client.audioManager.pause?.(guildId);
    return;
  }

  setVolume(guildId: string, volume: number): void {
    this.client.audioManager.setVolume(guildId, Math.max(0, Math.min(1, volume / 100)));
  }

  getVolume(guildId: string): number {
    return Math.round(this.client.audioManager.getVolume(guildId) * 100);
  }
}
