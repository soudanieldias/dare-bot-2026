import type {
  AudioManagerModule,
  AutocompleteModule,
  EmbedModule,
  MusicModule,
  SettingsModule,
  SoundpadModule,
  TicketModule,
  TtsModule,
} from '@/modules/index.js';
import type { Client, Collection } from 'discord.js';

export interface IDareClient extends Client {
  autocompleteModule: AutocompleteModule;
  commands: Collection<string, any>;
  embedModule?: EmbedModule;
  pads?: Map<string, { name: string; path: string }>;
  audioManager: AudioManagerModule;
  musicModule: MusicModule;
  settings: SettingsModule;
  soundpadModule: SoundpadModule;
  ticketModule?: TicketModule;
  ttsModule: TtsModule;
}
