import { StringSelectMenuBuilder } from 'discord.js';
import type { ITicketCategory } from '@/interfaces/ITicketCategory.js';
import type { TicketInteractionType } from '../types.js';
import { DEFAULT_TICKET_CATEGORIES } from '../constants/defaultTicketCategories.js';
import type { ICategoryPayload, ICategoryValidationResult } from '../types.js';

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
