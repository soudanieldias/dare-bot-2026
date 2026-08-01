import { JUKEBOX_DIR } from '@/constants/index.js';
import type { IDareClient } from '@/interfaces/index.js';

export class SettingsModule {
  public jukeboxRoot: string = JUKEBOX_DIR;
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {
    this.client.settings = this;
  }
}
