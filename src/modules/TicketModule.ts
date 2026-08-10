import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  Message,
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import { DEFAULT_TICKET_CATEGORIES, TICKET_CUSTOM_IDS } from '@/constants/index.js';
import { GuildRepository, GuildSettingsRepository, TicketRepository } from '@/database/index.js';
import type { IDareClient, ITicketCategory } from '@/interfaces/index.js';
import { logger } from '@/shared/index.js';
import type { IPendingConfig } from '@/types/index.js';
import {
  buildTicketPanel,
  getTicketCategoriesForGuild,
  handleAddCategoryCommand,
  handleConfigCommand,
  handleEditCategoryCommand,
  handleRemoveCategoryCommand,
  handleTicketAuthorMentionMessage,
  isTicketInteraction,
  processAddCategoryModal,
  processCategorySelect,
  processConfigModal,
  processEditCategoryModal,
  processEditCategorySelect,
  processRemoveCategorySelect,
  processTicketClaim,
  processTicketClose,
  processTicketCloseMessage,
  processTicketMention,
  processTicketReopen,
  processTicketTranscript,
  type ITicketConfigDeps,
  type ITicketLifecycleDeps,
} from '@/utils/index.js';

export class TicketModule {
  private guildRepo = new GuildRepository();
  private settingsRepo = new GuildSettingsRepository();
  private ticketRepo = new TicketRepository();
  private pendingConfig = new Map<string, IPendingConfig>();

  constructor(private client: IDareClient) {}

  private get configDeps(): ITicketConfigDeps {
    return {
      guildRepo: this.guildRepo,
      settingsRepo: this.settingsRepo,
      pendingConfig: this.pendingConfig,
    };
  }

  private get lifecycleDeps(): ITicketLifecycleDeps {
    return {
      settingsRepo: this.settingsRepo,
      ticketRepo: this.ticketRepo,
    };
  }

  public async bootstrap(): Promise<void> {
    this.client.ticketModule = this;
    logger.info('TicketModule', 'Bootstrapping TicketModule.');
  }

  getDefaultCategories(): ITicketCategory[] {
    return [...DEFAULT_TICKET_CATEGORIES];
  }

  async handleMessageCreate(message: Message): Promise<boolean> {
    return handleTicketAuthorMentionMessage(this.lifecycleDeps, message);
  }

  async handleButton(interaction: ButtonInteraction): Promise<boolean> {
    if (!isTicketInteraction(interaction.customId)) return false;
    const deps = this.lifecycleDeps;
    switch (interaction.customId) {
      case TICKET_CUSTOM_IDS.close:
        return processTicketClose(deps, interaction);
      case TICKET_CUSTOM_IDS.claim:
        return processTicketClaim(deps, interaction);
      case TICKET_CUSTOM_IDS.reopen:
        return processTicketReopen(deps, interaction);
      case TICKET_CUSTOM_IDS.transcript:
        return processTicketTranscript(deps, interaction);
      case TICKET_CUSTOM_IDS.mention:
        return processTicketMention(deps, interaction);
      case TICKET_CUSTOM_IDS.closeMessage:
        return processTicketCloseMessage(deps, interaction);
      default:
        return false;
    }
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<boolean> {
    if (!isTicketInteraction(interaction.customId)) return false;
    const configDeps = this.configDeps;
    const lifecycleDeps = this.lifecycleDeps;
    switch (interaction.customId) {
      case TICKET_CUSTOM_IDS.categorySelect:
        return processCategorySelect(lifecycleDeps, interaction);
      case TICKET_CUSTOM_IDS.removeCategorySelect:
        return processRemoveCategorySelect(configDeps, interaction);
      case TICKET_CUSTOM_IDS.editCategorySelect:
        return processEditCategorySelect(configDeps, interaction);
      default:
        return false;
    }
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (!isTicketInteraction(interaction.customId)) return false;
    const deps = this.configDeps;
    const id = interaction.customId;
    switch (id) {
      case TICKET_CUSTOM_IDS.configModal:
        return processConfigModal(deps, interaction);
      case TICKET_CUSTOM_IDS.addCategoryModal:
        return processAddCategoryModal(deps, interaction);
      default:
        if (id.startsWith(TICKET_CUSTOM_IDS.editCategoryModal)) {
          return processEditCategoryModal(deps, interaction);
        }
        return false;
    }
  }

  async handleConfigCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    return handleConfigCommand(this.configDeps, interaction);
  }

  async handleAddCategoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    return handleAddCategoryCommand(this.configDeps, interaction);
  }

  async handleRemoveCategoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    return handleRemoveCategoryCommand(this.configDeps, interaction);
  }

  async handleEditCategoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    return handleEditCategoryCommand(this.configDeps, interaction);
  }

  async handleSendEmbedCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId || !interaction.guild) {
      await interaction.reply({
        content: 'Este comando só pode ser usado em servidores.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const settings = await this.settingsRepo.findByGuildId(guildId);
      if (!settings?.ticketChannelId) {
        await interaction.reply({
          content:
            'O canal de tickets não está configurado. Use `/ticket config` para configurá-lo.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const channel = await interaction.guild.channels.fetch(settings.ticketChannelId);
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        await interaction.reply({
          content: 'O canal de tickets configurado não é um canal de texto válido.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const categories = getTicketCategoriesForGuild(settings.ticketCategoriesJson);
      const { embed, row } = buildTicketPanel(
        interaction.guild,
        categories,
        settings.ticketTitle,
        settings.ticketPanelDescription
      );

      await channel.send({
        embeds: [embed],
        components: [row],
      });

      await interaction.reply({
        content: `✅ Painel de tickets enviado em <#${channel.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error(
        'TicketModule',
        `Erro ao enviar embed: ${error instanceof Error ? error.message : String(error)}`
      );

      const content = '❌ Não foi possível enviar o painel de tickets.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
      }
    }
  }

  async handleTransferTicketCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { guild, guildId } = interaction;
    try {
      if (!guild || !guildId) {
        await interaction.reply({
          content: 'Este comando só pode ser usado em servidores.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const userToTransfer = interaction.options.getUser('username', true);
      if (!userToTransfer) {
        await interaction.reply({
          content: 'Você deve mencionar um usuário para transferir o ticket.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const ticket = await this.ticketRepo.findByChannel(interaction.channelId);
      if (!ticket) {
        await interaction.reply({
          content: 'Este canal não está associado a nenhum ticket.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (ticket.userId === userToTransfer.id) {
        await interaction.reply({
          content: 'O ticket já pertence a este usuário.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await this.ticketRepo.updateChannel(ticket.id, interaction.channelId);
      await this.ticketRepo.claim(ticket.id, userToTransfer.id);

      await interaction.reply({
        content: `✅ O atendimento do ticket foi transferido para <@${userToTransfer.id}>.`,
        flags: MessageFlags.Ephemeral,
      });

      const transferMessage = `O atendimento deste ticket foi transferido para <@${userToTransfer.id}>.`;
      await (interaction.channel as TextChannel)
        .send({ content: transferMessage })
        .catch(() => null);
    } catch (error) {
      logger.error(
        'TicketModule',
        `Erro ao transferir ticket: ${error instanceof Error ? error.message : String(error)}`
      );

      const message = '❌ Não foi possível transferir o ticket.';
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({ content: message, flags: MessageFlags.Ephemeral })
          .catch(() => null);
      } else {
        await interaction
          .reply({ content: message, flags: MessageFlags.Ephemeral })
          .catch(() => null);
      }
    }
  }
}
