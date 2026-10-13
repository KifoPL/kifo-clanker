import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import type { ContextCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { assertCanRead } from './shared.js';
import { detectLanguage } from './lang.js';
export const detectLanguageData = new ContextMenuCommandBuilder().setName('detect language').setType(ApplicationCommandType.Message).setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel).toJSON();
export function createDetectLanguage(services: RuntimeServices): ContextCommand {
  return {
    data: detectLanguageData,
    async execute(interaction) {
      if (!interaction.isMessageContextMenuCommand()) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const target = interaction.targetMessage;
        await assertCanRead(target.channel, interaction.user.id);
        await interaction.editReply({ embeds: [await detectLanguage(target.content, services.env.LANGUAGE_DETECT_KEY)] });
      } catch (error) { await interaction.editReply({ content: error instanceof Error ? error.message : 'Language detection failed.' }); }
    },
  };
}
