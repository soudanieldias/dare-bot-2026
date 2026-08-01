import { StringSelectMenuBuilder } from 'discord.js';
import type { ITicketCategory } from '@/interfaces/ITicketCategory.js';
import type {
  TicketInteractionType,
  ICategoryPayload,
  ICategoryValidationResult,
} from '@/types/ticket.js';

export const TICKET_PREFIX_UNDERSCORE = 'ticket_';
export const TICKET_PREFIX_HYPHEN = 'ticket-';

export const TICKET_CUSTOM_IDS = {
  categorySelect: 'ticket_category-select',
  configModal: 'ticket_config-modal',
  addCategoryModal: 'ticket_addcategory-modal',
  removeCategorySelect: 'ticket_removecategory-select',
  editCategorySelect: 'ticket_editcategory-select',
  editCategoryModal: 'ticket_editcategory-modal',
  close: 'ticket_close',
  claim: 'ticket_claim',
  reopen: 'ticket_reopen',
  transcript: 'ticket_transcript',
  mention: 'ticket_mention',
  closeMessage: 'ticket_close-message',
} as const;

export const DEFAULT_TICKET_CATEGORIES: ITicketCategory[] = [
  {
    id: 'suporte',
    name: 'Suporte',
    emoji: '🛠️',
    description: 'Precisa de ajuda? Abra um ticket de suporte!',
    color: '#ff6600',
  },
  {
    id: 'compras',
    name: 'Compras',
    emoji: '🛒',
    description: 'Compras, vendas e pagamentos',
    color: '#00ff00',
  },
  {
    id: 'ajuda',
    name: 'Ajuda',
    emoji: '❓',
    description: 'Precisa de ajuda ou suporte',
    color: '#0099ff',
  },
  {
    id: 'reclamacao',
    name: 'Reclamação',
    emoji: '😠',
    description: 'Reclamações e problemas',
    color: '#ff0000',
  },
  {
    id: 'sugestao',
    name: 'Sugestão',
    emoji: '💡',
    description: 'Sugestões e ideias',
    color: '#ffff00',
  },
];

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
