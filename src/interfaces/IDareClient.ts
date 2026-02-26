import type { AudioManagerModule } from '@/modules/AudioManagerModule.js';
import type { Client, Collection } from 'discord.js';

export interface IDareClient extends Client {
  commands: Collection<string, any>;
  pads?: Map<string, { name: string; path: string }>;
  audioManager: AudioManagerModule;
}
