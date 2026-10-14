import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { createPool, DatabaseError, query } from '../../src/db/index.js';

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
