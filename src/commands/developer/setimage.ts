import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type Interaction,
} from 'discord.js';
import { getI18n, replaceParams } from '@/utils/index.js';
import { sendEmbed } from '@/utils/index.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setimage')
    .setDescription('Mude avatar do bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption((option) =>
      option.setName('avatar').setDescription('O avatar').setRequired(true)
    ),
  category: 'dev',

  execute: async (client: IDareClient, interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const t = getI18n(interaction.locale);
    const isDeveloper = interaction.user.id === process.env.DEV_ID;

    if (!isDeveloper) return sendEmbed(interaction, t.common.unauthorized);

    const avatar = interaction.options.getAttachment('avatar', true);

    if (!avatar.contentType?.startsWith('image/')) {
      return sendEmbed(interaction, t.commands.setimage.errorInvalidImage);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await client.user?.setAvatar(avatar.url);
      await sendEmbed(interaction, t.commands.setimage.success);
    } catch (err: any) {
      console.error(err);
      await sendEmbed(
        interaction,
        replaceParams(t.commands.setimage.errorGeneric, { message: err.message })
      );
    }
  },
};
