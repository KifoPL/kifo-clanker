import type { Pool, PoolClient } from 'pg';
import { query } from './query.js';

export async function enqueueJob(
  connection: Pool | PoolClient,
  type: string,
  payload: unknown,
  runAt: Date,
  dedupeKey: string,
): Promise<string> {
  if (!type || !dedupeKey || !Number.isFinite(runAt.getTime())) throw new Error('Invalid scheduled job.');
  const serialized = JSON.stringify(payload);
  if (serialized === undefined) throw new Error('Scheduled job payload must be JSON.');
  const result = await query<{ id: string }>(connection, `
    INSERT INTO scheduled_jobs (type, payload, run_at, deduplication_key)
    VALUES ($1, $2::jsonb, $3, $4)
    ON CONFLICT (deduplication_key) DO UPDATE SET deduplication_key = EXCLUDED.deduplication_key
    WHERE scheduled_jobs.type = EXCLUDED.type AND scheduled_jobs.payload = EXCLUDED.payload
      AND scheduled_jobs.run_at = EXCLUDED.run_at
    RETURNING id`, [type, serialized, runAt, dedupeKey]);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Scheduled job deduplication key conflicts with a different job.');
  return id;
}
