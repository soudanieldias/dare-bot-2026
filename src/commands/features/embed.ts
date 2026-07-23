import type { Interaction } from 'discord.js';
import type { ICommand, IDareClient } from '@/interfaces/index.js';
import { CommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const embedCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Comandos de Embeds')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
  category: 'embed',
  async execute(client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    return await client.embedModule?.bootstrap(client, interaction);
  },
};
