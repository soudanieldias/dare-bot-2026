import { StringSelectMenuBuilder } from 'discord.js';
import {
  DEFAULT_TICKET_CATEGORIES,
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
