import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { parse, type Node } from 'acorn';
import { Client, GatewayIntentBits } from 'discord.js';
import { createPool } from '../../src/db/pool.js';
import { applicationCommandData, createRegistry } from '../../src/registry.js';
import { logger } from '../../src/logger.js';

interface SyntaxNode extends Node {
  value?: unknown;
  name?: string;
  elements?: SyntaxNode[];
  properties?: Array<{ key: SyntaxNode; value: SyntaxNode }>;
  left?: SyntaxNode;
  right?: SyntaxNode;
  object?: SyntaxNode;
  property?: SyntaxNode;
}
function literal(node: SyntaxNode): unknown {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ArrayExpression') return node.elements?.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries((node.properties ?? []).map(property => [
    property.key.name ?? String(property.key.value), literal(property.value),
  ]));
  return undefined;
}

async function legacyOptions(name: string): Promise<unknown> {
  const text = await readFile(`legacy/slash_commands/${name}.js`, 'utf8');
  const source = parse(text, { ecmaVersion: 'latest' });
  let options: unknown;
  function visit(node: SyntaxNode): void {
    if (node.type === 'AssignmentExpression' && node.left?.object?.name === 'module' && node.left.property?.name === 'exports' && node.right?.type === 'ObjectExpression') {
      const metadata = literal(node.right) as Record<string, unknown>;
      options = metadata.options ?? [];
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child === 'object' && 'type' in child) visit(child as SyntaxNode);
      } else if (value && typeof value === 'object' && 'type' in value) visit(value as unknown as SyntaxNode);
    }
  }
  visit(source);
  assert.ok(Array.isArray(options), `Cannot read legacy options for ${name}`);
  return options;
}

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

test('all legacy slash command names, option paths, types and required inputs remain registered', async () => {
  const files = (await readdir('legacy/slash_commands')).filter(name => name.endsWith('.js'));
  assert.equal(files.length, 19);
  const registered = applicationCommandData.filter(command => !command.type || command.type === 1);
  assert.equal(registered.length, 19);
  for (const file of files) {
    const name = file.slice(0, -3);
    const command = registered.find(item => item.name === name);
    assert.ok(command, `Missing /${name}`);
    const oldPaths = optionPaths(await legacyOptions(name));
    const newPaths = optionPaths('options' in command ? command.options ?? [] : []);
    for (const [path, option] of oldPaths) assert.deepEqual(newPaths.get(path), option, `/${name}${path} changed`);
  }
});

test('registry includes all 15 prefix commands, three context menus, owners and business job handlers without opening connections', async () => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const pool = createPool('postgresql://localhost/parity_no_connection');
  try {
    const registry = createRegistry({ client, pool, ownerIds: new Set(), prefixes: new Map(), logger, startedAt: Date.now(), env: {} });
    const names = new Set(registry.prefix.map(command => command.name));
    for (const name of ['clean','list','menu','perms','remove','stats','top','giveaway','lang','prefix','react','superslow','todo','test','help','serverlist','deploy','cmdlist']) assert.ok(names.has(name), `Missing prefix ${name}`);
    assert.deepEqual(registry.context.map(command => command.data.name).sort(), ['detect language', 'save', 'user stats']);
    assert.deepEqual(registry.slash.map(command => command.data.name).sort(), applicationCommandData.filter(command => !command.type || command.type === 1).map(command => command.name).sort());
    for (const type of ['role_restore','permission_restore','menu.expire','menu.participant','poll.complete','giveaway.complete','countdown.complete','countdown.expire']) assert.ok(registry.handlers[type], `Missing scheduled ${type}`);
    assert.equal(pool.totalCount, 0);
  } finally { await client.destroy(); await pool.end(); }
});
