import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import { query } from './query.js';

interface Column { name: string; [key: string]: unknown }
interface Index { name: string; shape: { unique: boolean; [key: string]: unknown } }
export interface TableShape {
  properties: unknown;
  columns: Column[];
  constraints: unknown[];
  indexes: Index[];
}

export async function readCatalog(client: PoolClient, schema: string): Promise<Map<string, TableShape>> {
  const tables = await query<{ name: string; properties: unknown }>(client, `SELECT c.relname AS name,
    jsonb_build_object('kind',c.relkind,'partition',c.relispartition,'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,
      'inherits',EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=c.oid),
      'triggers',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal)) AS properties
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','p','v','m','f')`, [schema]);
  const columns = await query<{ table: string; shape: Column }>(client, `SELECT c.relname AS table,
      jsonb_build_object('name',a.attname,'type',a.atttypid,'modifier',a.atttypmod,'not_null',a.attnotnull,
        'identity',a.attidentity,'generated',a.attgenerated,'collation',a.attcollation,
        'default',pg_get_expr(d.adbin,d.adrelid)) AS shape
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE n.nspname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attname`, [schema]);
  const constraints = await query<{ table: string; shape: unknown }>(client, `SELECT t.relname AS table,
      jsonb_build_object('kind',c.contype,'deferrable',c.condeferrable,'deferred',c.condeferred,
        'validated',c.convalidated,'no_inherit',c.connoinherit,
        'columns',ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord),
        'expression',pg_get_expr(c.conbin,c.conrelid,true),
        'foreign_table',f.relname,'foreign_schema',CASE WHEN fn.nspname=$1 THEN '<self>' ELSE fn.nspname END,
        'foreign_columns',ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord),
        'update',c.confupdtype,'delete',c.confdeltype,'match',c.confmatchtype) AS shape
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      LEFT JOIN pg_class f ON f.oid=c.confrelid LEFT JOIN pg_namespace fn ON fn.oid=f.relnamespace
      WHERE n.nspname=$1 AND c.contype NOT IN ('u','n')`, [schema]);
  const indexes = await query<{ table: string; name: string; shape: Index['shape'] }>(client, `SELECT t.relname AS table,x.relname AS name,
      jsonb_build_object('unique',i.indisunique,'immediate',i.indimmediate,'valid',i.indisvalid,'ready',i.indisready,
        'nulls_not_distinct',i.indnullsnotdistinct,'method',am.amname,'keys',i.indnkeyatts,
        'columns',ARRAY(SELECT pg_get_indexdef(i.indexrelid,k,true) FROM generate_series(1,i.indnatts) k),
        'predicate',pg_get_expr(i.indpred,i.indrelid,true)) AS shape
      FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      JOIN pg_class x ON x.oid=i.indexrelid JOIN pg_am am ON am.oid=x.relam WHERE n.nspname=$1`, [schema]);
  const catalog = new Map(tables.rows.map((row) => [row.name,
    { properties: row.properties, columns: [] as Column[], constraints: [] as unknown[], indexes: [] as Index[] }]));
  for (const row of columns.rows) catalog.get(row.table)?.columns.push(row.shape);
  for (const row of constraints.rows) catalog.get(row.table)?.constraints.push(row.shape);
  for (const row of indexes.rows) catalog.get(row.table)?.indexes.push({ name: row.name, shape: row.shape });
  return catalog;
}

const sorted = (values: readonly unknown[]): unknown[] => [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

export function validateCatalog(actual: Map<string, TableShape>, expected: Map<string, TableShape>, beforeApply = false): void {
  for (const [name, table] of expected) {
    const existing = actual.get(name);
    if (!existing) {
      if (beforeApply) continue;
      throw new Error(`Existing table ${name} is incompatible: table is missing.`);
    }
    const fail = (part: string): never => { throw new Error(`Existing table ${name} is incompatible: ${part} differ; restore the expected schema before migrating.`); };
    if (!isDeepStrictEqual(existing.properties, table.properties)) fail('table properties');
    const expectedColumns = beforeApply && name === 'scheduled_jobs' && !existing.columns.some((column) => column.name === 'deduplication_key')
      ? table.columns.filter((column) => column.name !== 'deduplication_key') : table.columns;
    if (!isDeepStrictEqual(sorted(existing.columns), sorted(expectedColumns))) fail('columns, types, defaults or identity settings');
    if (!isDeepStrictEqual(sorted(existing.constraints), sorted(table.constraints))) fail('constraints');
    for (const index of table.indexes) {
      const named = existing.indexes.find((candidate) => candidate.name === index.name);
      if (named && !isDeepStrictEqual(named.shape, index.shape)) fail(`index ${index.name}`);
      if (!beforeApply && !existing.indexes.some((candidate) => isDeepStrictEqual(candidate.shape, index.shape))) fail(`index ${index.name}`);
    }
    if (existing.indexes.some((index) => index.shape.unique && !table.indexes.some((candidate) => isDeepStrictEqual(candidate.shape, index.shape)))) fail('unique indexes');
  }
}
