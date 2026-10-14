import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { validateCatalog, type TableShape } from '../../src/db/catalog.js';
import { readMigrations, runMigrations } from '../../src/db/migrate.js';
import { withTransaction } from '../../src/db/transaction.js';

test('migration files require unique numeric versions and include content checksums', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kifo-migration-unit-'));
  try {
    await writeFile(join(directory, '001_test.sql'), 'SELECT 1');
    const first = (await readMigrations(directory))[0]!;
    await writeFile(join(directory, '001_test.sql'), 'SELECT 2');
    assert.notEqual((await readMigrations(directory))[0]?.checksum, first.checksum);
    await writeFile(join(directory, '001_duplicate.sql'), 'SELECT 3');
    await assert.rejects(readMigrations(directory), /versions must be unique/);
    await rm(join(directory, '001_duplicate.sql'));
    await writeFile(join(directory, 'not_versioned.sql'), 'SELECT 4');
    await assert.rejects(readMigrations(directory), /NNN_name.sql/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('changed applied migration rolls back and releases its client without applying DDL', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kifo-migration-unit-'));
  const calls: string[] = [];
  let destroyed: boolean | undefined;
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      return { rows: sql.startsWith('SELECT version') ? [{ version: '001', filename: '001_test.sql', checksum: 'changed' }] : [] };
    },
    release: (destroy: boolean) => { destroyed = destroy; },
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;
  try {
    await writeFile(join(directory, '001_test.sql'), 'CREATE TABLE untouched(id integer)');
    await assert.rejects(runMigrations(pool, directory), /Applied migration 001 is missing or has changed/);
    assert.equal(calls.at(-1), 'ROLLBACK');
    assert.equal(destroyed, false);
    assert.ok(!calls.some((sql) => sql.includes('CREATE TABLE untouched') || sql.includes('CREATE SCHEMA')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('catalog comparison ignores names/order but rejects unsafe structural differences', () => {
  const table: TableShape = { properties: { kind: 'r' }, columns: [{ name: 'id', type: 25 }, { name: 'value', type: 25 }],
    constraints: [{ kind: 'p', columns: ['id'] }], indexes: [{ name: 'expected_name', shape: { unique: true, columns: ['id'] } }] };
  const existing = structuredClone(table);
  existing.columns.reverse();
  existing.indexes[0]!.name = 'custom_constraint_name';
  const expected = new Map([['example', table]]);
  assert.doesNotThrow(() => validateCatalog(new Map([['example', existing]]), expected));
  existing.columns[0]!['type'] = 23;
  assert.throws(() => validateCatalog(new Map([['example', existing]]), expected), /Existing table example is incompatible: columns/);
  existing.columns[0]!['type'] = 25;
  existing.indexes.push({ name: 'unexpected_unique', shape: { unique: true, columns: ['value'] } });
  assert.throws(() => validateCatalog(new Map([['example', existing]]), expected), /unique indexes/);
});

test('transaction failure preserves its original error and destroys a client if rollback fails', async () => {
  const calls: string[] = [];
  let destroyed = false;
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (sql === 'ROLLBACK') throw new Error('Connection lost');
    return { rows: [] };
  }, release: (destroy: boolean) => { destroyed = destroy; } } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;
  await assert.rejects(withTransaction(pool, async () => { throw new Error('Original failure'); }), /Original failure/);
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK']);
  assert.equal(destroyed, true);
});
