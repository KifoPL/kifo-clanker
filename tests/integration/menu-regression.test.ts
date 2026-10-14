import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Collection, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { Pool } from 'pg';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { createPool, query, runMigrations } from '../../src/db/index.js';
import { MenuService } from '../../src/features/menus/service.js';

const databaseUrl = process.env['DATABASE_URL'];

test('menu cancellation and expiry guard actual PostgreSQL capture/admission transitions', { skip: !databaseUrl, timeout: 30_000 }, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `kifo_menu_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(databaseUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const pool = createPool(url.toString());
  const events: string[] = [];
  const notifications: string[] = [];
  const notificationErrors: string[] = [];
  let notificationsFail = false;
  const roles = new Collection<string, { id: string }>();
  let cancelDuringCapture = false;
  let expireDuringFetch = false;
  const intercepted = {
    connect: pool.connect.bind(pool),
    async query(sql: string, values: unknown[] = []) {
      if (cancelDuringCapture && sql.includes('SET previous_state=$3')) {
        cancelDuringCapture = false;
        await query(pool, "DELETE FROM menu_participants WHERE menu_id='menu' AND user_id='user'");
      }
      return pool.query(sql, values);
    },
  } as unknown as Pool;
  const permissions = new PermissionsBitField(PermissionFlagsBits.Administrator);
  const bot = { id: 'bot', permissions, roles: { highest: { comparePositionTo: () => 1 } } };
  const member = { id: 'user', user: { bot: false }, guild: { id: 'guild', ownerId: 'owner' },
    roles: { cache: roles, highest: { id: 'member-role' },
      async add() { events.push('grant'); roles.set('role', { id: 'role' }); },
      async remove() { events.push('restore'); roles.delete('role'); },
    }, async send(input: { content: string; allowedMentions: { parse: string[] } }) {
      assert.deepEqual(input.allowedMentions, { parse: [] });
      if (notificationsFail) throw new Error('DM unavailable');
      notifications.push(input.content);
    } };
  const role = { id: 'role', managed: false, guild: { id: 'guild', ownerId: 'owner' }, permissions: new PermissionsBitField() };
  const guild = { members: {
    async fetch(input: string | { user: string }) {
      const id = typeof input === 'string' ? input : input.user;
      if (id !== 'user') return bot;
      if (expireDuringFetch) {
        expireDuringFetch = false;
        await query(pool, "UPDATE menus SET expires_at=clock_timestamp()-interval '1 second' WHERE message_id='menu'");
      }
      return member;
    }, fetchMe: async () => bot,
  }, roles: { fetch: async () => role } };
  const service = new MenuService({ pool: intercepted, client: { guilds: { fetch: async () => guild } },
    logger: { error(message: string) { notificationErrors.push(message); } } } as unknown as RuntimeServices);
  const insertMenu = async (closing: boolean, expires: Date | null = null) => {
    await query(pool, `INSERT INTO menus(message_id,guild_id,channel_id,created_by,kind,target_id,closing,expires_at)
      VALUES ('menu','guild','source','creator','role','role',$1,$2)`, [closing, expires]);
    await service.hydrate();
  };
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    await runMigrations(pool);

    await insertMenu(true);
    roles.set('role', { id: 'role' });
    await query(pool, `INSERT INTO menu_participants(menu_id,user_id,target_key,previous_state,status)
      VALUES ('menu','user','guild:user:role:role:','absent','capturing')`);
    await service.runParticipant('menu', 'user', new AbortController().signal);
    assert.deepEqual(events, []);
    assert.equal(roles.has('role'), true);
    assert.equal((await query(pool, 'SELECT * FROM menu_participants')).rowCount, 0);

    await query(pool, 'TRUNCATE menus CASCADE');
    roles.clear();
    await insertMenu(false);
    cancelDuringCapture = true;
    await service.participant('menu', 'user', true);
    assert.deepEqual(events, []);
    assert.equal(roles.has('role'), false);
    assert.equal((await query(pool, 'SELECT * FROM menu_participants')).rowCount, 0);

    await query(pool, 'TRUNCATE menus CASCADE');
    await insertMenu(false, new Date(Date.now() + 60_000));
    expireDuringFetch = true;
    await service.participant('menu', 'user', true);
    assert.deepEqual(events, []);
    assert.equal((await query(pool, 'SELECT * FROM menu_participants')).rowCount, 0);

    await query(pool, 'TRUNCATE menus CASCADE');
    await insertMenu(false);
    await service.participant('menu', 'user', true);
    await service.participant('menu', 'user', true);
    assert.deepEqual(events, ['grant']);
    assert.deepEqual(notifications, ['Role menu active: <@&role>.']);
    assert.equal((await query(pool, 'SELECT status FROM menu_participants')).rows[0]?.['status'], 'active');
    await service.participant('menu', 'user', false);
    assert.deepEqual(events, ['grant', 'restore']);
    assert.deepEqual(notifications, ['Role menu active: <@&role>.', 'Previous role state restored for <@&role>.']);
    assert.equal((await query(pool, 'SELECT * FROM menu_participants')).rowCount, 0);

    notificationsFail = true;
    await service.participant('menu', 'user', true);
    assert.equal((await query(pool, 'SELECT status FROM menu_participants')).rows[0]?.['status'], 'active');
    await service.participant('menu', 'user', false);
    assert.equal((await query(pool, 'SELECT * FROM menu_participants')).rowCount, 0);
    assert.equal(notifications.length, 2);
    assert.deepEqual(notificationErrors, ['Menu notification failed', 'Menu notification failed']);

    await query(pool, 'TRUNCATE menus CASCADE');
    roles.clear();
    events.length = 0;
    await insertMenu(false);
    await query(pool, `INSERT INTO menu_participants(menu_id,user_id,target_key,previous_state,status)
      VALUES ('menu','user','guild:user:role:role:','absent','capturing')`);
    await query(pool, "UPDATE menus SET closing=true WHERE message_id='menu'");
    await service.runParticipant('menu', 'user', new AbortController().signal);
    assert.deepEqual(events, []);
    assert.equal(roles.has('role'), false);
    assert.equal((await query(pool, 'SELECT status FROM menu_participants')).rows[0]?.['status'], 'capturing');
  } finally {
    await pool.end();
    try { await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin.end(); }
  }
});
