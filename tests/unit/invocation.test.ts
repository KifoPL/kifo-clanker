import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField, type ChatInputCommandInteraction } from 'discord.js';
import { createInvocation, invocationCommand } from '../../src/discord/invocation.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { createOwnerSlashCommands } from '../../src/features/core/owner.js';

function fixture({ guild = true, permissions = 0n }: { guild?: boolean; permissions?: bigint } = {}) {
  const calls: Array<{ method: string; body?: unknown }> = [];
  const channel = { id: 'channel', isTextBased: () => true };
  const member = { permissionsIn: () => new PermissionsBitField(permissions) };
  const response = { id: 'response' };
  const actor = { id: 'actor' };
  const interaction = {
    id: 'interaction', user: actor, guildId: guild ? 'guild' : null, channelId: 'channel', channel: null,
    guild: guild ? {
      members: { async fetch() { calls.push({ method: 'member' }); return member; } },
      roles: { async fetch() { calls.push({ method: 'roles' }); } },
      channels: { async fetch(id: string, options: unknown) { calls.push({ method: 'freshChannel', body: { id, options } }); return channel; } },
    } : null,
    client: { channels: { async fetch() { calls.push({ method: 'channel' }); return channel; } } },
    async deferReply(body: unknown) { calls.push({ method: 'defer', body }); },
    async reply(body: unknown) { calls.push({ method: 'reply', body }); },
    async editReply(body: unknown) { calls.push({ method: 'edit', body }); return response; },
    async followUp(body: unknown) { calls.push({ method: 'followUp', body }); return response; },
    webhook: { async editMessage(id: string, body: unknown) { calls.push({ method: 'webhookEdit:' + id, body }); return response; } },
    options: { getString: () => 'global' },
  } as unknown as ChatInputCommandInteraction;
  return { interaction, calls, response, actor, member, channel };
}
const services = { ownerIds: new Set<string>() } as unknown as RuntimeServices;
const data = { name: 'fixture', description: 'Invocation fixture' };

test('invocation defers before fetching real context and preserves the interaction actor and origin', async () => {
  const f = fixture();
  const invocation = await createInvocation(f.interaction);
  assert.deepEqual(f.calls.map(call => call.method), ['defer', 'channel', 'member']);
  assert.deepEqual(f.calls[0]?.body, { flags: MessageFlags.Ephemeral });
  assert.equal(invocation.author, f.actor);
  assert.equal(invocation.id, 'interaction');
  assert.equal(invocation.member, f.member);
  assert.equal(invocation.channel, f.channel);
  assert.equal(invocation.inGuild(), true);
  assert.equal(await invocation.reply('First'), f.response);
  await invocation.reply({ content: 'Second' });
  await invocation.editReply(f.response.id, { content: 'Expired', components: [] });
  assert.deepEqual(f.calls.slice(3), [
    { method: 'edit', body: { content: 'First' } },
    { method: 'followUp', body: { content: 'Second', flags: MessageFlags.Ephemeral } },
    { method: 'webhookEdit:response', body: { content: 'Expired', components: [] } },
  ]);
});

test('a failed original response can be retried without creating a follow-up or losing its canonical message', async () => {
  const f = fixture(); let attempts = 0;
  f.interaction.editReply = (async (body: unknown) => {
    attempts++;
    if (attempts === 1) throw new Error('Original response delivery failed');
    f.calls.push({ method: 'edit', body }); return f.response;
  }) as unknown as typeof f.interaction.editReply;
  const invocation = await createInvocation(f.interaction);
  await assert.rejects(invocation.reply('First attempt'), /delivery failed/);
  assert.equal(await invocation.reply('Error recovery'), f.response);
  assert.equal(attempts, 2);
  assert.deepEqual(f.calls.filter(call => call.method === 'edit'), [{ method: 'edit', body: { content: 'Error recovery' } }]);
  assert.equal(f.calls.filter(call => call.method === 'followUp').length, 0);
});

test('public command responses stay public and DM context does not fetch a guild member', async () => {
  const f = fixture({ guild: false });
  const invocation = await createInvocation(f.interaction, true);
  assert.equal(invocation.inGuild(), false);
  assert.equal(invocation.member, null);
  await invocation.reply('First');
  await invocation.reply('Second');
  assert.deepEqual(f.calls, [
    { method: 'defer', body: {} }, { method: 'channel' },
    { method: 'edit', body: { content: 'First' } }, { method: 'followUp', body: { content: 'Second' } },
  ]);
});

test('owner and guild guards reject before command context fetch', async () => {
  for (const restricted of [{ ownerOnly: true }, { guildOnly: true }]) {
    const f = fixture({ guild: false });
    let ran = false;
    const command = invocationCommand(data, { name: 'fixture', description: '', ...restricted, async execute() { ran = true; } }, () => [], services);
    await command.execute(f.interaction);
    assert.equal(ran, false);
    assert.deepEqual(f.calls.map(call => call.method), ['reply']);
    assert.equal((f.calls[0]?.body as { flags: number }).flags, MessageFlags.Ephemeral);
  }
});

test('native command checks actual invoking channel permissions and awaits execution with typed arguments', async () => {
  let executed: readonly string[] | undefined;
  const command = invocationCommand(data, {
    name: 'fixture', description: '', permissions: [PermissionFlagsBits.ManageMessages],
    async execute(invocation, args) { await Promise.resolve(); assert.equal(invocation.author.id, 'actor'); executed = args; },
  }, interaction => [interaction.options.getString('operation', true)], services);
  const denied = fixture();
  await command.execute(denied.interaction);
  assert.equal(executed, undefined);
  assert.match(JSON.stringify(denied.calls), /required permissions/);
  await command.execute(fixture({ permissions: PermissionFlagsBits.ManageMessages }).interaction);
  assert.deepEqual(executed, ['global']);
});

test('owner deployment presents one nonempty confirmation row and edits an expired private prompt through its webhook', async () => {
  const f = fixture();
  const calls: unknown[] = [];
  f.interaction.editReply = (async (body: unknown) => {
    calls.push(body);
    return { id: 'prompt', async awaitMessageComponent() { throw new Error('timeout'); } };
  }) as unknown as typeof f.interaction.editReply;
  const ownerServices = { applicationCommands: [data], ownerIds: new Set(['actor']), client: { application: {} }, logger: { error() {} } } as unknown as RuntimeServices;
  const deploy = createOwnerSlashCommands(ownerServices).find(command => command.data.name === 'deploy');
  assert.ok(deploy);
  await deploy.execute(f.interaction);
  const payload = calls[0] as { components: Array<{ toJSON(): { components: unknown[] } }> };
  assert.equal(payload.components.length, 1);
  assert.equal(payload.components[0]?.toJSON().components.length, 1);
  assert.ok(f.calls.some(call => call.method === 'webhookEdit:prompt'));
});

test('permission guard rejects a stale allowed overwrite and passes the fresh source channel to the handler', async t => {
  const f = fixture({ permissions: PermissionFlagsBits.ManageMessages });
  Object.assign(f.interaction, { channel: f.channel });
  const fresh = { id: 'channel', isTextBased: () => true };
  let freshPermission = 0n;
  const targets: unknown[] = [];
  t.mock.method(f.member, 'permissionsIn', (target: unknown) => {
    targets.push(target);
    return new PermissionsBitField(target === fresh ? freshPermission : PermissionFlagsBits.ManageMessages);
  });
  assert.ok(f.interaction.guild);
  t.mock.method(f.interaction.guild.channels, 'fetch', async (id: string, options: unknown) => {
    assert.equal(id, 'channel'); assert.deepEqual(options, { force: true }); return fresh;
  });
  let executed = 0;
  const command = invocationCommand(data, {
    name: 'fixture', description: '', permissions: [PermissionFlagsBits.ManageMessages],
    async execute(invocation) { executed++; assert.equal(invocation.channel, fresh); },
  }, () => [], services);
  await command.execute(f.interaction);
  assert.equal(executed, 0); assert.deepEqual(targets, [fresh]);
  assert.equal(f.calls[0]?.method, 'defer'); assert.deepEqual(f.calls[0]?.body, { flags: MessageFlags.Ephemeral });
  assert.match(JSON.stringify(f.calls), /required permissions/);
  freshPermission = PermissionFlagsBits.ManageMessages;
  await command.execute(f.interaction); assert.equal(executed, 1);
});

test('permission guard reloads role definitions so revoked role bits cannot survive a forced member fetch', async t => {
  const f = fixture({ permissions: PermissionFlagsBits.ManageMessages });
  Object.assign(f.interaction, { channel: f.channel });
  let cachedRoleBits = PermissionFlagsBits.ManageMessages;
  let roleFetches = 0;
  t.mock.method(f.member, 'permissionsIn', () => new PermissionsBitField(cachedRoleBits));
  assert.ok(f.interaction.guild);
  t.mock.method(f.interaction.guild.roles, 'fetch', async () => { roleFetches++; cachedRoleBits = 0n; });
  let executed = false;
  const command = invocationCommand(data, {
    name: 'fixture', description: '', permissions: [PermissionFlagsBits.ManageMessages],
    async execute() { executed = true; },
  }, () => [], services);
  await command.execute(f.interaction);
  assert.equal(roleFetches, 1); assert.equal(executed, false); assert.match(JSON.stringify(f.calls), /required permissions/);
  assert.equal(f.calls[0]?.method, 'defer');
});

test('general and owner-only commands do not fetch role definitions or refresh source channels', async () => {
  for (const ownerOnly of [false, true]) {
    const f = fixture(); let executed = false;
    const ownerServices = { ownerIds: new Set(['actor']) } as unknown as RuntimeServices;
    const command = invocationCommand(data, {
      name: 'fixture', description: '', ownerOnly, async execute() { executed = true; },
    }, () => [], ownerServices);
    await command.execute(f.interaction);
    assert.equal(executed, true);
    assert.deepEqual(f.calls.map(call => call.method), ['defer', 'channel', 'member']);
  }
});
