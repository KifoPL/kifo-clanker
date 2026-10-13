import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import { color, safeMentions } from './shared.js';
export const prefixData = new SlashCommandBuilder().setName('prefix').setDescription('Learn how to use the bot’s native slash commands.').setContexts(InteractionContextType.Guild).toJSON();
export const prefix: InvocationCommand = {
  name: 'prefix', category: 'UTILITY', guildOnly: true, usage: ['/prefix'], description: 'Explain native slash commands and retired text prefixes.',
  async execute(invocation) {
    await invocation.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('Use native slash commands')
      .setDescription('Text prefixes are disabled. Type `/` in Discord to see this bot’s commands, or use `/help` for details. Previously configured server prefixes are kept only for migration history; they do not activate text commands.')], allowedMentions: safeMentions });
  },
};
