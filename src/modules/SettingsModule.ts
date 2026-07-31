import type { IDareClient } from '@/interfaces/IDareClient.js';

export class SettingsModule {
  public readonly jukeboxRoot: string = 'src/jukebox';
  constructor(private readonly client: IDareClient) {}

  bootstrap(): void {}
}
