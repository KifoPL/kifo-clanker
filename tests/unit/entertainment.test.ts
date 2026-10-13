import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHowgay, calculateIq, calculatePp, idRemainder } from '../../src/features/entertainment/calculations.js';
import { entertainmentFeature } from '../../src/features/entertainment/index.js';
import { createIssue } from '../../src/features/entertainment/error.js';
import { fetchJoke } from '../../src/features/entertainment/urmum.js';
import { testCommand, testDescription, testReply } from '../../src/features/entertainment/test.js';
import { ApplicationCommandOptionType, AttachmentBuilder, EmbedBuilder } from 'discord.js';
test('entertainment registry preserves ten distinct slash command names', () => {
  assert.deepEqual(entertainmentFeature.commandData.map(command => command.name).sort(), ['bookmark', 'cringe', 'error', 'guide', 'howgay', 'iq', 'pp', 'stfu', 'test', 'urmum']);
});
test('slash test merges argument parsing while retaining original input options and defaults', () => {
  assert.deepEqual(testCommand.data.options?.map(option => [option.name, option.type, option.required ?? false]), [
    ['input', ApplicationCommandOptionType.String, false], ['input2', ApplicationCommandOptionType.String, false], ['arguments', ApplicationCommandOptionType.String, false],
  ]);
  assert.equal(testDescription(null, null, null), '- input: `not passed`\n- input2: `not passed`');
  assert.equal(testDescription('hello', 'world', null), '- input: `hello`\n- input2: `world`');
  assert.equal(testDescription('unused', 'unused', ' one\t two\nthree '), '1. "one"\n2. "two"\n3. "three"');
  assert.equal(testDescription(null, null, '  '), 'No arguments.');
  const large = testReply(null, null, 'a '.repeat(900));
  const embed = large.embeds?.[0];
  assert.ok(embed instanceof EmbedBuilder);
  assert.ok((embed.toJSON().description?.length ?? 0) <= 4096);
  const file = large.files?.[0];
  assert.ok(file instanceof AttachmentBuilder);
  assert.equal(file.attachment.toString(), testDescription(null, null, 'a '.repeat(900)));
});
test('snowflake calculations retain decimal precision and intended concatenation', () => {
  assert.equal(idRemainder('123456789012345678', '987654321098765432', 101), 21);
  assert.equal(idRemainder('123456789012345679', '987654321098765432', 101), 20);
  assert.deepEqual(calculateIq('289119054130839552', '1'), { name: '420 IQ', value: 'Yeah, this is big brain time.' });
  assert.equal(calculatePp('795638549730295820', '1').value, '69 cm');
  assert.equal(calculateHowgay('289119054130839552', '1').name, '-1%');
  assert.throws(() => idRemainder('invalid', '123', 101), /Invalid Discord identifier/);
  assert.equal(calculatePp('123456789012345678', '987654321098765432').value, '6 cm');
});
test('joke provider validates status, body and HTTPS boundary', async () => {
  assert.equal(await fetchJoke('https://example.test/', async () => Response.json({ joke: 'A joke.' })), 'A joke.');
  await assert.rejects(fetchJoke('https://example.test/', async () => new Response('', { status: 503 })), /unavailable/);
  await assert.rejects(fetchJoke('https://example.test/', async () => Response.json({ joke: 42 })), /Invalid/);
  await assert.rejects(fetchJoke('http://example.test/'), /HTTPS/);
});
test('GitHub issue creation validates the returned issue URL and reports provider failure', async () => {
  const url = await createIssue('secret', 'KifoPL/kifo-clanker', 'Broken command', 'Discord context', async (_url, options) => {
    assert.equal(options?.method, 'POST');
    assert.equal(typeof options?.body, 'string');
    assert.match(String(options?.body), /Broken command/);
    return Response.json({ html_url: 'https://github.com/KifoPL/kifo-clanker/issues/1' }, { status: 201 });
  });
  assert.equal(url, 'https://github.com/KifoPL/kifo-clanker/issues/1');
  await assert.rejects(createIssue('secret', 'bad/repo/path', 'Description', ''), /repository/);
  await assert.rejects(createIssue('secret', 'KifoPL/kifo-clanker', 'Description', '', async () => new Response('', { status: 403 })), /failed/);
  await assert.rejects(createIssue('secret', 'KifoPL/kifo-clanker', 'Description', '', async () => Response.json({ html_url: 'https://untrusted.test/' }, { status: 201 })), /Invalid/);
});
