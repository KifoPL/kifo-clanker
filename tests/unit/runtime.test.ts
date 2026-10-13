import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../../src/config.js';
import { startHealthServer } from '../../src/health.js';
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand } from '../../src/contracts/commands.js';
import { dispatchInteraction } from '../../src/discord/dispatch.js';

test('configuration rejects missing secrets, wrong database scheme and invalid port', () => {
  const env = { DISCORD_TOKEN: 'test', DATABASE_URL: 'postgresql://localhost/clanker' };
  assert.equal(readConfig(env).healthPort, 8080);
  assert.throws(() => readConfig({ ...env, DISCORD_TOKEN: '' }), /DISCORD_TOKEN/);
  assert.throws(() => readConfig({ ...env, DATABASE_URL: 'https://example.com' }), /PostgreSQL/);
  assert.throws(() => readConfig({ ...env, HEALTH_PORT: '1.5' }), /HEALTH_PORT/);
});

test('readiness reflects database availability while liveness remains available', async () => {
  let available = true;
  const server = await startHealthServer(0, async () => {
    if (!available) throw new Error('database unavailable');
    return true;
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${url}/health/ready`)).status, 200);
    available = false;
    assert.equal((await fetch(`${url}/health/ready`)).status, 503);
    assert.equal((await fetch(`${url}/health/live`)).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('async command failures are awaited and answered through the correct acknowledgement path', async () => {
  const command: SlashCommand = {
    data: { name: 'fail', description: 'Failure fixture' },
    async execute() { await Promise.resolve(); throw new Error('private detail'); },
  };
  for (const state of ['new', 'deferred', 'replied'] as const) {
    const responses: Array<{ method: string; body: unknown }> = [];
    const interaction = {
      commandName: 'fail', deferred: state === 'deferred', replied: state === 'replied',
      async reply(body: unknown) { responses.push({ method: 'reply', body }); },
      async editReply(body: unknown) { responses.push({ method: 'edit', body }); },
      async followUp(body: unknown) { responses.push({ method: 'followUp', body }); },
    } as unknown as ChatInputCommandInteraction;
    await dispatchInteraction(interaction, [command]);
    assert.equal(responses.length, 1);
    assert.equal(responses[0]?.method, state === 'deferred' ? 'edit' : state === 'replied' ? 'followUp' : 'reply');
    assert.ok(!JSON.stringify(responses).includes('private detail'));
    if (state !== 'deferred') {
      assert.equal((responses[0]?.body as { flags: number }).flags, MessageFlags.Ephemeral);
    }
  }
});
