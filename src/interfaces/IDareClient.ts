import type { Client } from 'discord.js';

export interface IDareClient extends Client {
  commands: Map<string, any>;
  pads?: Map<string, { name: string; path: string }>;
}
