import { BOT_COLOR } from '../../constants.js';
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { calculatePp } from './calculations.js';

export const pp: SlashCommand = {
  data: new SlashCommandBuilder().setName('pp').setDescription('Measure your PP length with this totally reliable pp length calculator.')
    .addUserOption(option => option.setName('user').setDescription('A subject of measurement.')).toJSON(),
  async execute(interaction) {
    if (!interaction.guildId) { await interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral }); return; }
    const user = interaction.options.getUser('user') ?? interaction.user;
    const displayName = interaction.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(`${displayName}'s pp length is:`).addFields(calculatePp(user.id, interaction.guildId));
    await interaction.reply({ embeds: [embed] });
  },
};
