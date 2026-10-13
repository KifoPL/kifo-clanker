import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermissionsBitField, type Message } from 'discord.js';
import { createRegistryHelp } from '../../src/features/core/help.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { applicationCommandData } from '../../src/registry.js';

test('help normalizes categories, lists all registered members, and hides owner commands from others', async () => {
  const prefixCommands = ['management','Management','MANAGEMENT'].map((category, index) => ({ name: `cmd${index}`, description: 'fixture', category, async execute() {} }));
  prefixCommands.push({ name: 'private', description: 'fixture', category: 'DEBUG', async execute() {}, ownerOnly: true } as typeof prefixCommands[number] & { ownerOnly: boolean });
  let output: unknown;
  const services = { prefixes: new Map(), ownerIds: new Set() } as unknown as RuntimeServices;
  const help = createRegistryHelp(services, prefixCommands, []);
  const message = {
    author: { id: 'member' }, member: { permissionsIn: () => new PermissionsBitField(0n) },
    async reply(body: unknown) { output = body; },
  } as unknown as Message;
  await help.execute(message, ['management']);
  const text = JSON.stringify(output);
  for (const command of ['cmd0','cmd1','cmd2']) assert.ok(text.includes(command));
  await help.execute(message, []);
  assert.ok(!JSON.stringify(output).includes('private'));
});

test('one registry supplies complete application help, detailed options and configured prefixes', async () => {
  let output: unknown;
  const services = { prefixes: new Map([['guild', '?']]), ownerIds: new Set() } as unknown as RuntimeServices;
  const help = createRegistryHelp(services, [], applicationCommandData);
  const message = { guildId: 'guild', author: { id: 'member' }, async reply(body: unknown) { output = body; } } as unknown as Message;
  await help.execute(message, []);
  for (const name of ['/ticketing','/countdown','/epoch','user stats']) assert.ok(JSON.stringify(output).includes(name));
  await help.execute(message, ['/EPOCH']);
  for (const option of ['date_to_epoch','epoch_to_date','help']) assert.ok(JSON.stringify(output).includes(option));
  await help.execute(message, ['removed-command']);
  assert.ok(JSON.stringify(output).includes('?help'));
});
