import { randomInt } from 'node:crypto';
import { DiscordAPIError, type Message, type MessageReaction } from 'discord.js';
import ms from 'ms';
import type { RuntimeServices } from '../../contracts/features.js';
import { PermanentJobError } from '../../scheduler/index.js';
export const pollOptionNames = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const pollReactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
export function giveawayReaction(value: string): string | undefined {
  const custom = /^(?:<a?:\w{2,32}:(\d{17,20})>|(\d{17,20}))$/u.exec(value);
  if (custom) return custom[1] ?? custom[2];
  const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value));
  return graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]|[0-9#*]\ufe0f?\u20e3/u.test(value) ? value : undefined;
}
export function parseDuration(value: string, maximum = Infinity): number | undefined {
  if (!value.trim() || value.length > 100) return undefined;
  const duration = ms(value as ms.StringValue);
  return typeof duration === 'number' && Number.isFinite(duration) && duration >= 60000 && duration <= maximum && Number.isFinite(new Date(Date.now() + duration).getTime()) ? duration : undefined;
}
export interface Participant { id: string; bot: boolean }
export async function collectParticipants(fetchPage: (after?: string) => Promise<readonly Participant[]>, signal?: AbortSignal): Promise<string[]> {
  const ids = new Set<string>();
  let after: string | undefined;
  for (;;) {
    signal?.throwIfAborted();
    const page = await fetchPage(after);
    for (const user of page) { if (!/^\d{1,22}$/u.test(user.id)) throw new Error('Invalid participant identifier'); if (!user.bot) ids.add(user.id); }
    if (page.length < 100) break;
    const next = page.reduce((max, user) => BigInt(user.id) > BigInt(max) ? user.id : max, '0');
    if (after && BigInt(next) <= BigInt(after)) throw new Error('Reaction pagination did not advance');
    after = next;
  }
  return [...ids];
}
export function reactionParticipants(reaction: MessageReaction, signal?: AbortSignal): Promise<string[]> {
  return collectParticipants(async after => [...(await reaction.users.fetch({ limit: 100, ...(after ? { after } : {}) })).values()], signal);
}
export function chooseWinners(ids: readonly string[], count: number, draw: (maximum: number) => number = randomInt): string[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid winner count');
  const remaining = [...new Set(ids)];
  const winners: string[] = [];
  while (winners.length < count && remaining.length) {
    const index = draw(remaining.length);
    if (!Number.isInteger(index) || index < 0 || index >= remaining.length) throw new Error('Invalid random index');
    winners.push(remaining.splice(index, 1)[0]!);
  }
  return winners;
}
export async function fetchJobMessage(services: RuntimeServices, channelId: string, messageId: string): Promise<Message> {
  const channel = await services.client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !('messages' in channel)) throw new PermanentJobError('Scheduled channel was deleted or cannot contain messages');
  return channel.messages.fetch(messageId);
}
export function terminalDiscordError(error: unknown): boolean {
  return error instanceof DiscordAPIError && [10003, 10004, 10008, 50001, 50013].includes(Number(error.code));
}
export function jobRecordId(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('id' in payload) || typeof payload.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(payload.id)) throw new PermanentJobError('Invalid scheduled record identifier');
  return payload.id;
}
