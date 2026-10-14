import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { fetchVisibleMessage, saveBookmark } from '../utilities/shared.js';
export const bookmarkData = new SlashCommandBuilder().setName('bookmark').setDescription('Save a message and its attachments in your DMs.')
  .addStringOption(option => option.setName('message').setDescription('ID or URL of the message.').setRequired(true).setMaxLength(200))
  .addBooleanOption(option => option.setName('pin').setDescription('Pin the saved message. False by default.')).toJSON();
export function createBookmark(services: RuntimeServices): SlashCommand {
  return { data: bookmarkData, async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.channel?.isTextBased()) { await interaction.editReply({ content: 'This channel cannot contain saved messages.' }); return; }
    const message = await fetchVisibleMessage(services.client, interaction.user.id, interaction.channel, interaction.options.getString('message', true));
    await saveBookmark(interaction.user, message, interaction.options.getBoolean('pin') ?? false);
    await interaction.editReply({ content: 'Saved a copy in your DMs. You can also use Apps → Save on a message.' });
  } };
}
