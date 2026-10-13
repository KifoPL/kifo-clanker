import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import type { InteractionReplyOptions, MessageReplyOptions } from 'discord.js';
import { epochDateReply, epochIsoReply, epochToIso, parseEpochInput } from '../../src/commands/epoch.js';
import { createHelpCommand, helpReply } from '../../src/commands/help.js';
import { slashCommands } from '../../src/commands/index.js';
import { pingReply } from '../../src/commands/ping.js';
import { reverseReply, reverseText } from '../../src/commands/reverse.js';

function embedData(reply: InteractionReplyOptions | MessageReplyOptions) {
  const embed = reply.embeds?.[0];
  assert.ok(embed instanceof EmbedBuilder);
  return embed.toJSON();
}

test('migration registry contains only the supported slash commands with valid option types', () => {
  assert.deepEqual(slashCommands.map(command => command.data.name), ['ping', 'reverse', 'epoch']);
  const reverse = slashCommands.find(command => command.data.name === 'reverse');
  const textOption = reverse?.data.options?.find(option => option.name === 'text');
  assert.ok(textOption?.type === ApplicationCommandOptionType.String);
  assert.equal(textOption.required, true);
  assert.equal(textOption.max_length, 4096);
  const epoch = slashCommands.find(command => command.data.name === 'epoch');
  assert.deepEqual(epoch?.data.options?.map(option => option.name), ['date_to_epoch', 'epoch_to_date', 'help']);
});

test('ping stays private and preserves the optional custom reply', () => {
  assert.equal(embedData(pingReply(null)).description, 'Pong!');
  const reply = pingReply('Hello');
  assert.equal(embedData(reply).description, 'Pong!\nHello');
  assert.equal(reply.flags, MessageFlags.Ephemeral);
});

test('reverse preserves graphemes, combining accents, skin tones, and multi-codepoint emoji', () => {
  assert.equal(reverseText('abc'), 'cba');
  assert.equal(reverseText('A👩🏽‍💻e\u0301🇵🇱'), '🇵🇱e\u0301👩🏽‍💻A');
  assert.equal(reverseText(''), '');
});

test('reverse is public by default and honors the silent option', () => {
  const reply = reverseReply('Hello', false, 'Someone');
  assert.equal(embedData(reply).description, 'olleH');
  assert.match(embedData(reply).title ?? '', /Someone/);
  assert.equal(reply.flags, undefined);
  assert.equal(reverseReply('Hello', true, 'Someone').flags, MessageFlags.Ephemeral);
});

test('epoch accepts ISO dates, timezone offsets, and relative durations', () => {
  const now = Date.parse('2000-01-01T00:00:00Z');
  assert.deepEqual(parseEpochInput('1970-01-01T00:00:00Z', now), { epoch: 0, kind: 'date' });
  assert.deepEqual(parseEpochInput('2000-01-01T03:00+03:00', now), { epoch: 946684800, kind: 'date' });
  assert.deepEqual(parseEpochInput('2000-01-01T00:00:00', now), { epoch: 946684800, kind: 'date' });
  assert.deepEqual(parseEpochInput('2000-01-01', now), { epoch: 946684800, kind: 'date' });
  assert.equal(parseEpochInput('1 hour', now)?.epoch, 946688400);
  assert.equal(parseEpochInput('-1m', now)?.epoch, 946684740);
  assert.deepEqual(parseEpochInput('1', now), { epoch: 946684800, kind: 'duration', duration: 1 });
  assert.equal(parseEpochInput('2024-02-29', now)?.kind, 'date');
  assert.equal(parseEpochInput('2000-02-29', now)?.kind, 'date');
});

test('epoch rejects malformed, normalized calendar dates and excessive durations', () => {
  for (const input of ['', ' ', 'not a date', '2023-02-29', '1900-02-29', '2024-02-30', '2024-13-01', '2024-00-01', '2024-01-00', '2024-01-32', '2024-01-01T24:00:00Z', '2024-01-01T00:60:00Z', '2024-01-01T00:00:60Z', '2024-01-01T00:00:00+25:00', '1000000000000000000y', 'a'.repeat(101)]) {
    assert.equal(parseEpochInput(input, 0), undefined, input);
    assert.equal(epochDateReply(input, 0).flags, MessageFlags.Ephemeral, input);
  }
});

test('epoch returns copyable seconds and ISO output, including zero and negative epochs', () => {
  const dateReply = epochDateReply('1970-01-01T00:00:00Z', 0);
  assert.equal(dateReply.content, '0');
  assert.match(embedData(dateReply).description ?? '', /<t:0>/);
  assert.equal(dateReply.flags, undefined);
  assert.equal(epochIsoReply(0).content, '1970-01-01T00:00:00.000Z');
  assert.equal(epochIsoReply(-1).content, '1969-12-31T23:59:59.000Z');
  for (const epoch of [NaN, Infinity, 1.5, 8640000000001, -8640000000001, Number.MAX_SAFE_INTEGER]) {
    assert.equal(epochToIso(epoch), undefined);
    assert.equal(epochIsoReply(epoch).flags, MessageFlags.Ephemeral);
  }
});

test('prefix help is generated from migrated commands and supports details and custom prefixes', () => {
  assert.equal(createHelpCommand().name, 'help');
  const help = embedData(helpReply([]));
  assert.deepEqual(help.fields?.map(field => field.name), ['/ping', '/reverse', '/epoch', '!kifo help']);
  assert.match(help.description ?? '', /!kifo help <command>/);
  const detail = embedData(helpReply(['/EPOCH']));
  assert.equal(detail.title, '/epoch');
  assert.deepEqual(detail.fields?.map(field => field.name), ['date_to_epoch', 'epoch_to_date', 'help']);
  assert.match(embedData(helpReply(['removed-command'], '?')).description ?? '', /\?help/);
});
