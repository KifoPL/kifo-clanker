import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import { runStatistics } from './statistics.js';
import { utilityError } from './shared.js';
export const statsData = new SlashCommandBuilder().setName('stats').setDescription('Show server, member/bot, or role statistics.').setContexts(InteractionContextType.Guild)
  .addUserOption(option => option.setName('member').setDescription('Member whose statistics to show.'))
  .addRoleOption(option => option.setName('role').setDescription('Role whose statistics to show; choose either member or role.'))
  .toJSON();
export const stats: InvocationCommand = {
  name: 'stats', category: 'MANAGEMENT', guildOnly: true, usage: ['/stats', '/stats member:<member>', '/stats role:<role>'], description: 'Show detailed server, member/bot, or role statistics. Choose your account in the member option for your statistics.',
  async execute(invocation, args) { try { await runStatistics(invocation, args, false); } catch (error) { await utilityError(invocation, error); } },
};
