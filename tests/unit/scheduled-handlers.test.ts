import assert from 'node:assert/strict';
import test from 'node:test';
import { Collection, DiscordAPIError, type MessageCreateOptions } from 'discord.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { createScheduledHandlers } from '../../src/features/scheduled/handlers.js';
import { terminalDiscordError } from '../../src/features/scheduled/shared.js';

const id = '01234567-89ab-cdef-0123-456789abcdef';
const creatorId = '123456789012345678';
const firstId = '123456789012345679';
const secondId = '123456789012345680';
const apiError = (code: number) => new DiscordAPIError({ code, message: 'Unavailable' }, code,
  code < 50000 ? 404 : 403, 'GET', 'https://discord.com/api/v10/channels/1', {});

function fixture(type: 'poll' | 'giveaway' | 'countdown') {
  const record = {
    id, guild_id: '223456789012345678', channel_id: '323456789012345678', message_id: '423456789012345678', user_id: creatorId,
    completed_at: null as Date | null, outcome_message_id: null as string | null,
    question: 'Question', options: ['A', 'B'], outcome: null as Array<{ label: string; votes: number }> | null,
    winner_count: 2, reaction: '✅', winner_ids: null as string[] | null,
    status: 'scheduled', message: 'The deadline has arrived.',
  };
  const control = { fetchError: undefined as Error | undefined, replyError: undefined as Error | undefined,
    dmError: undefined as Error | undefined, failFinish: false };
  let freshReads = 0;
  const channelPosts: MessageCreateOptions[] = [];
  const dmBodies: MessageCreateOptions[] = [];
  const delivered = new Map<string, { id: string }>();
  const reactions = new Collection(['✅', '1️⃣', '2️⃣'].map(name => [name, {
    emoji: { name, id: null }, users: { fetch: async () => new Collection(name === '2️⃣' ? [] : [
      [firstId, { id: firstId, bot: false }], [secondId, { id: secondId, bot: false }],
      ['523456789012345678', { id: '523456789012345678', bot: true }],
    ]) },
  }]));
  const source = { embeds: [], reactions: { cache: reactions }, reply: async (body: MessageCreateOptions) => {
    if (control.replyError) throw control.replyError;
    channelPosts.push(body);
    return { id: '623456789012345678' };
  } };
  const stale = { ...source, reactions: { cache: new Collection() } };
  const services = { client: {
    channels: { fetch: async () => ({ isTextBased: () => true, messages: { fetch: async (options: unknown) => {
      if (control.fetchError) throw control.fetchError;
      if (options && typeof options === 'object' && 'force' in options && options.force === true) { freshReads++; return source; }
      return stale;
    } } }) },
    users: { fetch: async (recipient: string) => {
      assert.equal(recipient, creatorId);
      return { send: async (body: MessageCreateOptions) => {
        if (control.dmError) throw control.dmError;
        dmBodies.push(body);
        assert.equal(body.enforceNonce, true);
        const nonce = String(body.nonce);
        if (!delivered.has(nonce)) delivered.set(nonce, { id: '723456789012345678' });
        return delivered.get(nonce)!;
      } };
    } },
  }, pool: { query: async (sql: string, values: unknown[] = []) => {
    if (sql.includes('SELECT *')) return { rows: [record], rowCount: 1 };
    if (sql.includes('SET winner_ids=')) record.winner_ids = JSON.parse(String(values[1])) as string[];
    if (sql.includes('SET outcome=')) record.outcome = JSON.parse(String(values[1])) as typeof record.outcome;
    if (sql.includes('SET completed_at=')) {
      if (control.failFinish) throw new Error('Database unavailable');
      record.completed_at = new Date();
      record.outcome_message_id = values[1] as string | null;
    }
    return { rows: [], rowCount: 1 };
  } } } as unknown as RuntimeServices;
  const handler = createScheduledHandlers(services)[`${type}.complete`]!;
  return { record, control, channelPosts, dmBodies, delivered, freshReads: () => freshReads,
    run: (signal = new AbortController().signal) => handler({ id: 'job', type: `${type}.complete`, payload: { id }, attempts: 1 }, signal) };
}

test('poll completion reads current reactions rather than an old message cache', async () => {
  const current = fixture('poll');
  await current.run();
  assert.equal(current.freshReads(), 1);
  assert.deepEqual(current.record.outcome, [{ label: 'A', votes: 2 }, { label: 'B', votes: 0 }]);
});

test('permission loss or a removed guild retains uncomputed voting outcomes for retry', async () => {
  for (const type of ['poll', 'giveaway'] as const) for (const code of [50001, 50013, 10004]) {
    const current = fixture(type);
    current.control.fetchError = apiError(code);
    await assert.rejects(current.run(), error => error === current.control.fetchError);
    assert.equal(current.record.completed_at, null);
    assert.equal(current.dmBodies.length, 0);
  }
  assert.equal(terminalDiscordError(apiError(10008)), true);
});

test('persisted giveaway outcomes fall back to creator DMs without rerolling after forbidden delivery', async () => {
  const current = fixture('giveaway');
  current.record.winner_ids = [secondId];
  current.control.fetchError = apiError(50001);
  await current.run();
  assert.deepEqual(current.record.winner_ids, [secondId]);
  assert.equal(current.dmBodies.length, 1);
  assert.match(current.dmBodies[0]?.content ?? '', /Channel delivery unavailable/);
  assert.equal(current.record.outcome_message_id, '723456789012345678');
  assert.ok(current.record.completed_at instanceof Date);
});

test('fallback failure preserves persisted outcomes and retries use the same enforced nonce', async () => {
  const current = fixture('countdown');
  current.control.replyError = apiError(50013);
  current.control.dmError = apiError(50007);
  await assert.rejects(current.run());
  assert.equal(current.record.completed_at, null);
  current.control.dmError = undefined;
  current.control.failFinish = true;
  await assert.rejects(current.run(), /Database operation failed/);
  assert.equal(current.record.completed_at, null);
  current.control.failFinish = false;
  await current.run();
  assert.equal(current.dmBodies.length, 2);
  assert.equal(current.delivered.size, 1);
  assert.equal(current.dmBodies[0]?.nonce, current.dmBodies[1]?.nonce);
  assert.equal(current.record.outcome_message_id, '723456789012345678');
});

test('missing source messages do not discard already persisted countdown messages', async () => {
  const current = fixture('countdown');
  current.control.fetchError = apiError(10008);
  await current.run();
  assert.equal(current.dmBodies.length, 1);
  assert.ok(current.record.completed_at instanceof Date);
});

test('already cancelled scheduled work does not fetch Discord sources or collect new outcomes', async () => {
  for (const type of ['poll', 'giveaway', 'countdown'] as const) {
    const current = fixture(type);
    const controller = new AbortController();
    controller.abort(new Error('Stopping'));
    await assert.rejects(current.run(controller.signal), /Stopping/);
    assert.equal(current.freshReads(), 0);
    assert.equal(current.channelPosts.length, 0);
    assert.equal(current.dmBodies.length, 0);
    assert.equal(current.record.completed_at, null);
  }
});
