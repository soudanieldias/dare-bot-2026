import { getDiscordClient } from './Client.js';
import { DatabaseModule, OnReadyModule } from './modules/index.js';
import { config } from './shared/Config.js';
import { logger } from './shared/Logger.js';

export class App {
  private client = getDiscordClient();

  constructor() {}

  public async bootstrap(): Promise<void> {
    logger.info('App', 'Starting Dare Bot 2026...');
    try {
      await new DatabaseModule().bootstrap();

      await this.initializeModules();

      await this.client.login(config.discord.token);
      logger.info('App', 'Dare Bot Initialized successfully.');
    } catch (error) {
      logger.error('App', `Bootstrap failed: ${error}`);
      process.exit(1);
    }
  }

  private async initializeModules(): Promise<void> {
    await new OnReadyModule(this.client).bootstrap();
  }
}
