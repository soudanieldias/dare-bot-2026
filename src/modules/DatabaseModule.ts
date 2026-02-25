import { AppDataSource } from '@/database/DatabaseSource.js';
import { logger } from '@/shared/Logger.js';

export class DatabaseModule {
  async bootstrap(): Promise<void> {
    try {
      await AppDataSource.initialize();
      logger.info('Database', 'Connection established.');
    } catch (error) {
      logger.error('DataBase', error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }
}
