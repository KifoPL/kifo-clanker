import { randomUUID } from 'node:crypto';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { enqueueJob, query, withTransaction } from '../../db/index.js';
import { giveawayReaction, parseDuration } from './shared.js';
export function createGiveaway(services: RuntimeServices): PrefixCommand {
  return { name: 'giveaway', description: 'Choose random winners from users who react before a deadline.', category: 'utility', guildOnly: true, permissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AddReactions], usage: ['giveaway <winners> <duration> [emoji]'], async execute(message, args) {
    if (!message.inGuild() || !message.member?.permissionsIn(message.channel).has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AddReactions]) || !message.guild.members.me?.permissionsIn(message.channel).has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory])) { await message.reply('Use this in a server with Manage Channels and Add Reactions permissions.'); return; }
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
    await placeholder.edit({ content: `Ends at <t:${Math.floor(end.getTime() / 1000)}> (<t:${Math.floor(end.getTime() / 1000)}:R>).`, embeds: [new EmbedBuilder().setColor(0xa039a0).setTitle('GIVEAWAY!').setDescription(`React with ${emoji} to enter! ${count} winner${count === 1 ? '' : 's'} will be chosen.`)] });
    try { await placeholder.react(emoji); }
    catch (error) {
      await query(services.pool, "UPDATE giveaways SET completed_at=clock_timestamp(),terminal_reason='Reaction setup failed' WHERE id=$1", [id]);
      await placeholder.edit({ content: 'Giveaway cancelled: I could not add that reaction.', embeds: [] });
      throw error;
    }
  } };
}
