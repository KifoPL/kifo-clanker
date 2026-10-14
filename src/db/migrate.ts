import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { DatabaseError, query } from './query.js';
import { readCatalog, validateCatalog } from './catalog.js';

const ledgerSql = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  filename text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

export async function readMigrations(directory = resolve('migrations')) {
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
  return migrations;
}

export async function runMigrations(pool: Pool, directory = resolve('migrations')): Promise<void> {
  const migrations = await readMigrations(directory);
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
    await query(client, ledgerSql);
    let applied;
    try {
      applied = await query<{ version: string; filename: string; checksum: string }>(
        client, 'SELECT version, filename, checksum FROM schema_migrations ORDER BY version',
      );
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '42703') {
        throw new Error('Existing table schema_migrations is incompatible: required migration metadata columns are missing.');
      }
      throw error;
    }
    for (const row of applied.rows) {
      const migration = migrations.find((candidate) => candidate.version === row.version);
      if (!migration || migration.name !== row.filename || migration.checksum !== row.checksum) {
        throw new Error(`Applied migration ${row.version} is missing or has changed.`);
      }
    }
    const appliedVersions = new Set(applied.rows.map((row) => row.version));
    const pending = migrations.filter((migration) => !appliedVersions.has(migration.version));
    // shortcut: replay assumes schema-only migrations; separate data migrations before adding them.
    const targetSchema = (await query<{ schema: string }>(client, 'SELECT current_schema() AS schema')).rows[0]?.schema;
    if (!targetSchema) throw new Error('Migration search_path must name an existing target schema.');
    const referenceSchema = `kifo_migration_check_${randomUUID().replaceAll('-', '')}`;
    let expected: Awaited<ReturnType<typeof readCatalog>> | undefined;
    if (pending.length) {
      await query(client, `CREATE SCHEMA ${referenceSchema}`);
      await query(client, "SELECT set_config('search_path',$1,true)", [referenceSchema]);
      await query(client, ledgerSql);
      for (const migration of migrations) await query(client, migration.sql);
      expected = await readCatalog(client, referenceSchema);
      await query(client, "SELECT set_config('search_path',$1,true)", [`"${targetSchema.replaceAll('"', '""')}"`]);
      validateCatalog(await readCatalog(client, targetSchema), expected, true);
    }
    for (const migration of pending) {
      try {
        await query(client, migration.sql);
      } catch (error) {
        if (error instanceof DatabaseError) {
          throw new Error(`Migration ${migration.name} cannot be applied safely to the existing schema or data${error.code ? ` (${error.code})` : ''}; the migration transaction was rolled back.`);
        }
        throw error;
      }
      await query(client, 'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
        [migration.version, migration.name, migration.checksum]);
    }
    if (expected) {
      validateCatalog(await readCatalog(client, targetSchema), expected);
      await query(client, `DROP SCHEMA ${referenceSchema} CASCADE`);
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
