import { type ICommand } from '@/interfaces/index.js';
import { soundpadCommand } from './soundpad.js';
import { embedCommand } from './embed.js';
import { ttsCommand } from './tts.js';

export const commands: ICommand[] = [embedCommand, soundpadCommand, ttsCommand];
