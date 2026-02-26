import { type ICommand } from '@/interfaces/index.js';
import * as developer from './developer/index.js';
import * as features from './features/index.js';
import * as help from './help/index.js';
import * as music from './music/index.js';
import * as staff from './staff/index.js';

export type { ICommand };

export const commandArrays: ICommand[] = [
  ...developer.commands,
  ...features.commands,
  ...help.commands,
  ...music.commands,
  ...staff.commands,
];

export const commandMap = new Map<string, ICommand>(
  commandArrays.map((cmd) => [cmd.data.name, cmd])
);
