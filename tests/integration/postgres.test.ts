import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { assertSchemaReady, createPool, loadPrefixes, query, runMigrations } from '../../src/db/index.js';
import { DurableScheduler } from '../../src/scheduler/index.js';

const databaseUrl = process.env['DATABASE_URL'];

test('PostgreSQL migrations, prefix hydration and durable concurrent scheduling', {
  skip: !databaseUrl,
  timeout: 30_000,
}, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `kifo_test_${randomUUID().replaceAll('-', '')}`;
  const isolatedUrl = new URL(databaseUrl!);
  isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
  const pool = createPool(isolatedUrl.toString());
  const migrationDirectory = await mkdtemp(join(tmpdir(), 'kifo-migrations-'));
  const errors: unknown[] = [];
  const workers: DurableScheduler[] = [];
  admin.on('error', (error: unknown) => errors.push(error));
  pool.on('error', (error: unknown) => errors.push(error));
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    await assert.rejects(assertSchemaReady(pool), /Database schema is not ready/);
    await Promise.all([runMigrations(pool), runMigrations(pool)]);
    await assertSchemaReady(pool);
    await query(pool, "UPDATE schema_migrations SET filename = '001_wrong.sql' WHERE version = '001'");
    await assert.rejects(assertSchemaReady(pool), /Database schema is not ready/);
    await query(pool, "UPDATE schema_migrations SET filename = '001_baseline.sql' WHERE version = '001'");
    assert.equal((await query(pool, 'SELECT * FROM schema_migrations')).rowCount, 1);
    await query(pool, 'INSERT INTO guild_settings (guild_id, prefix) VALUES ($1, $2)', ['123', '!custom ']);
    assert.deepEqual(await loadPrefixes(pool), new Map([['123', '!custom ']]));

    await cp(resolve('migrations/001_baseline.sql'), join(migrationDirectory, '001_baseline.sql'));
    await writeFile(join(migrationDirectory, '002_broken.sql'), 'CREATE TABLE rollback_probe (id integer); SELECT no_such_column;');
    await assert.rejects(runMigrations(pool, migrationDirectory), /Database operation failed/);
    assert.equal((await query<{ name: string | null }>(pool, "SELECT to_regclass('rollback_probe')::text AS name")).rows[0]?.name, null);
    assert.equal((await query(pool, 'SELECT * FROM schema_migrations')).rowCount, 1);
    await rm(join(migrationDirectory, '002_broken.sql'));
    const baseline = await readFile(join(migrationDirectory, '001_baseline.sql'), 'utf8');
    await writeFile(join(migrationDirectory, '001_baseline.sql'), `${baseline}\n-- changed\n`);
    await assert.rejects(runMigrations(pool, migrationDirectory), /missing or has changed/);

    await query(pool, `INSERT INTO scheduled_jobs (type, payload, run_at) VALUES
      ('test', '{"name":"due"}', now()), ('unsupported', '{}', now())`);
    await query(pool, `INSERT INTO scheduled_jobs
      (type, payload, run_at, status, attempts, lease_token, lease_until) VALUES
      ('test', '{"name":"expired"}', now(), 'running', 1, $1, now() - interval '1 second'),
      ('test', '{}', now(), 'running', 3, $2, now() - interval '1 second')`, [randomUUID(), randomUUID()]);
    const handled: string[] = [];
    let active = 0;
    let peakActive = 0;
    for (let index = 0; index < 2; index += 1) {
      const worker = new DurableScheduler({
        pool,
        handlers: { test: async (job) => {
          handled.push(job.id);
          active += 1;
          peakActive = Math.max(peakActive, active);
          await new Promise((done) => setTimeout(done, 50));
          active -= 1;
        } },
        logger: { error: (_message, error) => { errors.push(error); } },
        batchSize: 1,
        pollIntervalMs: 10,
        handlerTimeoutMs: 100,
        leaseMs: 1_000,
      });
      workers.push(worker);
      worker.start();
    }
    const deadline = Date.now() + 5_000;
    let completed = 0;
    do {
      completed = (await query(pool, "SELECT id FROM scheduled_jobs WHERE status = 'completed'")).rowCount ?? 0;
      if (completed === 2) break;
      await new Promise((done) => setTimeout(done, 20));
    } while (Date.now() < deadline);
    await Promise.all(workers.map((worker) => worker.stop()));
    assert.equal(completed, 2);
    assert.equal(handled.length, 2);
    assert.equal(new Set(handled).size, 2);
    assert.equal(peakActive, 2);
    const unsupported = await query<{ status: string; attempts: number }>(pool,
      "SELECT status, attempts FROM scheduled_jobs WHERE type = 'unsupported'");
    assert.deepEqual(unsupported.rows, [{ status: 'pending', attempts: 0 }]);
    assert.equal((await query(pool, "SELECT id FROM scheduled_jobs WHERE status = 'failed'")).rowCount, 1);
    assert.equal(errors.length, 0);
    await query(pool, 'DROP TABLE scheduled_jobs');
    await assert.rejects(assertSchemaReady(pool), /Database schema is not ready/);
  } finally {
    await Promise.all(workers.map((worker) => worker.stop()));
    await pool.end();
    try {
      await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
      await rm(migrationDirectory, { recursive: true, force: true });
    }
  }
});
