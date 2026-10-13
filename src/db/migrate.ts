import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { DatabaseError, query } from './query.js';

export async function runMigrations(pool: Pool, directory = resolve('migrations')): Promise<void> {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  if (names.some((name) => !/^\d{3}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new Error('Migration filenames must use NNN_name.sql.');
  }
  const migrations = await Promise.all(names.map(async (name) => {
    const sql = await readFile(resolve(directory, name), 'utf8');
    return { name, version: name.slice(0, 3), sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
  if (new Set(migrations.map((migration) => migration.version)).size !== migrations.length) {
    throw new Error('Migration versions must be unique.');
  }
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    throw new DatabaseError(error);
  }
  let destroyClient = false;
  try {
    await query(client, 'BEGIN');
    await query(client, 'SELECT pg_advisory_xact_lock($1)', [1_802_078_307]);
    await query(client, `CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      filename text NOT NULL,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await query<{ version: string; filename: string; checksum: string }>(
      client, 'SELECT version, filename, checksum FROM schema_migrations ORDER BY version',
    );
    for (const row of applied.rows) {
      const migration = migrations.find((candidate) => candidate.version === row.version);
      if (!migration || migration.name !== row.filename || migration.checksum !== row.checksum) {
        throw new Error(`Applied migration ${row.version} is missing or has changed.`);
      }
    }
    const appliedVersions = new Set(applied.rows.map((row) => row.version));
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      await query(client, migration.sql);
      await query(client, 'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
        [migration.version, migration.name, migration.checksum]);
    }
    await query(client, 'COMMIT');
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
