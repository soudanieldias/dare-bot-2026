import { createRequire } from 'node:module';
import type { IDareClient } from '@/interfaces/IDareClient.js';

const require = createRequire(import.meta.url);
const discordTTS = require('discord-tts');

export const TTS_VOICES: Array<{ label: string; value: string }> = [
  { label: 'Português (BR)', value: 'pt-BR' },
  { label: 'Português (PT)', value: 'pt-PT' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'Español', value: 'es-ES' },
  { label: 'Français', value: 'fr-FR' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Italiano', value: 'it-IT' },
  { label: '日本語', value: 'ja-JP' },
];

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

  bootstrap(): void {
    this.client.ttsModule = this;
  }

  playTts(params: TtsConnectionParams, text: string, locale = 'pt-BR'): void {
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
