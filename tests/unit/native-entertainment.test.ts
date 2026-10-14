import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageFlags, PermissionsBitField } from 'discord.js';
import { entertainmentFeature } from '../../src/features/entertainment/index.js';
import { nativeFixture, ids, output } from './native-fixtures.js';
function command(name: string, f: ReturnType<typeof nativeFixture>) {
  const value = entertainmentFeature.create(f.services).slashCommands?.find(command => command.data.name === name); assert.ok(value); return value;
}
test('native IQ, PP and howgay target the selected member, default to requester and reject DMs', async () => {
  for (const name of ['iq', 'pp', 'howgay']) {
    const f = nativeFixture();
    await command(name, f).execute(f.interaction);
    assert.match(output(f.replies), /Requester/);
    f.values.user = { id: '289119054130839552', username: 'Selected' };
    await command(name, f).execute(f.interaction);
    assert.match(output(f.replies.at(-1)), /Selected/);
    assert.match(output(f.replies.at(-1)), name === 'iq' ? /420 IQ/ : name === 'pp' ? /69 cm/ : /-1%/);
    Object.assign(f.interaction, { guildId: null });
    await command(name, f).execute(f.interaction);
    assert.match(output(f.replies.at(-1)), /Use this command in a server/);
    assert.match(output(f.replies.at(-1)), /"flags":64/);
  }
});
test('native cringe and stfu notify only the selected target and preserve protected-user response', async () => {
  for (const name of ['cringe', 'stfu']) {
    const f = nativeFixture({ user: { id: ids.other } });
    await command(name, f).execute(f.interaction);
    assert.match(output(f.replies.at(-1)), new RegExp(`<@${ids.other}>`));
    assert.match(output(f.replies.at(-1)), new RegExp(`"users":\\["${ids.other}"\\]`));
    f.values.user = null;
    await command(name, f).execute(f.interaction);
    assert.match(output(f.replies.at(-1)), /"users":\[\]/);
    f.values.user = { id: '289119054130839552' };
    await command(name, f).execute(f.interaction);
    assert.match(output(f.replies.at(-1)), /own spell/);
    assert.doesNotMatch(output(f.replies.at(-1)), /<@289119054130839552>/);
  }
});
test('native guide returns the requested guide or guide list privately', async () => {
  const f = nativeFixture({ choice: 'epoch' });
  await command('guide', f).execute(f.interaction);
  assert.match(output(f.replies), /docs\/guides\/epoch/);
  f.values.choice = null;
  await command('guide', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /docs\/guideList/);
  assert.match(output(f.replies.at(-1)), /"flags":64/);
});
test('native joke command awaits provider fetch and gives bounded public success/failure replies', async t => {
  const f = nativeFixture(); let fail = false;
  t.mock.method(globalThis, 'fetch', async () => fail ? new Response('', { status: 503 }) : Response.json({ joke: 'Provider joke' }));
  await command('urmum', f).execute(f.interaction);
  assert.match(output(f.replies), /Provider joke/);
  assert.equal(f.defers.length, 1);
  assert.doesNotMatch(output(f.defers), /64/);
  fail = true; await command('urmum', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /unavailable/);
});
test('native bookmark copies only authorized content into requester DMs and honors pin', async t => {
  const f = nativeFixture({ message: ids.other, pin: true }); let pinned = 0;
  t.mock.method(f.response, 'pin', async () => { pinned++; });
  await command('bookmark', f).execute(f.interaction);
  assert.equal(f.dms.length, 1); assert.equal(pinned, 1);
  assert.match(output(f.dms), /Private source text/);
  assert.doesNotMatch(output(f.replies), /Private source text/);
  assert.match(output(f.defers), /"flags":64/);
  t.mock.method(f.channel, 'permissionsFor', () => new PermissionsBitField());
  await assert.rejects(command('bookmark', f).execute(f.interaction), /Read Message History/);
  assert.equal(f.dms.length, 1);
});
test('native error reporter handles disabled integration, cooldown, successful issue/owner DM and provider failure', async t => {
  const f = nativeFixture({ description: 'Command unexpectedly failed' });
  await command('error', f).execute(f.interaction);
  assert.match(output(f.replies), /disabled/); assert.equal(f.queries.length, 0);
  Object.assign(f.services.env, { GITHUB_TOKEN: 'test-key' });
  f.services.ownerIds.add(ids.actor);
  let admitted = false; let providerCalls = 0; let fail = false;
  t.mock.method(f.pool, 'query', async (sql: string, values: unknown[] = []) => { f.queries.push({ sql, values }); return { rows: [], rowCount: admitted ? 1 : 0 }; });
  t.mock.method(globalThis, 'fetch', async () => { providerCalls++; return fail ? new Response('', { status: 503 }) : Response.json({ html_url: 'https://github.com/KifoPL/kifo-clanker/issues/123' }, { status: 201 }); });
  await command('error', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /wait 10 minutes/); assert.equal(providerCalls, 0);
  admitted = true; await command('error', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /issues\/123/); assert.match(output(f.dms), /issues\/123/);
  assert.equal(f.queries.at(-1)?.values[0], ids.actor);
  fail = true; await command('error', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /reporting failed/); assert.equal(f.dms.length, 1);
  assert.ok(f.defers.every(body => output(body).includes(String(MessageFlags.Ephemeral))));
});

test('native bookmark reports unsupported channels without reading messages, and closed DMs fail without public content', async t => {
  const f = nativeFixture({ message: ids.other }); let reads = 0;
  t.mock.method(f.channel.messages, 'fetch', async () => { reads++; return f.source; });
  t.mock.method(f.channel, 'isTextBased', () => false);
  await command('bookmark', f).execute(f.interaction);
  assert.equal(reads, 0); assert.match(output(f.replies), /cannot contain saved messages/);
  t.mock.method(f.channel, 'isTextBased', () => true);
  t.mock.method(f.user, 'send', async () => { throw new Error('DMs closed'); });
  await assert.rejects(command('bookmark', f).execute(f.interaction), /DMs closed/);
  assert.doesNotMatch(output(f.replies), /Private source text/);
});

test('native issue creation survives owner-DM failure while database admission failure prevents provider calls', async t => {
  const f = nativeFixture({ description: 'A reproducible issue' }); Object.assign(f.services.env, { GITHUB_TOKEN: 'test-key' }); f.services.ownerIds.add(ids.actor);
  let providerCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => { providerCalls++; return Response.json({ html_url: 'https://github.com/KifoPL/kifo-clanker/issues/999' }, { status: 201 }); });
  t.mock.method(f.user, 'send', async () => { throw new Error('Owner DMs disabled'); });
  await command('error', f).execute(f.interaction);
  assert.match(output(f.replies.at(-1)), /Created a GitHub issue/); assert.equal(providerCalls, 1);
  t.mock.method(f.pool, 'query', async () => { throw new Error('Private database failure'); });
  await assert.rejects(command('error', f).execute(f.interaction), /Database operation failed/);
  assert.equal(providerCalls, 1); assert.doesNotMatch(output(f.replies), /Private database failure|test-key/);
});
