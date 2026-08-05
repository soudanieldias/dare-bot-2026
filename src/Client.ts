import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { IDareClient } from './interfaces/index.js';

const partials: Partials[] = [
  Partials.Channel,
  Partials.GuildMember,
  Partials.GuildScheduledEvent,
  Partials.Message,
  Partials.Poll,
  Partials.PollAnswer,
  Partials.Reaction,
  Partials.SoundboardSound,
  Partials.ThreadMember,
  Partials.User,
];

const intents: GatewayIntentBits[] = [
  GatewayIntentBits.AutoModerationConfiguration,
  GatewayIntentBits.AutoModerationExecution,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessagePolls,
  GatewayIntentBits.DirectMessageReactions,
  GatewayIntentBits.DirectMessageTyping,
  GatewayIntentBits.GuildExpressions,
  GatewayIntentBits.GuildIntegrations,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessagePolls,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageTyping,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildWebhooks,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildScheduledEvents,
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
