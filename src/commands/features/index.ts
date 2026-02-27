import { type ICommand } from '@/interfaces/index.js';
import { soundpadCommand } from './soundpad.js';
import { ttsCommand } from './tts.js';

export const commands: ICommand[] = [soundpadCommand, ttsCommand];
