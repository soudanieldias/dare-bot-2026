import { ActivityType } from 'discord.js';
import { config, logger } from '@/shared/index.js';
import type { IDareClient } from '@/interfaces/index.js';

export class ActivityModule {
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {
    this.client.once('clientReady', () => {
      logger.info('Activity', 'Inicializando Activity do BOT.');
      this.client.user?.setActivity(config.discord.activityText, {
        type: config.discord.activityType as unknown as ActivityType,
        url: 'https://diasitservices.com.br/',
      });
      this.client.user?.setPresence({ status: 'online' });
      logger.info('Activity', 'Activity Carregada com Sucesso.');
    });
  }

  updateActivity(activity: string, type: ActivityType): void {
    this.client.user?.setActivity(activity, {
      type,
      url: 'https://diasitservices.com.br/',
    });
    logger.info('Activity', `Activity atualizada para: ${activity} (${ActivityType[type]})`);
  }
}
