import type { I18nDict } from '../types.js';

export const ptBR: I18nDict = {
  common: {
    unauthorized: 'Não Autorizado!',
    underConstruction: 'Em construção',
  },
  commands: {
    setimage: {
      description: 'Mude avatar do bot',
      optionAvatar: 'O avatar',
      errorInvalidImage: 'Erro: envie uma imagem válida.',
      success: '✅ Avatar atualizado com sucesso!',
      errorGeneric: '❌ Erro ao definir avatar: {{message}}',
    },
  },
};
