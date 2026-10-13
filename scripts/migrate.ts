import { createPool, DatabaseError, runMigrations } from '../src/db/index.js';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations.');
  const pool = createPool(databaseUrl, 1);
  pool.on('error', (error: unknown) => {
    console.error(new DatabaseError(error).message);
    process.exitCode = 1;
  });
  try {
    await runMigrations(pool);
    console.log('Database migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Migration failed.');
  process.exitCode = 1;
});
