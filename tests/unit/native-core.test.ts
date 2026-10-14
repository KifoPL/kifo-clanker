import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Collection, type ActionRowBuilder, type ButtonBuilder } from 'discord.js';
import { createOwnerSlashCommands } from '../../src/features/core/owner.js';
import { nativeFixture, ids, output } from './native-fixtures.js';
function ownerCommand(name: string, f: ReturnType<typeof nativeFixture>) {
  const value = createOwnerSlashCommands(f.services).find(command => command.data.name === name); assert.ok(value); return value;
}
test('native owner commands deny ordinary members before context, reload or application changes', async () => {
  for (const name of ['reload', 'serverlist', 'cmdlist', 'deploy']) {
    const f = nativeFixture({ operation: 'global' });
    await ownerCommand(name, f).execute(f.interaction);
    assert.equal(f.defers.length, 0); assert.match(output(f.replies), /Only the bot owner/);
    assert.equal(f.channelSends.length, 0); assert.equal(f.queries.length, 0);
  }
});
test('native owner reload awaits cache refresh and reports success privately; unavailable reload fails', async () => {
  const f = nativeFixture(); f.services.ownerIds.add(ids.actor);
  let reloads = 0; f.services.reload = async () => { reloads++; };
  await ownerCommand('reload', f).execute(f.interaction);
  assert.equal(reloads, 1); assert.match(output(f.replies), /Cached settings reloaded/); assert.match(output(f.defers), /"flags":64/);
  delete f.services.reload;
  await assert.rejects(ownerCommand('reload', f).execute(f.interaction), /unavailable/);
});
test('native owner serverlist returns the actual server roster as a private attachment', async () => {
  const f = nativeFixture(); f.services.ownerIds.add(ids.actor);
  await ownerCommand('serverlist', f).execute(f.interaction);
  const body = f.replies[0] as { files: Array<{ name: string; attachment: Buffer }> };
  assert.equal(body.files[0]?.name, 'servers.txt'); assert.match(body.files[0]?.attachment.toString() ?? '', /Test Guild.*223456789012345678.*1 members/);
  assert.match(output(f.defers), /"flags":64/);
});
test('native owner cmdlist fetches global and invoking guild commands, with no guild fetch in DMs', async () => {
  const f = nativeFixture(); f.services.ownerIds.add(ids.actor); const scopes: unknown[] = [];
  Object.assign(f.client, { application: { commands: { async fetch(options?: unknown) { scopes.push(options); return new Collection([['1', { id: '1', name: options ? 'guild-command' : 'global-command' }]]); } } } });
  await ownerCommand('cmdlist', f).execute(f.interaction);
  assert.deepEqual(scopes, [undefined, { guildId: ids.guild }]);
  const body = f.replies[0] as { files: Array<{ attachment: Buffer }> };
  assert.match(body.files[0]?.attachment.toString() ?? '', /global\tglobal-command.*\nguild\tguild-command/);
  Object.assign(f.interaction, { guild: null, guildId: null }); scopes.length = 0;
  await ownerCommand('cmdlist', f).execute(f.interaction);
  assert.deepEqual(scopes, [undefined]);
});
for (const [operation, expectedScopes, removal] of [
  ['guild', [ids.guild], false], ['global', [undefined], false], ['both', [ids.guild, undefined], false],
  ['delete-guild', [ids.guild], true], ['delete-global', [undefined], true], ['delete-both', [ids.guild, undefined], true],
] as const) {
  test(`native deploy ${operation} binds confirmation to owner/message/action and applies correct scopes`, async t => {
    const f = nativeFixture({ operation }); f.services.ownerIds.add(ids.actor); const changes: Array<{ data: unknown[]; guild?: string }> = []; let acknowledged = 0;
    Object.assign(f.client, { application: { commands: { async set(data: unknown[], guild?: string) { changes.push({ data, ...(guild ? { guild } : {}) }); } } } });
    t.mock.method(f.response, 'awaitMessageComponent', async (value: unknown) => {
      const options = value as { filter(item: { user: { id: string }; message: { id: string }; customId: string }): boolean };
      const body = f.replies[0] as { components: Array<ActionRowBuilder<ButtonBuilder>> };
      const button = body.components[0]?.toJSON().components[0]; assert.ok(button && 'custom_id' in button);
      const valid = { user: { id: ids.actor }, message: { id: ids.message }, customId: button.custom_id, async deferUpdate() { acknowledged++; } };
      assert.equal(options.filter({ ...valid, user: { id: ids.other } }), false);
      assert.equal(options.filter({ ...valid, message: { id: ids.other } }), false);
      assert.equal(options.filter({ ...valid, customId: 'wrong' }), false);
      assert.equal(options.filter(valid), true);
      return valid;
    });
    await ownerCommand('deploy', f).execute(f.interaction);
    assert.equal(acknowledged, 1);
    assert.deepEqual(changes.map(change => change.guild), expectedScopes);
    assert.deepEqual(changes.map(change => change.data), expectedScopes.map(() => removal ? [] : f.services.applicationCommands));
    assert.match(output(f.replies.at(-1)), new RegExp(removal ? 'Removed commands' : 'Registered commands'));
    assert.equal(f.errors.length, 0); assert.match(output(f.defers), /"flags":64/);
  });
}
test('native deployment expires without mutations and stops after a failed first scope', async t => {
  const f = nativeFixture({ operation: 'both' }); f.services.ownerIds.add(ids.actor); let changes = 0;
  Object.assign(f.client, { application: { commands: { async set() { changes++; throw new Error('Registration failed'); } } } });
  await ownerCommand('deploy', f).execute(f.interaction);
  assert.equal(changes, 0); assert.match(output(f.replies.at(-1)), /expired/);
  t.mock.method(f.response, 'awaitMessageComponent', async () => {
    const body = f.replies.at(-1) as { components: Array<ActionRowBuilder<ButtonBuilder>> };
    const button = body.components[0]?.toJSON().components[0]; assert.ok(button && 'custom_id' in button);
    return { customId: button.custom_id, user: { id: ids.actor }, async deferUpdate() {} };
  });
  await ownerCommand('deploy', f).execute(f.interaction);
  assert.equal(changes, 1); assert.match(output(f.replies.at(-1)), /operation failed/);
});

test('native deploy rejects invalid operations and respects owner revocation during confirmation', async t => {
  const f = nativeFixture({ operation: 'invalid' }); f.services.ownerIds.add(ids.actor); let changes = 0;
  Object.assign(f.client, { application: { commands: { async set() { changes++; } } } });
  await assert.rejects(ownerCommand('deploy', f).execute(f.interaction), /valid deployment operation/);
  assert.equal(f.replies.length, 0);
  f.values.operation = 'global';
  t.mock.method(f.response, 'awaitMessageComponent', async () => {
    const body = f.replies.at(-1) as { components: Array<ActionRowBuilder<ButtonBuilder>> };
    const button = body.components[0]?.toJSON().components[0]; assert.ok(button && 'custom_id' in button);
    f.services.ownerIds.delete(ids.actor);
    return { customId: button.custom_id, user: { id: ids.actor }, async deferUpdate() {} };
  });
  await ownerCommand('deploy', f).execute(f.interaction);
  assert.equal(changes, 0); assert.match(output(f.replies.at(-1)), /operation failed/);
});
test('native deploy reports second-scope failure after retaining the completed first scope', async t => {
  const f = nativeFixture({ operation: 'both' }); f.services.ownerIds.add(ids.actor); const scopes: Array<string | undefined> = [];
  Object.assign(f.client, { application: { commands: { async set(_data: unknown[], guild?: string) { scopes.push(guild); if (!guild) throw new Error('Global unavailable'); } } } });
  t.mock.method(f.response, 'awaitMessageComponent', async () => {
    const body = f.replies[0] as { components: Array<ActionRowBuilder<ButtonBuilder>> };
    const button = body.components[0]?.toJSON().components[0]; assert.ok(button && 'custom_id' in button);
    return { customId: button.custom_id, user: { id: ids.actor }, async deferUpdate() {} };
  });
  await ownerCommand('deploy', f).execute(f.interaction);
  assert.deepEqual(scopes, [ids.guild, undefined]); assert.match(output(f.replies.at(-1)), /operation failed/); assert.equal(f.errors.length, 1);
});

test('owner inventory reports empty data and rejects unavailable Discord application before listing', async () => {
  const f = nativeFixture(); f.services.ownerIds.add(ids.actor); f.client.guilds.cache.clear();
  await ownerCommand('serverlist', f).execute(f.interaction);
  const body = f.replies[0] as { files: Array<{ attachment: Buffer }> };
  assert.equal(body.files[0]?.attachment.toString(), 'No servers.');
  await assert.rejects(ownerCommand('cmdlist', f).execute(f.interaction), /application is not ready/);
  f.values.operation = 'guild'; Object.assign(f.client, { application: {} }); f.services.applicationCommands = [];
  await assert.rejects(ownerCommand('deploy', f).execute(f.interaction), /metadata is unavailable/);
});
