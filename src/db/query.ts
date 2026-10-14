import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { withSpan } from '../observability.js';

export class DatabaseError extends Error {
  readonly code: string | undefined;

  constructor(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error
      && typeof error.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code)
      ? error.code : undefined;
    super(code ? `Database operation failed (${code}).` : 'Database operation failed.');
    this.name = 'DatabaseError';
    this.code = code;
  }
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  connection: Pool | PoolClient,
  sql: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  try {
    const operation = /^\s*([a-z]+)/iu.exec(sql)?.[1]?.toUpperCase() || 'QUERY';
    return await withSpan('db.query', { operation }, () => connection.query<Row>(sql, [...values]));
  } catch (error) {
    throw new DatabaseError(error);
  }
}
