import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { type Client, Events } from 'discord.js';
import { readConfig } from '../../src/config.js';
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

test('application refuses gateway login before complete schema, then ignores text prefixes, dispatches slash commands and closes resources', { skip: !databaseUrl, timeout: 30_000 }, async () => {
  const admin = createPool(databaseUrl!, 1);
  const schema = `app_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(databaseUrl!);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const fixture = new GatewayFixture();
  try {
    await query(admin, `CREATE SCHEMA ${schema}`);
    const firstPool = createPool(url.toString());
    await assert.rejects(startApp({ ...readConfig({ DISCORD_TOKEN: 'fixture', DATABASE_URL: url.toString(), SCHEDULER_PAUSED: 'true' }), healthPort: 0 }, {
      client: fixture as unknown as Client, pool: firstPool,
    }), /schema is not ready/);
    assert.equal(fixture.loggedIn, false);
    assert.equal(fixture.destroyed, true);

    const pool = createPool(url.toString());
    await runMigrations(pool);
    await query(pool, 'INSERT INTO guild_settings(guild_id,prefix) VALUES($1,$2)', ['123456789012345678', '?']);
    const connected = new GatewayFixture();
    const close = await startApp({ ...readConfig({ DISCORD_TOKEN: 'fixture', DATABASE_URL: url.toString(), SCHEDULER_PAUSED: 'true' }), healthPort: 0 }, {
      client: connected as unknown as Client, pool,
    });
    let calls = 0;
    const originalQuery = pool.query.bind(pool);
    pool.query = ((...args: Parameters<typeof pool.query>) => { calls++; return originalQuery(...args); }) as typeof pool.query;
    const textReplies: unknown[] = [];
    for (const content of ['!kifo help', '!kifo', '?help', '?remove <@222222222222222222> <@&333333333333333333>', '!kifo deploy', 'ordinary chat']) {
      connected.emit(Events.MessageCreate, {
        content, channelId: '111111111111111111', guildId: '123456789012345678', guild: { id: '123456789012345678' },
        member: { permissionsIn: () => ({ has: () => true }) }, author: { bot: false, id: '222222222222222222' },
        async reply(body: unknown) { textReplies.push(body); },
      });
    }
    // Drain queued passive handlers before observing a subsequent interaction.
    await new Promise<void>(resolve => setImmediate(resolve));
    let reply: unknown;
    const replied = new Promise<void>(resolve => connected.emit(Events.InteractionCreate, {
      id: 'interaction', commandName: 'help', guildId: '123456789012345678', user: { id: '222222222222222222' },
      isChatInputCommand: () => true, isContextMenuCommand: () => false,
      memberPermissions: { has: () => true }, options: { getString: () => null },
      async reply(body: unknown) { reply = body; resolve(); },
    }));
    await replied;
    assert.deepEqual(textReplies, [], 'default and stored custom prefixes cannot invoke commands');
    assert.equal(calls, 0, 'message intake and slash help neither read prefixes nor execute command mutations');
    assert.ok(JSON.stringify(reply).includes('/help'));
    assert.ok(JSON.stringify(reply).includes('/clean'));
    assert.ok(JSON.stringify(reply).includes('/countdown'));
    assert.ok(!JSON.stringify(reply).includes('!kifo'));
    await new Promise<void>(resolve => setImmediate(resolve));
    const releases: Array<() => void> = [];
    let started!: () => void;
    const allStarted = new Promise<void>(resolve => { started = resolve; });
    for (let index = 0; index < 16; index++) connected.emit(Events.InteractionCreate, {
      id: `held-${index}`, commandName: 'help', guildId: '123456789012345678', user: { id: `actor-${index}` },
      isChatInputCommand: () => true, isContextMenuCommand: () => false,
      memberPermissions: { has: () => true }, options: { getString: () => null },
      async reply() {
        await new Promise<void>(resolve => {
          releases.push(resolve);
          if (releases.length === 16) started();
        });
      },
    });
    await allStarted;
    try {
      const busyReplies: unknown[] = [];
      const component = {
        id: 'component', customId: 'countdown:fixture:yes', user: { id: 'actor' },
        isChatInputCommand: () => false, isContextMenuCommand: () => false,
        isButton: () => true, isRepliable: () => true, deferred: false, replied: false,
        async reply(body: unknown) { busyReplies.push(body); },
      };
      connected.emit(Events.InteractionCreate, component);
      assert.equal(busyReplies.length, 1, 'runtime components receive immediate busy acknowledgement rather than queuing past expiry');
      assert.match(JSON.stringify(busyReplies), /busy/);
      for (const prefix of ['moderation', 'automation', 'deploy']) connected.emit(Events.InteractionCreate, {
        ...component, id: prefix, customId: `${prefix}:fixture:yes`,
      });
      assert.equal(busyReplies.length, 1, 'scoped confirmation collectors own their acknowledgement, even when intake is full');
    } finally { for (const release of releases) release(); }
    assert.equal(connected.presence, true);
    await close();
    assert.equal(connected.destroyed, true);
    assert.equal(pool.totalCount, 0);
  } finally {
    await query(admin, `DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
