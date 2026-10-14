import assert from 'node:assert/strict';
import test from 'node:test';
import { canConfirmCountdown } from '../../src/features/scheduled/countdown.js';
import { chooseWinners, collectParticipants, giveawayReaction, jobRecordId, parseDuration } from '../../src/features/scheduled/shared.js';
import { scheduledFeature } from '../../src/features/scheduled/index.js';
import { giveawayData } from '../../src/features/scheduled/giveaway.js';
import { ApplicationCommandOptionType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
test('scheduled feature declares poll, countdown and giveaway with valid duration bounds', () => {
  assert.deepEqual(scheduledFeature.commandData.map(command => command.name), ['poll', 'countdown', 'giveaway']);
  assert.equal(parseDuration('1m'), 60000);
  assert.equal(parseDuration('1 year', 31557600000), 31557600000);
  for (const invalid of ['', '59s', '-1h', 'not a duration', '1e100y']) assert.equal(parseDuration(invalid), undefined);
  assert.equal(parseDuration('2y', 31557600000), undefined);
});
test('giveaway slash options expose typed input and preserve administrator permissions', () => {
  assert.deepEqual(giveawayData.options?.map(option => [option.name, option.type, option.required ?? false]), [
    ['winners', ApplicationCommandOptionType.Integer, true], ['duration', ApplicationCommandOptionType.String, true], ['emoji', ApplicationCommandOptionType.String, false],
  ]);
  assert.deepEqual(giveawayData.contexts, [InteractionContextType.Guild]);
  assert.equal(giveawayData.default_member_permissions, String(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.AddReactions));
});
test('giveaway drawing selects unique winners and handles too few entrants without dropping a winner', () => {
  assert.deepEqual(chooseWinners(['1', '2', '2', '3'], 2, () => 0), ['1', '2']);
  assert.deepEqual(chooseWinners(['1'], 10, () => 0), ['1']);
  assert.deepEqual(chooseWinners([], 1), []);
  assert.throws(() => chooseWinners(['1'], 1, () => 1), /random index/);
  assert.throws(() => chooseWinners(['1'], 0), /winner count/);
});
test('reaction pagination fetches all participants beyond the first 100 and excludes every bot', async () => {
  const cursors: (string | undefined)[] = [];
  const participants = await collectParticipants(async after => {
    cursors.push(after);
    if (!after) return Array.from({ length: 100 }, (_, index) => ({ id: String(index + 1), bot: index === 0 }));
    return [{ id: '101', bot: false }, { id: '102', bot: true }];
  });
  assert.deepEqual(cursors, [undefined, '100']);
  assert.equal(participants.length, 100);
  assert.ok(participants.includes('101'));
  assert.ok(!participants.includes('1'));
  assert.ok(!participants.includes('102'));
  await assert.rejects(collectParticipants(async () => Array.from({ length: 100 }, () => ({ id: '1', bot: false }))), /did not advance/);
});
test('countdown confirmation binds user, source message, unconsumed state and expiry', () => {
  const record = { user_id: '1', message_id: '2', status: 'pending_confirmation', confirmation_expires_at: new Date(30000) };
  assert.equal(canConfirmCountdown(record, '1', '2', 29999), true);
  assert.equal(canConfirmCountdown(record, '3', '2', 29999), false);
  assert.equal(canConfirmCountdown(record, '1', '3', 29999), false);
  assert.equal(canConfirmCountdown(record, '1', '2', 30000), false);
  assert.equal(canConfirmCountdown({ ...record, status: 'scheduled' }, '1', '2', 29999), false);
});
test('scheduled record payload validation rejects malformed IDs permanently', () => {
  const id = '01234567-89ab-cdef-0123-456789abcdef';
  assert.equal(jobRecordId({ id }), id);
  for (const payload of [null, {}, { id: '-'.repeat(36) }, { id: 'secret' }]) assert.throws(() => jobRecordId(payload), /Invalid scheduled record/);
});
test('giveaway emoji accepts Unicode graphemes and custom IDs while rejecting prose and multiple emoji', () => {
  assert.equal(giveawayReaction('👩🏽‍💻'), '👩🏽‍💻');
  assert.equal(giveawayReaction('1️⃣'), '1️⃣');
  assert.equal(giveawayReaction('🇵🇱'), '🇵🇱');
  assert.equal(giveawayReaction('<a:done:828097348545544202>'), '828097348545544202');
  assert.equal(giveawayReaction('not an emoji'), undefined);
  assert.equal(giveawayReaction('✅❌'), undefined);
});
