import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { GuildRepository, GuildSettingsRepository } from '@/database/index.js';
import { DEFAULT_TICKET_CATEGORIES, DEFAULT_TICKET_WELCOME, TICKET_CUSTOM_IDS } from '@/constants/index.js';
import type { ITicketCategory } from '@/interfaces/index.js';
import type { IPendingConfig } from '@/types/index.js';
import {
  buildTicketPanel,
  ensureGuildExists,
  getTicketCategoriesForGuild,
  normalizeCategoryId,
  validateCategoryPayload,
} from './ticketHelpers.js';

export interface ITicketConfigDeps {
  guildRepo: GuildRepository;
  settingsRepo: GuildSettingsRepository;
  pendingConfig: Map<string, IPendingConfig>;
}

export async function handleConfigCommand(
  deps: ITicketConfigDeps,
  interaction: ChatInputCommandInteraction
): Promise<void> {
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

  deps.pendingConfig.set(interaction.user.id, {
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
        .setCustomId('paneltitle')
        .setLabel('Título do painel de tickets')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Sistema de Tickets')
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('paneldescription')
        .setLabel('Descrição do painel de tickets')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Selecione uma categoria abaixo para abrir um ticket')
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

export async function processConfigModal(
  deps: ITicketConfigDeps,
  interaction: ModalSubmitInteraction
): Promise<boolean> {
  await interaction.deferReply({ ephemeral: true });

  const pending = deps.pendingConfig.get(interaction.user.id);
  deps.pendingConfig.delete(interaction.user.id);

  if (!pending || !interaction.guild) {
    await interaction.editReply({
      content: 'Sessão expirada. Execute /ticket config novamente.',
    });
    return true;
  }

  await ensureGuildExists(deps.guildRepo, interaction.guildId!, interaction.guild);

  const ticketTitle = interaction.fields.getTextInputValue('paneltitle');
  const ticketPanelDescription = interaction.fields.getTextInputValue('paneldescription');

  await deps.settingsRepo.upsert(interaction.guildId!, {
    ticketChannelId: pending.channelId,
    ticketLogsChannelId: pending.logsId,
    ticketCategoryId: pending.categoryId,
    ticketRoleId: pending.roleId,
    mentionRoleId: pending.mentionId,
    ticketTitle,
    ticketPanelDescription,
    ticketDescription: DEFAULT_TICKET_WELCOME,
  });

  const categories = getTicketCategoriesForGuild(
    (await deps.settingsRepo.findByGuildId(interaction.guildId!))?.ticketCategoriesJson
  );

  const { embed, row } = buildTicketPanel(
    interaction.guild,
    categories,
    ticketTitle,
    ticketPanelDescription
  );

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

export async function handleAddCategoryCommand(
  deps: ITicketConfigDeps,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;

  await ensureGuildExists(deps.guildRepo, interaction.guildId, interaction.guild);

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
  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId);
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

  await deps.settingsRepo.upsert(interaction.guildId, { ticketCategoriesJson: categories });

  await interaction.reply({
    content: `✅ Categoria **${validation.payload!.name}** adicionada.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleRemoveCategoryCommand(
  deps: ITicketConfigDeps,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;

  await ensureGuildExists(deps.guildRepo, interaction.guildId, interaction.guild);

  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId);
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

export async function processRemoveCategorySelect(
  deps: ITicketConfigDeps,
  interaction: StringSelectMenuInteraction
): Promise<boolean> {
  const categoryId = interaction.values[0];
  if (!categoryId || !interaction.guildId || !interaction.guild) return true;

  await ensureGuildExists(deps.guildRepo, interaction.guildId, interaction.guild);
  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId);
  let categories: ITicketCategory[] = settings?.ticketCategoriesJson
    ? [...settings.ticketCategoriesJson]
    : [...DEFAULT_TICKET_CATEGORIES];

  categories = categories.filter((c) => c.id !== categoryId);
  if (categories.length === 0) {
    categories = [...DEFAULT_TICKET_CATEGORIES];
  }

  await deps.settingsRepo.upsert(interaction.guildId, { ticketCategoriesJson: categories });

  await interaction.update({
    content: '✅ Categoria removida.',
    components: [],
  });
  return true;
}

export async function handleEditCategoryCommand(
  deps: ITicketConfigDeps,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;

  await ensureGuildExists(deps.guildRepo, interaction.guildId, interaction.guild);
  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId);
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

export async function processEditCategorySelect(
  deps: ITicketConfigDeps,
  interaction: StringSelectMenuInteraction
): Promise<boolean> {
  const categoryId = interaction.values[0];
  if (!categoryId || !interaction.guildId) return true;

  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId);
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

export async function processAddCategoryModal(
  _deps: ITicketConfigDeps,
  _interaction: ModalSubmitInteraction
): Promise<boolean> {
  return true;
}

export async function processEditCategoryModal(
  deps: ITicketConfigDeps,
  interaction: ModalSubmitInteraction
): Promise<boolean> {
  const customId = interaction.customId;
  const categoryId = customId.includes('::') ? customId.split('::')[1] : null;
  if (!categoryId || !interaction.guildId || !interaction.guild) return true;

  await ensureGuildExists(deps.guildRepo, interaction.guildId, interaction.guild);
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

  const settings = await deps.settingsRepo.findByGuildId(interaction.guildId);
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

  await deps.settingsRepo.upsert(interaction.guildId, { ticketCategoriesJson: categories });

  await interaction.reply({
    content: `✅ Categoria atualizada para **${validation.payload!.name}**.`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
