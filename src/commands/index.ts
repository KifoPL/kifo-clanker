import type { SlashCommand } from '../contracts/commands.js';
import { epoch } from './epoch.js';
import { ping } from './ping.js';
import { reverse } from './reverse.js';

export const slashCommands: readonly SlashCommand[] = [ping, reverse, epoch];
