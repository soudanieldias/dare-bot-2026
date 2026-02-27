import { AppDataSource } from '@/database/DatabaseSource.js';
import { GuildRepository } from '@/database/repositories/GuildRepository.js';
import { type IDareClient } from '@/interfaces/index.js';
import { logger } from '@/shared/index.js';

export class DatabaseModule {
  async bootstrap(): Promise<void> {
    try {
      await AppDataSource.initialize();
      logger.info('Database', 'Connection established.');

      logger.info('Database', 'Checking for pending migrations...');
      const pendingMigrations = await AppDataSource.runMigrations();

      if (pendingMigrations.length > 0) {
        logger.info('Database', `${pendingMigrations.length} migrations applied successfully.`);
      } else {
        logger.debug('Database', 'No pending migrations found.');
      }
    } catch (error) {
      await logger.critical(
        'Database',
        `Bootstrap failed: ${error}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  public static async populateServers(client: IDareClient): Promise<void> {
    try {
      const guildRepo = new GuildRepository();
      const guilds = client.guilds.cache;

      for (const [, guild] of guilds) {
        await guildRepo.upsert({
          id: guild.id,
          name: guild.name,
          iconURL: guild.iconURL() ?? null,
          bannerURL: guild.bannerURL() ?? null,
        });
      }

      logger.info('Database', 'Guildas populadas no banco de dados com sucesso.');
    } catch (error) {
      logger.error('Database', `Erro ao popular guilds: ${error}`);
    }
  }
}
