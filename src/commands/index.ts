import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { type IDareClient } from '@/interfaces/index.js';
import * as developer from './developer/index.js';
import * as features from './features/index.js';
import * as help from './help/index.js';
import * as music from './music/index.js';
import * as staff from './staff/index.js';

export interface SlashCommand {
  data: { name: string; toJSON: () => unknown };
  execute: (
    client: IDareClient,
    interaction: ChatInputCommandInteraction | ButtonInteraction
  ) => Promise<void>;
}

export const commandArrays: SlashCommand[] = [
  ...developer.commands,
  ...features.commands,
  ...help.commands,
  ...music.commands,
  ...staff.commands,
];

export const commandMap = new Map<string, SlashCommand>(
  commandArrays.map((cmd) => [cmd.data.name, cmd])
);
