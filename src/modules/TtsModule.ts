import { createRequire } from 'node:module';
import { TTS_DEFAULT_LOCALE } from '@/constants/index.js';
import type { IDareClient } from '@/interfaces/index.js';

const require = createRequire(import.meta.url);
const discordTTS = require('discord-tts');

function localeToLang(locale: string): string {
  const lang = locale.split('-')[0];
  return lang && lang.length === 2 ? lang : 'pt';
}

export interface TtsConnectionParams {
  channelId: string;
  guildId: string;
  adapterCreator: unknown;
}

export class TtsModule {
  constructor(private readonly client: IDareClient) {}

  public async bootstrap(): Promise<void> {
    this.client.ttsModule = this;
  }

  playTts(params: TtsConnectionParams, text: string, locale = TTS_DEFAULT_LOCALE): void {
    const lang = localeToLang(locale);
    const stream = discordTTS.getVoiceStream(text, { lang });
    this.client.audioManager.playFromStream(
      params.guildId,
      params.channelId,
      params.adapterCreator,
      stream
    );
  }
}
