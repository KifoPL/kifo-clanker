import { BOT_COLOR } from '../../constants.js';
import { randomUUID } from 'node:crypto';
import { EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand, SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { enqueueJob, query, withTransaction } from '../../db/index.js';
import { giveawayReaction, parseDuration } from './shared.js';
import { invocationCommand } from '../../discord/invocation.js';
export const giveawayData = new SlashCommandBuilder().setName('giveaway').setDescription('Choose random winners from users who react before a deadline.')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.AddReactions)
  .addIntegerOption(option => option.setName('winners').setDescription('Number of distinct winners.').setRequired(true).setMinValue(1).setMaxValue(2147483647))
  .addStringOption(option => option.setName('duration').setDescription('Duration of at least 1 minute, for example 1h.').setRequired(true).setMaxLength(100))
  .addStringOption(option => option.setName('emoji').setDescription('Entry reaction, such as ✅ or a custom emoji.').setMaxLength(100)).toJSON();
export function createGiveaway(services: RuntimeServices): InvocationCommand {
  return { name: 'giveaway', description: 'Choose random winners from users who react before a deadline.', category: 'utility', guildOnly: true, permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AddReactions], usage: ['giveaway <winners> <duration> [emoji]'], async execute(message, args) {
    if (!message.inGuild() || !message.guild || !message.member?.permissionsIn(message.channelId).has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AddReactions]) || !message.guild.members.me?.permissionsIn(message.channelId).has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory])) { await message.reply('Use this in a server with Manage Channels and Add Reactions permissions.'); return; }
    const count = Number(args[0]);
    const duration = parseDuration(args[1] ?? '');
    const emoji = args[2] ?? '<a:done:828097348545544202>';
    const reaction = giveawayReaction(emoji);
    if (!Number.isSafeInteger(count) || count < 1 || count > 2147483647 || duration === undefined || reaction === undefined) { await message.reply('Usage: giveaway <positive integer winners> <duration of at least 1m> [emoji].'); return; }
    const placeholder = await message.reply({ content: 'Preparing giveaway…', allowedMentions: { parse: [], repliedUser: false } });
    const id = randomUUID();
    const end = new Date(Date.now() + duration);
    await withTransaction(services.pool, async connection => {
      await query(connection, 'INSERT INTO giveaways(id,guild_id,channel_id,message_id,user_id,winner_count,reaction,end_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, message.guildId, message.channelId, placeholder.id, message.author.id, count, reaction, end]);
      await enqueueJob(connection, 'giveaway.complete', { id }, end, `giveaway:${id}`);
    });
    try {
      await placeholder.edit({ content: `Ends at <t:${Math.floor(end.getTime() / 1000)}> (<t:${Math.floor(end.getTime() / 1000)}:R>).`, embeds: [new EmbedBuilder().setColor(BOT_COLOR).setTitle('GIVEAWAY!').setDescription(`React with ${emoji} to enter! ${count} winner${count === 1 ? '' : 's'} will be chosen.`)] });
      await placeholder.react(emoji);
    }
    catch (error) {
      await query(services.pool, "UPDATE giveaways SET completed_at=clock_timestamp(),terminal_reason='Giveaway setup failed' WHERE id=$1", [id]);
      await placeholder.edit({ content: 'Giveaway cancelled: I could not finish its setup.', embeds: [] })
        .catch(cleanupError => services.logger.error('Giveaway cancellation message failed', cleanupError));
      throw error;
    }
  } };
}

export function createGiveawaySlash(services: RuntimeServices): SlashCommand {
  return invocationCommand(giveawayData, createGiveaway(services), interaction => [
    String(interaction.options.getInteger('winners', true)),
    interaction.options.getString('duration', true),
    interaction.options.getString('emoji') ?? '<a:done:828097348545544202>',
  ], services, true);
}
