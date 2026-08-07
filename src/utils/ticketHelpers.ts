import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, type Guild } from 'discord.js';
import {
  DEFAULT_TICKET_CATEGORIES,
  DEFAULT_TICKET_PANEL_DESCRIPTION,
  DEFAULT_TICKET_PANEL_TITLE,
  DEFAULT_TICKET_WELCOME,
  TICKET_CUSTOM_IDS,
  TICKET_PREFIX_HYPHEN,
  TICKET_PREFIX_UNDERSCORE,
} from '@/constants/index.js';
import type { ITicketCategory } from '@/interfaces/index.js';
import type {
  TicketInteractionType,
  ICategoryPayload,
  ICategoryValidationResult,
} from '@/types/index.js';

export function isTicketInteraction(customId: string | null | undefined): boolean {
  if (!customId) return false;
  return customId.startsWith(TICKET_PREFIX_UNDERSCORE) || customId.startsWith(TICKET_PREFIX_HYPHEN);
}

export function getTicketCategoriesForGuild(
  guildCategories: ITicketCategory[] | null | undefined
): ITicketCategory[] {
  if (guildCategories?.length) return guildCategories;
  return DEFAULT_TICKET_CATEGORIES;
}

export function resolveInteractionType(
  type: TicketInteractionType | null | undefined
): TicketInteractionType {
  const valid: TicketInteractionType[] = ['selectMenu', 'singleButton', 'openDirect', 'modal'];
  if (type && valid.includes(type)) return type;
  return 'selectMenu';
}

export function normalizeCategoryId(name: string, emoji: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'categoria'
  );
}

export function validateCategoryPayload(payload: ICategoryPayload): ICategoryValidationResult {
  const { name, emoji } = payload;
  if (!name?.trim()) return { valid: false, error: 'Nome é obrigatório' };
  if (!emoji?.trim()) return { valid: false, error: 'Emoji é obrigatório' };
  return { valid: true, payload: { ...payload, name: name.trim(), emoji: emoji.trim() } };
}

export function ensureAtLeastOneCategory(categories: ITicketCategory[]): ITicketCategory[] {
  if (categories?.length) return categories;
  return DEFAULT_TICKET_CATEGORIES;
}

export function buildSelectMenuFromCategories(
  categories: ITicketCategory[],
  customId: string,
  placeholder: string
): StringSelectMenuBuilder {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  for (const cat of ensureAtLeastOneCategory(categories)) {
    menu.addOptions({
      label: cat.name,
      description: cat.description ?? '',
      value: cat.id,
      emoji: cat.emoji,
    });
  }
  return menu;
}

export function getTicketWelcomeMessage(): string {
  return DEFAULT_TICKET_WELCOME;
}

export function buildTicketPanel(
  guild: Guild,
  categories: ITicketCategory[],
  panelTitle?: string | null,
  panelDescription?: string | null
): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<StringSelectMenuBuilder>;
} {
  const categoriesText = categories
    .map((c) => `${c.emoji} **${c.name}** - ${c.description ?? ''}`)
    .join('\n')
    .slice(0, 1024);

  const icon = guild.iconURL();
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setAuthor({
      name: panelTitle?.trim() || DEFAULT_TICKET_PANEL_TITLE,
      ...(icon ? { iconURL: icon } : {}),
    })
    .setDescription(panelDescription?.trim() || DEFAULT_TICKET_PANEL_DESCRIPTION)
    .addFields({
      name: '🎫 Categorias',
      value: categoriesText || 'Nenhuma categoria configurada.',
      inline: false,
    })
    .setFooter({
      text: guild.name,
      ...(icon ? { iconURL: icon } : {}),
    });

  const menu = buildSelectMenuFromCategories(
    categories,
    TICKET_CUSTOM_IDS.categorySelect,
    'Selecione o tipo de ticket'
  );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  return { embed, row };
}

export async function ensureGuildExists(
  guildRepo: {
    upsert: (data: { id: string; name: string; iconURL: string | null }) => Promise<unknown>;
  },
  guildId: string,
  guild: { name: string; iconURL: () => string | null }
): Promise<void> {
  await guildRepo.upsert({
    id: guildId,
    name: guild.name,
    iconURL: guild.iconURL(),
  });
}
