import { readDatabaseConfig } from '../src/config.js';
import { readFile } from 'node:fs/promises';
import { createPool, DatabaseError } from '../src/db/index.js';
import { prepareImport } from '../src/db/import-plan.js';
import { importSnapshot } from '../src/db/import-snapshot.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const path = args.find((arg) => !arg.startsWith('--'));
  if (!path || args.some((arg) => arg.startsWith('--') && arg !== '--apply' && arg !== '--dry-run')
    || (args.includes('--apply') && args.includes('--dry-run')) || args.filter((arg) => !arg.startsWith('--')).length !== 1) {
    throw new Error('Usage: tsx scripts/import-mysql.ts snapshot.json [--dry-run|--apply]');
  }
  const snapshot: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!args.includes('--apply')) {
    const report = prepareImport(snapshot).report;
    console.log(JSON.stringify({ mode: 'dry-run', ...report }, null, 2));
    if (!report.valid) process.exitCode = 1;
    return;
  }
  const { databaseUrl } = readDatabaseConfig(process.env);
  const pool = createPool(databaseUrl, 1);
  pool.on('error', (error: unknown) => { console.error(new DatabaseError(error).message); process.exitCode = 1; });
  try {
    const report = await importSnapshot(pool, snapshot, true);
    console.log(JSON.stringify({ mode: 'apply', applied: report.valid, ...report }, null, 2));
    if (!report.valid) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof SyntaxError ? 'Snapshot is not valid JSON.' : error instanceof Error ? error.message : 'Import failed.');
  process.exitCode = 1;
});
