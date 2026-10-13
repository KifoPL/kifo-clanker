import { writeFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { exportMysqlSnapshot, mysqlExportError, readMysqlExportConfig } from '../src/db/export-mysql.js';

async function main(): Promise<void> {
  const [path, option, ddlPath, extra] = process.argv.slice(2);
  if (!path || path.startsWith('--') || extra || (option !== undefined && (option !== '--ddl' || !ddlPath || ddlPath.startsWith('--')))) {
    throw new Error('Usage: tsx scripts/export-mysql.ts snapshot.json [--ddl schema.json]');
  }
  if (ddlPath === path) throw new Error('Snapshot and schema filenames must differ.');
  const config = readMysqlExportConfig(process.env);
  let connection: mysql.Connection;
  try {
    connection = await mysql.createConnection({ uri: config.sourceUrl, timezone: config.timezone,
      dateStrings: true, supportBigNumbers: true, bigNumberStrings: true,
      multipleStatements: false, connectTimeout: 5_000 });
  } catch (error) {
    throw mysqlExportError(error);
  }
  try {
    const result = await exportMysqlSnapshot({
      query: (sql, values = []) => connection.query({ sql, timeout: 30_000 }, [...values]),
    }, config.timezone, !!ddlPath);
    await writeFile(path, `${JSON.stringify(result.snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    if (ddlPath) await writeFile(ddlPath, `${JSON.stringify(result.ddl, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ exported: true, ...result.report }, null, 2));
    if (!result.report.valid) process.exitCode = 1;
  } finally {
    await connection.end().catch((error: unknown) => { throw mysqlExportError(error); });
  }
}

main().catch((error: unknown) => {
  const isFileError = error && typeof error === 'object' && 'code' in error && ['EEXIST', 'ENOENT', 'EACCES'].includes(String(error.code));
  console.error(isFileError ? 'Cannot create output file; use a new filename in a writable directory.' : error instanceof Error ? error.message : 'MySQL export failed.');
  process.exitCode = 1;
});
