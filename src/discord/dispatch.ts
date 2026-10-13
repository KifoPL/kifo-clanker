import { MessageFlags, type ChatInputCommandInteraction, type Message } from 'discord.js';
import type { PrefixCommand, SlashCommand } from '../contracts/commands.js';
import { logger } from '../logger.js';

export async function dispatchInteraction(interaction: ChatInputCommandInteraction, commands: readonly SlashCommand[]): Promise<void> {
  const command = commands.find(item => item.data.name === interaction.commandName);
  try {
    if (!command) {
      await interaction.reply({ content: 'This command has not been migrated yet.', flags: MessageFlags.Ephemeral });
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    logger.error('Interaction failed', error);
    const reply = { content: 'The command failed. Please try again.', allowedMentions: { parse: [] as const } };
    try {
      if (interaction.deferred) await interaction.editReply(reply);
      else if (interaction.replied) await interaction.followUp({ ...reply, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
    } catch (responseError) { logger.error('Interaction error response failed', responseError); }
  }
}

export function parsePrefix(content: string, prefix: string): { name: string; args: string[] } | undefined {
  if (content.toLowerCase().trim() === prefix.toLowerCase().trim()) return { name: 'help', args: [] };
  if (!content.toLowerCase().startsWith(prefix.toLowerCase())) return;
  const [name, ...args] = content.slice(prefix.length).trim().split(/\s+/u);
  return { name: name?.toLowerCase() || 'help', args };
}

export async function dispatchMessage(message: Message, prefix: string, commands: readonly PrefixCommand[]): Promise<void> {
  if (message.author.bot) return;
  const parsed = parsePrefix(message.content, prefix);
  if (!parsed) return;
  const command = commands.find(item => item.name === parsed.name);
  if (!command) return;
  try { await command.execute(message, parsed.args); }
  catch (error) { logger.error('Prefix command failed', error); }
}
