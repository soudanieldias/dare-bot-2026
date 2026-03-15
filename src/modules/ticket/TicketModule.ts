import {
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
} from 'discord.js';
import discordTranscripts from 'discord-html-transcripts';
import type { IDareClient } from '@/interfaces/IDareClient.js';
import type { ITicketCategory } from '@/interfaces/ITicketCategory.js';
import { GuildRepository } from '@/database/repositories/GuildRepository.js';
import { GuildSettingsRepository } from '@/database/repositories/GuildSettingsRepository.js';
import { TicketRepository } from '@/database/repositories/TicketRepository.js';
import { logger } from '@/shared/Logger.js';
import { DEFAULT_TICKET_CATEGORIES } from './constants/defaultTicketCategories.js';
import { TICKET_CUSTOM_IDS, isTicketInteraction } from './constants/ticketCustomIds.js';
import {
  getTicketCategoriesForGuild,
  buildSelectMenuFromCategories,
  normalizeCategoryId,
  validateCategoryPayload,
} from './utils/ticketHelpers.js';

interface IPendingConfig {
  channelId: string;
  logsId: string;
  categoryId: string;
  roleId: string;
  mentionId: string | null;
}

export class TicketModule {
  private guildRepo = new GuildRepository();
  private settingsRepo = new GuildSettingsRepository();
  private ticketRepo = new TicketRepository();
  private pendingConfig = new Map<string, IPendingConfig>();

  constructor(private client: IDareClient) {}

  async bootstrap(): Promise<void> {
    this.client.ticketModule = this;
    logger.info('TicketModule', 'Bootstrapping TicketModule.');
  }

  getDefaultCategories(): ITicketCategory[] {
    return [...DEFAULT_TICKET_CATEGORIES];
  }

  async handleButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!isTicketInteraction(interaction.customId)) return false;
    const id = interaction.customId;
    switch (id) {
      case TICKET_CUSTOM_IDS.close:
        return this.processTicketClose(interaction);
      case TICKET_CUSTOM_IDS.claim:
        return this.processTicketClaim(interaction);
      case TICKET_CUSTOM_IDS.reopen:
        return this.processTicketReopen(interaction);
      case TICKET_CUSTOM_IDS.transcript:
        return this.processTicketTranscript(interaction);
      case TICKET_CUSTOM_IDS.mention:
        return this.processTicketMention(interaction);
      case TICKET_CUSTOM_IDS.closeMessage:
        return this.processTicketCloseMessage(interaction);
      default:
        return false;
    }
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (!isTicketInteraction(interaction.customId)) return false;
    const id = interaction.customId;
    switch (id) {
      case TICKET_CUSTOM_IDS.categorySelect:
        return this.processCategorySelect(interaction);
      case TICKET_CUSTOM_IDS.removeCategorySelect:
        return this.processRemoveCategorySelect(interaction);
      case TICKET_CUSTOM_IDS.editCategorySelect:
        return this.processEditCategorySelect(interaction);
      default:
        return false;
    }
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!isTicketInteraction(interaction.customId)) return false;
    const id = interaction.customId;
    switch (id) {
      case TICKET_CUSTOM_IDS.configModal:
        return this.processConfigModal(interaction);
      case TICKET_CUSTOM_IDS.addCategoryModal:
        return this.processAddCategoryModal(interaction);
      default:
        if (id.startsWith(TICKET_CUSTOM_IDS.editCategoryModal)) {
          return this.processEditCategoryModal(interaction);
        }
        return false;
    }
  }

  async handleConfigCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'Este comando só pode ser usado em um servidor.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const canal = interaction.options.getChannel('canal');
    const logs = interaction.options.getChannel('logs');
    const categoria = interaction.options.getChannel('categoria');
    const cargo = interaction.options.getRole('cargo');
    const mention = interaction.options.getRole('mention');

    if (!canal || !logs || !categoria || !cargo) {
      await interaction.reply({
        content: 'Preencha todos os campos obrigatórios (canal, logs, categoria, cargo).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    this.pendingConfig.set(interaction.user.id, {
      channelId: canal.id,
      logsId: logs.id,
      categoryId: categoria.id,
      roleId: cargo.id,
      mentionId: mention?.id ?? null,
    });

    const modal = new ModalBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.configModal)
      .setTitle('Configuração de Tickets');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('opentitle')
          .setLabel('Título da mensagem de abertura')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Sistema de Tickets')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('opendescription')
          .setLabel('Descrição da mensagem de abertura')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Clique no menu para abrir um ticket')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tickettitle')
          .setLabel('Título do embed do ticket')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Bem-vindo ao seu ticket')
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ticketdescription')
          .setLabel('Descrição do embed do ticket')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Como posso ajudá-lo?')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  }

  private async processConfigModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    await interaction.deferReply({ ephemeral: true });

    const pending = this.pendingConfig.get(interaction.user.id);
    this.pendingConfig.delete(interaction.user.id);

    if (!pending || !interaction.guild) {
      await interaction.editReply({
        content: 'Sessão expirada. Execute /ticket config novamente.',
      });
      return true;
    }

    await this.ensureGuildExists(interaction.guildId!, interaction.guild);

    const openTitle = interaction.fields.getTextInputValue('opentitle');
    const openDescription = interaction.fields.getTextInputValue('opendescription');
    const ticketTitle = interaction.fields.getTextInputValue('tickettitle');
    const ticketDescription = interaction.fields.getTextInputValue('ticketdescription');

    await this.settingsRepo.upsert(interaction.guildId!, {
      ticketChannelId: pending.channelId,
      ticketLogsChannelId: pending.logsId,
      ticketCategoryId: pending.categoryId,
      ticketRoleId: pending.roleId,
      mentionRoleId: pending.mentionId,
      ticketTitle,
      ticketDescription,
    });

    const categories = getTicketCategoriesForGuild(
      (await this.settingsRepo.findByGuildId(interaction.guildId!))?.ticketCategoriesJson
    );

    const categoriesText = categories
      .map((c) => `${c.emoji} **${c.name}** - ${c.description ?? ''}`)
      .join('\n')
      .slice(0, 1024);

    const icon = interaction.guild.iconURL();
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setAuthor({
        name: openTitle,
        ...(icon ? { iconURL: icon } : {}),
      })
      .setDescription(openDescription)
      .addFields({
        name: '🎫 Categorias',
        value: categoriesText || 'Nenhuma categoria configurada.',
        inline: false,
      })
      .setFooter({
        text: interaction.guild.name,
        ...(icon ? { iconURL: icon } : {}),
      });

    const menu = buildSelectMenuFromCategories(
      categories,
      TICKET_CUSTOM_IDS.categorySelect,
      'Selecione o tipo de ticket'
    );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    try {
      const ch = await interaction.guild.channels.fetch(pending.channelId);
      if (ch && 'send' in ch) {
        await (ch as { send: (opts: object) => Promise<unknown> }).send({
          embeds: [embed],
          components: [row],
        });
      }
    } catch (err) {
      await interaction.editReply({
        content: `✅ Config salva, mas falha ao enviar painel no canal: ${err instanceof Error ? err.message : String(err)}`,
      });
      return true;
    }

    await interaction.editReply({
      content: '✅ Sistema de tickets configurado com sucesso!',
    });
    return true;
  }

  private async ensureGuildExists(
    guildId: string,
    guild: { name: string; iconURL: () => string | null }
  ): Promise<void> {
    await this.guildRepo.upsert({
      id: guildId,
      name: guild.name,
      iconURL: guild.iconURL(),
    });
  }

  async handleAddCategoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId || !interaction.guild) return;

    await this.ensureGuildExists(interaction.guildId, interaction.guild);

    const name = interaction.options.getString('name', true);
    const emoji = interaction.options.getString('emoji', true);
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');

    const validation = validateCategoryPayload({
      name,
      emoji,
      ...(description ? { description } : {}),
      ...(color ? { color } : {}),
    });
    if (!validation.valid) {
      await interaction.reply({
        content: `❌ ${validation.error}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const id = normalizeCategoryId(name, emoji);
    const settings = await this.settingsRepo.findByGuildId(interaction.guildId);
    const categories: ITicketCategory[] = settings?.ticketCategoriesJson
      ? [...settings.ticketCategoriesJson]
      : [...DEFAULT_TICKET_CATEGORIES];

    if (categories.some((c) => c.id === id)) {
      await interaction.reply({
        content: '❌ Já existe uma categoria com esse nome.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    categories.push({
      id,
      name: validation.payload!.name,
      emoji: validation.payload!.emoji,
      ...(validation.payload!.description ? { description: validation.payload!.description } : {}),
      ...(validation.payload!.color ? { color: validation.payload!.color } : {}),
    });

    await this.settingsRepo.upsert(interaction.guildId, { ticketCategoriesJson: categories });

    await interaction.reply({
      content: `✅ Categoria **${validation.payload!.name}** adicionada.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  async handleRemoveCategoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId || !interaction.guild) return;

    await this.ensureGuildExists(interaction.guildId, interaction.guild);

    const settings = await this.settingsRepo.findByGuildId(interaction.guildId);
    const categories = getTicketCategoriesForGuild(settings?.ticketCategoriesJson);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.removeCategorySelect)
      .setPlaceholder('Selecione a categoria para remover')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        categories.map((c) => ({
          label: c.name,
          value: c.id,
          emoji: c.emoji,
          description: (c.description ?? '').slice(0, 100),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    await interaction.reply({
      content: 'Selecione a categoria a remover:',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async processRemoveCategorySelect(
    interaction: StringSelectMenuInteraction
  ): Promise<boolean> {
    const categoryId = interaction.values[0];
    if (!categoryId || !interaction.guildId || !interaction.guild) return true;

    await this.ensureGuildExists(interaction.guildId, interaction.guild);
    const settings = await this.settingsRepo.findByGuildId(interaction.guildId);
    let categories: ITicketCategory[] = settings?.ticketCategoriesJson
      ? [...settings.ticketCategoriesJson]
      : [...DEFAULT_TICKET_CATEGORIES];

    categories = categories.filter((c) => c.id !== categoryId);
    if (categories.length === 0) {
      categories = [...DEFAULT_TICKET_CATEGORIES];
    }

    await this.settingsRepo.upsert(interaction.guildId, { ticketCategoriesJson: categories });

    await interaction.update({
      content: '✅ Categoria removida.',
      components: [],
    });
    return true;
  }

  async handleEditCategoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId || !interaction.guild) return;

    await this.ensureGuildExists(interaction.guildId, interaction.guild);
    const settings = await this.settingsRepo.findByGuildId(interaction.guildId);
    const categories = getTicketCategoriesForGuild(settings?.ticketCategoriesJson);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.editCategorySelect)
      .setPlaceholder('Selecione a categoria para editar')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        categories.map((c) => ({
          label: c.name,
          value: c.id,
          emoji: c.emoji,
          description: (c.description ?? '').slice(0, 100),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    await interaction.reply({
      content: 'Selecione a categoria a editar:',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  private async processEditCategorySelect(
    interaction: StringSelectMenuInteraction
  ): Promise<boolean> {
    const categoryId = interaction.values[0];
    if (!categoryId || !interaction.guildId) return true;

    const settings = await this.settingsRepo.findByGuildId(interaction.guildId);
    const categories = getTicketCategoriesForGuild(settings?.ticketCategoriesJson);
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return true;

    const modal = new ModalBuilder()
      .setCustomId(`${TICKET_CUSTOM_IDS.editCategoryModal}::${categoryId}`)
      .setTitle(`Editar: ${cat.name}`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Nome')
          .setStyle(TextInputStyle.Short)
          .setValue(cat.name)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('emoji')
          .setLabel('Emoji')
          .setStyle(TextInputStyle.Short)
          .setValue(cat.emoji)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Descrição')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(cat.description ?? '')
          .setRequired(false)
      )
    );

    await interaction.showModal(modal);
    return true;
  }

  private async processAddCategoryModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    return true;
  }

  private async processEditCategoryModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    const customId = interaction.customId;
    const categoryId = customId.includes('::') ? customId.split('::')[1] : null;
    if (!categoryId || !interaction.guildId || !interaction.guild) return true;

    await this.ensureGuildExists(interaction.guildId, interaction.guild);
    const name = interaction.fields.getTextInputValue('name');
    const emoji = interaction.fields.getTextInputValue('emoji');
    const description = interaction.fields.getTextInputValue('description') || undefined;

    const validation = validateCategoryPayload({
      name,
      emoji,
      ...(description ? { description } : {}),
    });
    if (!validation.valid) {
      await interaction.reply({
        content: `❌ ${validation.error}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const settings = await this.settingsRepo.findByGuildId(interaction.guildId);
    let categories: ITicketCategory[] = settings?.ticketCategoriesJson
      ? [...settings.ticketCategoriesJson]
      : [...DEFAULT_TICKET_CATEGORIES];

    const idx = categories.findIndex((c) => c.id === categoryId);
    if (idx === -1) return true;

    const newId = normalizeCategoryId(name, emoji);
    const cur = categories[idx]!;
    categories[idx] = {
      id: newId,
      name: validation.payload!.name,
      emoji: validation.payload!.emoji,
      ...(validation.payload!.description ? { description: validation.payload!.description } : {}),
      ...(cur.color ? { color: cur.color } : {}),
    };

    await this.settingsRepo.upsert(interaction.guildId, { ticketCategoriesJson: categories });

    await interaction.reply({
      content: `✅ Categoria atualizada para **${validation.payload!.name}**.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  private async processCategorySelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
    const categoryId = interaction.values[0];
    if (!categoryId || !interaction.guild) return true;

    const guildId = interaction.guildId!;
    const settings = await this.settingsRepo.findByGuildId(guildId);
    if (!settings?.ticketChannelId || !settings.ticketCategoryId || !settings.ticketRoleId) {
      await interaction.reply({
        content: '❌ Sistema de tickets não configurado. Use /ticket config.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const existing = await this.ticketRepo.findOpenByUser(guildId, interaction.user.id);
    if (existing) {
      await interaction.reply({
        content: `❌ Você já possui um ticket aberto: <#${existing.channelId}>`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const categories = getTicketCategoriesForGuild(settings.ticketCategoriesJson);
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return true;

    const ticketNumber = await this.ticketRepo.getNextNumber(guildId);

    const ticketChannel = await interaction.guild.channels.create({
      name: `${category.emoji}・ticket-${ticketNumber.toString().padStart(4, '0')}`,
      type: ChannelType.GuildText,
      topic: interaction.user.id,
      parent: settings.ticketCategoryId,
      permissionOverwrites: [
        {
          id: settings.ticketRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });

    await this.ticketRepo.create(guildId, {
      userId: interaction.user.id,
      channelId: ticketChannel.id,
      categoryId,
      ticketNumber,
    });

    const gIcon = interaction.guild.iconURL();
    const embed = new EmbedBuilder()
      .setColor((category.color as `#${string}`) ?? 0x2f3136)
      .setAuthor({
        name: `${category.emoji} Ticket #${ticketNumber.toString().padStart(4, '0')}`,
        ...(gIcon ? { iconURL: gIcon } : {}),
      })
      .setDescription(category.description ?? `Bem-vindo ao seu ticket de ${category.name}!`)
      .addFields(
        { name: '👤 Usuário', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🎫 Número', value: `#${ticketNumber}`, inline: true }
      )
      .setFooter({
        text: interaction.guild.name,
        ...(gIcon ? { iconURL: gIcon } : {}),
      });

    const claimBtn = new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.claim)
      .setStyle(ButtonStyle.Success)
      .setLabel('Claim')
      .setEmoji('🎯');
    const closeBtn = new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.close)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Fechar')
      .setEmoji('🔒');
    const mentionBtn = new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.mention)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Mencionar')
      .setEmoji('👤');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claimBtn, closeBtn, mentionBtn);

    let mentionContent = '';
    if (settings.mentionRoleId) {
      mentionContent = `<@&${settings.mentionRoleId}>`;
    }

    await ticketChannel.send({
      content: mentionContent,
      embeds: [embed],
      components: [row],
    });

    const linkEmbed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setDescription(
        `✅ Seu ticket ${category.emoji} #${ticketNumber.toString().padStart(4, '0')} foi criado em ${ticketChannel}`
      );
    const linkBtn = new ButtonBuilder()
      .setLabel('Ir para o ticket')
      .setURL(ticketChannel.url)
      .setStyle(ButtonStyle.Link);
    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(linkBtn);

    await interaction.reply({
      embeds: [linkEmbed],
      components: [linkRow],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  private async processTicketClose(interaction: ButtonInteraction): Promise<boolean> {
    const channel = interaction.channel;
    const guildId = interaction.guildId;
    if (!channel || !guildId || !('topic' in channel)) return true;

    const userId = channel.topic;
    const settings = await this.settingsRepo.findByGuildId(guildId);
    if (!settings?.ticketRoleId) return true;

    const member = interaction.member;
    const roles =
      member && typeof member === 'object' && 'roles' in member
        ? (member as { roles: { cache?: { has: (id: string) => boolean } } }).roles?.cache
        : null;
    const perms =
      member && typeof member === 'object' && 'permissions' in member
        ? (member as { permissions: { has: (p: bigint) => boolean } }).permissions
        : null;
    const hasRole = roles?.has(settings.ticketRoleId) ?? false;
    const isAdmin = perms?.has(PermissionFlagsBits.Administrator) ?? false;
    if (!hasRole && !isAdmin) {
      await interaction.reply({
        content: `❌ Você precisa do cargo <@&${settings.ticketRoleId}> ou ser Admin.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const ticket = await this.ticketRepo.findByChannel(channel.id);
    if (!ticket?.claimedBy) {
      await interaction.reply({
        content: '❌ Use o botão "Claim" antes de fechar.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await channel.permissionOverwrites.edit(userId!, { ViewChannel: false });
    await channel.permissionOverwrites.edit(settings.ticketRoleId, {
      ViewChannel: true,
      SendMessages: true,
    });
    await channel.permissionOverwrites.edit(interaction.guild!.id, { ViewChannel: false });

    const iconUrl = interaction.guild!.iconURL();
    const closedEmbed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setDescription('Ticket fechado. Escolha uma ação:')
      .setFooter({
        text: interaction.guild!.name,
        ...(iconUrl ? { iconURL: iconUrl } : {}),
      });
    const reopenBtn = new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.reopen)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Reabrir');
    const transcriptBtn = new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.transcript)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Transcrever e apagar');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(reopenBtn, transcriptBtn);

    await interaction.reply({ embeds: [closedEmbed], components: [row] });
    return true;
  }

  private async processTicketClaim(interaction: ButtonInteraction): Promise<boolean> {
    const ticket = await this.ticketRepo.findByChannel(interaction.channelId);
    if (!ticket) {
      await interaction.reply({
        content: '❌ Este comando só pode ser usado em canais de ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (ticket.claimedBy) {
      await interaction.reply({
        content: '❌ Este ticket já foi reivindicado.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const settings = await this.settingsRepo.findByGuildId(interaction.guildId!);
    if (!settings?.ticketRoleId) return true;

    const member = interaction.member;
    const roles =
      member && typeof member === 'object' && 'roles' in member
        ? (member as { roles: { cache?: { has: (id: string) => boolean } } }).roles?.cache
        : null;
    const hasRole = roles?.has(settings.ticketRoleId) ?? false;
    if (!hasRole) {
      await interaction.reply({
        content: `❌ Você precisa do cargo <@&${settings.ticketRoleId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await this.ticketRepo.claim(ticket.id, interaction.user.id);

    const claimEmbed = new EmbedBuilder()
      .setTitle('Atendimento iniciado')
      .setDescription(`**Atendente:** ${interaction.user}`)
      .setColor(0x2f3136)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    const ch = interaction.channel;
    if (ch && 'send' in ch) {
      await (ch as { send: (opts: object) => Promise<unknown> }).send({ embeds: [claimEmbed] });
    }

    const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_CUSTOM_IDS.claim)
        .setStyle(ButtonStyle.Success)
        .setLabel('Claim')
        .setEmoji('🎯')
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(TICKET_CUSTOM_IDS.close)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Fechar')
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId(TICKET_CUSTOM_IDS.mention)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Mencionar')
        .setEmoji('👤')
    );

    if (interaction.message && 'edit' in interaction.message) {
      await interaction.message.edit({ components: [updatedRow] });
    }

    await interaction.reply({
      content: '✅ Ticket reivindicado com sucesso!',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  private async processTicketReopen(interaction: ButtonInteraction): Promise<boolean> {
    const channel = interaction.channel as {
      topic?: string | null;
      permissionOverwrites?: { edit: (id: string, perms: object) => Promise<unknown> };
    } | null;
    const topic = channel && 'topic' in channel ? channel.topic : null;
    const ticket = await this.ticketRepo.findByChannel(interaction.channelId!);
    const settings = await this.settingsRepo.findByGuildId(interaction.guildId!);

    if (!ticket || !settings?.ticketRoleId) return true;

    await this.ticketRepo.reopen(ticket.id);

    if (topic && channel?.permissionOverwrites) {
      const member = await interaction.guild!.members.fetch(topic).catch(() => null);
      if (member) {
        await channel.permissionOverwrites.edit(topic, {
          ViewChannel: true,
          SendMessages: true,
          AttachFiles: true,
          EmbedLinks: true,
        });
      }
    }

    if (channel?.permissionOverwrites) {
      await channel.permissionOverwrites.edit(settings.ticketRoleId, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        EmbedLinks: true,
      });
      await channel.permissionOverwrites.edit(interaction.guild!.id, { ViewChannel: false });
    }

    const guildIcon = interaction.guild!.iconURL();
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setDescription('Ticket reaberto!')
      .setFooter({
        text: interaction.guild!.name,
        ...(guildIcon ? { iconURL: guildIcon } : {}),
      });
    const closeMsgBtn = new ButtonBuilder()
      .setCustomId(TICKET_CUSTOM_IDS.closeMessage)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Apagar mensagem')
      .setEmoji('🗑️');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeMsgBtn);

    await interaction.message?.delete();
    await interaction.reply({
      ...(topic ? { content: `<@${topic}>` } : {}),
      embeds: [embed],
      components: [row],
    });
    return true;
  }

  private async processTicketCloseMessage(interaction: ButtonInteraction): Promise<boolean> {
    try {
      await interaction.message.delete();
    } catch {
      // ignore
    }
    return true;
  }

  private async processTicketTranscript(interaction: ButtonInteraction): Promise<boolean> {
    const channel = interaction.channel;
    const ticket = await this.ticketRepo.findByChannel(interaction.channelId!);
    const settings = await this.settingsRepo.findByGuildId(interaction.guildId!);

    if (!ticket || !channel) return true;

    await interaction.reply({
      content: '🔄 Gerando transcript e fechando ticket em 3 segundos...',
      flags: MessageFlags.Ephemeral,
    });

    let transcriptAttachment: Awaited<
      ReturnType<typeof discordTranscripts.createTranscript>
    > | null = null;
    try {
      transcriptAttachment = await discordTranscripts.createTranscript(channel as never, {
        limit: -1,
        filename: `transcript-${channel.id}.html`,
        poweredBy: false,
      });
    } catch (err) {
      logger.error(
        'TicketModule',
        `Erro ao gerar transcript: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await this.ticketRepo.close(ticket.id);

    if (settings?.ticketLogsChannelId) {
      const logsChannel = await interaction.guild!.channels.fetch(settings.ticketLogsChannelId);
      if (logsChannel && 'send' in logsChannel) {
        const topic = 'topic' in channel ? channel.topic : null;
        const embed = new EmbedBuilder()
          .setColor(0x2f3136)
          .setTitle('Ticket Fechado')
          .setDescription(
            `Ticket #${ticket.ticketNumber} de <@${topic ?? ticket.userId}> fechado por ${interaction.user}.`
          )
          .setTimestamp();

        const files = transcriptAttachment ? [transcriptAttachment] : [];

        await (logsChannel as { send: (opts: object) => Promise<unknown> })
          .send({ embeds: [embed], files })
          .catch(() => null);
      }
    }

    await new Promise((r) => setTimeout(r, 3000));
    if (channel && 'delete' in channel) {
      await (channel as { delete: () => Promise<unknown> }).delete();
    }
    return true;
  }

  private async processTicketMention(interaction: ButtonInteraction): Promise<boolean> {
    const channel = interaction.channel;
    const topic = channel && 'topic' in channel ? channel.topic : null;
    if (!topic) {
      await interaction.reply({
        content: '❌ Não foi possível identificar o usuário do ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    try {
      const member = await interaction.guild!.members.fetch(topic);
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Ticket Aberto')
        .setDescription(
          `Olá ${member.user.tag}, você foi mencionado no ticket em ${interaction.guild!.name}.`
        )
        .addFields([{ name: 'Canal', value: channel ? `<#${channel.id}>` : '' }])
        .setTimestamp();
      const btn = new ButtonBuilder()
        .setLabel('Ir para o ticket')
        .setURL(`https://discord.com/channels/${interaction.guildId}/${channel?.id ?? ''}`)
        .setStyle(ButtonStyle.Link);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btn);

      await member.send({
        content: `Você foi mencionado no ticket:`,
        embeds: [embed],
        components: [row],
      });

      await interaction.reply({
        content: '✅ Usuário notificado.',
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      await interaction.reply({
        content: '❌ Não foi possível enviar DM ao usuário.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return true;
  }
}
