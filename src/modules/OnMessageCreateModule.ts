import type { IDareClient } from '@/interfaces/index.js';
import { config, logger } from '@/shared/index.js';
import { Events, type Message } from 'discord.js';

export class OnMessageCreateModule {
  private client: IDareClient;
  constructor(client: IDareClient) {
    this.client = client;
  }

  public bootstrap(): void {
    this.client.on(Events.MessageCreate, async (message: Message) => {
      try {
        if (message.author.bot || !message.content.startsWith(config.discord.prefix)) return;

        // TODO: Implement command router and logic here
      } catch (error) {
        logger.error('OnMessageCreate', `Error processing message: ${error}`);
      }
    });
  }
}
