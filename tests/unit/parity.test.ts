import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { Client, GatewayIntentBits } from 'discord.js';
import { createPool } from '../../src/db/pool.js';
import { applicationCommandData, createRegistry } from '../../src/registry.js';
import { logger } from '../../src/logger.js';

const types: Record<string, number> = { SUB_COMMAND: 1, SUB_COMMAND_GROUP: 2, STRING: 3, INTEGER: 4, BOOLEAN: 5, USER: 6, CHANNEL: 7, ROLE: 8, MENTIONABLE: 9, NUMBER: 10, ATTACHMENT: 11 };
function optionPaths(options: unknown, parent = ''): Map<string, { type: number; required: boolean }> {
  assert.ok(Array.isArray(options));
  const paths = new Map<string, { type: number; required: boolean }>();
  for (const value of options) {
    assert.ok(value && typeof value === 'object');
    const option = value as Record<string, unknown>;
    assert.equal(typeof option.name, 'string');
    const path = `${parent}/${String(option.name)}`;
    const type = typeof option.type === 'number' ? option.type : types[String(option.type)];
    assert.ok(type, `Unknown option type at ${path}`);
    paths.set(path, { type, required: option.required === true });
    if (option.options) for (const [nestedPath, metadata] of optionPaths(option.options, path)) paths.set(nestedPath, metadata);
  }
  return paths;
}

test('supported slash names, option paths, types and required inputs preserve their public contract', async () => {
  const expected = JSON.parse(await readFile('tests/fixtures/application-options.json', 'utf8')) as Array<{ name: string; options: unknown }>;
  assert.equal(expected.length, 18);
  const registered = applicationCommandData.filter(command => !command.type || command.type === 1);
  assert.equal(registered.length, 35);
  for (const contract of expected) {
    const command = registered.find(item => item.name === contract.name);
    assert.ok(command, `Missing /${contract.name}`);
    const newPaths = optionPaths('options' in command ? command.options ?? [] : []);
    for (const [path, option] of optionPaths(contract.options)) assert.deepEqual(newPaths.get(path), option, `/${contract.name}${path} changed`);
  }
  assert.ok(!applicationCommandData.some(command => ['prefix', 'test'].includes(command.name)));
});

test('registry exposes native slash commands, three context menus and durable handlers without connections', async () => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const pool = createPool('postgresql://localhost/parity_no_connection');
  try {
    const registry = createRegistry({ client, pool, ownerIds: new Set(), logger, startedAt: Date.now(), env: {} });
    const names = new Set(registry.slash.map(command => command.data.name));
    for (const name of ['clean','list','menu','perms','remove','stats','top','giveaway','lang','react','superslow','todo','help','serverlist','deploy','cmdlist']) assert.ok(names.has(name), `Missing slash /${name}`);
    assert.equal('prefix' in registry, false);
    assert.deepEqual(registry.context.map(command => command.data.name).sort(), ['detect language', 'save', 'user stats']);
    assert.deepEqual(registry.slash.map(command => command.data.name).sort(), applicationCommandData.filter(command => !command.type || command.type === 1).map(command => command.name).sort());
    for (const type of ['role_restore','permission_restore','menu.expire','menu.participant','poll.complete','giveaway.complete','countdown.complete','countdown.expire']) assert.ok(registry.handlers[type], `Missing scheduled ${type}`);
    assert.equal(pool.totalCount, 0);
  } finally { await client.destroy(); await pool.end(); }
});
