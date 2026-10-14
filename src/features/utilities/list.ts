import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import { runStatistics } from './statistics.js';
import { utilityError } from './shared.js';
export const listData = new SlashCommandBuilder().setName('list').setDescription('Export members or roles to a text attachment.').setContexts(InteractionContextType.Guild)
  .addSubcommand(option => option.setName('server').setDescription('Export all server members.'))
  .addSubcommand(option => option.setName('user').setDescription('Export a member’s roles; defaults to yourself.')
    .addUserOption(member => member.setName('member').setDescription('Server member whose roles to export.')))
  .addSubcommand(option => option.setName('roles').setDescription('Export members having every specified role, optionally in a channel.')
    .addRoleOption(role => role.setName('role').setDescription('A role every result must have.').setRequired(true))
    .addStringOption(roles => roles.setName('roles').setDescription('Additional role IDs or mentions, separated by spaces.').setMaxLength(1000))
    .addChannelOption(channel => channel.setName('channel').setDescription('Only members who can view this channel.')))
  .toJSON();
export const list: InvocationCommand = {
  name: 'list', category: 'MANAGEMENT', guildOnly: true, usage: ['/list server', '/list user [member]', '/list roles role:<role> [roles:<additional roles>] [channel:<channel>]'], description: 'Export server members, a member’s roles, or members with all roles; optionally filter by channel/here.',
  async execute(invocation, args) { try { await runStatistics(invocation, args, true); } catch (error) { await utilityError(invocation, error); } },
};
