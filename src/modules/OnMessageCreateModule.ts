import type { IDareClient } from '@/interfaces/index.js';
import { config, logger } from '@/shared/index.js';
import { Events, type Message } from 'discord.js';

export class OnMessageCreateModule {
  private client: IDareClient;
  constructor(client: IDareClient) {
    this.client = client;
  }

  public async bootstrap(): Promise<void> {
    this.client.on(Events.MessageCreate, async (message: Message) => {
      try {
        if (message.author.bot) return;

        if (this.client.ticketModule) {
          await this.client.ticketModule.handleMessageCreate(message);
        }

        if (!message.content.startsWith(config.discord.prefix)) return;

        // TODO: Implement command router and logic here
      } catch (error) {
        logger.error('OnMessageCreate', `Error processing message: ${error}`);
      }
    });
  }
}
