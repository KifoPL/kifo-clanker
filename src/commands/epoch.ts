import { BOT_COLOR, BOT_URLS } from '../constants.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { InteractionReplyOptions } from 'discord.js';
import ms from 'ms';
import type { SlashCommand } from '../contracts/commands.js';

type EpochInput = { epoch: number; kind: 'date' } | { epoch: number; kind: 'duration'; duration: number };

export function epochToIso(epoch: number): string | undefined {
  const date = new Date(epoch * 1000);
  return Number.isSafeInteger(epoch) && Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

export function parseEpochInput(input: string, now = Date.now()): EpochInput | undefined {
  const text = input.trim();
  if (!text || text.length > 100) return undefined;

  // ms checks duration syntax at runtime and returns undefined for unsupported strings.
  const duration = ms(text as ms.StringValue);
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    const epoch = Math.floor((now + duration) / 1000);
    return epochToIso(epoch) === undefined ? undefined : { epoch, kind: 'duration', duration };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/i.exec(text);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = monthDays[month - 1];
  if (maxDay === undefined || day < 1 || day > maxDay || Number(match[4] ?? 0) > 23 || Number(match[5] ?? 0) > 59 || Number(match[6] ?? 0) > 59) return undefined;

  // Dates without an offset use UTC, independent of the host timezone.
  const utcInput = /T/i.test(text) && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text) ? `${text}Z` : text;
  const epoch = Math.floor(Date.parse(utcInput) / 1000);
  return epochToIso(epoch) === undefined ? undefined : { epoch, kind: 'date' };
}

export function epochDateReply(input: string, now = Date.now()): InteractionReplyOptions {
  const parsed = parseEpochInput(input, now);
  if (!parsed) return invalidInputReply();
  const detected = parsed.kind === 'date' ? '__date__' : `__time period__: \`${ms(parsed.duration, { long: true })}\``;
  return {
    content: String(parsed.epoch),
    embeds: [new EmbedBuilder().setColor(BOT_COLOR).setDescription(
      `\`${input}\` detected as ${detected}: <t:${parsed.epoch}>, <t:${parsed.epoch}:R>.\n\n**The epoch (in seconds) is:** \`${parsed.epoch}\`.\nFor easier copying, the epoch is also in the message content.\n\nWrong output? Use ISO 8601 format, or read the guide at \`/epoch help\`.`,
    )],
  };
}

export function epochIsoReply(epoch: number): InteractionReplyOptions {
  const iso = epochToIso(epoch);
  if (iso === undefined) return invalidInputReply();
  return {
    content: iso,
    embeds: [new EmbedBuilder().setColor(BOT_COLOR).setDescription(
      `Detected date: <t:${epoch}>, <t:${epoch}:R>.\n\n**The date (ISO 8601 format) is:** \`${iso}\`.\nFor easier copying, the date is also in the message content.\n\nWrong output? Use epoch in *seconds*, or read the guide at \`/epoch help\`.`,
    )],
  };
}

function invalidInputReply(): InteractionReplyOptions {
  return { content: 'Unrecognized input. Use a valid ISO 8601 date, a time period, or epoch seconds. For help, see `/epoch help`.', flags: MessageFlags.Ephemeral };
}

export const epoch: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('epoch')
    .setDescription('Easily convert dates to epoch and vice versa.')
    .addSubcommand(command => command
      .setName('date_to_epoch').setDescription('Convert from date to epoch number (in seconds).')
      .addStringOption(option => option.setName('input').setDescription('Type a date like "1970-01-01T00:00:00Z", or a time period like "1h"').setRequired(true).setMaxLength(100)))
    .addSubcommand(command => command
      .setName('epoch_to_date').setDescription('Convert from epoch number (in seconds) to date.')
      .addIntegerOption(option => option.setName('epoch').setDescription('The number of seconds since 1970-01-01T00:00:00').setRequired(true)))
    .addSubcommand(command => command.setName('help').setDescription('Receive a link to the guide for this command.'))
    .toJSON(),
  async execute(interaction) {
    switch (interaction.options.getSubcommand()) {
      case 'date_to_epoch':
        await interaction.reply(epochDateReply(interaction.options.getString('input', true)));
        break;
      case 'epoch_to_date':
        await interaction.reply(epochIsoReply(interaction.options.getInteger('epoch', true)));
        break;
      case 'help':
        await interaction.reply({
          content: 'Click the button to learn more about the epoch converter.',
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
            .setLabel('Epoch Converter Guide').setStyle(ButtonStyle.Link)
            .setURL(BOT_URLS.guide('epoch')))],
          flags: MessageFlags.Ephemeral,
        });
        break;
    }
  },
};
