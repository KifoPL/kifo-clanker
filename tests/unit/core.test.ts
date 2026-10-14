import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermissionsBitField, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { createRegistryHelp } from '../../src/features/core/help.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { applicationCommandData } from '../../src/registry.js';

function fixture(options: Record<string, string> = {}, permissions = 0n) {
  let output: unknown;
  const interaction = {
    user: { id: 'member' }, guildId: 'guild', memberPermissions: new PermissionsBitField(permissions),
    options: { getString: (name: string) => options[name] ?? null },
    async reply(body: unknown) { output = body; },
  } as unknown as ChatInputCommandInteraction;
  return { interaction, output: () => output };
}

test('native help groups commands and hides owner commands and unavailable permissions', async () => {
  const services = { ownerIds: new Set() } as unknown as RuntimeServices;
  const help = createRegistryHelp(services, () => applicationCommandData);
  const all = fixture();
  await help.execute(all.interaction);
  const output = JSON.stringify(all.output());
  for (const command of ['/help', '/epoch', '/ping', 'user stats']) assert.ok(output.includes(command));
  for (const command of ['/deploy', '/reload', '/serverlist', '/cmdlist', '/remove']) assert.ok(!output.includes(command));
  assert.equal((all.output() as { flags: number }).flags, MessageFlags.Ephemeral);
  const management = fixture({ category: 'management' }, PermissionsBitField.All);
  await help.execute(management.interaction);
  for (const command of ['/clean', '/perms', '/remove', '/menu']) assert.ok(JSON.stringify(management.output()).includes(command));
  assert.ok(!JSON.stringify(management.output()).includes('/epoch'));
  services.ownerIds.add('member');
  await help.execute(all.interaction);
  assert.ok(JSON.stringify(all.output()).includes('/deploy'));
});

test('registry supplies detailed native options and slash-only help for unknown commands', async () => {
  const help = createRegistryHelp({ ownerIds: new Set() } as unknown as RuntimeServices, () => applicationCommandData);
  const detail = fixture({ command: '/EPOCH' });
  await help.execute(detail.interaction);
  for (const option of ['date_to_epoch', 'epoch_to_date', 'help']) assert.ok(JSON.stringify(detail.output()).includes(option));
  const unknown = fixture({ command: 'removed-command' });
  await help.execute(unknown.interaction);
  assert.ok(JSON.stringify(unknown.output()).includes('/help'));
  assert.ok(!JSON.stringify(unknown.output()).includes('!kifo'));
});

test('DM help excludes commands registered only for guild context', async () => {
  const f = fixture();
  Object.assign(f.interaction, { guildId: null });
  await createRegistryHelp({ ownerIds: new Set() } as unknown as RuntimeServices, () => applicationCommandData).execute(f.interaction);
  const text = JSON.stringify(f.output());
  for (const name of ['/clean', '/remove', '/perms', '/menu', '/list', '/stats', '/top', '/todo', '/giveaway']) assert.ok(!text.includes(name), name);
  assert.ok(text.includes('/help'));
});
