import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { protectedIds } from './calculations.js';

export const stfu: SlashCommand = {
  data: new SlashCommandBuilder().setName('stfu').setDescription('An eloquent way to ask someone to lower their voice.')
    .addUserOption(option => option.setName('user').setDescription('Direct your feelings towards this user.')).toJSON(),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const embed = new EmbedBuilder().setColor(0xa039a0).setTitle(`Command "STFU" issued by ${interaction.user.tag}`);
    if (user && protectedIds.has(user.id)) {
      embed.setTitle(`You dare use my own spell against me, ${interaction.user.username}?`).setImage('https://media1.tenor.com/images/72623e4b02895f3c7b623f2222268908/tenor.gif');
      await interaction.reply({ embeds: [embed] });
    } else {
      embed.setDescription("I honestly don't even know where to start, but what you're doing is incredibly annoying, needless, and generally speaking, stupid. Continuing to do so may result in permanent damage to your brain cells. As I care for your health, please stop doing this.");
      await interaction.reply({ content: user ? `<@${user.id}>` : '', embeds: [embed], allowedMentions: { users: user ? [user.id] : [], parse: [] } });
    }
  },
};
