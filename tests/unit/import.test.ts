import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { prepareImport } from '../../src/db/import-plan.js';
import { bit, identifier, timestamp, timezoneOffset } from '../../src/db/import-validation.js';

const snapshot = JSON.parse(await readFile(new URL('../fixtures/mysql-snapshot.json', import.meta.url), 'utf8')) as {
  timezone: string; tables: Record<string, Record<string, unknown>[]>;
};

test('all13 legacy tables map to canonical records and supported jobs without losing precise IDs', () => {
  const plan = prepareImport(snapshot);
  assert.equal(plan.report.valid, true);
  assert.equal(Object.keys(plan.report.sourceCounts).length, 13);
  assert.equal(plan.rows.length, 13);
  assert.equal(plan.jobs.length, 7);
  assert.equal(plan.rows.find((row) => row.table === 'guild_settings')?.values['guild_id'], '1234567890123456789');
  assert.equal(plan.rows.find((row) => row.table === 'superslow_users')?.values['timestamp_ms'], '1760000001000');
  assert.deepEqual(plan.rows.find((row) => row.table === 'auto_reactions')?.values['emojis'], ['✅', '❌']);
  assert.equal(plan.rows.find((row) => row.table === 'ticket_settings')?.values['slowmode_seconds'], 30);
  assert.equal(plan.rows.find((row) => row.table === 'ticket_settings')?.values['archive_minutes'], 1440);
  assert.equal(plan.rows.find((row) => row.table === 'ticket_settings')?.values['are_public'], true);
  assert.equal(plan.rows.find((row) => row.table === 'autothreading_settings')?.values['archive_minutes'], 60);
  assert.ok(plan.jobs.every((job) => job.runAt === '2030-01-02T10:34:56.000Z'));
  assert.ok(plan.report.issues.some((issue) => issue.message.includes('greatest timestamp')));
  assert.ok(plan.report.issues.some((issue) => issue.message.includes('Applied permission state')));
  assert.deepEqual(prepareImport(snapshot), plan);
});

test('unsafe snowflake numbers, invalid BIT values and calendar/timezone ambiguity are rejected', () => {
  assert.throws(() => identifier(1234567890123456789, 'GuildId'), /precision/);
  assert.equal(identifier('1234567890123456789', 'GuildId'), '1234567890123456789');
  assert.throws(() => bit({ type: 'Buffer', data: [2] }, 'ArePublic'), /BIT/);
  assert.throws(() => bit('false', 'ArePublic'), /BIT/);
  assert.throws(() => timezoneOffset('Europe/Warsaw'), /explicit UTC offset/);
  assert.throws(() => timestamp('2030-02-30 12:00:00', 'EndTime', '+00:00'), /calendar/);
  assert.throws(() => timestamp('2030-01-01 12:00:00.000001', 'EndTime', '+00:00'), /precision/);
  assert.equal(timestamp('2030-01-01T12:00:00Z', 'EndTime', '+02:00'), '2030-01-01T12:00:00.000Z');
});

test('duplicates, missing tables, orphan cooldowns and unmapped fields appear in the report', () => {
  const copy = structuredClone(snapshot);
  copy.tables['prefixes']!.push({ ...copy.tables['prefixes']![0] });
  delete copy.tables['countdown'];
  copy.tables['superslowusers']!.push({ ChannelId: '999', UserId: '123', Timestamp: '1760000000000' });
  copy.tables['react']!.push({ ChannelId: '888', emote: '✅', UnexpectedColumn: 'data' });
  const report = prepareImport(copy).report;
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.message.includes('Duplicate target')));
  assert.ok(report.issues.some((issue) => issue.table === 'countdown' && issue.severity === 'error'));
  assert.ok(report.issues.some((issue) => issue.message.includes('absent from superslow')));
  assert.ok(report.issues.some((issue) => issue.message.includes('Unmapped source fields')));
});

test('nullable expiries preserve permanent menus, polls and moderation rows without phantom jobs', () => {
  const copy = structuredClone(snapshot);
  for (const table of ['menu_perms', 'menu_roles']) copy.tables[table]![0]!['EndDate'] = null;
  for (const table of ['polls', 'perms', 'role_remove']) copy.tables[table]![0]!['EndTime'] = null;
  const plan = prepareImport(copy);
  assert.equal(plan.report.valid, true);
  assert.equal(plan.rows.length, 13);
  assert.equal(plan.jobs.length, 2);
  assert.ok(plan.rows.filter((row) => row.table === 'menus').every((row) => row.values['expires_at'] === null));
  assert.ok(plan.rows.filter((row) => row.table === 'moderation_operations').every((row) => row.values['restore_at'] === null));
});

test('permission restoration tri-state and explicit millisecond/timezone dates are preserved exactly', () => {
  for (const [command, state] of [['add', 'allow'], ['deny', 'deny'], ['rm', 'inherit']]) {
    const copy = structuredClone(snapshot);
    copy.tables['perms']![0]!['Command'] = command;
    copy.tables['menu_roles']![0]!['EndDate'] = '2030-01-02T12:34:56.123-05:00';
    const plan = prepareImport(copy);
    assert.equal(plan.report.valid, true);
    assert.equal(plan.rows.find((row) => row.table === 'moderation_operations' && row.values['kind'] === 'permission')?.values['previous_state'], state);
    const expected = '2030-01-02T17:34:56.123Z';
    assert.equal(plan.rows.find((row) => row.table === 'menus' && row.values['kind'] === 'role')?.values['expires_at'], expected);
    assert.equal(plan.jobs.find((job) => job.dedupeKey === 'menu.expire:1723456789012345678')?.runAt, expected);
  }
});
