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
  registrations: Array<{ data: unknown[]; guild: string | undefined }> = [];
  onRegister: ((data: unknown[], guild?: string) => Promise<void>) | undefined;
  onLogin: (() => Promise<void>) | undefined;
  reportChannels: string[] = [];
  reports: unknown[] = [];
  onReport: (() => Promise<void>) | undefined;
  channels = { fetch: async (id: string) => {
    this.reportChannels.push(id);
    return { isSendable: () => true, send: async (body: unknown) => { await this.onReport?.(); this.reports.push(body); } };
  } };
  application = {
    fetch: async () => ({ owner: { id: '289119054130839552' } }),
    commands: { set: async (data: unknown[], guild?: string) => {
      this.registrations.push({ data, guild });
      await this.onRegister?.(data, guild);
    } },
  };
  async login(): Promise<string> { await this.onLogin?.(); this.loggedIn = true; this.emit(Events.ClientReady); return 'unit'; }
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
    assert.equal(f.client.registrations.length, 1);
    assert.equal(f.client.registrations[0]?.guild, undefined);
    assert.equal(f.client.registrations[0]?.data.length, 38);
    assert.deepEqual(f.client.reportChannels, ['822800863050858541']);
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

test('authenticated test bot automatically registers complete metadata only after schema and gateway readiness', async () => {
  const f = await fixture(); f.client.user.id = '796447999747948584';
  f.client.onLogin = async () => {
    assert.ok(f.queries.some(sql => sql.startsWith('SELECT version, filename, checksum')));
    assert.deepEqual(f.client.registrations, []);
  };
  f.client.onRegister = async () => { assert.equal(f.client.isReady(), true); };
  const close = await startApp(f.config, { client: f.client as unknown as Client, pool: f.pool });
  try {
    assert.equal(f.client.registrations.length, 1);
    assert.equal(f.client.registrations[0]?.guild, '822800862581751848');
    assert.equal(f.client.registrations[0]?.data.length, 38);
    assert.equal(f.client.isReady(), true);
  } finally { await close(); }
});

test('registration is never attempted when migration validation or gateway login fails', async () => {
  for (const schemaReady of [false, true]) {
    const f = await fixture(schemaReady); f.client.user.id = '796447999747948584';
    if (schemaReady) f.client.onLogin = async () => { throw new Error('Gateway unavailable'); };
    await assert.rejects(startApp(f.config, { client: f.client as unknown as Client, pool: f.pool }), schemaReady ? /Gateway unavailable/ : /schema is not ready/);
    assert.deepEqual(f.client.registrations, []); assert.equal(f.client.destroyed, true); assert.equal(f.ended(), true);
  }
});

test('test-bot startup awaits registration before returning readiness', async () => {
  const f = await fixture(); f.client.user.id = '796447999747948584';
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void; const registrationStarted = new Promise<void>(resolve => { started = resolve; });
  f.client.onRegister = async () => { started(); await gate; };
  let ready = false;
  const starting = startApp(f.config, { client: f.client as unknown as Client, pool: f.pool }).then(close => { ready = true; return close; });
  await registrationStarted; assert.equal(ready, false);
  release(); const close = await starting;
  try { assert.equal(ready, true); } finally { await close(); }
});

test('test-bot registration failure closes Discord/database resources and does not expose a ready runtime', async () => {
  const f = await fixture(); f.client.user.id = '796447999747948584';
  f.client.onRegister = async () => { throw new Error('Discord registration failed'); };
  await assert.rejects(startApp(f.config, { client: f.client as unknown as Client, pool: f.pool }), /Discord registration failed/);
  assert.equal(f.client.registrations.length, 1); assert.equal(f.client.destroyed, true); assert.equal(f.ended(), true);
  assert.equal(f.client.isReady(), false);
});

test('startup selects authenticated test identity after login and honors configured guild override', async () => {
  const f = await fixture(); const override = '123456789012345678';
  f.config = { ...readConfig({ DISCORD_TOKEN: 'unit-token', DATABASE_URL: 'postgres://localhost/unit', DISCORD_TEST_GUILD_ID: override }), healthPort: 0, schedulerPaused: true };
  f.client.onLogin = async () => { f.client.user.id = '796447999747948584'; };
  const close = await startApp(f.config, { client: f.client as unknown as Client, pool: f.pool });
  try { assert.equal(f.client.registrations.length, 1); assert.equal(f.client.registrations[0]?.guild, override); assert.equal(f.client.registrations[0]?.data.length, 38); }
  finally { await close(); }
});


test('production registration failure closes startup resources before reporting success', async () => {
  const f = await fixture();
  f.client.onRegister = async () => { throw new Error('Global registration denied'); };
  await assert.rejects(startApp(f.config, { client: f.client as unknown as Client, pool: f.pool }), /Global registration denied/);
  assert.equal(f.client.registrations[0]?.guild, undefined);
  assert.equal(f.client.destroyed, true); assert.equal(f.ended(), true);
  assert.deepEqual(f.client.reportChannels, []);
});

test('production registration report failure leaves the app ready and keeps global registration', async () => {
  const f = await fixture();
  f.client.onReport = async () => { throw new Error('Report channel unavailable'); };
  const close = await startApp(f.config, { client: f.client as unknown as Client, pool: f.pool });
  try { assert.equal(f.client.isReady(), true); assert.equal(f.client.registrations.length, 1); assert.equal(f.client.registrations[0]?.guild, undefined); }
  finally { await close(); }
});

test('validated production reporting override reaches actual startup notification without changing global scope', async () => {
  const f = await fixture(); const override = '123456789012345678';
  f.config = { ...readConfig({ DISCORD_TOKEN: 'unit-token', DATABASE_URL: 'postgres://localhost/unit', DISCORD_DEPLOY_CHANNEL_ID: override }), healthPort: 0, schedulerPaused: true };
  const close = await startApp(f.config, { client: f.client as unknown as Client, pool: f.pool });
  try { assert.equal(f.client.registrations[0]?.guild, undefined); assert.deepEqual(f.client.reportChannels, [override]); assert.equal(f.client.reports.length, 1); }
  finally { await close(); }
});
