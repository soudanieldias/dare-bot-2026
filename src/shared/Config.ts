import 'dotenv/config';

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN ?? '',
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    devId: process.env.DEV_ID ?? '',
    debug: process.env.DEBUG === 'true',
    prefix: process.env.BOT_PREFIX ?? '//',
    activityText: process.env.DEFAULT_ACTIVITY_TEXT ?? 'Dare Bot 2026',
    activityType: process.env.DEFAULT_ACTIVITY_TYPE ?? 'PLAYING',
  },
  database: {
    url: process.env.DATABASE_URL,
    logging: process.env.DATABASE_LOGGING === 'true',
  },
} as const;
