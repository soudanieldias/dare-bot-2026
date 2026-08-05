import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type Interaction,
  CommandInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { ICommand, IDareClient } from '@/interfaces/index.js';
import { getI18n, replaceParams, sendEmbed, SystemResourceHelper } from '@/utils/index.js';
import { Stats } from 'node:fs';

export const aiChatCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('aichat')
    .setDescription('Converse com a IA')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: 'dev',

  execute: async (client: IDareClient, interaction: Interaction): Promise<void> => {
    if (!interaction.isChatInputCommand()) return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.reply({
        content: 'Comando em desenvolvimento. Em breve estará disponível.',
        flags: MessageFlags.Ephemeral,
      });

      return;
    } catch (err: any) {
      console.error(err);
      return;
    }
  },
};
