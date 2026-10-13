import { EmbedBuilder } from 'discord.js';
import type { MessageReplyOptions } from 'discord.js';
import type { PrefixCommand } from '../contracts/commands.js';
import { slashCommands } from './index.js';

export function helpReply(args: readonly string[], prefix = '!kifo '): MessageReplyOptions {
  const query = args[0]?.toLowerCase().replace(/^\//, '');
  const command = slashCommands.find(command => command.data.name === query);
  const embed = new EmbedBuilder().setColor(0xa039a0);
  if (command) {
    embed.setTitle(`/${command.data.name}`).setDescription(command.data.description);
    if (command.data.options?.length) {
      embed.addFields(command.data.options.map(option => ({ name: option.name, value: option.description })));
    }
  } else if (query && query !== 'help') {
    embed.setDescription(`Command "${query}" not found. Run \`${prefix}help\` to list available commands.`);
  } else {
    embed.setTitle('Available commands').setDescription(`Use slash commands below, or \`${prefix}help <command>\` for details.`)
      .addFields(slashCommands.map(command => ({ name: `/${command.data.name}`, value: command.data.description })))
      .addFields({ name: `${prefix}help`, value: 'List available commands or show help for a command.' });
  }
  return { embeds: [embed] };
}

export function createHelpCommand(prefix = '!kifo '): PrefixCommand {
  return {
    name: 'help',
    description: 'List available commands or show help for a command.',
    async execute(message, args) {
      await message.reply(helpReply(args, prefix));
    },
  };
}
