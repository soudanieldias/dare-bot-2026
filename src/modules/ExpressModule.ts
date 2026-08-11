import express from 'express';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import path from 'node:path';
import type { IDareClient } from '@/interfaces/index.js';
import { config, logger } from '@/shared/index.js';

interface GuildAudioStatus {
  guildId: string;
  guildName: string;
  channelId: string | null;
  channelName: string | null;
  isConnected: boolean;
  currentTrack: { name: string; type: string } | null;
  queue: Array<{ name: string; type: string }>;
  volume: number;
}

interface StatusMessage {
  type: 'status';
  status: GuildAudioStatus[];
  updatedAt: string;
}

export class ExpressModule {
  private readonly app = express();
  private readonly server = createServer(this.app);
  private wss: WebSocketServer | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly client: IDareClient) {}

  public async bootstrap(): Promise<void> {
    this.app.set('trust proxy', true);
    this.app.use(express.static(path.resolve(process.cwd(), 'public')));

    this.app.get('/', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
    });

    this.app.get('/api/status', async (_req, res) => {
      const status = await this.buildStatus();
      res.json({
        server: { port: config.server.port },
        status,
        updatedAt: new Date().toISOString(),
      });
    });

    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
    this.wss.on('connection', (socket) => {
      void this.sendStatus(socket);
    });

    const port = config.server.port;
    this.server.listen(port, () => {
      logger.info('Express', `Servidor HTTP iniciado em http://localhost:${port}`);
    });

    this.broadcastTimer = setInterval(() => {
      void this.broadcastStatus();
    }, 1500);
  }

  private async sendStatus(socket: WebSocket): Promise<void> {
    if (socket.readyState !== socket.OPEN) return;
    const message: StatusMessage = {
      type: 'status',
      status: await this.buildStatus(),
      updatedAt: new Date().toISOString(),
    };
    socket.send(JSON.stringify(message));
  }

  private async broadcastStatus(): Promise<void> {
    if (!this.wss) return;
    const message: StatusMessage = {
      type: 'status',
      status: await this.buildStatus(),
      updatedAt: new Date().toISOString(),
    };

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  private async buildStatus(): Promise<GuildAudioStatus[]> {
    const guilds = Array.from(this.client.guilds.cache.values());

    const entries = await Promise.all(
      guilds.map(async (guild) => {
        const channelId = this.client.audioManager.getConnectionChannelId(guild.id);
        const { current, queue } = this.client.musicModule.getQueue(guild.id);
        const channelName = channelId ? await this.lookupChannelName(guild.id, channelId) : null;
        const volume = this.client.musicModule.getVolume(guild.id);

        return {
          guildId: guild.id,
          guildName: guild.name,
          channelId: channelId || null,
          channelName,
          isConnected: Boolean(channelId),
          currentTrack: current ? { name: current.name, type: current.type } : null,
          queue: queue.map((item) => ({ name: item.name, type: item.type })),
          volume,
        };
      })
    );

    return entries;
  }

  private async lookupChannelName(guildId: string, channelId: string): Promise<string | null> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;

    const channel =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null));

    return channel?.name ?? null;
  }

  private renderHtml(): string {
    return '';
  }
}
