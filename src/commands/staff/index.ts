import { type ICommand } from '@/interfaces/index.js';
import { messageCommand } from './message.js';
import { ticketCommand } from './ticket.js';

export const commands: ICommand[] = [messageCommand, ticketCommand];
