import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerStartupCommands } from '../../src/features/core/registration.js';
import { applicationCommandData } from '../../src/registry.js';
import { nativeFixture } from './native-fixtures.js';

const testBot = '796447999747948584';
const productionBot = '795638549730295820';
const testGuild = '822800862581751848';
function registrationFixture(botId = testBot) {
  const f = nativeFixture();
  Object.assign(f.client.user, { id: botId });
  f.services.applicationCommands = applicationCommandData;
  const changes: Array<{ data: unknown[]; guild: string | undefined }> = [];
  const argumentCounts: number[] = [];
  const commands = { async set(...args: [unknown[], string?]) {
    argumentCounts.push(args.length); const [data, guild] = args; changes.push({ data, guild });
  } };
  Object.assign(f.client, { application: { commands } });
  const destinations: string[] = [];
  Object.assign(f.client.channels, { fetch: async (id: string) => { destinations.push(id); return f.channel; } });
  return { ...f, commands, changes, destinations, argumentCounts };
}

test('authenticated test bot registers all38metadata entries in default test guild without application-ID env', async () => {
  const f = registrationFixture();
  Object.assign(f.services.env, { DISCORD_APPLICATION_ID: productionBot });
  assert.equal(await registerStartupCommands(f.services), true);
  assert.equal(f.changes.length, 1);
  assert.equal(f.changes[0]?.guild, testGuild); assert.deepEqual(f.argumentCounts, [2]);
  assert.equal(f.changes[0]?.data.length, 38);
  assert.deepEqual(f.changes[0]?.data, applicationCommandData);
});

test('test-guild override changes only destination while registration is awaited', async t => {
  const f = registrationFixture(); const override = '123456789012345678';
  Object.assign(f.services.env, { DISCORD_TEST_GUILD_ID: override });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.mock.method(f.commands, 'set', async (data: unknown[], guild?: string) => { f.changes.push({ data, guild }); await gate; });
  let completed = false;
  const registering = registerStartupCommands(f.services).then(result => { completed = result; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(completed, false); assert.equal(f.changes[0]?.guild, override);
  release(); await registering; assert.equal(completed, true);
});

test('unknown authenticated identities skip registration even with known application-ID env', async () => {
  const f = registrationFixture('123456789012345678'); Object.assign(f.services.env, { DISCORD_APPLICATION_ID: testBot });
  assert.equal(await registerStartupCommands(f.services), false); assert.deepEqual(f.changes, []); assert.deepEqual(f.destinations, []);
});

test('failed authenticated test registration rejects rather than reporting startup success', async t => {
  const f = registrationFixture(); let writes = 0;
  t.mock.method(f.commands, 'set', async () => { writes++; throw new Error('Discord registration failed'); });
  await assert.rejects(registerStartupCommands(f.services), /Discord registration failed/); assert.equal(writes, 1);
});

test('test registration rejects absent metadata/application rather than clearing existing guild commands', async () => {
  const f = registrationFixture(); f.services.applicationCommands = [];
  await assert.rejects(registerStartupCommands(f.services), /metadata is unavailable/); assert.deepEqual(f.changes, []);
  f.services.applicationCommands = applicationCommandData; Object.assign(f.client, { application: null });
  await assert.rejects(registerStartupCommands(f.services), /metadata is unavailable/); assert.deepEqual(f.changes, []);
});


test('authenticated production bot registers38commands globally and reports in production channel', async () => {
  const f = registrationFixture(productionBot);
  Object.assign(f.services.env, { DISCORD_APPLICATION_ID: testBot, DISCORD_TEST_GUILD_ID: '123456789012345678' });
  assert.equal(await registerStartupCommands(f.services), true);
  assert.deepEqual(f.changes, [{ data: [...applicationCommandData], guild: undefined }]);
  assert.equal(f.changes[0]?.data.length, 38); assert.deepEqual(f.argumentCounts, [1]);
  assert.deepEqual(f.destinations, ['828100819730956348']);
  assert.equal(f.channelSends.length, 1); assert.match(JSON.stringify(f.channelSends), /38/);
});

test('test registration reports only in default test reporting channel with safe mentions', async () => {
  const f = registrationFixture();
  assert.equal(await registerStartupCommands(f.services), true);
  assert.deepEqual(f.destinations, ['822800863050858539']);
  assert.equal(f.channelSends.length, 1);
  assert.match(JSON.stringify(f.channelSends), /"parse":\[\]/);
});

test('deployment reporting override applies to either bot identity without changing command scope', async () => {
  for (const botId of [testBot, productionBot]) {
    const f = registrationFixture(botId); Object.assign(f.services.env, { DISCORD_DEPLOY_CHANNEL_ID: '123456789012345678' });
    assert.equal(await registerStartupCommands(f.services), true);
    assert.deepEqual(f.destinations, ['123456789012345678']);
    assert.equal(f.changes[0]?.guild, botId === testBot ? testGuild : undefined);
  }
});

test('report-channel lookup or message delivery failure does not invalidate successful command registration', async t => {
  for (const failure of ['lookup', 'send']) {
    const f = registrationFixture(productionBot);
    if (failure === 'lookup') t.mock.method(f.client.channels, 'fetch', async () => { throw new Error('Channel unavailable'); });
    else t.mock.method(f.channel, 'send', async () => { throw new Error('Report denied'); });
    assert.equal(await registerStartupCommands(f.services), true);
    assert.equal(f.changes.length, 1); assert.equal(f.errors.length, 1);
  }
});

test('production command-registration failure rejects before sending a success report', async t => {
  const f = registrationFixture(productionBot);
  t.mock.method(f.commands, 'set', async () => { throw new Error('Global registration denied'); });
  await assert.rejects(registerStartupCommands(f.services), /Global registration denied/);
  assert.deepEqual(f.destinations, []); assert.deepEqual(f.channelSends, []);
});


test('missing or non-sendable reporting channels do not emit a false failure or attempt a send', async t => {
  for (const unavailable of ['missing', 'non-sendable']) {
    const f = registrationFixture();
    if (unavailable === 'missing') t.mock.method(f.client.channels, 'fetch', async () => null);
    else t.mock.method(f.channel, 'isSendable', () => false);
    assert.equal(await registerStartupCommands(f.services), true);
    assert.equal(f.changes.length, 1); assert.deepEqual(f.channelSends, []); assert.equal(f.errors.length, 1);
  }
});
