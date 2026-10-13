import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPool, query, runMigrations } from '../../src/db/index.js';
import { persistGiveawayWinners } from '../../src/features/scheduled/handlers.js';
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
