import { commandArrays } from '@/commands/index.js';
import type { IDareClient } from '@/interfaces/index.js';
import { logger, config } from '@/shared/index.js';
import { SystemResourceHelper } from '@/utils/index.js';
import { Collection, REST, Routes } from 'discord.js';

export class CommandLoaderModule {
  constructor(private readonly client: IDareClient) {}
  public async bootstrap(): Promise<void> {
    try {
      logger.info('Commands', 'Bootstraping CommandLoaderModule.');

      const { clientId, token } = config.discord;

      if (!clientId) {
        await logger.critical('Commands', 'DISCORD_CLIENT_ID is not set. Set it in .env');
        return;
      }

      this.client.commands = new Collection();

      const commandsData = commandArrays.map((command) => {
        this.client.commands.set(command.data.name, command);
        return command.data.toJSON();
      });

      const rest = new REST({ version: '10' }).setToken(token);

      await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
      logger.info('Commands', 'Commands loaded successfully.');

      const stats = SystemResourceHelper.getStats();
      logger.info('System', `Comandos carregados. RAM atual: ${stats.process.ram}`);
    } catch (error) {
      await logger.critical(
        'Commands',
        `Failed to load commands: ${error}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
