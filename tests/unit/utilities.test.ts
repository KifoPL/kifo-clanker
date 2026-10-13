import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplicationCommandOptionType, ChannelType, MessageFlags, type ChatInputCommandInteraction, Collection, PermissionsBitField, PermissionFlagsBits, type Client, type GuildMember, type Message, type TextBasedChannel, type User } from 'discord.js';
import type { CommandInvocation } from '../../src/contracts/invocation.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { utilitiesFeature } from '../../src/features/utilities/index.js';
import { detectLanguage, languageName, readDetections } from '../../src/features/utilities/lang.js';
import { assertCanRead, canDeleteUtilityDm, fetchVisibleMessage, parseMessageReference, saveBookmark } from '../../src/features/utilities/shared.js';
import { filterMembers, memberTsv, parseListTarget, userStats } from '../../src/features/utilities/statistics.js';
import { createTop, parseTopArgs, scanPages, selectWinners } from '../../src/features/utilities/top.js';

const userId = '123456789012345678';
const guildId = '223456789012345678';
const channelId = '323456789012345678';
const messageId = '423456789012345678';
const roleId = '523456789012345678';
const role2 = '623456789012345678';
const read = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];

function readableChannel(userPermissions = read, botPermissions = read): TextBasedChannel {
  return {
    id: channelId, type: ChannelType.GuildText, isTextBased: () => true, isDMBased: () => false, isThread: () => false,
    guild: { members: { me: { id: 'bot' }, fetch: async () => ({ id: userId }) } },
    permissionsFor: (member: { id: string }) => new PermissionsBitField(member.id === 'bot' ? botPermissions : userPermissions),
  } as unknown as TextBasedChannel;
}
function rosterMember(id: string, roles: readonly string[], visible = true): GuildMember {
  return { id, user: { username: 'Żółć\nadmin\tname' }, nickname: 'line\nline', roles: { highest: { rawPosition: 2 }, cache: new Collection(roles.map(role => [role, {}])) }, visible } as unknown as GuildMember;
}

test('message references accept exact Discord links and reject hostile or ambiguous URLs', () => {
  assert.deepEqual(parseMessageReference(messageId), { messageId });
  assert.deepEqual(parseMessageReference(`https://discord.com/channels/${guildId}/${channelId}/${messageId}?foo=bar`), { guildId, channelId, messageId });
  assert.deepEqual(parseMessageReference(`https://canary.discordapp.com/channels/@me/${channelId}/${messageId}`), { guildId: '@me', channelId, messageId });
  for (const input of ['1', `https://discord.com.evil/channels/${guildId}/${channelId}/${messageId}`, `https://discord.com@evil/channels/${guildId}/${channelId}/${messageId}`, `http://discord.com/channels/${guildId}/${channelId}/${messageId}`, `${messageId}/extra`]) assert.throws(() => parseMessageReference(input));
});

test('list target modes retain self, role intersection, and channel filters', () => {
  const roles = new Set([roleId, role2]);
  const channels = new Set([channelId]);
  assert.deepEqual(parseListTarget([], userId, channelId, roles, channels), { kind: 'server' });
  assert.deepEqual(parseListTarget(['me'], userId, channelId, roles, channels), { kind: 'user', id: userId });
  assert.deepEqual(parseListTarget([`<@!${userId}>`], userId, channelId, roles, channels), { kind: 'user', id: userId });
  assert.deepEqual(parseListTarget([roleId, `<@&${role2}>`], userId, channelId, roles, channels), { kind: 'roles', ids: [roleId, role2] });
  assert.deepEqual(parseListTarget(['here', roleId], userId, channelId, roles, channels), { kind: 'roles', channelId, ids: [roleId] });
  assert.deepEqual(parseListTarget([`<#${channelId}>`, roleId, role2], userId, channelId, roles, channels), { kind: 'roles', channelId, ids: [roleId, role2] });
  assert.throws(() => parseListTarget([roleId, userId], userId, channelId, roles, channels), /not a valid role/);
});

test('roster filters use AND roles plus visibility and TSV rows cannot inject columns', () => {
  const members = [rosterMember('both', [roleId, role2]), rosterMember('one', [roleId]), rosterMember('hidden', [roleId, role2], false)];
  const channel = { permissionsFor: (member: GuildMember & { visible: boolean }) => new PermissionsBitField(member.visible ? [PermissionFlagsBits.ViewChannel] : []) } as unknown as Parameters<typeof filterMembers>[2];
  const filtered = filterMembers(members, [roleId, role2], channel);
  assert.deepEqual(filtered.map(member => member.id), ['both']);
  assert.equal(memberTsv(filtered), 'User ID\tPosition\tUser name\tNickname\nboth\t2\tŻółć admin name\tline line');
});

test('both requester and bot need target visibility and message history', async () => {
  await assertCanRead(readableChannel(), userId);
  await assert.rejects(assertCanRead(readableChannel([PermissionFlagsBits.ViewChannel]), userId), /Read Message History/);
  await assert.rejects(assertCanRead(readableChannel(read, []), userId), /Read Message History/);
  const privateThread = readableChannel();
  Object.assign(privateThread, { isThread: () => true, type: ChannelType.PrivateThread, members: { fetch: async () => { throw new Error('not a member'); } } });
  if (privateThread.isDMBased()) throw new Error('Expected guild channel.');
  Object.assign(privateThread.guild.members, { fetch: async () => ({ id: userId, permissions: new PermissionsBitField() }) });
  await assert.rejects(assertCanRead(privateThread, userId), /private thread/);
});

test('message fetch checks authorization before reading and checks linked guild identity', async () => {
  let reads = 0;
  const channel = readableChannel([], read);
  Object.assign(channel, { isTextBased: () => true, guildId, messages: { fetch: async () => { reads++; return {}; } } });
  const client = { channels: { fetch: async () => channel } } as unknown as Client;
  await assert.rejects(fetchVisibleMessage(client, userId, channel, messageId), /Read Message History/);
  assert.equal(reads, 0);
  await assert.rejects(fetchVisibleMessage(client, userId, channel, `https://discord.com/channels/${roleId}/${channelId}/${messageId}`), /Invalid message link/);
  assert.equal(reads, 0);
});

function batch(start: number, time: number) { return Array.from({ length: 100 }, (_, index) => ({ id: String(start - index), createdTimestamp: time - index })); }

test('history scan advances cursors, respects dates, and reports bounded truncation', async () => {
  const before: Array<string | undefined> = [];
  const pages = [batch(1000, 1000), batch(900, 900)];
  const result = await scanPages(async cursor => { before.push(cursor); return pages.shift() ?? []; }, 850, new AbortController().signal);
  assert.deepEqual(before, [undefined, '901']);
  assert.equal(result.messages.length, 151);
  assert.equal(result.truncated, false);
  let calls = 0;
  const limited = await scanPages(async () => batch(1000 - calls++ * 100, 1000), 0, new AbortController().signal, 2);
  assert.equal(calls, 2);
  assert.equal(limited.truncated, true);
});

test('history scan stops on failed, repeated, or cancelled pagination', async () => {
  let calls = 0;
  await assert.rejects(scanPages(async () => { calls++; throw new Error('Discord offline'); }, 0, new AbortController().signal), /Discord offline/);
  assert.equal(calls, 1);
  await assert.rejects(scanPages(async () => batch(1000, 1000), 0, new AbortController().signal), /did not advance/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(scanPages(async () => { throw new Error('should not fetch'); }, 0, controller.signal), { name: 'AbortError' });
});

test('cancellation releases the scan even while a Discord page request remains pending', async () => {
  const controller = new AbortController();
  let finishPage: ((value: readonly { id: string; createdTimestamp: number }[]) => void) | undefined;
  const scan = scanPages(() => new Promise<readonly { id: string; createdTimestamp: number }[]>(resolve => { finishPage = resolve; }), 0, controller.signal);
  controller.abort();
  await assert.rejects(scan, { name: 'AbortError' });
  finishPage?.([]);
});

test('top validates windows and ranks unique authors, retaining ties at the cutoff', () => {
  assert.deepEqual(parseTopArgs(['2', '1d', `<#${channelId}>`, `<:party:${roleId}>`]), { count: 2, duration: 86400000, channelId, emojiKey: roleId });
  assert.equal(parseTopArgs(['1', '10s', channelId, '👍']).emojiKey, '👍');
  assert.equal(parseTopArgs(['1', '10s', channelId, roleId]).emojiKey, roleId);
  for (const args of [['0', '1d', channelId, '👍'], ['11', '1d', channelId, '👍'], ['1', '9s', channelId, '👍'], ['1', '15d', channelId, '👍'], ['1', '1d', channelId, 'hello'], ['1', '1d', channelId, '👍not-an-emoji']]) assert.throws(() => parseTopArgs(args));
  const winners = selectWinners([{ authorId: 'a', score: 20 }, { authorId: 'a', score: 19 }, { authorId: 'b', score: 10 }, { authorId: 'c', score: 10 }, { authorId: 'd', score: 9 }, { authorId: 'e', score: 0 }], 2);
  assert.deepEqual(winners.map(winner => [winner.authorId, winner.rank]), [['a', 1], ['b', 2], ['c', 2]]);
});

test('language detection validates provider payload and supplies native language names', async () => {
  assert.match(languageName('pl'), /Polish.*polski/);
  const body = { data: { detections: [{ language: 'pl', confidence: 98, isReliable: true }] } };
  assert.deepEqual(readDetections(body), body.data.detections);
  for (const malformed of [{}, { data: { detections: [] } }, { data: { detections: [{ language: 'pl', confidence: '90', isReliable: true }] } }]) {
    if ('data' in malformed && malformed.data.detections.length === 0) assert.deepEqual(readDetections(malformed), []);
    else assert.throws(() => readDetections(malformed));
  }
  await assert.rejects(detectLanguage('text', undefined), /LANGUAGE_DETECT_KEY/);
  await assert.rejects(detectLanguage('   ', 'test-key'), /no text/);
});

test('language API uses authenticated native fetch and converts provider failure into an error', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, 'https://ws.detectlanguage.com/0.2/detect');
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-key');
      assert.equal(init?.body, JSON.stringify({ q: 'Cześć' }));
      return new Response(JSON.stringify({ data: { detections: [{ language: 'pl', confidence: 92, isReliable: false }] } }), { status: 200 });
    };
    const embed = await detectLanguage('Cześć', 'test-key');
    assert.match(embed.toJSON().fields?.[0]?.value ?? '', /92.*\n❌/);
    globalThis.fetch = async () => new Response('', { status: 401 });
    await assert.rejects(detectLanguage('hello', 'test-key'), /401/);
  } finally { globalThis.fetch = originalFetch; }
});

test('utility DM deletion is limited to our bot, the recipient, and recognized notes', () => {
  const message = { channel: { type: ChannelType.DM, recipientId: userId }, author: { id: 'bot' }, client: { user: { id: 'bot' } }, embeds: [{ title: 'BOOKMARK - general, guild' }] } as unknown as Message;
  assert.equal(canDeleteUtilityDm(message, userId), true);
  assert.equal(canDeleteUtilityDm(message, roleId), false);
  Object.assign(message, { author: { id: 'another-bot' } });
  assert.equal(canDeleteUtilityDm(message, userId), false);
  Object.assign(message, { author: { id: 'bot' }, embeds: [{ title: 'Unrelated bot DM' }] });
  assert.equal(canDeleteUtilityDm(message, userId), false);
  Object.assign(message, { embeds: [{ author: { name: 'TODO' } }] });
  assert.equal(canDeleteUtilityDm(message, userId), true);
});

test('bookmark copies attachment bytes in memory and names role mentions safely', async () => {
  const originalFetch = globalThis.fetch;
  const sends: unknown[] = [];
  try {
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
    const message = { channel: readableChannel(), content: `Hello <@&${roleId}>`, guild: { name: 'Guild', roles: { cache: new Collection([[roleId, { name: 'Members' }]]) } }, author: { tag: 'name', id: userId, displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' }, url: `https://discord.com/channels/${guildId}/${channelId}/${messageId}`, attachments: new Collection([['a', { size: 3, name: 'file.txt', url: 'https://cdn.discordapp.com/attachments/file.txt' }]]), embeds: [] } as unknown as Message;
    const user = { id: userId, send: async (payload: unknown) => { sends.push(payload); return { react: async () => {}, pin: async () => {} }; } } as unknown as User;
    await saveBookmark(user, message);
    const payload = sends[0] as { files: Array<{ attachment: Buffer }>; embeds: Array<{ toJSON(): { description?: string } }> };
    assert.deepEqual(payload.files[0]?.attachment, Buffer.from([1, 2, 3]));
    assert.equal(payload.embeds[0]?.toJSON().description, 'Hello @Members');
  } finally { globalThis.fetch = originalFetch; }
});

test('user stats handle unknown join/presence and preserve bot identity, roles, and fun stats', () => {
  const member = { id: userId, displayName: 'Bot Name', nickname: null, premiumSince: null, joinedAt: null, joinedTimestamp: null, user: { id: userId, bot: true, tag: 'bot', createdAt: new Date(0), createdTimestamp: 0, displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' }, guild: { id: guildId, roles: { highest: { position: 10 }, cache: new Collection([[guildId, {}]]) } }, roles: { cache: new Collection([[guildId, { id: guildId }]]), highest: { name: '@everyone', position: 0 } } } as unknown as GuildMember;
  const embed = userStats(member).toJSON();
  assert.match(embed.description ?? '', /BOT/);
  assert.equal(embed.fields?.find(field => field.name === 'Joined server')?.value, 'Unknown');
  assert.equal(embed.fields?.find(field => field.name === 'Status')?.value, 'Presence unavailable');
  assert.ok(embed.fields?.some(field => field.name.startsWith('IQ level:')));
});

test('utilities metadata imports and feature creation make no database or Discord calls', () => {
  const services = new Proxy({} as RuntimeServices, { get() { throw new Error('Services were accessed during construction.'); } });
  const runtime = utilitiesFeature.create(services);
  assert.equal(Object.isFrozen(utilitiesFeature), true);
  assert.equal('prefixCommands' in runtime, false);
  assert.deepEqual(runtime.slashCommands?.map(command => command.data.name), ['list', 'stats', 'top', 'lang', 'prefix', 'todo']);
  assert.deepEqual(utilitiesFeature.commandData.map(command => command.name), ['list', 'stats', 'top', 'lang', 'prefix', 'todo', 'detect language', 'save', 'user stats']);
});


test('top sends private cross-channel contents and image URLs only to requester DMs', async () => {
  const publicReplies: unknown[] = [];
  const publicSends: unknown[] = [];
  const directSends: unknown[] = [];
  const source = readableChannel();
  const secret = {
    id: messageId, createdTimestamp: Date.now(), content: 'Private source contents',
    author: { id: userId, username: 'PrivateAuthor', displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' },
    url: `https://discord.com/channels/${guildId}/${channelId}/${messageId}`,
    attachments: new Collection([['image', { contentType: 'image/png', url: 'https://cdn.discordapp.com/private.png' }]]),
    reactions: { cache: new Collection([['thumb', { emoji: { name: '👍', id: null }, count: 3 }]]) },
  };
  Object.assign(source, { isTextBased: () => true, messages: { fetch: async () => new Collection([[messageId, secret]]) } });
  const invokingChannelId = '723456789012345678';
  const message = {
    id: '823456789012345678', channelId: invokingChannelId,
    author: { id: userId, send: async (payload: unknown) => { directSends.push(payload); } },
    channel: { id: invokingChannelId, isDMBased: () => false, isSendable: () => true, send: async (payload: unknown) => { publicSends.push(payload); } },
    member: { permissionsIn: () => new PermissionsBitField([PermissionFlagsBits.ManageChannels]) },
    guild: { channels: { fetch: async () => source } },
    reply: async (payload: unknown) => { publicReplies.push(payload); return { id: messageId, edit: async (edit: unknown) => { publicReplies.push(edit); } }; },
    editReply: async (_id: string, payload: unknown) => { publicReplies.push(payload); return { id: messageId }; },
  } as unknown as CommandInvocation;
  await createTop().command.execute(message, ['1', '1d', channelId, '👍']);
  assert.equal(publicSends.length, 0);
  assert.equal(directSends.length, 2);
  const direct = directSends[1] as { embeds: Array<{ toJSON(): { description?: string; image?: { url: string } } }> };
  assert.equal(direct.embeds[0]?.toJSON().description, 'Private source contents');
  assert.equal(direct.embeds[0]?.toJSON().image?.url, 'https://cdn.discordapp.com/private.png');
  assert.doesNotMatch(JSON.stringify(publicReplies), /Private source contents|PrivateAuthor|private\.png/);
  directSends.length = 0;
  Object.assign(message.author, { send: async () => { throw new Error('DMs disabled'); } });
  await createTop().command.execute(message, ['1', '1d', channelId, '👍']);
  assert.equal(publicSends.length, 0);
  assert.match(JSON.stringify(publicReplies.at(-1)), /Enable DMs/);
  assert.doesNotMatch(JSON.stringify(publicReplies), /Private source contents|PrivateAuthor|private\.png/);
  Object.assign(message, { channelId });
  await createTop().command.execute(message, ['1', '1d', channelId, '👍']);
  assert.equal(publicSends.length, 1);
});


test('top shutdown prevents an in-flight channel lookup from registering a new scan', async () => {
  const top = createTop();
  let resolveChannel: ((channel: TextBasedChannel) => void) | undefined;
  let channelFetches = 0;
  let historyFetches = 0;
  let resultSends = 0;
  const replies: unknown[] = [];
  const source = readableChannel();
  Object.assign(source, { isTextBased: () => true, messages: { fetch: async () => { historyFetches++; return new Collection(); } } });
  const message = {
    id: messageId, channelId, author: { id: userId, send: async () => { resultSends++; } },
    channel: { isDMBased: () => false },
    member: { permissionsIn: () => new PermissionsBitField([PermissionFlagsBits.ManageChannels]) },
    guild: { channels: { fetch: () => { channelFetches++; return new Promise<TextBasedChannel>(resolve => { resolveChannel = resolve; }); } } },
    reply: async (payload: unknown) => { replies.push(payload); return {}; },
    editReply: async (_id: string, payload: unknown) => { replies.push(payload); return { id: messageId }; },
  } as unknown as CommandInvocation;
  const command = top.command.execute(message, ['1', '1d', channelId, '👍']);
  assert.ok(resolveChannel);
  await top.close();
  resolveChannel(source);
  await command;
  assert.equal(historyFetches, 0);
  assert.equal(resultSends, 0);
  assert.match(JSON.stringify(replies), /shutting down/);
  await top.command.execute(message, ['1', '1d', channelId, '👍']);
  assert.equal(channelFetches, 1);
});


test('native utilities expose typed targets and bounded ranking options', () => {
  const runtime = utilitiesFeature.create({} as RuntimeServices);
  const commands = runtime.slashCommands!;
  const list = commands.find(command => command.data.name === 'list')!.data;
  assert.deepEqual(list.options?.map(option => [option.name, option.type]), [['server', ApplicationCommandOptionType.Subcommand], ['user', ApplicationCommandOptionType.Subcommand], ['roles', ApplicationCommandOptionType.Subcommand]]);
  const roleList = list.options?.find(option => option.name === 'roles');
  assert.ok(roleList?.type === ApplicationCommandOptionType.Subcommand);
  assert.equal(roleList.options?.find(option => option.name === 'role')?.type, ApplicationCommandOptionType.Role);
  assert.equal(roleList.options?.find(option => option.name === 'role')?.required, true);
  assert.equal(roleList.options?.find(option => option.name === 'channel')?.type, ApplicationCommandOptionType.Channel);
  const stats = commands.find(command => command.data.name === 'stats')!.data;
  assert.deepEqual(stats.options?.map(option => [option.name, option.type]), [['member', ApplicationCommandOptionType.User], ['role', ApplicationCommandOptionType.Role]]);
  const top = commands.find(command => command.data.name === 'top')!.data;
  const winners = top.options?.find(option => option.name === 'winners');
  assert.ok(winners?.type === ApplicationCommandOptionType.Integer);
  assert.equal(winners.min_value, 1);
  assert.equal(winners.max_value, 10);
  assert.equal(top.options?.find(option => option.name === 'channel')?.type, ApplicationCommandOptionType.Channel);
  assert.equal(commands.find(command => command.data.name === 'lang')!.data.options?.[0]?.required, true);
});

test('native /prefix acknowledges privately and explains slash commands without promising paid prefixes', async () => {
  const events: string[] = [];
  const replies: unknown[] = [];
  const interaction = {
    id: messageId, channelId, guildId, guild: { members: { fetch: async () => ({ id: userId }) } },
    channel: readableChannel(), user: { id: userId }, client: {},
    deferReply: async (options: { flags: number }) => { assert.equal(options.flags, MessageFlags.Ephemeral); events.push('defer'); },
    editReply: async (payload: unknown) => { events.push('reply'); replies.push(payload); return {}; },
  } as unknown as ChatInputCommandInteraction;
  const command = utilitiesFeature.create({} as RuntimeServices).slashCommands!.find(value => value.data.name === 'prefix')!;
  await command.execute(interaction);
  assert.deepEqual(events, ['defer', 'reply']);
  const payload = replies[0] as { embeds: Array<{ toJSON(): { description?: string } }> };
  assert.match(payload.embeds[0]?.toJSON().description ?? '', /Text prefixes are disabled.*\/help/);
  assert.doesNotMatch(payload.embeds[0]?.toJSON().description ?? '', /premium|beer|buy|custom prefix/i);
});

test('native /list user resolves the selected member and returns roles as an interaction attachment', async () => {
  const roles = new Collection([[guildId, { id: guildId, name: '@everyone', rawPosition: 0, position: 0 }], [roleId, { id: roleId, name: 'Selected role', rawPosition: 2, position: 2 }]]);
  const target = { id: role2, displayName: 'Selected member', nickname: null, premiumSince: null, joinedAt: null, joinedTimestamp: null, user: { id: role2, bot: false, tag: 'selected', createdAt: new Date(0), createdTimestamp: 0, displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' }, roles: { cache: roles, highest: roles.get(roleId) } };
  const guild = { id: guildId, roles: { cache: roles, highest: roles.get(roleId), fetch: async () => roles }, channels: { cache: new Collection([[channelId, {}]]) }, members: { me: { id: 'bot' }, fetch: async (argument: string | { user: string }) => { if (typeof argument === 'string') { assert.equal(argument, role2); return target; } assert.equal(argument.user, userId); return { id: userId }; } } };
  Object.assign(target, { guild });
  const channel = readableChannel(read, [...read, PermissionFlagsBits.AttachFiles]);
  const replies: unknown[] = [];
  const interaction = {
    id: messageId, channelId, guildId, guild, channel, user: { id: userId }, client: {},
    options: { getSubcommand: () => 'user', getUser: (name: string) => { assert.equal(name, 'member'); return { id: role2 }; } },
    deferReply: async (options: { flags: number }) => { assert.equal(options.flags, MessageFlags.Ephemeral); },
    editReply: async (payload: unknown) => { replies.push(payload); return {}; },
  } as unknown as ChatInputCommandInteraction;
  const command = utilitiesFeature.create({} as RuntimeServices).slashCommands!.find(value => value.data.name === 'list')!;
  await command.execute(interaction);
  const payload = replies[0] as { files: Array<{ attachment: Buffer }>; embeds: Array<{ toJSON(): { title?: string } }> };
  assert.equal(payload.embeds[0]?.toJSON().title, 'Selected member stats:');
  assert.match(payload.files[0]?.attachment.toString() ?? '', /Selected role/);
});

test('native /todo preserves literal URL text and fetches only the explicit link option', async () => {
  const reference = `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
  let linked = false;
  let sourceReads = 0;
  const sends: unknown[] = [];
  const source = readableChannel();
  Object.assign(source, { guildId, messages: { fetch: async () => { sourceReads++; return { content: 'Referenced message', url: reference }; } } });
  const services = { client: { channels: { fetch: async () => source } }, logger: { error: () => {} } } as unknown as RuntimeServices;
  const interaction = {
    id: messageId, channelId, guildId, guild: { members: { fetch: async () => ({ id: userId }) } },
    channel: readableChannel(), client: {},
    user: { id: userId, send: async (payload: unknown) => { sends.push(payload); return { react: async () => {}, pin: async () => {} }; } },
    options: { getString: (name: string) => name === 'link' ? linked ? reference : null : linked ? 'Additional note' : reference },
    deferReply: async () => {}, editReply: async () => ({}),
  } as unknown as ChatInputCommandInteraction;
  const command = utilitiesFeature.create(services).slashCommands!.find(value => value.data.name === 'todo')!;
  await command.execute(interaction);
  const literal = sends[0] as { embeds: Array<{ toJSON(): { description?: string } }> };
  assert.equal(literal.embeds[0]?.toJSON().description, reference);
  assert.equal(sourceReads, 0);
  linked = true;
  await command.execute(interaction);
  const copied = sends[1] as { embeds: Array<{ toJSON(): { description?: string } }> };
  assert.equal(copied.embeds[0]?.toJSON().description, 'Referenced message\n==========\nAdditional note');
  assert.equal(sourceReads, 1);
});
