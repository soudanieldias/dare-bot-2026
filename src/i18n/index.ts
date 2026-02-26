import type { I18nDict, LocaleId } from './types.js';
import { ptBR } from './locales/pt-BR.js';
import { en } from './locales/en.js';

const locales: Record<LocaleId, I18nDict> = { 'pt-BR': ptBR, en };

const supportedLocales: LocaleId[] = ['pt-BR', 'en'];
const defaultLocale: LocaleId = 'pt-BR';

export type { I18nDict, LocaleId };
export { ptBR, en };

export function getI18n(locale: string): I18nDict {
  const normalized = locale.startsWith('pt') ? 'pt-BR' : locale.startsWith('en') ? 'en' : null;
  return locales[normalized ?? defaultLocale] ?? locales[defaultLocale];
}

export function replaceParams(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
    text
  );
}

export { supportedLocales, defaultLocale };
