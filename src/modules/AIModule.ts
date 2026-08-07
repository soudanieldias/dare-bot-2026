import type { IDareClient } from '@/interfaces/IDareClient.js';
import { config, logger } from '@/shared/index.js';

export class AiModule {
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {
    logger.info('AiModule', 'AI Module initialized.');
  }
}
