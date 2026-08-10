import type { IDareClient } from '@/interfaces/index.js';
import type { AutocompleteInteraction } from 'discord.js';
import { JUKEBOX_ROOT } from '@/constants/index.js';
import { readdir } from 'node:fs/promises';

export class AutocompleteModule {
  constructor(private readonly client: IDareClient) {}

  public async bootstrap(): Promise<void> {
    this.client.autocompleteModule = this;
  }

  public async execute(interaction: AutocompleteInteraction): Promise<void> {
    switch (interaction.commandName) {
      case 'music':
        return this.music(interaction);

      case 'admin':
        return this.admin(interaction);

      case 'playlist':
        return this.playlist(interaction);

      default:
        return;
    }
  }

  private getJukeboxCategories = async (): Promise<string[]> => {
    const entries = await readdir(JUKEBOX_ROOT, {
      withFileTypes: true,
    });

    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  };

  private async music(interaction: AutocompleteInteraction) {
    if (interaction.options.getSubcommand() === 'jukebox') {
      const focused = interaction.options.getFocused();

      const categories = await this.getJukeboxCategories();

      const filtered = categories
        .filter((category) => category.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25);

      await interaction.respond(
        filtered.map((category) => ({
          name: category,
          value: category,
        }))
      );
    }
  }

  private async admin(interaction: AutocompleteInteraction) {
    // ...
  }

  private async playlist(interaction: AutocompleteInteraction) {
    // ...
  }
}
