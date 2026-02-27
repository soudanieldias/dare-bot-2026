import * as readline from 'readline';
import { getDiscordClient } from './Client.js';
import type { IDareClient } from './interfaces/index.js';
import {
  ActivityModule,
  AudioManagerModule,
  CommandLoaderModule,
  DatabaseModule,
  OnClientReadyModule,
  OnInteractionModule,
  OnMessageCreateModule,
  SoundpadModule,
  SoundModule,
} from './modules/index.js';
import { config, logger } from './shared/index.js';
import { AppDataSource } from './database/DatabaseSource.js';

export class App {
  private client: IDareClient = getDiscordClient();
  private isShuttingDown = false;

  constructor() {
    this.registerGracefulShutdown();
  }

  public async bootstrap(): Promise<void> {
    logger.info('App', 'Starting Dare Bot 2026...');
    try {
      await new DatabaseModule().bootstrap();

      await this.initializeModules();

      await this.client.login(config.discord.token);
      logger.info('App', 'Dare Bot Initialized successfully.');
    } catch (error) {
      await logger.critical(
        'App',
        `Bootstrap failed: ${error}`,
        error instanceof Error ? error : undefined
      );
      process.exit(1);
    }
  }

  private registerGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info('App', `Received ${signal}, shutting down gracefully...`);

      try {
        this.client.audioManager?.shutdown();
        this.client.destroy();
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
        }
        logger.info('App', 'Shutdown complete.');
        process.exit(0);
      } catch (error) {
        logger.error('App', `Shutdown error: ${error}`);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    if (process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin });
      rl.on('line', (line) => {
        if (line.trim().toLowerCase() === 'stop') {
          void shutdown('stop');
        }
      });
    }
  }

  private async initializeModules(): Promise<void> {
    await new OnClientReadyModule(this.client).bootstrap();
    await new ActivityModule(this.client).bootstrap();
    await new OnInteractionModule(this.client).bootstrap();
    await new OnMessageCreateModule(this.client).bootstrap();
    await new CommandLoaderModule(this.client).bootstrap();

    // Initialize Sound System
    await new AudioManagerModule(this.client).bootstrap();
    await new SoundModule(this.client).bootstrap();
    await new SoundpadModule(this.client).bootstrap();
  }
}
