import path from 'node:path';
import type { ITicketCategory } from '@/interfaces/index.js';

// --- Paths ---

export const AUDIOS_DIR = 'src/audios';
export const JUKEBOX_DIR = 'src/jukebox';
export const JUKEBOX_ROOT = path.resolve(JUKEBOX_DIR);
export const RECORDINGS_DIR = 'recordings';
export const RECORDING_START_SOUND = path.join(AUDIOS_DIR, 'system', 'recording_start.mp3');

// --- Soundpad ---

export const SOUNDPAD_CATEGORIES: Array<{ label: string; value: string }> = [
  { label: 'todos', value: 'spad_all' },
  { label: 'audios', value: 'spad_audios' },
  { label: 'frases', value: 'spad_frases' },
  { label: 'memes', value: 'spad_memes' },
  { label: 'musicas', value: 'spad_musicas' },
  { label: 'times', value: 'spad_times' },
];

export const SOUNDPAD_PATHS: Record<string, { path: string; category: string }> = {
  spad_all: { path: AUDIOS_DIR, category: 'todos' },
  spad_audios: { path: `${AUDIOS_DIR}/audios`, category: 'audios' },
  spad_frases: { path: `${AUDIOS_DIR}/frases`, category: 'frases' },
  spad_memes: { path: `${AUDIOS_DIR}/memes`, category: 'memes' },
  spad_musicas: { path: `${AUDIOS_DIR}/musicas`, category: 'musicas' },
  spad_times: { path: `${AUDIOS_DIR}/times`, category: 'times' },
};

export const SOUNDPAD_BUTTONS_PER_ROW = 5;

// --- TTS ---

export const TTS_DEFAULT_LOCALE = 'pt-BR';

export const TTS_VOICES: Array<{ label: string; value: string }> = [
  { label: 'Português (BR)', value: 'pt-BR' },
  { label: 'Português (PT)', value: 'pt-PT' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'Español', value: 'es-ES' },
  { label: 'Français', value: 'fr-FR' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Italiano', value: 'it-IT' },
  { label: '日本語', value: 'ja-JP' },
];

export const TTS_LANGUAGES = TTS_VOICES.map((v) => v.value).join(', ');

// --- Ticket ---

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

/** Título padrão do painel de tickets */
export const DEFAULT_TICKET_PANEL_TITLE = 'Sistema de Tickets';

/** Descrição padrão do painel de tickets */
export const DEFAULT_TICKET_PANEL_DESCRIPTION =
  'Selecione uma categoria abaixo para abrir um ticket.';

/** Mensagem padrão dentro do canal do ticket (não usa description da categoria) */
export const DEFAULT_TICKET_WELCOME =
  'Olá! Descreva seu problema com o máximo de detalhes. A equipe irá atendê-lo em breve.';

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
