import type { Client } from 'discord.js';

export interface IDareClient extends Client {
  pads: Map<string, { name: string; path: string }>;
}
