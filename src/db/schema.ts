import type { Pool } from 'pg';
import { DatabaseError, query } from './query.js';

export async function assertSchemaReady(pool: Pool): Promise<void> {
  const notReady = 'Database schema is not ready. Run npm run migrate before starting the bot.';
  try {
    const result = await query<{ filename: string }>(pool,
      'SELECT filename FROM schema_migrations WHERE version = $1', ['001']);
    if (result.rows[0]?.filename !== '001_baseline.sql') throw new Error(notReady);
    await query(pool, 'SELECT guild_id, prefix FROM guild_settings LIMIT 0');
    await query(pool, `SELECT id, type, payload, run_at, attempts, max_attempts, status,
      lease_token, lease_until, last_error, completed_at, created_at FROM scheduled_jobs LIMIT 0`);
  } catch (error) {
    if (error instanceof DatabaseError && ['42P01', '42703'].includes(error.code ?? '')) {
      throw new Error(notReady);
    }
    throw error;
  }
}
