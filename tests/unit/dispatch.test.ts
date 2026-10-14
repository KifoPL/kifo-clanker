import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApplicationCommandType, MessageFlags, type ContextMenuCommandInteraction, type ChatInputCommandInteraction } from 'discord.js';
import type { ContextCommand } from '../../src/contracts/commands.js';
import type { SlashCommand } from '../../src/contracts/commands.js';
import { dispatchContext, dispatchInteraction } from '../../src/discord/dispatch.js';

test('unknown application commands acknowledge privately without invoking a handler', async () => {
  const bodies: unknown[] = [];
  const interaction = { commandName: 'removed', async reply(body: unknown) { bodies.push(body); } };
  await dispatchInteraction(interaction as unknown as ChatInputCommandInteraction, []);
  await dispatchContext(interaction as unknown as ContextMenuCommandInteraction, []);
  assert.equal(bodies.length, 2);
  for (const body of bodies) assert.equal((body as { flags: number }).flags, MessageFlags.Ephemeral);
});

test('failures after a deferred response preserve the existing result and send a private follow-up', async () => {
  for (const kind of ['slash', 'context'] as const) {
    const original = { content: 'An already-delivered result' };
    const edits: unknown[] = [];
    const followUps: unknown[] = [];
    const interaction = {
      commandName: 'fixture', deferred: true, replied: true,
      async editReply(body: unknown) { edits.push(body); Object.assign(original, body); },
      async followUp(body: unknown) { followUps.push(body); },
    };
    const execute = async () => { throw new Error('private failure detail'); };
    if (kind === 'slash') {
      const command: SlashCommand = { data: { name: 'fixture', description: 'Fixture' }, execute };
      await dispatchInteraction(interaction as unknown as ChatInputCommandInteraction, [command]);
    } else {
      const command: ContextCommand = { data: { name: 'fixture', type: ApplicationCommandType.Message }, execute };
      await dispatchContext(interaction as unknown as ContextMenuCommandInteraction, [command]);
    }
    assert.deepEqual(edits, []);
    assert.equal(original.content, 'An already-delivered result');
    assert.equal(followUps.length, 1);
    assert.equal((followUps[0] as { flags: number }).flags, MessageFlags.Ephemeral);
    assert.doesNotMatch(JSON.stringify(followUps), /private failure detail/);
  }
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
