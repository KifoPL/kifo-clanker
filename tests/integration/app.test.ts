import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { type Client, Events } from 'discord.js';
import { startApp } from '../../src/app.js';
import { createPool, query, runMigrations } from '../../src/db/index.js';

const databaseUrl = process.env.DATABASE_URL;

class GatewayFixture extends EventEmitter {
  loggedIn = false;
  destroyed = false;
  presence = false;
  user = { id: '795638549730295820', setPresence: () => { this.presence = true; } };
  application = { fetch: async () => ({ owner: { id: '289119054130839552' } }) };
  async login(): Promise<string> { this.loggedIn = true; this.emit(Events.ClientReady); return 'fixture'; }
  isReady(): boolean { return this.loggedIn && !this.destroyed; }
  async destroy(): Promise<void> { this.destroyed = true; }
}

test('application refuses gateway login before complete schema, then runs cached prefix dispatch and closes resources', { skip: !databaseUrl, timeout: 30_000 }, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `app_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(databaseUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const fixture = new GatewayFixture();
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    const firstPool = createPool(url.toString());
    await assert.rejects(startApp({ discordToken: 'fixture', databaseUrl: url.toString(), healthPort: 0, schedulerPaused: true }, {
      client: fixture as unknown as Client, pool: firstPool,
    }), /schema is not ready/);
    assert.equal(fixture.loggedIn, false);
    assert.equal(fixture.destroyed, true);

    const pool = createPool(url.toString());
    await runMigrations(pool);
    await query(pool, 'INSERT INTO guild_settings(guild_id,prefix) VALUES($1,$2)', ['123456789012345678', '?']);
    const connected = new GatewayFixture();
    const close = await startApp({ discordToken: 'fixture', databaseUrl: url.toString(), healthPort: 0, schedulerPaused: true }, {
      client: connected as unknown as Client, pool,
    });
    let calls = 0;
    const originalQuery = pool.query.bind(pool);
    pool.query = ((...args: Parameters<typeof pool.query>) => { calls++; return originalQuery(...args); }) as typeof pool.query;
    let reply: unknown;
    const replied = new Promise<void>(resolve => connected.emit(Events.MessageCreate, {
      content: '?help', channelId: '111111111111111111', guildId: '123456789012345678', guild: { id: '123456789012345678' },
      member: { permissionsIn: () => ({ has: () => true }) }, author: { bot: false, id: '222222222222222222' },
      async reply(body: unknown) { reply = body; resolve(); },
    }));
    await replied;
    assert.equal(calls, 0, 'ordinary command/help uses hydrated settings without configuration SELECTs');
    assert.ok(JSON.stringify(reply).includes('?help'));
    assert.ok(JSON.stringify(reply).includes('/countdown'));
    assert.equal(connected.presence, true);
    await close();
    assert.equal(connected.destroyed, true);
    assert.equal(pool.totalCount, 0);
  } finally {
    await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
