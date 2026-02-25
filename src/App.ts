import { getDiscordClient } from './Client.js';
import type { IDareClient } from './interfaces/index.js';
import {
  ActivityModule,
  DatabaseModule,
  OnClientReadyModule,
  OnInteractionModule,
  OnMessageCreateModule,
} from './modules/index.js';
import { config, logger } from './shared/index.js';

export class App {
  private client: IDareClient = getDiscordClient();

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
    await new OnClientReadyModule(this.client).bootstrap();
    await new ActivityModule(this.client).bootstrap();
    await new OnInteractionModule(this.client).bootstrap();
    await new OnMessageCreateModule(this.client).bootstrap();
  }
}
