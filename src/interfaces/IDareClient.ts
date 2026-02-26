import type { AudioManagerModule } from '@/modules/AudioManagerModule.js';
import type { SoundModule } from '@/modules/SoundModule.js';
import type { SoundpadModule } from '@/modules/SoundpadModule.js';
import type { Client, Collection } from 'discord.js';

export interface IDareClient extends Client {
  commands: Collection<string, any>;
  pads?: Map<string, { name: string; path: string }>;
  audioManager: AudioManagerModule;
  soundModule: SoundModule;
  soundpadModule: SoundpadModule;
}
