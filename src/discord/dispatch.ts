import { MessageFlags, PermissionsBitField, type ChatInputCommandInteraction, type ContextMenuCommandInteraction, type Message } from 'discord.js';
import type { ContextCommand, PrefixCommand, SlashCommand } from '../contracts/commands.js';
import { logger } from '../logger.js';
import { withSpan } from '../observability.js';

export async function dispatchInteraction(interaction: ChatInputCommandInteraction, commands: readonly SlashCommand[]): Promise<void> {
  const command = commands.find(item => item.data.name === interaction.commandName);
  try {
    if (!command) {
      await interaction.reply({ content: 'Unknown command. Please ask the bot owner to refresh command registration.', flags: MessageFlags.Ephemeral });
      return;
    }
    await withSpan('discord.command', { command: command.data.name, kind: 'slash' }, () => command.execute(interaction));
    logger.info(`Slash command completed: ${command.data.name}`);
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

export async function dispatchMessage(message: Message, prefix: string, commands: readonly PrefixCommand[], ownerIds: ReadonlySet<string> = new Set(), slash: readonly SlashCommand[] = []): Promise<void> {
  if (message.author.bot) return;
  const parsed = parsePrefix(message.content, prefix);
  if (!parsed) return;
  const help = parsed.args[0]?.toLowerCase() === 'help';
  const command = commands.find(item => item.name === (help ? 'help' : parsed.name));
  if (!command) {
    await message.reply({ content: slash.some(item => item.data.name === parsed.name)
      ? `Use \`/${parsed.name}\` for this command.` : `Unknown command. Use \`${prefix}help\` to see available commands.` });
    return;
  }
  if (command.ownerOnly && !ownerIds.has(message.author.id)) { await message.reply('Only the bot owner can use this command.'); return; }
  if (command.guildOnly && !message.guild) { await message.reply('This command requires a server.'); return; }
  if (command.permissions && message.guild && !message.member?.permissionsIn(message.channelId).has(new PermissionsBitField([...command.permissions]))) {
    await message.reply('You do not have the required permissions in this channel.'); return;
  }
  try {
    await withSpan('discord.command', { command: command.name, kind: 'prefix' }, () => command.execute(message, help ? [parsed.name] : parsed.args));
    logger.info(`Prefix command completed: ${command.name}`);
  }
  catch (error) {
    logger.error('Prefix command failed', error);
    await message.reply('The command could not complete. Check the syntax and target permissions, or contact the bot owner.').catch(() => {});
  }
}

export async function dispatchContext(interaction: ContextMenuCommandInteraction, commands: readonly ContextCommand[]): Promise<void> {
  const command = commands.find(item => item.data.name === interaction.commandName);
  try {
    if (!command) { await interaction.reply({ content: 'Unknown context menu command.', flags: MessageFlags.Ephemeral }); return; }
    await withSpan('discord.command', { command: command.data.name, kind: 'context' }, () => command.execute(interaction));
    logger.info(`Context menu completed: ${command.data.name}`);
  } catch (error) {
    logger.error('Context menu command failed', error);
    const reply = { content: 'The command could not complete. Check access to the selected resource.', allowedMentions: { parse: [] as const } };
    try {
      if (interaction.deferred) await interaction.editReply(reply);
      else if (interaction.replied) await interaction.followUp({ ...reply, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
    } catch (responseError) { logger.error('Context menu error response failed', responseError); }
  }
}
