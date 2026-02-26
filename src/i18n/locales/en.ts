import type { I18nDict } from '../types.js';

export const en: I18nDict = {
  common: {
    unauthorized: 'Unauthorized!',
    underConstruction: 'Under construction',
  },
  commands: {
    setimage: {
      description: 'Change bot avatar',
      optionAvatar: 'The avatar',
      errorInvalidImage: 'Error: send a valid image.',
      success: '✅ Avatar updated successfully!',
      errorGeneric: '❌ Error setting avatar: {{message}}',
    },
  },
};
