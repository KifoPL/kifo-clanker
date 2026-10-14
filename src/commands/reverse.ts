import { BOT_COLOR, BOT_NAME, BOT_URLS } from '../constants.js';
import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { InteractionReplyOptions } from 'discord.js';
import type { SlashCommand } from '../contracts/commands.js';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function reverseText(text: string): string {
  return Array.from(segmenter.segment(text), part => part.segment).reverse().join('');
}

export function reverseReply(text: string, silent: boolean, userTag: string): InteractionReplyOptions {
  if (!text.length) return { content: 'Provide text to reverse.', flags: MessageFlags.Ephemeral };
  return {
    embeds: [new EmbedBuilder()
      .setColor(BOT_COLOR)
      .setAuthor({ name: `Powered by ${BOT_NAME}™`, url: BOT_URLS.support })
      .setTitle(`Command "REVERSE" issued by ${userTag}`)
      .setDescription(reverseText(text))],
    ...(silent ? { flags: MessageFlags.Ephemeral } : {}),
  };
}

export const reverse: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('reverse')
    .setDescription('This command reverses anything you type.')
    .addStringOption(option => option.setName('text').setDescription('The text to reverse').setRequired(true).setMinLength(1).setMaxLength(4096))
    .addBooleanOption(option => option.setName('silent').setDescription('Whether to show the result to only you, or everyone. False by default.'))
    .toJSON(),
  async execute(interaction) {
    await interaction.reply(reverseReply(
      interaction.options.getString('text', true),
      interaction.options.getBoolean('silent') ?? false,
      interaction.user.tag,
    ));
  },
};
