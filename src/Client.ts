import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { IDareClient } from './interfaces/index.js';

const partials: Partials[] = [
  Partials.User,
  Partials.Channel,
  Partials.GuildMember,
  Partials.Message,
  Partials.Reaction,
  Partials.GuildScheduledEvent,
  Partials.ThreadMember,
  Partials.SoundboardSound,
  Partials.Poll,
  Partials.PollAnswer,
];

const intents: GatewayIntentBits[] = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildExpressions,
  GatewayIntentBits.GuildIntegrations,
  GatewayIntentBits.GuildWebhooks,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildMessageTyping,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessageReactions,
  GatewayIntentBits.DirectMessageTyping,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildScheduledEvents,
  GatewayIntentBits.AutoModerationConfiguration,
  GatewayIntentBits.AutoModerationExecution,
  GatewayIntentBits.GuildMessagePolls,
  GatewayIntentBits.DirectMessagePolls,
];

let instance: IDareClient | null = null;

export function getDiscordClient(): IDareClient {
  if (!instance) {
    const client = new Client({ intents, partials }) as IDareClient;
    client.pads = new Map();
    client.commands = new Collection();
    instance = client;
  }
  return instance;
}
