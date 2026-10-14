import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApplicationCommandType, MessageFlags, type ContextMenuCommandInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ContextCommand } from '../../src/contracts/commands.js';
import { dispatchContext, dispatchInteraction } from '../../src/discord/dispatch.js';

test('unknown application commands acknowledge privately without invoking a handler', async () => {
  const bodies: unknown[] = [];
  const interaction = { commandName: 'removed', async reply(body: unknown) { bodies.push(body); } };
  await dispatchInteraction(interaction as unknown as ChatInputCommandInteraction, []);
  await dispatchContext(interaction as unknown as ContextMenuCommandInteraction, []);
  assert.equal(bodies.length, 2);
  for (const body of bodies) assert.equal((body as { flags: number }).flags, MessageFlags.Ephemeral);
});

test('context dispatch awaits execution and acknowledges failures without leaking resource details', async () => {
  const calls: Array<{ method: string; body: unknown }> = [];
  const command: ContextCommand = {
    data: { name: 'fixture', type: ApplicationCommandType.Message },
    async execute() { await Promise.resolve(); throw new Error('private message body'); },
  };
  for (const state of ['new', 'deferred', 'replied'] as const) {
    calls.length = 0;
    const interaction = {
      commandName: 'fixture', deferred: state === 'deferred', replied: state === 'replied',
      async reply(body: unknown) { calls.push({ method: 'reply', body }); },
      async editReply(body: unknown) { calls.push({ method: 'edit', body }); },
      async followUp(body: unknown) { calls.push({ method: 'followUp', body }); },
    } as unknown as ContextMenuCommandInteraction;
    await dispatchContext(interaction, [command]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, state === 'new' ? 'reply' : state === 'deferred' ? 'edit' : 'followUp');
    assert.doesNotMatch(JSON.stringify(calls), /private message body/);
  }
});
