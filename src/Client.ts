import { Client, GatewayIntentBits, Partials } from 'discord.js';
import type { IDareClient } from './interfaces/index.js';

const partials: [] | Array<Partials> = [
  Partials.Channel,
  Partials.Message,
  Partials.GuildMember,
  Partials.GuildScheduledEvent,
  Partials.Poll,
  Partials.PollAnswer,
  Partials.Reaction,
  Partials.SoundboardSound,
  Partials.ThreadMember,
  Partials.User,
];

const intents: [] | Array<GatewayIntentBits> = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.DirectMessages,
];

let instance: IDareClient | null = null;

export function getDiscordClient(): IDareClient {
  if (!instance) {
    const client = new Client({ intents, partials }) as IDareClient;
    client.pads = new Map();
    client.commands = new Map();
    instance = client;
  }
  return instance;
}
