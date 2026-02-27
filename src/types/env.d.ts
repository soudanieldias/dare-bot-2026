declare namespace NodeJS {
  interface ProcessEnv {
    // Discord Bot
    BOT_NAME: string;
    BOT_DESCRIPTION: string;
    DISCORD_TOKEN: string;
    DISCORD_CLIENT_ID: string;
    DEV_ID: string;
    BOT_PREFIX: string;

    // Database
    DATABASE_URL: string;
    DATABASE_TYPE: 'postgres' | 'mysql';
    DATABASE_HOST: string;
    DATABASE_PORT: string;
    DATABASE_USER: string;
    DATABASE_PASSWORD: string;
    DATABASE_NAME: string;
    DATABASE_SSL: 'true' | 'false';
    DATABASE_LOGGING: 'true' | 'false';

    // System
    NODE_ENV: 'development' | 'production' | 'test';
    DEBUG: 'true' | 'false';
    LOG_WEBHOOK_URL?: string;

    // Activity
    DEFAULT_ACTIVITY_TEXT: string;
    DEFAULT_ACTIVITY_TYPE: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING';

    // Voice
    DEFAULT_GUILD_ID: string;
    DEFAULT_CHANNEL_ID: string;
    CONNECT_ON_STARTUP: boolean;
  }
}
