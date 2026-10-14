import type { Pool } from 'pg';
import { query } from './query.js';

export async function retryJob(pool: Pool, id: string): Promise<string> {
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9_223_372_036_854_775_807n) {
    throw new Error('Job ID must be a positive PostgreSQL bigint decimal string.');
  }
  const result = await query<{ id: string }>(pool, `UPDATE scheduled_jobs
    SET status = 'pending', attempts = 0, lease_token = NULL, lease_until = NULL,
        last_error = NULL, completed_at = NULL
    WHERE id = $1 AND status = 'failed' RETURNING id`, [id]);
  const retried = result.rows[0]?.id;
  if (!retried) throw new Error('Job does not exist or is not failed; only failed jobs can be retried.');
  return retried;
}
