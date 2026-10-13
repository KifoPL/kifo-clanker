import pg from 'pg';

export function createPool(databaseUrl: string, max = 5): pg.Pool {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!Number.isInteger(max) || max < 1 || max > 20) {
    throw new Error('Database pool size must be an integer from 1 to 20.');
  }
  return new pg.Pool({
    connectionString: databaseUrl,
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    lock_timeout: 5_000,
    keepAlive: true,
  });
}
