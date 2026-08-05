import { type ICommand } from '@/interfaces/index.js';
import { aiChatCommand } from './aichat.js';
import getresources from './getresources.js';
import setImage from './setimage.js';

export const commands: ICommand[] = [setImage, getresources];
