import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPool, query, runMigrations } from '../../src/db/index.js';
import { persistGiveawayWinners } from '../../src/features/scheduled/handlers.js';
import { createScheduledHandlers } from '../../src/features/scheduled/handlers.js';
import { createPoll } from '../../src/features/scheduled/poll.js';
import { createGiveawaySlash } from '../../src/features/scheduled/giveaway.js';
import { DurableScheduler } from '../../src/scheduler/index.js';
import type { Pool } from 'pg';
import { nativeFixture } from '../unit/native-fixtures.js';
const databaseUrl = process.env.DATABASE_URL;
test('giveaway outcomes survive retries and concurrent attempts without rerolling', { skip: !databaseUrl, timeout: 30000 }, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `scheduled_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(databaseUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const first = createPool(url.toString());
  const retry = createPool(url.toString());
  let created = false;
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    created = true;
    await runMigrations(first);
    const id = randomUUID();
    await query(first, `INSERT INTO giveaways(id,guild_id,channel_id,message_id,user_id,winner_count,reaction,end_at) VALUES($1,'1','2','3','4',2,'✅',clock_timestamp())`, [id]);
    assert.deepEqual(await persistGiveawayWinners(first, id, ['111', '222']), ['111', '222']);
    assert.deepEqual(await persistGiveawayWinners(retry, id, ['333', '444']), ['111', '222']);
    const concurrentId = randomUUID();
    await query(first, `INSERT INTO giveaways(id,guild_id,channel_id,message_id,user_id,winner_count,reaction,end_at) VALUES($1,'1','2','5','4',1,'✅',clock_timestamp())`, [concurrentId]);
    const attempts = await Promise.all([persistGiveawayWinners(first, concurrentId, ['111']), persistGiveawayWinners(retry, concurrentId, ['222'])]);
    assert.deepEqual(attempts[0], attempts[1]);
    assert.ok(attempts[0]?.[0] === '111' || attempts[0]?.[0] === '222');
  } finally {
    await first.end();
    await retry.end();
    try { if (created) await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin.end(); }
  }
});

test('failed poll and giveaway setup cancel durable records before their timer can announce', { skip: !databaseUrl, timeout: 30000 }, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `scheduled_setup_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(databaseUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const pool = createPool(url.toString());
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    await runMigrations(pool);
    for (const type of ['poll', 'giveaway'] as const) {
      const current = nativeFixture(type === 'poll' ? { question: 'Question', timeout: '1m', one: 'A', two: 'B' }
        : { winners: 1, duration: '1m', emoji: '✅' });
      current.services.pool = pool;
      let reactions = 0;
      current.response.react = async () => { reactions++; };
      const failure = new Error('Discord setup unavailable');
      if (type === 'poll') current.interaction.editReply = async () => { throw failure; };
      else current.response.edit = async () => { throw failure; };
      const command = type === 'poll' ? createPoll(current.services) : createGiveawaySlash(current.services);
      await assert.rejects(command.execute(current.interaction), error => error === failure);
      const table = type === 'poll' ? 'polls' : 'giveaways';
      const row = (await query<{ id: string; completed_at: Date | null; terminal_reason: string }>(pool, `SELECT * FROM ${table}`)).rows[0]!;
      assert.ok(row.completed_at instanceof Date);
      assert.match(row.terminal_reason, /setup failed/);
      assert.equal(reactions, 0);
      await createScheduledHandlers(current.services)[`${type}.complete`]!({ id: 'job', type: `${type}.complete`, payload: { id: row.id }, attempts: 1 }, new AbortController().signal);
      assert.equal(current.channelSends.length, 0);
      assert.equal(current.dms.length, 0);
    }
  } finally {
    await pool.end();
    try { await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin.end(); }
  }
});

test('a PostgreSQL claim finishing after stop returns ownership without spending an attempt', { skip: !databaseUrl, timeout: 30000 }, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `scheduler_stop_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(databaseUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const pool = createPool(url.toString());
  let notifyClaim!: () => void;
  const claimed = new Promise<void>(resolve => { notifyClaim = resolve; });
  let releaseClaim!: () => void;
  const released = new Promise<void>(resolve => { releaseClaim = resolve; });
  let calls = 0;
  const errors: unknown[] = [];
  const pausedPool = { query: async (sql: string, values: unknown[] = []) => {
    const result = await pool.query(sql, values);
    if (sql.includes('WITH exhausted')) { notifyClaim(); await released; }
    return result;
  } } as unknown as Pool;
  const scheduler = new DurableScheduler({ pool: pausedPool, handlers: { test: async () => { calls++; } },
    logger: { error: (_message, error) => errors.push(error) }, handlerTimeoutMs: 5000, leaseMs: 10000 });
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    await runMigrations(pool);
    await query(pool, "INSERT INTO scheduled_jobs(type,payload,run_at) VALUES('test','{}',clock_timestamp())");
    scheduler.start();
    await claimed;
    const stopping = scheduler.stop();
    releaseClaim();
    await stopping;
    assert.equal(calls, 0);
    assert.deepEqual((await query(pool, 'SELECT status,attempts,lease_token,lease_until FROM scheduled_jobs')).rows,
      [{ status: 'pending', attempts: 0, lease_token: null, lease_until: null }]);
    assert.equal(errors.length, 0);
  } finally {
    releaseClaim();
    await scheduler.stop();
    await pool.end();
    try { await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin.end(); }
  }
});
