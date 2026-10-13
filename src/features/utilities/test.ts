import { EmbedBuilder } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import { color, safeMentions, textFile } from './shared.js';
export const test: PrefixCommand = {
  name: 'test', category: 'DEBUG', guildOnly: true, usage: ['test <args>'], description: 'Show how your arguments were parsed.',
  async execute(message, args) {
    const content = args.map((arg, index) => `${index + 1}. ${JSON.stringify(arg)}`).join('\n') || 'No arguments.';
    await message.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Your arguments:').setDescription(content.slice(0, 4096))], files: content.length > 4096 ? [textFile(content, 'arguments.txt')] : [], allowedMentions: safeMentions });
  },
};
