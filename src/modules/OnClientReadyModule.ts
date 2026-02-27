import { Events } from 'discord.js';
import { logger } from '@/shared/index.js';
import type { IDareClient } from '@/interfaces/index.js';
import { DatabaseModule } from './DatabaseModule.js';

export class OnClientReadyModule {
  constructor(private readonly client: IDareClient) {}

  public bootstrap(): void {
    this.client.once(Events.ClientReady, async (readyClient) => {
      this.printStatus(readyClient as IDareClient);
      await new DatabaseModule().populateServers(readyClient as IDareClient);
    });
  }

  private printStatus(readyClient: IDareClient): void {
    const guilds = readyClient.guilds.cache;
    const guildList = readyClient.guilds.cache
      .map((guild, id) => {
        const isLast = id === guilds.lastKey();
        const branch = isLast ? '      └──' : '├──';
        return `${branch} ${guild.name} (${guild.id})`;
      })
      .join('\n');

    logger.startup(`
      ==============================================
      BOT ONLINE: ${readyClient.user?.tag}
      STATUS: Ready to work!
      USERS: ${readyClient.users.cache.size} (cached)
      GUILDS: ${guilds.size}
      ----------------------------------------------
      GUILD LIST:
      ${guildList || '      (none)'}
      ==============================================
    `);
  }
}
