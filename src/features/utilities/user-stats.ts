import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import type { ContextCommand } from '../../contracts/commands.js';
import { userStats } from './statistics.js';
import { safeMentions } from './shared.js';
export const userStatsData = new ContextMenuCommandBuilder().setName('user stats').setType(ApplicationCommandType.User).setContexts(InteractionContextType.Guild).toJSON();
export const userStatsCommand: ContextCommand = {
  data: userStatsData,
  async execute(interaction) {
    if (!interaction.isUserContextMenuCommand()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) { await interaction.editReply({ content: 'User statistics are only available in a server.' }); return; }
    const member = await interaction.guild.members.fetch(interaction.targetId);
    await interaction.editReply({ embeds: [userStats(member)], allowedMentions: safeMentions });
  },
};
