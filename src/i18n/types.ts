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
