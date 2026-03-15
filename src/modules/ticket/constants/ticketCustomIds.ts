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

export function isTicketInteraction(customId: string | null | undefined): boolean {
  if (!customId) return false;
  return customId.startsWith(TICKET_PREFIX_UNDERSCORE) || customId.startsWith(TICKET_PREFIX_HYPHEN);
}
