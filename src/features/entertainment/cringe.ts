import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { protectedIds } from './calculations.js';

export const cringe: SlashCommand = {
  data: new SlashCommandBuilder().setName('cringe').setDescription('Express your feelings to another discord user with this beautiful poem.')
    .addUserOption(option => option.setName('user').setDescription('Direct your feelings towards this user.')).toJSON(),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const embed = new EmbedBuilder().setColor(0xa039a0).setTitle(`Command "CRINGE" issued by ${interaction.user.tag}`);
    if (user && protectedIds.has(user.id)) {
      embed.setTitle(`You dare use my own spell against me, ${interaction.user.username}?`).setImage('https://media1.tenor.com/images/72623e4b02895f3c7b623f2222268908/tenor.gif');
      await interaction.reply({ embeds: [embed] });
    } else {
      embed.setDescription("Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.");
      await interaction.reply({ content: user ? `<@${user.id}>` : '', embeds: [embed], allowedMentions: { users: user ? [user.id] : [], parse: [] } });
    }
  },
};
