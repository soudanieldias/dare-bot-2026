import { commandArrays } from '@/commands/index.js';
import type { IDareClient } from '@/interfaces/index.js';
import { logger, config } from '@/shared/index.js';
import { Collection, REST, Routes } from 'discord.js';

export class CommandLoaderModule {
  constructor(private readonly client: IDareClient) {}
  public async bootstrap(): Promise<void> {
    try {
      logger.info('Commands', 'Bootstraping CommandLoaderModule.');

      const { clientId, token } = config.discord;

      if (!clientId) {
        return logger.error(
          'Commands',
          'DISCORD_CLIENT_ID is not set. Please set it in the .env file.'
        );
      }

      this.client.commands = new Collection();

      const commandsData = commandArrays.map((command) => {
        this.client.commands.set(command.data.name, command);
        return command.data.toJSON();
      });

      const rest = new REST({ version: '10' }).setToken(token);

      await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
      logger.info('Commands', 'Commands loaded successfully.');
    } catch (error) {
      logger.error('Commands', `Failed to load commands: ${error}`);
    }
  }
}
