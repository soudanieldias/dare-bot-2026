import type { IDareClient } from '@/interfaces/index.js';

export class SettingsModule {
  public jukeboxRoot: string = './src/jukebox';
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {
    this.client.settings = this;
  }
}
