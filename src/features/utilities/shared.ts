import { BOT_COLOR } from '../../constants.js';
import { AttachmentBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits, type Client, type Message, type TextBasedChannel, type User } from 'discord.js';

import type { CommandInvocation } from '../../contracts/invocation.js';

export const safeMentions = { parse: [] as const };
const snowflake = /^\d{16,22}$/u;

export function entityId(input: string): string | undefined {
  const match = /^(?:<@!?|<@&|<#)(\d{16,22})>$/u.exec(input);
  return match?.[1] ?? (snowflake.test(input) ? input : undefined);
}

export function parseMessageReference(input: string): { guildId?: string; channelId?: string; messageId: string } {
  if (snowflake.test(input)) return { messageId: input };
  const match = /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d{16,22}|@me)\/(\d{16,22})\/(\d{16,22})(?:\?[^\s]*)?$/u.exec(input);
  if (!match?.[1] || !match[2] || !match[3]) throw new Error('Specify a Discord message ID or message link.');
  return { guildId: match[1], channelId: match[2], messageId: match[3] };
}

export async function assertCanRead(channel: TextBasedChannel, userId: string): Promise<void> {
  if (channel.isDMBased()) {
    if (channel.type !== ChannelType.DM) throw new Error('You cannot read that direct message.');
    const dm = channel.partial ? await channel.client.channels.fetch(channel.id, { force: true }) : channel;
    if (dm?.type !== ChannelType.DM || dm.recipientId !== userId) throw new Error('You cannot read that direct message.');
    return;
  }
  const fresh = await channel.fetch(true);
  if (!fresh.isTextBased() || fresh.isDMBased()) throw new Error('The message channel is unavailable.');
  if (fresh.isThread()) {
    // Thread permissions inherit the parent's cached overwrites in discord.js.
    if (!fresh.parentId || !await fresh.guild.channels.fetch(fresh.parentId, { force: true })) throw new Error('The thread parent is unavailable.');
  }
  const [member, bot] = await Promise.all([
    fresh.guild.members.fetch({ user: userId, force: true }),
    fresh.guild.members.fetchMe({ force: true }),
    fresh.guild.roles.fetch(),
  ]);
  const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  if (!fresh.permissionsFor(member)?.has(required) || !fresh.permissionsFor(bot)?.has(required)) {
    throw new Error('Both you and the bot need View Channel and Read Message History in the target channel.');
  }
  if (fresh.isThread() && fresh.type === ChannelType.PrivateThread && !fresh.permissionsFor(member)?.has(PermissionFlagsBits.ManageThreads)) {
    if (!await fresh.members.fetch({ member: userId, force: true }).catch(() => null)) throw new Error('You are not a member of that private thread.');
  }
}

export async function fetchVisibleMessage(client: Client, userId: string, channel: TextBasedChannel, input: string): Promise<Message> {
  const ref = parseMessageReference(input);
  const target = ref.channelId ? await client.channels.fetch(ref.channelId) : channel;
  if (!target?.isTextBased()) throw new Error('The message channel is unavailable.');
  if (ref.guildId && ref.guildId !== '@me' && (!('guildId' in target) || target.guildId !== ref.guildId)) throw new Error('Invalid message link.');
  if (ref.guildId === '@me' && !target.isDMBased()) throw new Error('Invalid direct message link.');
  await assertCanRead(target, userId);
  const message = await target.messages.fetch(ref.messageId);
  await assertCanRead(target, userId);
  return message;
}

export function textFile(content: string, name = 'list.txt'): AttachmentBuilder {
  return new AttachmentBuilder(Buffer.from(content, 'utf8'), { name });
}

export async function attachmentBuffers(message: Message): Promise<AttachmentBuilder[]> {
  const files: AttachmentBuilder[] = [];
  let total = 0;
  // Discord's lowest default upload limit is 10 MiB; leave space for payload overhead.
  const limit = 9 * 1024 * 1024;
  for (const attachment of message.attachments.values()) {
    if (attachment.size + total > limit) throw new Error('Attachments exceed the 9 MiB copy limit. Save the originals from the message link.');
    const url = new URL(attachment.url);
    if (url.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) throw new Error('Unsupported attachment host.');
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error('Could not download an attachment. Please try again.');
    const parts: Uint8Array[] = [];
    for await (const part of response.body) {
      total += part.byteLength;
      if (total > limit) { await response.body.cancel().catch(() => {}); throw new Error('Attachments exceed the 9 MiB copy limit.'); }
      parts.push(part);
    }
    files.push(new AttachmentBuilder(Buffer.concat(parts), { name: attachment.name }));
  }
  return files;
}

export async function saveBookmark(user: User, message: Message, pin = false): Promise<Message> {
  await assertCanRead(message.channel, user.id);
  const files = await attachmentBuffers(message);
  await assertCanRead(message.channel, user.id);
  const content = message.content.replace(/<@&(\d{16,22})>/gu, (match, id: string) => message.guild?.roles.cache.get(id)?.name ? `@${message.guild.roles.cache.get(id)!.name}` : match);
  const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(`BOOKMARK - ${'name' in message.channel ? message.channel.name : 'DM'}, ${message.guild?.name ?? 'Direct message'}`.slice(0, 256))
    .setAuthor({ name: `${message.author.tag}, ID: ${message.author.id}`, iconURL: message.author.displayAvatarURL() })
    .setURL(message.url).setDescription(content.slice(0, 4096) || '*No content.*')
    .addFields({ name: "Don't need this anymore?", value: 'React with ❌ to delete this bookmark.' });
  if (content.length > 4096 || message.embeds.length) files.push(textFile(`${content}\n\n${message.embeds.map(item => JSON.stringify(item.toJSON(), null, 2)).join('\n\n')}`, 'message.txt'));
  let firstCopy: Message | undefined;
  for (let offset = 0; offset < Math.max(1, files.length); offset += 10) {
    const copy = await user.send({ embeds: [embed], files: files.slice(offset, offset + 10), allowedMentions: safeMentions });
    firstCopy ??= copy;
    await copy.react('❌').catch(() => {});
    if (pin) await copy.pin().catch(() => { throw new Error('The bookmark was saved in DM, but could not be pinned.'); });
  }
  return firstCopy!;
}

export function canDeleteUtilityDm(message: Message, userId: string): boolean {
  if (message.channel.type !== ChannelType.DM || message.channel.partial || message.channel.recipientId !== userId || message.author.id !== message.client.user?.id) return false;
  const embed = message.embeds[0];
  return embed?.author?.name === 'TODO' || embed?.title?.startsWith('BOOKMARK - ') === true;
}

export async function utilityError(invocation: CommandInvocation, error: unknown): Promise<void> {
  await invocation.reply({ content: error instanceof Error ? error.message : 'The command failed. Please try again.', allowedMentions: safeMentions });
}
