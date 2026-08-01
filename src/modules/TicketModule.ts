import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import {
  GuildRepository,
  GuildSettingsRepository,
  TicketRepository,
} from '@/database/index.js';
import type { IDareClient, ITicketCategory } from '@/interfaces/index.js';
import { logger } from '@/shared/index.js';
import type { IPendingConfig } from '@/types/index.js';
import {
  DEFAULT_TICKET_CATEGORIES,
  TICKET_CUSTOM_IDS,
  handleAddCategoryCommand,
  handleConfigCommand,
  handleEditCategoryCommand,
  handleRemoveCategoryCommand,
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

  async bootstrap(): Promise<void> {
    this.client.ticketModule = this;
    logger.info('TicketModule', 'Bootstrapping TicketModule.');
  }

  getDefaultCategories(): ITicketCategory[] {
    return [...DEFAULT_TICKET_CATEGORIES];
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
}
