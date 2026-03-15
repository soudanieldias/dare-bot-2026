import type { ITicketCategory } from '@/interfaces/ITicketCategory.js';

export type TicketInteractionType = 'selectMenu' | 'singleButton' | 'openDirect' | 'modal';

export interface ITicketGuildConfig {
  ticketChannelId?: string | null;
  ticketCategoryId?: string | null;
  ticketLogsChannelId?: string | null;
  ticketRoleId?: string | null;
  ticketTitle?: string | null;
  ticketDescription?: string | null;
  ticketInteractionType?: TicketInteractionType | null;
  ticketCategories?: ITicketCategory[];
}

export interface ICategoryPayload {
  name: string;
  emoji: string;
  description?: string;
  color?: string;
}

export interface ICategoryValidationResult {
  valid: boolean;
  error?: string;
  payload?: ICategoryPayload;
}
