import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MessageFlags } from 'discord.js';
import { slashCommands } from '../../src/commands/index.js';
import { nativeFixture, output } from './native-fixtures.js';
const command = (name: string) => { const value = slashCommands.find(command => command.data.name === name); assert.ok(value); return value; };
test('native ping reads its named optional argument and acknowledges privately', async () => {
  for (const reply of [null, 'Custom pong']) {
    const f = nativeFixture({ reply });
    await command('ping').execute(f.interaction);
    assert.equal(f.replies.length, 1);
    assert.match(output(f.replies), reply ? /Custom pong/ : /Pong!/);
    assert.match(output(f.replies), new RegExp(`"flags":${MessageFlags.Ephemeral}`));
  }
});

test('native reverse handles empty input without constructing a rejected Discord embed', async () => {
  const f = nativeFixture({ text: '', silent: false });
  await command('reverse').execute(f.interaction);
  assert.match(output(f.replies), /Provide text to reverse/);
  assert.match(output(f.replies), /"flags":64/);
  assert.doesNotMatch(output(f.replies), /embeds/);
});
test('native reverse maps text and silent options without breaking Unicode graphemes', async () => {
  for (const silent of [false, true]) {
    const f = nativeFixture({ text: 'A👩🏽‍💻é', silent });
    await command('reverse').execute(f.interaction);
    assert.match(output(f.replies), /é👩🏽‍💻A/);
    assert.equal(output(f.replies).includes(`"flags":${MessageFlags.Ephemeral}`), silent);
  }
});
test('native epoch dispatches all subcommands and rejects bad dates privately', async () => {
  for (const [values, expected] of [
    [{ subcommand: 'date_to_epoch', input: '1970-01-01T00:00:00Z' }, /"content":"0"/],
    [{ subcommand: 'date_to_epoch', input: '1970-01-01T00:00:00.123456Z' }, /"content":"0"/],
    [{ subcommand: 'epoch_to_date', epoch: -1 }, /1969-12-31T23:59:59.000Z/],
    [{ subcommand: 'help' }, /Epoch Converter Guide/],
    [{ subcommand: 'date_to_epoch', input: '2023-02-29' }, /Unrecognized input/],
    [{ subcommand: 'epoch_to_date', epoch: 8640000000001 }, /Unrecognized input/],
  ] as const) {
    const f = nativeFixture(values); await command('epoch').execute(f.interaction);
    assert.equal(f.replies.length, 1); assert.match(output(f.replies), expected);
    if ('input' in values && values.input === '2023-02-29') assert.match(output(f.replies), /"flags":64/);
  }
});
