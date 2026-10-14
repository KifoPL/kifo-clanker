import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Collection, PermissionsBitField, type ContextMenuCommandInteraction } from 'discord.js';
import { utilitiesFeature } from '../../src/features/utilities/index.js';
import { nativeFixture, ids, output } from './native-fixtures.js';
function command(name: string, f: ReturnType<typeof nativeFixture>) { const value = utilitiesFeature.create(f.services).slashCommands?.find(command => command.data.name === name); assert.ok(value); return value; }
test('native list server and role filters export the requested roster privately', async () => {
  for (const subcommand of ['server', 'roles']) {
    const f = nativeFixture({ subcommand, role: { id: ids.role } });
    await command('list', f).execute(f.interaction);
    const body = f.replies[0] as { files: Array<{ attachment: Buffer }> };
    assert.match(body.files[0]?.attachment.toString() ?? '', /Requester/);
    assert.match(output(f.defers), /"flags":64/); assert.equal(f.channelSends.length, 0);
  }
});
test('native list validates additional role inputs and target channel visibility before exposing roster', async t => {
  const f = nativeFixture({ subcommand: 'roles', role: { id: ids.role }, roles: 'not-a-role' });
  await command('list', f).execute(f.interaction);
  assert.match(output(f.replies), /not a valid role/); assert.doesNotMatch(output(f.replies), /User ID/);
  f.values.roles = null; f.values.channel = f.channel;
  t.mock.method(f.channel, 'permissionsFor', () => new PermissionsBitField());
  await command('list', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /Attach Files|able to view/);
});
test('native stats dispatches server, member and role targets without an attachment or public disclosure', async () => {
  for (const values of [{}, { member: { id: ids.actor } }, { role: { id: ids.role } }]) {
    const f = nativeFixture(values);
    await command('stats', f).execute(f.interaction);
    const body = f.replies[0] as { embeds: unknown[]; files?: unknown[] };
    assert.equal(body.embeds.length, 1); assert.equal(body.files, undefined);
    assert.match(output(f.replies), values.role ? /Members stats/ : values.member ? /Requester stats/ : /Test Guild stats/);
    assert.match(output(f.defers), /"flags":64/);
  }
  const f = nativeFixture({ member: { id: ids.actor }, role: { id: ids.role } });
  await command('stats', f).execute(f.interaction);
  assert.match(output(f.replies), /either a member or a role/);
});
test('native language option reads authorized message, uses provider result and reports missing configuration privately', async t => {
  const f = nativeFixture({ message: ids.other }); let providerCalls = 0;
  await command('lang', f).execute(f.interaction);
  assert.match(output(f.replies), /not configured/);
  Object.assign(f.services.env, { LANGUAGE_DETECT_KEY: 'test-language-key' });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, request: RequestInit) => {
    providerCalls++; assert.match(String(request.body), /Private source text/);
    return Response.json({ data: { detections: [{ language: 'pl', confidence: 98, isReliable: true }] } });
  });
  await command('lang', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /Polish/); assert.equal(providerCalls, 1);
  t.mock.method(f.channel, 'permissionsFor', () => new PermissionsBitField());
  await command('lang', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /Read Message History/); assert.equal(providerCalls, 1);
});
test('native todo delivers notes into requester DMs and reports missing arguments or closed DMs', async t => {
  const f = nativeFixture({ text: 'Finish review' }); let pins = 0; let reactions = 0;
  t.mock.method(f.response, 'pin', async () => { pins++; }); t.mock.method(f.response, 'react', async () => { reactions++; });
  await command('todo', f).execute(f.interaction);
  assert.match(output(f.dms), /Finish review/); assert.equal(pins, 1); assert.equal(reactions, 1);
  assert.doesNotMatch(output(f.replies), /Finish review/); assert.match(output(f.defers), /"flags":64/);
  f.values.text = null; await command('todo', f).execute(f.interaction); assert.match(output(f.replies.at(-1)), /Provide \/todo/);
  f.values.text = 'Second note'; t.mock.method(f.user, 'send', async () => { throw new Error('DMs closed'); });
  await command('todo', f).execute(f.interaction); assert.match(output(f.replies.at(-1)), /DMs closed/);
});
test('native top maps all typed options, applies permissions and ranks public source posts', async t => {
  const f = nativeFixture({ winners: 1, duration: '1d', emoji: '👍' }); f.values.channel = f.channel;
  await command('top', f).execute(f.interaction);
  assert.match(output(f.replies), /Scanned 1 messages/); assert.match(output(f.channelSends), /Private source text/);
  assert.match(output(f.channelSends), /with 4 👍/); assert.equal(f.dms.length, 0);
  assert.deepEqual(f.defers[0], {});
  t.mock.method(f.member, 'permissionsIn', () => new PermissionsBitField());
  await command('top', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /required permissions/); assert.equal(f.channelSends.length, 1);
});
test('native top routes cross-channel source contents into requester DMs, never public results', async () => {
  const f = nativeFixture({ winners: 1, duration: '1d', emoji: '👍' });
  const source = { ...f.channel, id: ids.other }; f.values.channel = source;
  Object.assign(f.guild, { channels: { cache: new Collection([[ids.channel, f.channel], [ids.other, source]]), fetch: async (id: string) => id === ids.channel ? f.channel : source } });
  await command('top', f).execute(f.interaction);
  assert.equal(f.channelSends.length, 0); assert.match(output(f.dms), /Private source text/);
  assert.doesNotMatch(output(f.replies), /Private source text/);
});
test('all native guild-only utilities reject DMs before member and history access', async () => {
  for (const name of ['list', 'stats', 'top', 'lang', 'todo']) {
    const f = nativeFixture(); Object.assign(f.interaction, { guild: null, guildId: null });
    await command(name, f).execute(f.interaction);
    assert.equal(f.defers.length, 0); assert.match(output(f.replies), /requires a server/); assert.equal(f.dms.length, 0);
  }
});
test('save and language message context menus preserve privacy and turn access/provider failures into replies', async t => {
  const f = nativeFixture(); Object.assign(f.services.env, { LANGUAGE_DETECT_KEY: 'test-key' });
  Object.assign(f.interaction, { targetMessage: f.source, isMessageContextMenuCommand: () => true });
  const interaction = f.interaction as unknown as ContextMenuCommandInteraction;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { detections: [{ language: 'en', confidence: 99, isReliable: true }] } }));
  const runtime = utilitiesFeature.create(f.services);
  const save = runtime.contextCommands?.find(command => command.data.name === 'save');
  const language = runtime.contextCommands?.find(command => command.data.name === 'detect language'); assert.ok(save && language);
  await save.execute(interaction); assert.match(output(f.dms), /Private source text/); assert.doesNotMatch(output(f.replies), /Private source text/);
  await language.execute(interaction); assert.match(output(f.replies.at(-1)), /English/);
  t.mock.method(f.channel, 'permissionsFor', () => new PermissionsBitField());
  await save.execute(interaction); await language.execute(interaction);
  assert.equal(f.dms.length, 1); assert.match(output(f.replies.at(-1)), /Read Message History/);
  assert.ok(f.defers.every(value => output(value).includes('64')));
});
test('user stats context resolves the selected user and rejects missing guild context privately', async () => {
  const f = nativeFixture(); Object.assign(f.interaction, { targetId: ids.actor, isUserContextMenuCommand: () => true });
  const command = utilitiesFeature.create(f.services).contextCommands?.find(command => command.data.name === 'user stats'); assert.ok(command);
  await command.execute(f.interaction as unknown as ContextMenuCommandInteraction);
  assert.match(output(f.replies), /Requester stats/); assert.match(output(f.defers), /"flags":64/);
  Object.assign(f.interaction, { guild: null }); await command.execute(f.interaction as unknown as ContextMenuCommandInteraction);
  assert.match(output(f.replies.at(-1)), /only available in a server/);
});

test('save context reports closed DMs, and language context reports provider failure privately', async t => {
  const f = nativeFixture(); Object.assign(f.services.env, { LANGUAGE_DETECT_KEY: 'test-key' });
  Object.assign(f.interaction, { targetMessage: f.source, isMessageContextMenuCommand: () => true });
  const runtime = utilitiesFeature.create(f.services); const interaction = f.interaction as unknown as ContextMenuCommandInteraction;
  t.mock.method(f.user, 'send', async () => { throw new Error('DMs closed'); });
  await runtime.contextCommands?.find(command => command.data.name === 'save')?.execute(interaction);
  assert.match(output(f.replies.at(-1)), /DMs closed/);
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await runtime.contextCommands?.find(command => command.data.name === 'detect language')?.execute(interaction);
  assert.match(output(f.replies.at(-1)), /failed \(503\)/);
});

test('utility reaction deletion requires requester-owned DM and bot-authored utility notes', async () => {
  const f = nativeFixture(); const runtime = utilitiesFeature.create(f.services); let deletions = 0;
  const message = { partial: false, channel: { type: 1, recipientId: ids.actor }, client: { user: { id: 'bot' } }, author: { id: 'bot' }, embeds: [{ author: { name: 'TODO' } }], async delete() { deletions++; } };
  const reaction = { message, emoji: { name: '✅' } } as unknown as Parameters<NonNullable<typeof runtime.onReaction>>[0];
  await runtime.onReaction?.(reaction, f.interaction.user, true); assert.equal(deletions, 1);
  Object.assign(message.channel, { recipientId: ids.other }); await runtime.onReaction?.(reaction, f.interaction.user, true); assert.equal(deletions, 1);
  Object.assign(message.channel, { recipientId: ids.actor }); Object.assign(message.author, { id: ids.other }); await runtime.onReaction?.(reaction, f.interaction.user, true); assert.equal(deletions, 1);
  Object.assign(message.author, { id: 'bot' }); await runtime.onReaction?.(reaction, f.interaction.user, false); assert.equal(deletions, 1);
});

test('native top cancellation rejects strangers and aborts the requesters in-flight scan', async () => {
  const f = nativeFixture({ winners: 1, duration: '1d', emoji: '👍' }); f.values.channel = f.channel;
  let start!: () => void; const started = new Promise<void>(resolve => { start = resolve; });
  let finish!: (messages: Collection<string, typeof f.source>) => void;
  Object.assign(f.channel.messages, { fetch: async () => { start(); return new Promise<Collection<string, typeof f.source>>(resolve => { finish = resolve; }); } });
  const runtime = utilitiesFeature.create(f.services); const command = runtime.slashCommands?.find(command => command.data.name === 'top'); assert.ok(command);
  const running = command.execute(f.interaction); await started;
  let acknowledged = 0; const denied: unknown[] = [];
  const button = { isButton: () => true, customId: `utilities:top:cancel:${f.interaction.id}`, user: { id: ids.other }, async reply(body: unknown) { denied.push(body); }, async deferUpdate() { acknowledged++; } };
  await runtime.onInteraction?.(button as unknown as Parameters<NonNullable<typeof runtime.onInteraction>>[0]);
  assert.match(output(denied), /Only the person/); assert.equal(acknowledged, 0);
  button.user.id = ids.actor;
  await runtime.onInteraction?.(button as unknown as Parameters<NonNullable<typeof runtime.onInteraction>>[0]);
  await running; finish(new Collection());
  assert.equal(acknowledged, 1); assert.match(output(f.replies.at(-1)), /cancelled or timed out/); assert.equal(f.channelSends.length, 0);
});

test('native top refuses inaccessible history without reading or disclosing the selected channel contents', async t => {
  const f = nativeFixture({ winners: 1, duration: '1d', emoji: '👍' }); f.values.channel = f.channel; let reads = 0;
  t.mock.method(f.channel, 'permissionsFor', () => new PermissionsBitField());
  t.mock.method(f.channel.messages, 'fetch', async () => { reads++; return new Collection(); });
  await command('top', f).execute(f.interaction);
  assert.equal(reads, 0); assert.equal(f.channelSends.length, 0); assert.equal(f.dms.length, 0);
  assert.match(output(f.replies), /Read Message History/); assert.doesNotMatch(output(f.replies), /Private source text/);
});

test('bookmark reaction removal fetches partial messages and honors deletion emoji and bot exclusion', async () => {
  const f = nativeFixture(); const runtime = utilitiesFeature.create(f.services); let deletions = 0; let fetches = 0;
  const full = { channel: { type: 1, recipientId: ids.actor }, client: { user: { id: 'bot' } }, author: { id: 'bot' }, embeds: [{ title: 'BOOKMARK - general' }], async delete() { deletions++; } };
  const reaction = { message: { partial: true, channel: full.channel, async fetch() { fetches++; return full; } }, emoji: { name: '👍' } };
  const invoke = () => runtime.onReaction?.(reaction as unknown as Parameters<NonNullable<typeof runtime.onReaction>>[0], f.interaction.user, true);
  await invoke(); assert.equal(deletions, 0); assert.equal(fetches, 1);
  reaction.emoji.name = '❌'; await invoke(); assert.equal(deletions, 1);
  Object.assign(f.user, { bot: true }); await invoke(); assert.equal(deletions, 1); assert.equal(fetches, 2);
});

test('native role statistics enrich color names when available and still return statistics on provider failure', async t => {
  const f = nativeFixture({ role: { id: ids.role } }); const role = f.guild.roles.cache.get(ids.role); assert.ok(role);
  Object.assign(role, { color: 0xff0000, hexColor: '#ff0000' }); let fail = false;
  t.mock.method(globalThis, 'fetch', async () => fail ? new Response('', { status: 503 }) : Response.json({ name: { value: 'Scarlet' } }));
  await command('stats', f).execute(f.interaction); assert.match(output(f.replies.at(-1)), /Scarlet/);
  fail = true; await command('stats', f).execute(f.interaction); assert.match(output(f.replies.at(-1)), /#ff0000/); assert.match(output(f.replies.at(-1)), /Members stats/);
});

test('native roster export requires Manage Server for more than a thousand members', async t => {
  const f = nativeFixture({ subcommand: 'server' });
  const roster = new Collection(Array.from({ length: 1001 }, (_, index) => { const id = String(700000000000000000n + BigInt(index)); return [id, { ...f.member, id, user: { ...f.user, id } }] as const; }));
  t.mock.method(f.guild.members, 'fetch', async (argument: unknown) => typeof argument === 'object' && argument !== null && 'time' in argument ? roster : f.member);
  f.member.permissions = new PermissionsBitField();
  await command('list', f).execute(f.interaction); assert.match(output(f.replies.at(-1)), /more than 1000 members requires Manage Server/);
  f.member.permissions = new PermissionsBitField(PermissionsBitField.All);
  await command('list', f).execute(f.interaction);
  const body = f.replies.at(-1) as { files: Array<{ attachment: Buffer }> };
  assert.equal(body.files[0]?.attachment.toString().split('\n').length, 1002);
});
