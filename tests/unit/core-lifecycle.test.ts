import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Client, Guild, Message } from 'discord.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { coreFeature, refreshPresence } from '../../src/features/core/index.js';

function fixture(logChannel?: string) {
  const replies: unknown[] = [];
  const sent: unknown[] = [];
  const logs: string[] = [];
  const fetched: string[] = [];
  const presences: unknown[] = [];
  const client = {
    user: { id: '795638549730295820', setPresence: (presence: unknown) => { presences.push(presence); } },
    guilds: { cache: { size: 2 } },
    channels: { async fetch(id: string) {
      fetched.push(id);
      return { isSendable: () => true, async send(body: unknown) { sent.push(body); } };
    } },
  } as unknown as Client;
  const services = {
    client, startedAt: Date.now() - 120_000, ownerIds: new Set(),
    env: logChannel ? { DISCORD_LOG_CHANNEL_ID: logChannel } : {},
    logger: { info: (message: string) => { logs.push(message); } },
  } as unknown as RuntimeServices;
  return { services, runtime: coreFeature.create(services), replies, sent, logs, fetched, presences,
    message(content: string, bot = false) {
      return { content, author: { bot }, async reply(body: unknown) { replies.push(body); } } as unknown as Message;
    } };
}

test('mention greeting handles only a bare human mention and directs users to native help', async () => {
  const f = fixture();
  for (const text of ['ordinary text', '!kifo help', '?help', '<@795638549730295820> help']) assert.equal(await f.runtime.onMessage!(f.message(text)), 'continue');
  assert.equal(await f.runtime.onMessage!(f.message('<@795638549730295820>', true)), 'continue');
  assert.equal(f.replies.length, 0);
  for (const text of ['<@795638549730295820>', ' <@!795638549730295820> ']) assert.equal(await f.runtime.onMessage!(f.message(text)), 'handled');
  assert.equal(f.replies.length, 2);
  assert.match(JSON.stringify(f.replies), /\/help/);
  assert.match(JSON.stringify(f.replies), /Online for 2 minutes/);
});

test('guild lifecycle logging is optional and Discord notifications disable mentions', async () => {
  const guild = { id: 'guild', name: '@everyone' } as unknown as Guild;
  const silent = fixture();
  await silent.runtime.onGuild!(guild, 'join');
  assert.deepEqual(silent.logs, ['Guild lifecycle: join']);
  assert.deepEqual(silent.fetched, []);
  const relay = fixture('123456789012345678');
  for (const event of ['join', 'leave', 'unavailable'] as const) await relay.runtime.onGuild!(guild, event);
  assert.equal(relay.sent.length, 3);
  assert.deepEqual(relay.fetched, Array(3).fill('123456789012345678'));
  for (const body of relay.sent) assert.deepEqual((body as { allowedMentions: unknown }).allowedMentions, { parse: [] });
});

test('presence refresh reports slash help and uptime through the client double', () => {
  const f = fixture();
  refreshPresence(f.services.client, Date.now() - 120_000);
  assert.equal(f.presences.length, 1);
  assert.match(JSON.stringify(f.presences), /Use \/help.*2m/);
});
