import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import type { ContextCommand } from '../../contracts/commands.js';
import { saveBookmark } from './shared.js';
export const saveData = new ContextMenuCommandBuilder().setName('save').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel).toJSON();
export const save: ContextCommand = {
  data: saveData,
  async execute(interaction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await saveBookmark(interaction.user, interaction.targetMessage);
      await interaction.editReply({ content: 'Saved a copy in DM! React with ❌ to delete it.' });
    } catch (error) { await interaction.editReply({ content: error instanceof Error ? error.message : 'Could not save the message. Check that your DMs are open.' }); }
  },
};
