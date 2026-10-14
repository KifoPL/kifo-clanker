import { BOT_COLOR } from '../constants.js';
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { InteractionReplyOptions } from 'discord.js';
import type { SlashCommand } from '../contracts/commands.js';

export function pingReply(reply: string | null): InteractionReplyOptions {
  return {
    embeds: [new EmbedBuilder().setColor(BOT_COLOR).setDescription(reply === null ? 'Pong!' : `Pong!\n${reply}`)],
    flags: MessageFlags.Ephemeral,
  };
}

export const ping: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('...pong?')
    .addStringOption(option => option.setName('reply').setDescription('What do you want me to reply with?').setMaxLength(4000))
    .toJSON(),
  async execute(interaction) {
    await interaction.reply(pingReply(interaction.options.getString('reply')));
  },
};
