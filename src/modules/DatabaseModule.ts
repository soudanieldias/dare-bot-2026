import { AppDataSource } from '@/database/DatabaseSource.js';
import { logger } from '@/shared/Logger.js';

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
      logger.error('Database', `Bootstrap failed: ${error}`);
      throw error;
    }
  }
}
