import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { exportMysqlSnapshot, mysqlExportError, readMysqlExportConfig, type MysqlSnapshotConnection } from '../../src/db/export-mysql.js';
import { legacyTables } from '../../src/db/import-plan.js';

const snapshot = JSON.parse(await readFile(new URL('../fixtures/mysql-snapshot.json', import.meta.url), 'utf8')) as {
  timezone: string; tables: Record<string, unknown[]>;
};

function fakeMysql(overrides: { engine?: string; fail?: boolean } = {}) {
  const calls: { sql: string; values: readonly unknown[] }[] = [];
  const connection: MysqlSnapshotConnection = { async query(sql, values = []) {
    calls.push({ sql, values });
    if (sql.includes('information_schema.TABLES')) return [legacyTables.map((table) => ({ table_name: table, engine: overrides.engine ?? 'InnoDB' })), []];
    const select = /^SELECT \* FROM `([a-z_]+)`$/.exec(sql);
    if (select) {
      if (overrides.fail) throw Object.assign(new Error('mysql://username:secret@private-host sensitive SQL'), { code: 'ER_ACCESS_DENIED_ERROR' });
      if (select[1] === 'ticketing') {
        const rows = structuredClone(snapshot.tables['ticketing']) as Record<string, unknown>[];
        rows[0]!['ArePublic'] = Buffer.from([1]);
        return [rows, []];
      }
      return [snapshot.tables[select[1]!]!, []];
    }
    const ddl = /^SHOW CREATE TABLE `([a-z_]+)`$/.exec(sql);
    if (ddl) return [[{ 'Create Table': `CREATE TABLE ${ddl[1]} (...) ENGINE=InnoDB` }], []];
    return [[], []];
  } };
  return { connection, calls };
}

test('MySQL export configuration requires explicit timezone and masks URLs in validation errors', () => {
  assert.throws(() => readMysqlExportConfig({}), /MYSQL_SOURCE_URL/);
  assert.throws(() => readMysqlExportConfig({ MYSQL_SOURCE_URL: 'https://username:secret@localhost/db', MYSQL_SOURCE_TIMEZONE: '+00:00' }), /valid MySQL URL/);
  assert.throws(() => readMysqlExportConfig({ MYSQL_SOURCE_URL: 'mysql://username:secret@localhost/db' }), /explicit UTC offset/);
  assert.throws(() => readMysqlExportConfig({ MYSQL_SOURCE_URL: 'mysql://username:secret@localhost/db', MYSQL_SOURCE_TIMEZONE: 'Europe/Warsaw' }), /explicit UTC offset/);
  assert.equal(readMysqlExportConfig({ MYSQL_SOURCE_URL: 'mysql://user:secret@localhost/db', MYSQL_SOURCE_TIMEZONE: '+02:00' }).timezone, '+02:00');
  assert.throws(() => readMysqlExportConfig({ MYSQL_SOURCE_URL: 'mysql://user:secret@localhost/db?debug=true', MYSQL_SOURCE_TIMEZONE: '+00:00' }), /safety options are fixed/);
  assert.equal(mysqlExportError(new Error('secret URL')).message, 'MySQL export failed.');
});

test('all13 reads and optional DDL share a read-only consistent snapshot and preserve raw ID/date/bit values', async () => {
  const { connection, calls } = fakeMysql();
  const exported = await exportMysqlSnapshot(connection, '+02:00', true);
  assert.deepEqual(calls[0], { sql: 'SET SESSION time_zone = ?', values: ['+02:00'] });
  assert.equal(calls[1]?.sql, 'SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  assert.equal(calls[2]?.sql, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  assert.equal(calls.at(-1)?.sql, 'COMMIT');
  assert.equal(calls.filter((call) => call.sql.startsWith('SELECT *')).length, 13);
  assert.equal(calls.filter((call) => call.sql.startsWith('SHOW CREATE')).length, 13);
  assert.deepEqual(exported.snapshot, snapshot);
  assert.equal(exported.report.valid, true);
  assert.equal(Object.keys(exported.ddl).length, 13);
  assert.equal(exported.report.warnings.length, 2);
  assert.ok(!calls.some((call) => /INSERT|UPDATE|DELETE|ALTER|DROP/.test(call.sql)));
});

test('missing transactional engines and provider failures roll back without leaking credentials or data', async () => {
  const nonTransactional = fakeMysql({ engine: 'MyISAM' });
  await assert.rejects(exportMysqlSnapshot(nonTransactional.connection, '+00:00'), /must exist and use InnoDB/);
  assert.equal(nonTransactional.calls.at(-1)?.sql, 'ROLLBACK');
  assert.equal(nonTransactional.calls.filter((call) => call.sql.startsWith('SELECT *')).length, 0);
  const denied = fakeMysql({ fail: true });
  await assert.rejects(exportMysqlSnapshot(denied.connection, '+00:00'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'MySQL export failed (ER_ACCESS_DENIED_ERROR).');
    return true;
  });
  assert.equal(denied.calls.at(-1)?.sql, 'ROLLBACK');
});
