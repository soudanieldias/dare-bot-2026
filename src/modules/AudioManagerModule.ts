import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  AudioResource,
} from '@discordjs/voice';
import { type IDareClient } from '@/interfaces/IDareClient.js';
import { logger } from '@/shared/index.js';

interface AudioQueueItem {
  source: string;
  name: string;
  type: 'MUSIC' | 'EFFECT';
}

export class AudioManagerModule {
  private connectionMap = new Map<string, VoiceConnection>();
  private playerMap = new Map<string, AudioPlayer>();
  private queueMap = new Map<string, AudioQueueItem[]>();

  constructor(private readonly client: IDareClient) {}

  public async bootstrap(): Promise<void> {
    logger.info('Audio', 'AudioManagerModule inicializado (Unificado).');
  }

  private getOrCreatePlayer(guildId: string, channelId: string, adapterCreator: any): AudioPlayer {
    let player = this.playerMap.get(guildId);

    if (!player) {
      player = createAudioPlayer();

      player.on(AudioPlayerStatus.Idle, () => {
        this.processQueue(guildId);
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

  public async play(guildId: string, channelId: string, adapterCreator: any, item: AudioQueueItem) {
    const player = this.getOrCreatePlayer(guildId, channelId, adapterCreator);
    const resource = createAudioResource(item.source);

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
      const resource = createAudioResource(nextItem.source);
      player.play(resource);
      logger.info('Audio', `Tocando agora (Fila): ${nextItem.name}`);
    }
  }

  private cleanup(guildId: string) {
    this.connectionMap.get(guildId)?.destroy();
    this.connectionMap.delete(guildId);
    this.playerMap.delete(guildId);
    this.queueMap.delete(guildId);
    logger.info('Audio', `Recursos limpos para a guilda: ${guildId}`);
  }

  public stop(guildId: string) {
    this.playerMap.get(guildId)?.stop();
    this.cleanup(guildId);
  }
}
