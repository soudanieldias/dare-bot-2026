declare module 'discord-tts' {
  import type { Readable } from 'node:stream';

  export function getVoiceStream(
    text: string,
    options?: {
      lang?: string;
      slow?: boolean;
      host?: string;
      timeout?: number;
      splitPunct?: string;
    }
  ): Readable;

  export function getVoiceConnections(): unknown;
}
