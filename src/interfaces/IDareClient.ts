import type {
  AudioManagerModule,
  EmbedModule,
  MusicModule,
  SettingsModule,
  SoundpadModule,
  TicketModule,
  TtsModule,
} from '@/modules/index.js';
import type { Client, Collection } from 'discord.js';

export interface IDareClient extends Client {
  commands: Collection<string, any>;
  embedModule?: EmbedModule;
  pads?: Map<string, { name: string; path: string }>;
  audioManager: AudioManagerModule;
  musicModule: MusicModule;
  soundpadModule: SoundpadModule;
  ticketModule?: TicketModule;
  ttsModule: TtsModule;
  settings: SettingsModule;
}
