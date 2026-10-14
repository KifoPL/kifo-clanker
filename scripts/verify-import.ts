import { readDatabaseConfig } from '../src/config.js';
import { readFile } from 'node:fs/promises';
import { createPool, DatabaseError } from '../src/db/index.js';
import { verifyImport } from '../src/db/import-snapshot.js';

async function main(): Promise<void> {
  const [path, extra] = process.argv.slice(2);
  if (!path || extra) throw new Error('Usage: tsx scripts/verify-import.ts snapshot.json');
  const { databaseUrl } = readDatabaseConfig(process.env);
  const snapshot: unknown = JSON.parse(await readFile(path, 'utf8'));
  const pool = createPool(databaseUrl, 1);
  pool.on('error', (error: unknown) => { console.error(new DatabaseError(error).message); process.exitCode = 1; });
  try {
    const report = await verifyImport(pool, snapshot);
    console.log(JSON.stringify(report, null, 2));
    if (!report.matched) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof SyntaxError ? 'Snapshot is not valid JSON.' : error instanceof Error ? error.message : 'Reconciliation failed.');
  process.exitCode = 1;
});
