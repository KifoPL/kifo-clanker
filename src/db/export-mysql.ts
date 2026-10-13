import { legacyTables, prepareImport, type ImportIssue, type LegacyTable } from './import-plan.js';
import { legacyRow, timezoneOffset } from './import-validation.js';

export interface MysqlSnapshotConnection {
  query(sql: string, values?: readonly unknown[]): Promise<readonly [unknown, unknown]>;
}

class SnapshotError extends Error {}

export function readMysqlExportConfig(env: NodeJS.ProcessEnv): { sourceUrl: string; timezone: string } {
  const sourceUrl = env['MYSQL_SOURCE_URL'];
  if (!sourceUrl) throw new Error('MYSQL_SOURCE_URL is required.');
  let url: URL;
  try { url = new URL(sourceUrl); }
  catch { throw new Error('MYSQL_SOURCE_URL must be a valid MySQL URL with a database name.'); }
  if (url.protocol !== 'mysql:' || !url.hostname || !url.username || !/^\/[^/]+$/.test(url.pathname)
    || (url.port && (!Number.isInteger(Number(url.port)) || Number(url.port) < 1 || Number(url.port) > 65_535))) {
    throw new Error('MYSQL_SOURCE_URL must be a valid MySQL URL with a database name.');
  }
  if ([...url.searchParams.keys()].some((name) => !['ssl', 'charset'].includes(name))) {
    throw new Error('MYSQL_SOURCE_URL only supports ssl and charset query options; export safety options are fixed.');
  }
  return { sourceUrl, timezone: timezoneOffset(env['MYSQL_SOURCE_TIMEZONE']) };
}

export function mysqlExportError(error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string' && /^(?:ER_[A-Z0-9_]+|E[A-Z]+)$/.test(error.code) ? error.code : undefined;
  return new Error(code ? `MySQL export failed (${code}).` : 'MySQL export failed.');
}

export async function exportMysqlSnapshot(connection: MysqlSnapshotConnection, timezone: string, includeDdl = false): Promise<{
  snapshot: { timezone: string; tables: Record<LegacyTable, unknown[]> };
  ddl: Record<string, string>;
  report: { valid: boolean; warnings: string[]; issues: ImportIssue[]; sourceCounts: Record<string, number> };
}> {
  const offset = timezoneOffset(timezone);
  let transaction = false;
  try {
    await connection.query('SET SESSION time_zone = ?', [offset]);
    await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    transaction = true;
    const [metadata] = await connection.query(`SELECT TABLE_NAME AS table_name, ENGINE AS engine
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${legacyTables.map(() => '?').join(',')})`, [...legacyTables]);
    if (!Array.isArray(metadata) || legacyTables.some((table) => !metadata.some((row: unknown) => {
      const item = legacyRow(row);
      return item['table_name'] === table && item['engine'] === 'InnoDB';
    }))) throw new SnapshotError('All 13 legacy tables must exist and use InnoDB for a consistent snapshot.');
    const tables = {} as Record<LegacyTable, unknown[]>;
    const ddl: Record<string, string> = {};
    for (const table of legacyTables) {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      if (!Array.isArray(rows)) throw new SnapshotError(`Cannot export legacy table ${table}.`);
      tables[table] = rows;
      if (includeDdl) {
        const [definitions] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
        const definition = Array.isArray(definitions) ? legacyRow(definitions[0])['Create Table'] : undefined;
        if (typeof definition !== 'string') throw new SnapshotError(`Cannot capture schema for legacy table ${table}.`);
        ddl[table] = definition;
      }
    }
    await connection.query('COMMIT');
    transaction = false;
    // Buffer values become their standard JSON form before the same import validation runs.
    const snapshot = JSON.parse(JSON.stringify({ timezone: offset, tables })) as { timezone: string; tables: Record<LegacyTable, unknown[]> };
    const validation = prepareImport(snapshot).report;
    return { snapshot, ddl, report: { valid: validation.valid, issues: validation.issues, sourceCounts: validation.sourceCounts,
      warnings: ['The offset applies to unzoned MySQL datetimes; verify historical daylight-saving/timezone semantics.',
        'BIGINT IDs are exported as strings; legacy FLOAT/DOUBLE IDs that already lost precision cannot be repaired.'] } };
  } catch (error) {
    if (transaction) await connection.query('ROLLBACK').catch(() => {});
    throw error instanceof SnapshotError ? error : mysqlExportError(error);
  }
}
