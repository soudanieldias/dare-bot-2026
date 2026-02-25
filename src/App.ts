import { getDiscordClient } from './Client.js';
import { logger } from './shared/Logger.js';

export class App {
  private client = getDiscordClient();

  constructor() {}

  public bootstrap(): void {
    logger.info('App', 'Starting Dare Bot 2026...');
    return;
  }
}
