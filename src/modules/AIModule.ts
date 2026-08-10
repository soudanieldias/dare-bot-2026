import type { IDareClient } from '@/interfaces/IDareClient.js';
import { config, logger } from '@/shared/index.js';

export class AiModule {
  constructor(private readonly client: IDareClient) {}

  public async bootstrap(): Promise<void> {
    logger.info('AiModule', 'AI Module initialized.');
  }
}
