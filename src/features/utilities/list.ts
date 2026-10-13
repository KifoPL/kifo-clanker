import type { PrefixCommand } from '../../contracts/commands.js';
import { runStatistics } from './statistics.js';
import { utilityError } from './shared.js';
export const list: PrefixCommand = {
  name: 'list', category: 'MANAGEMENT', guildOnly: true, usage: ['list', 'list <member ID/mention or me>', 'list [channel/here] <role> [role ...]'], description: 'Export server members, a member’s roles, or members with all roles; optionally filter by channel/here.',
  async execute(message, args) { try { await runStatistics(message, args, true); } catch (error) { await utilityError(message, error); } },
};
