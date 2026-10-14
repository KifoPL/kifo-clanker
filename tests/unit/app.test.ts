import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { type Client, Events } from 'discord.js';
import type { Pool } from 'pg';
import { startApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
import { readMigrations } from '../../src/db/migrate.js';

class GatewayDouble extends EventEmitter {
  loggedIn = false;
  destroyed = false;
  presence: unknown;
  user = { id: '795638549730295820', setPresence: (presence: unknown) => { this.presence = presence; } };
  application = { fetch: async () => ({ owner: { id: '289119054130839552' } }) };
  async login(): Promise<string> { this.loggedIn = true; this.emit(Events.ClientReady); return 'unit'; }
  isReady(): boolean { return this.loggedIn && !this.destroyed; }
  async destroy(): Promise<void> { this.destroyed = true; }
}

async function fixture(ready = true) {
  const migrations = await readMigrations();
  const queries: string[] = [];
  let ended = false;
  const pool = Object.assign(new EventEmitter(), {
    totalCount: 0, idleCount: 0, waitingCount: 0,
    async query(sql: string) {
      queries.push(sql);
      if (sql.startsWith('SELECT version, filename, checksum')) return { rows: ready ? migrations.map(m => ({ version: m.version, filename: m.name, checksum: m.checksum })) : [] };
      return { rows: [], rowCount: 0 };
    },
    async end() { ended = true; },
  }) as unknown as Pool;
  const client = new GatewayDouble();
  const config = { ...readConfig({ DISCORD_TOKEN: 'unit-token', DATABASE_URL: 'postgres://localhost/unit' }), healthPort: 0, schedulerPaused: true };
  return { client, pool, config, queries, ended: () => ended };
}

test('runtime starts and shuts down through gateway and database doubles, with message events confined to passive features', async () => {
  const f = await fixture();
  const close = await startApp(f.config, { client: f.client as unknown as Client, pool: f.pool });
  try {
    assert.equal(f.client.loggedIn, true);
    assert.match(JSON.stringify(f.client.presence), /\/help/);
    f.queries.length = 0;
    const replies: unknown[] = [];
    for (const content of ['!kifo help', '?help', '!kifo deploy']) f.client.emit(Events.MessageCreate, {
      content, channelId: 'channel', guild: { id: 'guild' }, author: { bot: false },
      async reply(body: unknown) { replies.push(body); },
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(replies, []);
    assert.deepEqual(f.queries, []);
  } finally { await close(); }
  assert.equal(f.client.destroyed, true);
  assert.equal(f.ended(), true);
});

test('missing migration state blocks gateway login and closes every startup resource using doubles', async () => {
  const f = await fixture(false);
  await assert.rejects(startApp(f.config, { client: f.client as unknown as Client, pool: f.pool }), /schema is not ready/);
  assert.equal(f.client.loggedIn, false);
  assert.equal(f.client.destroyed, true);
  assert.equal(f.ended(), true);
});

test('runtime routes gateway events to feature hooks and dispatches both application command types with doubles', async t => {
  const { coreFeature } = await import('../../src/features/core/index.js');
  const { Collection, ChannelType } = await import('discord.js');
  const calls: Array<{ kind: string; values: unknown[] }> = [];
  const originalCreate = coreFeature.create;
  t.mock.method(coreFeature, 'create', (services: Parameters<typeof originalCreate>[0]) => ({
    ...originalCreate(services),
    async hydrate() { calls.push({ kind: 'hydrate', values: [] }); },
    async onReady() { calls.push({ kind: 'ready', values: [] }); },
    async onMessage(message: { id: string }) { calls.push({ kind: 'message', values: [message.id] }); return 'handled' as const; },
    async onReaction(reaction: { message: { id: string } }, user: { id: string }, added: boolean) { calls.push({ kind: 'reaction', values: [reaction.message.id, user.id, added] }); },
    async onMessageDelete(message: { id: string }) { calls.push({ kind: 'delete', values: [message.id] }); },
    async onGuild(guild: { id: string }, event: string) { calls.push({ kind: 'guild', values: [guild.id, event] }); },
    async onInteraction(interaction: { id: string }) { calls.push({ kind: 'component', values: [interaction.id] }); return true; },
  }));
  const f = await fixture();
  const close = await startApp(f.config, { client: f.client as unknown as Client, pool: f.pool });
  try {
    assert.deepEqual(calls.map(call => call.kind), ['hydrate', 'ready']);
    const message = { id: 'message', channel: { type: ChannelType.GuildText }, channelId: 'channel', guildId: 'guild', guild: { id: 'guild' }, content: 'hello', partial: false, author: { id: 'author', bot: false } };
    f.client.emit(Events.MessageCreate, message);
    f.client.emit(Events.MessageReactionAdd, { message, emoji: { name: '✅' } }, { id: 'member', bot: false });
    f.client.emit(Events.MessageReactionRemove, { message, emoji: { name: '✅' } }, { id: 'member', bot: false });
    f.client.emit(Events.MessageDelete, message);
    f.client.emit(Events.MessageBulkDelete, new Collection([['bulk', { ...message, id: 'bulk' }]]));
    for (const event of [Events.GuildCreate, Events.GuildDelete, Events.GuildUnavailable]) f.client.emit(event, { id: 'guild' });
    f.client.emit(Events.InteractionCreate, { id: 'component', isChatInputCommand: () => false, isContextMenuCommand: () => false, isButton: () => false });
    const replies: unknown[] = [];
    for (const slash of [true, false]) f.client.emit(Events.InteractionCreate, {
      id: slash ? 'slash' : 'context', commandName: slash ? 'help' : 'unknown-context', user: { id: slash ? 'slash-user' : 'context-user' }, guildId: 'guild',
      isChatInputCommand: () => slash, isContextMenuCommand: () => !slash,
      memberPermissions: { has: () => true }, options: { getString: () => null },
      async reply(body: unknown) { replies.push(body); },
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(calls.filter(call => call.kind === 'message').map(call => call.values), [['message']]);
    assert.deepEqual(calls.filter(call => call.kind === 'reaction').map(call => call.values), [['message', 'member', true], ['message', 'member', false]]);
    assert.deepEqual(calls.filter(call => call.kind === 'delete').map(call => call.values), [['message'], ['bulk']]);
    assert.deepEqual(calls.filter(call => call.kind === 'guild').map(call => call.values), [['guild', 'join'], ['guild', 'leave'], ['guild', 'unavailable']]);
    assert.deepEqual(calls.filter(call => call.kind === 'component').map(call => call.values), [['component']]);
    assert.equal(replies.length, 2);
    assert.match(JSON.stringify(replies), /Available slash commands/);
    assert.match(JSON.stringify(replies), /Unknown context menu/);
  } finally { await close(); }
  f.client.emit(Events.MessageCreate, { id: 'after-close', channelId: 'channel' });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(calls.filter(call => call.kind === 'message').length, 1, 'shutdown stops event intake');
});
