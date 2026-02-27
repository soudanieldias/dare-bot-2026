import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type Interaction,
} from 'discord.js';
import { getI18n, replaceParams } from '@/utils/index.js';
import { sendEmbed, SystemResourceHelper } from '@/utils/index.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import { Stats } from 'node:fs';

export default {
  data: new SlashCommandBuilder()
    .setName('getresources')
    .setDescription('Obtenha os recursos do bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: 'dev',

  execute: async (client: IDareClient, interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const t = getI18n(interaction.locale);
    const isDeveloper = interaction.user.id === process.env.DEV_ID;

    if (!isDeveloper) return sendEmbed(interaction, t.common.unauthorized);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await sendEmbed(
        interaction,
        `RAM do Processo: ${SystemResourceHelper.getStats().process.ram}`
      );
    } catch (err: any) {
      console.error(err);
      await sendEmbed(
        interaction,
        replaceParams(t.common.underConstruction, { message: err.message })
      );
    }
  },
};
