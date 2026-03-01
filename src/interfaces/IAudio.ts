export type AudioType = 'MUSIC' | 'EFFECT';

export interface AudioQueueItem {
  source: string;
  name: string;
  type: AudioType;
}

export interface IConnectionParams {
  channelId: string;
  guildId: string;
  adapterCreator: unknown;
}

export interface IPadInfo {
  name: string;
  path: string;
}
