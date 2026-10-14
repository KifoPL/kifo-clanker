import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createPool, query, runMigrations } from '../../src/db/index.js';
import { readMigrations } from '../../src/db/migrate.js';

const databaseUrl = process.env['DATABASE_URL'];

test('compatible untracked tables and indexes are adopted without changing existing rows', { skip: !databaseUrl, timeout: 30_000 }, async () => {
  const migrations = await readMigrations();
  for (const complete of [false, true]) {
    const admin = createPool(databaseUrl!, 1);
    const schema = `kifo_adopt_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    const pool = createPool(url.toString());
    try {
      await query(admin, `CREATE SCHEMA ${schema}`);
      for (const migration of complete ? migrations : migrations.slice(0, 1)) await query(pool, migration.sql);
      await query(pool, 'ALTER TABLE guild_settings RENAME CONSTRAINT guild_settings_pkey TO custom_guild_key');
      if (complete) await query(pool, 'ALTER TABLE scheduled_jobs DROP CONSTRAINT scheduled_jobs_deduplication_key_key');
      await query(pool, "INSERT INTO guild_settings VALUES ('123', '!before ')");
      const before = (await query(pool, "INSERT INTO scheduled_jobs (type,payload,run_at) VALUES ('legacy','{\"keep\":true}',now()) RETURNING *")).rows[0]!;
      await runMigrations(pool);
      await runMigrations(pool);
      assert.equal((await query(pool, 'SELECT prefix FROM guild_settings')).rows[0]?.['prefix'], '!before ');
      const after = (await query(pool, 'SELECT * FROM scheduled_jobs WHERE id=$1', [before['id']])).rows[0]!;
      assert.deepEqual(after, { ...before, deduplication_key: null });
      const next = (await query(pool, "INSERT INTO scheduled_jobs (type,payload,run_at) VALUES ('next','{}',now()) RETURNING id")).rows[0]!;
      assert.equal(BigInt(next['id'] as string), BigInt(before['id'] as string) + 1n);
      assert.equal((await query(pool, 'SELECT * FROM schema_migrations')).rowCount, migrations.length);
      await assert.rejects(query(pool, `INSERT INTO scheduled_jobs(type,payload,run_at,deduplication_key)
        VALUES ('a','{}',now(),'duplicate'),('b','{}',now(),'duplicate')`), /23505/);
    } finally {
      await pool.end();
      try { await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await admin.end(); }
    }
  }
});

test('incompatible preexisting types, constraints and named indexes are rejected atomically', { skip: !databaseUrl, timeout: 30_000 }, async () => {
  const migrations = await readMigrations();
  for (const defect of ['type', 'constraint', 'index', 'duplicate_dedupe'] as const) {
    const admin = createPool(databaseUrl!, 1);
    const schema = `kifo_reject_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    const pool = createPool(url.toString());
    try {
      await query(admin, `CREATE SCHEMA ${schema}`);
      for (const migration of migrations) await query(pool, migration.sql);
      await query(pool, "INSERT INTO guild_settings VALUES ('123', '!before ')");
      if (defect === 'type') await query(pool, 'ALTER TABLE guild_settings ALTER COLUMN prefix TYPE varchar(100)');
      if (defect === 'constraint') await query(pool, 'ALTER TABLE guild_settings DROP CONSTRAINT guild_settings_prefix_check');
      if (defect === 'index') {
        await query(pool, 'DROP INDEX scheduled_jobs_due_idx');
        await query(pool, 'CREATE INDEX scheduled_jobs_due_idx ON scheduled_jobs (type)');
      }
      if (defect === 'duplicate_dedupe') {
        await query(pool, 'ALTER TABLE scheduled_jobs DROP CONSTRAINT scheduled_jobs_deduplication_key_key');
        await query(pool, `INSERT INTO scheduled_jobs(type,payload,run_at,deduplication_key)
          VALUES ('a','{}',now(),'duplicate'),('b','{}',now(),'duplicate')`);
      }
      await assert.rejects(runMigrations(pool), defect === 'duplicate_dedupe'
        ? /Migration 002_shared.sql cannot be applied safely.*23505/
        : /Existing table (guild_settings|scheduled_jobs) is incompatible/);
      assert.equal((await query(pool, 'SELECT prefix FROM guild_settings')).rows[0]?.['prefix'], '!before ');
      assert.equal((await query<{ name: string | null }>(pool, "SELECT to_regclass('schema_migrations')::text AS name")).rows[0]?.name, null);
    } finally {
      await pool.end();
      try { await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await admin.end(); }
    }
  }
});
