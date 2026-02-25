import { getDataSource } from '@/database/DatabaseClient.js';
import { logger } from '@/shared/Logger.js';

export class DatabaseModule {
  async bootstrap(): Promise<void> {
    try {
      logger.info('DataBase', 'Inicializando MySQL...');
      await getDataSource();
      logger.info('DataBase', 'MySQL Inicializado com Sucesso!');
    } catch (error) {
      logger.error('DataBase', error);
    }
  }
}
