import { EmbedBuilder } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { color, fetchVisibleMessage, safeMentions, textFile, utilityError } from './shared.js';
export function createTodo(services: RuntimeServices): PrefixCommand {
  return {
    name: 'todo', category: 'UTILITY', guildOnly: true, usage: ['todo <description>', 'todo <Discord message link> [description]'], description: 'Send yourself a pinned to-do note in DMs. React to the note to delete it.',
    async execute(message, args) {
      try {
        if (!args.length) throw new Error('Usage: todo <description> or todo <Discord message link> [description]');
        const linked = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\//u.test(args[0]!);
        const target = linked ? await fetchVisibleMessage(services.client, message.author.id, message.channel, args[0]!) : undefined;
        const description = target ? `${target.content}\n==========\n${args.slice(1).join(' ')}` : args.join(' ');
        const embed = new EmbedBuilder().setColor(color).setTitle('A new task awaits!').setAuthor({ name: 'TODO' })
          .setDescription(description.slice(0, 4096)).setTimestamp().addFields({ name: 'Finished?', value: 'React with ✅ (or any other reaction) to mark it as done and delete this note.' });
        if (target) embed.addFields({ name: 'Link', value: `[Click for original message!](${target.url})` });
        const copy = await message.author.send({ embeds: [embed], files: description.length > 4096 ? [textFile(description, 'todo.txt')] : [], allowedMentions: safeMentions });
        await copy.react('✅').catch(error => services.logger.error('Could not add TODO completion reaction', error));
        await copy.pin().catch(error => services.logger.error('Could not pin TODO note', error));
        await message.reply({ content: 'Knock knock, I just left you a note in DMs!', allowedMentions: safeMentions });
      } catch (error) { await utilityError(message, error); }
    },
  };
}
