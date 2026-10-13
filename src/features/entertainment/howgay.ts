import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { calculateHowgay } from './calculations.js';

export const howgay: SlashCommand = {
  data: new SlashCommandBuilder().setName('howgay').setDescription('A quick test to find out your gayness level.')
    .addUserOption(option => option.setName('user').setDescription('A subject of measurement.')).toJSON(),
  async execute(interaction) {
    if (!interaction.guildId) { await interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral }); return; }
    const user = interaction.options.getUser('user') ?? interaction.user;
    const displayName = interaction.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    const embed = new EmbedBuilder().setColor(0xa039a0).setTitle(`${displayName}'s gay level is:`).addFields(calculateHowgay(user.id, interaction.guildId));
    await interaction.reply({ embeds: [embed] });
  },
};
