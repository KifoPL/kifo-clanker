import type { Pool, PoolClient } from 'pg';
import { DatabaseError, query } from './query.js';

export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    throw new DatabaseError(error);
  }
  let destroyClient = false;
  try {
    await query(client, 'BEGIN');
    const result = await fn(client);
    await query(client, 'COMMIT');
    return result;
  } catch (error) {
    try {
      await query(client, 'ROLLBACK');
    } catch {
      destroyClient = true;
    }
    throw error;
  } finally {
    client.release(destroyClient);
  }
}
