import type {
  Interaction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';
import type { IDareClient } from './IDareClient.js';

export interface ICommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  category?: string;
  execute: (
    client: IDareClient,
    interaction: Interaction,
    category?: string
  ) => Promise<void>;
}
