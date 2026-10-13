import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { calculateIq, protectedIds } from './calculations.js';

export const iq: SlashCommand = {
  data: new SlashCommandBuilder().setName('iq').setDescription('A very quick and accurate IQ test.')
    .addUserOption(option => option.setName('user').setDescription('A subject of measurement.')).toJSON(),
  async execute(interaction) {
    if (!interaction.guildId) { await interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral }); return; }
    const user = interaction.options.getUser('user') ?? interaction.user;
    const displayName = interaction.guild?.members.cache.get(user.id)?.displayName ?? user.username;
    const embed = new EmbedBuilder().setColor(0xa039a0).setTitle(`${displayName}'s IQ level is:`).addFields(calculateIq(user.id, interaction.guildId));
    if (protectedIds.has(user.id)) embed.setImage('https://media1.tenor.com/images/8ac74d59bf920c9588c8f7f00229cb78/tenor.gif');
    await interaction.reply({ embeds: [embed] });
  },
};
