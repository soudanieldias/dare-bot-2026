export type AudioType = 'MUSIC' | 'EFFECT';

export interface AudioQueueItem {
  source: string;
  name: string;
  type: AudioType;
}
