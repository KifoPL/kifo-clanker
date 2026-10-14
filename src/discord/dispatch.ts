import { MessageFlags, type ChatInputCommandInteraction, type ContextMenuCommandInteraction } from 'discord.js';
import type { ContextCommand, SlashCommand } from '../contracts/commands.js';
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
      if (interaction.deferred && !interaction.replied) await interaction.editReply(reply);
      else if (interaction.replied) await interaction.followUp({ ...reply, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
    } catch (responseError) { logger.error('Interaction error response failed', responseError); }
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
      if (interaction.deferred && !interaction.replied) await interaction.editReply(reply);
      else if (interaction.replied) await interaction.followUp({ ...reply, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral });
    } catch (responseError) { logger.error('Context menu error response failed', responseError); }
  }
}
