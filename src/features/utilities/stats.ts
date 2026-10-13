import type { PrefixCommand } from '../../contracts/commands.js';
import { runStatistics } from './statistics.js';
import { utilityError } from './shared.js';
export const stats: PrefixCommand = {
  name: 'stats', category: 'MANAGEMENT', guildOnly: true, usage: ['stats', 'stats <member ID/mention, role ID/mention, or me>'], description: 'Show detailed server, member/bot, or role statistics. Use stats me for your statistics.',
  async execute(message, args) { try { await runStatistics(message, args, false); } catch (error) { await utilityError(message, error); } },
};
