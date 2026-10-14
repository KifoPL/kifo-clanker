import { BOT_COLOR } from '../../constants.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { protectedIds } from './calculations.js';

export const cringe: SlashCommand = {
  data: new SlashCommandBuilder().setName('cringe').setDescription('Express your feelings to another discord user with this beautiful poem.')
    .addUserOption(option => option.setName('user').setDescription('Direct your feelings towards this user.')).toJSON(),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(`Command "CRINGE" issued by ${interaction.user.tag}`);
    if (user && protectedIds.has(user.id)) {
      embed.setTitle(`You dare use my own spell against me, ${interaction.user.username}?`).setImage('https://media.tenor.com/FfEuhXlmhYkAAAAM/my-own-spells-against-me.gif');
      await interaction.reply({ embeds: [embed] });
    } else {
      embed.setDescription("Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.");
      await interaction.reply({ content: user ? `<@${user.id}>` : '', embeds: [embed], allowedMentions: { users: user ? [user.id] : [], parse: [] } });
    }
  },
};
