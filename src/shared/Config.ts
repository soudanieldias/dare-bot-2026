import 'dotenv/config';

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN ?? '',
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    devId: process.env.DEV_ID ?? '',
    debug: process.env.DEBUG === 'true',
    prefix: process.env.BOT_PREFIX ?? '//',
    activityText: process.env.DEFAULT_ACTIVITY_TEXT ?? 'Dare Bot 2026 v2',
    activityType: process.env.DEFAULT_ACTIVITY_TYPE ?? 'PLAYING',
  },
  database: {
    url: process.env.DATABASE_URL,
    logging: process.env.DATABASE_LOGGING === 'true',
  },
  voice: {
    bootGuild: process.env.DEFAULT_GUILD_ID || '',
    bootChannel: process.env.DEFAULT_CHANNEL_ID || '',
    connectOnStartup: process.env.CONNECT_ON_STARTUP,
  },
  logging: {
    webhookUrl: process.env.LOG_WEBHOOK_URL ?? '',
    preferredGuildId: process.env.LOG_GUILD_ID ?? '',
    preferredChannelId: process.env.LOG_CHANNEL_ID ?? '',
  },
  server: {
    port: parseInt(process.env.SERVER_PORT ?? '3000', 10) || 3000,
  },
  bot: {
    name: process.env.BOT_NAME ?? 'Dare Bot 2026',
    version: process.env.BOT_VERSION ?? 'v2.0.0',
  },
} as const;
