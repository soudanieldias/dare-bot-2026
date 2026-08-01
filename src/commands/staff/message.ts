import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Interaction,
} from 'discord.js';
import type { ICommand, IDareClient } from '@/interfaces/index.js';
import { logger } from '@/shared/index.js';

export const messageCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('message')
    .setDescription('Comandos de Mensagens')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sc) =>
      sc
        .setName('clearmessages')
        .setDescription('Limpa o Chat')
        .addIntegerOption((quantity) =>
          quantity
            .setName('quantity')
            .setDescription('Quantas mensagens deseja deletar? (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    ) as ICommand['data'],

  category: 'staff',

  async execute(_client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== 'clearmessages') return;

    try {
      const hasAdminRole = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      if (!hasAdminRole) {
        await interaction.reply({
          content: 'ERRO: Não Autorizado!!!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const quantity = interaction.options.getInteger('quantity', true);
      const channel = interaction.channel;

      if (!channel || !('bulkDelete' in channel)) {
        await interaction.reply({
          content: 'Este comando só pode ser usado em canais de texto do servidor.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const messagesDeleted = await channel.bulkDelete(quantity, true);

      await interaction.reply({
        content: `${messagesDeleted.size} mensagens foram deletadas do canal`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error(
        'ClearMessages',
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );

      const content =
        'Não foi possível limpar as mensagens. Verifique permissões e tente novamente.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
      }
    }
  },
};
