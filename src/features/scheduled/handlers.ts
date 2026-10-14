import { BOT_COLOR } from '../../constants.js';
import { AttachmentBuilder, EmbedBuilder, resolvePartialEmoji, type Message } from 'discord.js';
import type { Pool, PoolClient } from 'pg';
import type { RuntimeServices } from '../../contracts/features.js';
import { query } from '../../db/index.js';
import { PermanentJobError, type ScheduledHandler } from '../../scheduler/index.js';
import { chooseWinners, fetchJobMessage, jobRecordId, pollReactions, reactionParticipants, terminalDiscordError } from './shared.js';
interface BaseRecord { id: string; guild_id: string; channel_id: string; message_id: string; user_id: string; completed_at: Date | null; outcome_message_id: string | null }
interface Giveaway extends BaseRecord { winner_count: number; reaction: string | null; winner_ids: string[] | null }
interface PollOutcome { label: string; votes: number }
interface Poll extends BaseRecord { question: string | null; options: string[] | null; outcome: PollOutcome[] | null }
interface Countdown extends BaseRecord { message: string; status: string }
async function finish(services: RuntimeServices, table: 'polls' | 'giveaways' | 'countdowns', id: string, messageId?: string, terminalReason?: string): Promise<void> {
  await query(services.pool, `UPDATE ${table} SET completed_at=clock_timestamp(), outcome_message_id=$2, terminal_reason=$3${table === 'countdowns' ? ", status='completed'" : ''} WHERE id=$1`, [id, messageId ?? null, terminalReason ?? null]);
}
async function guarded(services: RuntimeServices, table: 'polls' | 'giveaways' | 'countdowns', id: string, work: () => Promise<void>): Promise<void> {
  try { await work(); }
  catch (error) { if (!terminalDiscordError(error) && !(error instanceof PermanentJobError)) throw error; await finish(services, table, id, undefined, 'Discord resource deleted or no longer accessible'); }
}
export function createScheduledHandlers(services: RuntimeServices): Record<string, ScheduledHandler> {
  return {
    'giveaway.complete': async (job, signal) => {
      const id = jobRecordId(job.payload);
      const row = (await query<Giveaway>(services.pool, 'SELECT * FROM giveaways WHERE id=$1', [id])).rows[0];
      if (!row || row.completed_at) return;
      if (row.outcome_message_id) { await finish(services, 'giveaways', id, row.outcome_message_id); return; }
      await guarded(services, 'giveaways', id, async () => {
        const message = await fetchJobMessage(services, row.channel_id, row.message_id);
        let winners = row.winner_ids;
        if (winners === null) {
          const legacyEmoji = /React with (.*?) to enter!/iu.exec(message.embeds[0]?.description ?? '')?.[1];
          const recovered = legacyEmoji ? resolvePartialEmoji(legacyEmoji) : null;
          const reactionId = row.reaction ?? recovered?.id ?? (recovered && 'name' in recovered ? recovered.name : undefined);
          if (!reactionId) throw new PermanentJobError('Giveaway reaction cannot be recovered');
          const reaction = message.reactions.cache.find(reaction => reaction.emoji.id === reactionId || reaction.emoji.name === reactionId);
          const participants = reaction ? await reactionParticipants(reaction, signal) : [];
          const chosen = chooseWinners(participants, row.winner_count);
          signal.throwIfAborted();
          winners = await persistGiveawayWinners(services.pool, id, chosen);
        }
        if (!Array.isArray(winners) || !winners.every(value => typeof value === 'string' && /^\d+$/u.test(value))) throw new Error('Invalid stored giveaway winners');
        signal.throwIfAborted();
        const text = winners.length ? winners.map(id => `- <@${id}>`).join('\n') : 'No eligible participants entered.';
        const announcement = await message.reply({ content: `<@${row.user_id}> Giveaway ended.`, embeds: [new EmbedBuilder().setColor(BOT_COLOR).setTitle('Giveaway results:').setDescription(text.length > 3500 ? 'Winners are listed in the attached file.' : text)], files: text.length > 3500 ? [new AttachmentBuilder(Buffer.from(text), { name: 'giveaway-winners.txt' })] : [], nonce: announcementNonce(id), enforceNonce: true, allowedMentions: { parse: [], users: [row.user_id], repliedUser: false } });
        await finish(services, 'giveaways', id, announcement.id);
      });
    },
    'poll.complete': async (job, signal) => {
      const id = jobRecordId(job.payload);
      const row = (await query<Poll>(services.pool, 'SELECT * FROM polls WHERE id=$1', [id])).rows[0];
      if (!row || row.completed_at) return;
      if (row.outcome_message_id) { await finish(services, 'polls', id, row.outcome_message_id); return; }
      await guarded(services, 'polls', id, async () => {
        const message = await fetchJobMessage(services, row.channel_id, row.message_id);
        let outcome = row.outcome;
        if (outcome === null) {
          const options = row.options ?? message.embeds[0]?.fields.map(field => field.value) ?? [];
          const calculated: PollOutcome[] = [];
          for (const [index, label] of options.entries()) {
            const reaction = message.reactions.cache.find(reaction => reaction.emoji.name === pollReactions[index]);
            calculated.push({ label, votes: reaction ? (await reactionParticipants(reaction, signal)).length : 0 });
          }
          calculated.sort((a, b) => b.votes - a.votes);
          signal.throwIfAborted();
          await query(services.pool, 'UPDATE polls SET outcome=$2 WHERE id=$1 AND outcome IS NULL', [id, JSON.stringify(calculated)]);
          outcome = (await query<Poll>(services.pool, 'SELECT * FROM polls WHERE id=$1', [id])).rows[0]!.outcome;
        }
        if (!Array.isArray(outcome)) throw new Error('Invalid stored poll outcome');
        signal.throwIfAborted();
        const announcement = await message.reply({ content: `<@${row.user_id}> Poll ended.`, embeds: [new EmbedBuilder().setColor(BOT_COLOR).setTitle('Poll results').setDescription((row.question ?? message.embeds[0]?.description ?? 'Poll').slice(0, 1800)).addFields(outcome.map((option, index) => ({ name: `${index + 1}. ${option.label}`.slice(0, 256), value: `${option.votes} votes` })))], nonce: announcementNonce(id), enforceNonce: true, allowedMentions: { parse: [], users: [row.user_id], repliedUser: false } });
        await finish(services, 'polls', id, announcement.id);
      });
    },
    'countdown.complete': async (job, signal) => {
      const id = jobRecordId(job.payload);
      const row = (await query<Countdown>(services.pool, 'SELECT * FROM countdowns WHERE id=$1', [id])).rows[0];
      if (!row || row.completed_at || row.status !== 'scheduled') return;
      if (row.outcome_message_id) { await finish(services, 'countdowns', id, row.outcome_message_id); return; }
      await guarded(services, 'countdowns', id, async () => {
        const message = await fetchJobMessage(services, row.channel_id, row.message_id);
        signal.throwIfAborted();
        const announcement = await message.reply({ content: `<@${row.user_id}> Countdown has ended!`, embeds: [new EmbedBuilder().setColor(BOT_COLOR).setTitle('Countdown has ended!').setDescription(row.message)], nonce: announcementNonce(id), enforceNonce: true, allowedMentions: { parse: [], users: [row.user_id], repliedUser: false } });
        await finish(services, 'countdowns', id, announcement.id);
      });
    },
    'countdown.expire': async (job, signal) => {
      const id = jobRecordId(job.payload);
      await query(services.pool, `UPDATE countdowns SET status='cancelled' WHERE id=$1 AND status='pending_confirmation' AND confirmation_expires_at <= clock_timestamp()`, [id]);
      const row = (await query<Countdown>(services.pool, `SELECT * FROM countdowns WHERE id=$1 AND status='cancelled' AND completed_at IS NULL AND confirmation_expires_at <= clock_timestamp()`, [id])).rows[0];
      if (!row) return;
      await guarded(services, 'countdowns', id, async () => {
        signal.throwIfAborted();
        const message: Message = await fetchJobMessage(services, row.channel_id, row.message_id);
        await message.edit({ content: 'Countdown confirmation expired.', components: [], embeds: [] });
        await query(services.pool, 'UPDATE countdowns SET completed_at=clock_timestamp(),outcome_message_id=$2 WHERE id=$1', [id, message.id]);
      });
    },
  };
}

// Discord deduplicates enforced nonces for a limited window; persist IDs immediately after sending.
export function announcementNonce(id: string): string { return id.replaceAll('-', '').slice(0, 25); }

export async function persistGiveawayWinners(connection: Pool | PoolClient, id: string, chosen: readonly string[]): Promise<string[]> {
  await query(connection, 'UPDATE giveaways SET winner_ids=$2 WHERE id=$1 AND winner_ids IS NULL', [id, JSON.stringify(chosen)]);
  const stored = (await query<Giveaway>(connection, 'SELECT * FROM giveaways WHERE id=$1', [id])).rows[0]?.winner_ids;
  if (!Array.isArray(stored) || !stored.every(value => typeof value === 'string' && /^\d+$/u.test(value))) throw new Error('Invalid stored giveaway winners');
  return stored;
}
