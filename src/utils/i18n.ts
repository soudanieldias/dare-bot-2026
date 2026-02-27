export type LocaleId = 'pt-BR' | 'en';

export interface I18nDict {
  common: {
    unauthorized: string;
    underConstruction: string;
  };
  commands: {
    setimage: {
      description: string;
      optionAvatar: string;
      errorInvalidImage: string;
      success: string;
      errorGeneric: string;
    };
  };
}

const locales: Record<LocaleId, I18nDict> = {
  'pt-BR': {
    common: { unauthorized: 'Não Autorizado!', underConstruction: 'Em construção' },
    commands: {
      setimage: {
        description: 'Mude avatar do bot',
        optionAvatar: 'O avatar',
        errorInvalidImage: 'Erro: envie uma imagem válida.',
        success: '✅ Avatar atualizado com sucesso!',
        errorGeneric: '❌ Erro ao definir avatar: {{message}}',
      },
    },
  },
  en: {
    common: { unauthorized: 'Unauthorized!', underConstruction: 'Under construction' },
    commands: {
      setimage: {
        description: 'Change bot avatar',
        optionAvatar: 'The avatar',
        errorInvalidImage: 'Error: send a valid image.',
        success: '✅ Avatar updated successfully!',
        errorGeneric: '❌ Error setting avatar: {{message}}',
      },
    },
  },
};

const defaultLocale: LocaleId = 'pt-BR';

export function getI18n(locale: string): I18nDict {
  const id: LocaleId = locale.startsWith('pt') ? 'pt-BR' : locale.startsWith('en') ? 'en' : defaultLocale;
  return locales[id];
}

export function replaceParams(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
    text
  );
}
