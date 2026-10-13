import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { color, fetchVisibleMessage, safeMentions, textFile, utilityError } from './shared.js';
export const todoData = new SlashCommandBuilder().setName('todo').setDescription('Send yourself a pinned to-do note in DMs.').setContexts(InteractionContextType.Guild)
  .addStringOption(option => option.setName('text').setDescription('Your task description.').setMaxLength(4000))
  .addStringOption(option => option.setName('link').setDescription('Discord message ID or link to include in the note.').setMaxLength(300)).toJSON();
export function createTodo(services: RuntimeServices): InvocationCommand {
  return {
    name: 'todo', category: 'UTILITY', guildOnly: true, usage: ['/todo text:<description>', '/todo link:<Discord message link> [text:<description>]'], description: 'Send yourself a pinned to-do note in DMs. React to the note to delete it.',
    async execute(invocation, args) {
      try {
        const [link = '', text = ''] = args;
        if (!link && !text.trim()) throw new Error('Provide /todo text:<description> or link:<Discord message link> [text:<description>].');
        const target = link ? await fetchVisibleMessage(services.client, invocation.author.id, invocation.channel, link) : undefined;
        const description = target ? `${target.content}\n==========\n${text}` : text;
        const embed = new EmbedBuilder().setColor(color).setTitle('A new task awaits!').setAuthor({ name: 'TODO' })
          .setDescription(description.slice(0, 4096)).setTimestamp().addFields({ name: 'Finished?', value: 'React with ✅ (or any other reaction) to mark it as done and delete this note.' });
        if (target) embed.addFields({ name: 'Link', value: `[Click for original message!](${target.url})` });
        const copy = await invocation.author.send({ embeds: [embed], files: description.length > 4096 ? [textFile(description, 'todo.txt')] : [], allowedMentions: safeMentions });
        await copy.react('✅').catch(error => services.logger.error('Could not add TODO completion reaction', error));
        await copy.pin().catch(error => services.logger.error('Could not pin TODO note', error));
        await invocation.reply({ content: 'Knock knock, I just left you a note in DMs!', allowedMentions: safeMentions });
      } catch (error) { await utilityError(invocation, error); }
    },
  };
}
