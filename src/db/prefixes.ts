import type { Pool } from 'pg';
import { query } from './query.js';

export async function loadPrefixes(pool: Pool): Promise<Map<string, string>> {
  const result = await query<{ guild_id: string; prefix: string }>(
    pool, 'SELECT guild_id, prefix FROM guild_settings',
  );
  return new Map(result.rows.map((row) => [row.guild_id, row.prefix]));
}
