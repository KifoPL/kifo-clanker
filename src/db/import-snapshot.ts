import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { enqueueJob } from './jobs.js';
import { importTargetTables, prepareImport, type ImportPlan, type ImportRow } from './import-plan.js';
import { query } from './query.js';
import { assertSchemaReady } from './schema.js';
import { withTransaction } from './transaction.js';

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

function selection(row: ImportRow): { columns: string[]; where: string; values: unknown[] } {
  return { columns: Object.keys(row.values), where: row.key.map((key, index) => `${key} = $${index + 1}`).join(' AND '),
    values: row.key.map((key) => row.values[key]) };
}

async function readTarget(connection: Pool | PoolClient, row: ImportRow): Promise<unknown> {
  const select = selection(row);
  return canonical((await query(connection,
    `SELECT ${select.columns.join(', ')} FROM ${row.table} WHERE ${select.where}`, select.values)).rows[0]);
}

export async function importSnapshot(pool: Pool, snapshot: unknown, apply = false): Promise<ImportPlan['report']> {
  const plan = prepareImport(snapshot);
  if (!apply || !plan.report.valid) return plan.report;
  await assertSchemaReady(pool);
  await withTransaction(pool, async (client) => {
    await query(client, 'SELECT pg_advisory_xact_lock($1)', [1_802_078_308]);
    for (const row of plan.rows) {
      const columns = Object.keys(row.values);
      await query(client, `INSERT INTO ${row.table} (${columns.join(', ')})
        VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) ON CONFLICT DO NOTHING`,
      columns.map((column) => row.values[column]));
      if (!isDeepStrictEqual(await readTarget(client, row), canonical(row.values))) {
        throw new Error(`Import conflicts with an existing ${row.table} row; transaction rolled back.`);
      }
    }
    for (const job of plan.jobs) await enqueueJob(client, job.type, job.payload, new Date(job.runAt), job.dedupeKey);
  });
  return plan.report;
}

export interface ReconciliationReport {
  matched: boolean;
  expectedCounts: Record<string, number>;
  actualCounts: Record<string, number>;
  expectedPendingJobs: number;
  actualPendingJobs: number;
  mismatches: { table: string; key: unknown; expected: unknown; actual: unknown }[];
}

export async function verifyImport(pool: Pool, snapshot: unknown): Promise<ReconciliationReport> {
  const plan = prepareImport(snapshot);
  if (!plan.report.valid) throw new Error('Snapshot validation failed; run the import dry-run and resolve its errors.');
  await assertSchemaReady(pool);
  return withTransaction(pool, async (client) => {
    await query(client, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const report: ReconciliationReport = { matched: true, expectedCounts: plan.report.targetCounts, actualCounts: {},
      expectedPendingJobs: plan.jobs.length, actualPendingJobs: 0, mismatches: [] };
    for (const table of importTargetTables) {
      const count = (await query<{ count: string }>(client, `SELECT count(*)::text AS count FROM ${table}`)).rows[0]?.count;
      report.actualCounts[table] = Number(count);
      if (report.actualCounts[table] !== report.expectedCounts[table]) report.matched = false;
    }
    for (const row of plan.rows) {
      const actual = await readTarget(client, row);
      const expected = canonical(row.values);
      if (!isDeepStrictEqual(actual, expected)) {
        report.matched = false;
        report.mismatches.push({ table: row.table, key: selection(row).values, expected, actual: actual ?? null });
      }
    }
    report.actualPendingJobs = Number((await query<{ count: string }>(client,
      "SELECT count(*)::text AS count FROM scheduled_jobs WHERE status IN ('pending', 'running')")).rows[0]?.count);
    if (report.actualPendingJobs !== report.expectedPendingJobs) report.matched = false;
    for (const job of plan.jobs) {
      const actual = canonical((await query(client, `SELECT type, payload, run_at, status FROM scheduled_jobs
        WHERE deduplication_key = $1`, [job.dedupeKey])).rows[0]);
      const expected = { type: job.type, payload: job.payload, run_at: job.runAt, status: 'pending' };
      if (!isDeepStrictEqual(actual, expected)) {
        report.matched = false;
        report.mismatches.push({ table: 'scheduled_jobs', key: job.dedupeKey, expected, actual: actual ?? null });
      }
    }
    return report;
  });
}
