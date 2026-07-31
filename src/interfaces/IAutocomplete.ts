import type { AutocompleteInteraction } from 'discord.js';

export interface IAutocomplete {
  command: string;
  subcommand?: string;
}
