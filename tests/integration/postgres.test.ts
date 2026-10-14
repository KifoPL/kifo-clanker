import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { assertSchemaReady, createPool, enqueueJob, query, retryJob, runMigrations, withTransaction } from '../../src/db/index.js';
import { importSnapshot, verifyImport } from '../../src/db/import-snapshot.js';
import { prepareImport } from '../../src/db/import-plan.js';
import { DurableScheduler } from '../../src/scheduler/index.js';

const databaseUrl = process.env['DATABASE_URL'];
const migrationCount = (await readdir(resolve('migrations'))).filter((name) => name.endsWith('.sql')).length;

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
  let releaseHandlers!: () => void;
  const bothHandlersStarted = new Promise<void>((resolve) => { releaseHandlers = resolve; });
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
    assert.equal((await query(pool, 'SELECT * FROM schema_migrations')).rowCount, migrationCount);
    await query(pool, 'INSERT INTO guild_settings (guild_id, prefix) VALUES ($1, $2)', ['123', '!custom ']);
    assert.deepEqual((await query(pool, 'SELECT guild_id, prefix FROM guild_settings')).rows, [{ guild_id: '123', prefix: '!custom ' }]);

    await cp(resolve('migrations'), migrationDirectory, { recursive: true });
    await writeFile(join(migrationDirectory, '999_broken.sql'), 'CREATE TABLE rollback_probe (id integer); SELECT no_such_column;');
    await assert.rejects(runMigrations(pool, migrationDirectory), /Database operation failed/);
    assert.equal((await query<{ name: string | null }>(pool, "SELECT to_regclass('rollback_probe')::text AS name")).rows[0]?.name, null);
    assert.equal((await query(pool, 'SELECT * FROM schema_migrations')).rowCount, migrationCount);
    await rm(join(migrationDirectory, '999_broken.sql'));
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
          // Hold the first lease until another worker enters; elapsed time cannot prove concurrent claims.
          if (active === 2) releaseHandlers();
          await bothHandlersStarted;
          active -= 1;
        } },
        logger: { error: (_message, error) => { errors.push(error); } },
        batchSize: 1,
        pollIntervalMs: 10,
        handlerTimeoutMs: 5_000,
        leaseMs: 10_000,
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
    releaseHandlers();
    await Promise.all(workers.map((worker) => worker.stop()));
    assert.equal(completed, 2);
    assert.equal(handled.length, 2);
    assert.equal(new Set(handled).size, 2);
    assert.equal(peakActive, 2);
    const unsupported = await query<{ status: string; attempts: number }>(pool,
      "SELECT status, attempts FROM scheduled_jobs WHERE type = 'unsupported'");
    assert.deepEqual(unsupported.rows, [{ status: 'pending', attempts: 0 }]);
    assert.equal((await query(pool, "SELECT id FROM scheduled_jobs WHERE status = 'failed'")).rowCount, 1);
    const failed = (await query(pool, "SELECT * FROM scheduled_jobs WHERE status = 'failed'")).rows[0]!;
    assert.equal(await retryJob(pool, failed['id'] as string), failed['id']);
    const retried = (await query(pool, 'SELECT * FROM scheduled_jobs WHERE id = $1', [failed['id']])).rows[0]!;
    assert.deepEqual(retried, { ...failed, status: 'pending', attempts: 0, lease_token: null, lease_until: null, last_error: null, completed_at: null });
    await assert.rejects(retryJob(pool, failed['id'] as string), /only failed jobs/);
    const running = (await query<{ id: string }>(pool, `INSERT INTO scheduled_jobs
      (type, payload, run_at, status, attempts, lease_token, lease_until)
      VALUES ('unsupported', '{"retained":true}', now(), 'running', 1, $1, now() + interval '1 hour') RETURNING id`, [randomUUID()])).rows[0]!;
    await assert.rejects(retryJob(pool, running.id), /only failed jobs/);
    assert.equal((await query(pool, 'SELECT status FROM scheduled_jobs WHERE id = $1', [running.id])).rows[0]?.['status'], 'running');
    await assert.rejects(retryJob(pool, '9223372036854775808'), /bigint decimal string/);
    assert.equal(errors.length, 0);
    await query(pool, 'DROP TABLE scheduled_jobs');
    await assert.rejects(assertSchemaReady(pool), /Database schema is not ready/);
  } finally {
    releaseHandlers();
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

test('all13 snapshot tables import atomically, rerun safely and reconcile actual canonical values/jobs', {
  skip: !databaseUrl,
  timeout: 30_000,
}, async () => {
  const snapshot: unknown = JSON.parse(await readFile(new URL('../fixtures/mysql-snapshot.json', import.meta.url), 'utf8'));
  const admin = createPool(databaseUrl!, 1);
  const schema = `kifo_import_${randomUUID().replaceAll('-', '')}`;
  const isolatedUrl = new URL(databaseUrl!);
  isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
  const pool = createPool(isolatedUrl.toString());
  admin.on('error', () => {});
  pool.on('error', () => {});
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    await runMigrations(pool);
    const dryRun = await importSnapshot(pool, snapshot);
    assert.equal(dryRun.valid, true);
    assert.equal((await query(pool, 'SELECT * FROM guild_settings')).rowCount, 0);

    await query(pool, "INSERT INTO auto_reactions (channel_id, emojis) VALUES ('2234567890123456789', ARRAY['conflict'])");
    await assert.rejects(importSnapshot(pool, snapshot, true), /conflicts with an existing auto_reactions/);
    assert.equal((await query(pool, 'SELECT * FROM guild_settings')).rowCount, 0);
    assert.equal((await query(pool, 'SELECT * FROM scheduled_jobs')).rowCount, 0);
    await query(pool, 'DELETE FROM auto_reactions');

    assert.equal((await importSnapshot(pool, snapshot, true)).valid, true);
    assert.equal((await importSnapshot(pool, snapshot, true)).valid, true);
    const reconciled = await verifyImport(pool, snapshot);
    assert.equal(reconciled.matched, true);
    assert.equal(reconciled.actualPendingJobs, 7);
    assert.equal(reconciled.mismatches.length, 0);
    const planned = prepareImport(snapshot);
    const existing = planned.jobs[0]!;
    const id = await enqueueJob(pool, existing.type, existing.payload, new Date(existing.runAt), existing.dedupeKey);
    assert.ok(id);
    await assert.rejects(enqueueJob(pool, existing.type, { different: true }, new Date(existing.runAt), existing.dedupeKey), /conflicts with a different job/);

    await assert.rejects(withTransaction(pool, async (client) => {
      await query(client, "UPDATE guild_settings SET prefix = '!rollback '");
      throw new Error('rollback check');
    }), /rollback check/);
    assert.equal((await verifyImport(pool, snapshot)).matched, true);
    await query(pool, "UPDATE guild_settings SET prefix = '!changed '");
    const drift = await verifyImport(pool, snapshot);
    assert.equal(drift.matched, false);
    assert.equal(drift.mismatches[0]?.table, 'guild_settings');
    await query(pool, "UPDATE scheduled_jobs SET payload = '{}' WHERE deduplication_key = $1", [existing.dedupeKey]);
    assert.ok((await verifyImport(pool, snapshot)).mismatches.some((item) => item.table === 'scheduled_jobs'));

    await query(pool, `TRUNCATE ${Object.keys(planned.report.targetCounts).join(', ')}, scheduled_jobs CASCADE`);
    const permanent = structuredClone(snapshot) as { tables: Record<string, Record<string, unknown>[]> };
    for (const table of ['polls', 'role_remove', 'perms']) permanent.tables[table]![0]!['EndTime'] = null;
    permanent.tables['menu_perms']![0]!['EndDate'] = null;
    permanent.tables['menu_roles']![0]!['EndDate'] = '2030-01-02T12:34:56.123-05:00';
    const permissionRow = permanent.tables['perms']![0]!;
    permanent.tables['perms'] = ['add', 'deny', 'rm'].map((command, index) => ({ ...permissionRow,
      Id: String(index + 1), PermId: String(1_000 + index), Command: command }));
    assert.equal((await importSnapshot(pool, permanent, true)).valid, true);
    assert.equal((await verifyImport(pool, permanent)).matched, true);
    const states = await query<{ previous_state: string; restore_at: Date | null }>(pool,
      "SELECT previous_state, restore_at FROM moderation_operations WHERE kind = 'permission' ORDER BY target_id");
    assert.deepEqual(states.rows, [
      { previous_state: 'allow', restore_at: null }, { previous_state: 'deny', restore_at: null }, { previous_state: 'inherit', restore_at: null },
    ]);
    const precise = await query<{ expires_at: Date }>(pool, "SELECT expires_at FROM menus WHERE kind = 'role'");
    assert.equal(precise.rows[0]?.expires_at.toISOString(), '2030-01-02T17:34:56.123Z');
  } finally {
    await pool.end();
    try {
      await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  }
});
