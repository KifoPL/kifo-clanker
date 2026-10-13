import { createPool, DatabaseError, retryJob } from '../src/db/index.js';

async function main(): Promise<void> {
  const [id, extra] = process.argv.slice(2);
  if (!id || extra) throw new Error('Usage: tsx scripts/retry-job.ts <failed-job-id>');
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required to retry a job.');
  const pool = createPool(databaseUrl, 1);
  pool.on('error', (error: unknown) => { console.error(new DatabaseError(error).message); process.exitCode = 1; });
  try {
    console.log(`Scheduled job ${await retryJob(pool, id)} is pending again.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Job retry failed.');
  process.exitCode = 1;
});
