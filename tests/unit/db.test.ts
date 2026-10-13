import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { createPool, DatabaseError, loadPrefixes, query } from '../../src/db/index.js';

test('database connection validation does not expose credentials', () => {
  assert.throws(() => createPool('https://secret:password@example.com/db'), /valid PostgreSQL URL/);
  assert.throws(() => createPool('not a URL'), /valid PostgreSQL URL/);
  assert.throws(() => createPool('postgres://localhost/db', 0), /pool size/);
});

test('query errors retain SQLSTATE without query text, values or server detail', async () => {
  const pool = { query: async () => {
    throw Object.assign(new Error('password=secret private payload'), { code: '23505', detail: 'private value' });
  } } as unknown as Pool;
  await assert.rejects(query(pool, 'SELECT secret', ['secret']), (error: unknown) => {
    assert.ok(error instanceof DatabaseError);
    assert.equal(error.code, '23505');
    assert.equal(error.message, 'Database operation failed (23505).');
    assert.equal('cause' in error, false);
    return true;
  });
  assert.equal(new DatabaseError({ code: 'secret value' }).message, 'Database operation failed.');
});

test('prefix hydration loads all guild settings with one query', async () => {
  let calls = 0;
  const pool = { query: async (sql: string) => {
    calls += 1;
    assert.equal(sql, 'SELECT guild_id, prefix FROM guild_settings');
    return { rows: [{ guild_id: '123', prefix: '!kifo ' }, { guild_id: '456', prefix: '??' }] };
  } } as unknown as Pool;
  assert.deepEqual(await loadPrefixes(pool), new Map([['123', '!kifo '], ['456', '??']]));
  assert.equal(calls, 1);
});
