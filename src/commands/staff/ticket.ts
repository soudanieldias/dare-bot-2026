import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type Interaction,
} from 'discord.js';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { ICommand } from '@/interfaces/ICommand.js';

export const ticketCommand: ICommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistema de tickets configurável')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sc) =>
      sc
        .setName('config')
        .setDescription('Configura o sistema de tickets')
        .addChannelOption((o) =>
          o.setName('canal').setDescription('Canal para o painel de tickets').setRequired(true)
        )
        .addChannelOption((o) =>
          o.setName('logs').setDescription('Canal de logs dos tickets').setRequired(true)
        )
        .addChannelOption((o) =>
          o
            .setName('categoria')
            .setDescription('Categoria onde os canais de ticket serão criados')
            .setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName('cargo').setDescription('Cargo da equipe de atendimento').setRequired(true)
        )
        .addRoleOption((o) =>
          o.setName('mention').setDescription('Cargo a ser mencionado em novos tickets').setRequired(false)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('addcategory')
        .setDescription('Adiciona uma categoria de ticket')
        .addStringOption((o) => o.setName('name').setDescription('Nome da categoria').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji da categoria').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('Descrição').setRequired(false))
        .addStringOption((o) => o.setName('color').setDescription('Cor hex (ex: #ff6600)').setRequired(false))
    )
    .addSubcommand((sc) =>
      sc.setName('removecategory').setDescription('Remove uma categoria de ticket')
    )
    .addSubcommand((sc) =>
      sc.setName('editcategory').setDescription('Edita uma categoria de ticket')
    ) as ICommand['data'],

  category: 'staff',

  async execute(client: IDareClient, interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!client.ticketModule) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'config') {
      await client.ticketModule.handleConfigCommand(interaction);
      return;
    }
    if (subcommand === 'addcategory') {
      await client.ticketModule.handleAddCategoryCommand(interaction);
      return;
    }
    if (subcommand === 'removecategory') {
      await client.ticketModule.handleRemoveCategoryCommand(interaction);
      return;
    }
    if (subcommand === 'editcategory') {
      await client.ticketModule.handleEditCategoryCommand(interaction);
      return;
    }
  },
};
