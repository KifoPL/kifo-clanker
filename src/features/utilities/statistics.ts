import { BOT_COLOR, BOT_NAME } from '../../constants.js';
import { ChannelType, EmbedBuilder, PermissionFlagsBits, type Guild, type GuildBasedChannel, type GuildMember, type Role } from 'discord.js';
import type { CommandInvocation } from '../../contracts/invocation.js';
import { calculateHowgay, calculateIq, calculatePp } from '../entertainment/calculations.js';
import { assertCanRead, entityId, safeMentions, textFile } from './shared.js';

const stamp = (date: Date | null): string => date ? `<t:${Math.floor(date.getTime() / 1000)}:F> (<t:${Math.floor(date.getTime() / 1000)}:R>)` : 'Unknown';
const cell = (value: string): string => value.replace(/[\t\r\n]/gu, ' ');
const field = (name: string, value: string, inline = false) => ({ name, value: value.slice(0, 1024) || 'None', inline });

export function filterMembers(members: Iterable<GuildMember>, roleIds: readonly string[], channel?: GuildBasedChannel): GuildMember[] {
  return [...members].filter(member => roleIds.every(id => member.roles.cache.has(id)) && (!channel || channel.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel)));
}

export function memberTsv(members: readonly GuildMember[]): string {
  return 'User ID\tPosition\tUser name\tNickname\n' + members.map(member => `${member.id}\t${member.roles.highest.rawPosition}\t${cell(member.user.username)}\t${cell(member.nickname ?? '')}`).join('\n');
}

export function userStats(member: GuildMember): EmbedBuilder {
  const user = member.user;
  const roles = member.roles.cache.filter(role => role.id !== member.guild.id);
  const iq = calculateIq(user.id, member.guild.id);
  const pp = calculatePp(user.id, member.guild.id);
  const gay = calculateHowgay(user.id, member.guild.id);
  const joined = member.joinedTimestamp;
  const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(`${member.displayName} stats:`.slice(0, 256))
    .setDescription(`${user.bot ? '**BOT** ' : ''}<@${user.id}> · ${user.tag}\nNickname: ${member.nickname ?? 'None'}\nID: ${user.id}`)
    .setImage(user.displayAvatarURL({ size: 512 }))
    .addFields(
      field('Account created', stamp(user.createdAt)),
      field('Joined server', stamp(member.joinedAt)),
      field('Time before joining', joined ? `${Math.max(0, Math.floor((joined - user.createdTimestamp) / 1000))} seconds after account creation; ${Math.floor((joined - member.guild.createdTimestamp) / 1000)} seconds after server creation.${!user.bot && joined - user.createdTimestamp < 3_600_000 ? '\nAccount joined within an hour of creation; this can happen with alternate accounts.' : ''}` : 'Unknown'),
      field('Boost status', member.premiumSince ? `Boosting since ${stamp(member.premiumSince)}` : 'Not boosting'),
      field('Roles', `${roles.size} roles. Highest: ${member.roles.highest.name} (${member.guild.roles.highest.position - member.roles.highest.position + 1} of ${member.guild.roles.cache.size}).\nHoisted as: ${member.roles.hoist?.name ?? 'Not hoisted'}`),
      field('Status', member.presence?.status ?? 'Presence unavailable'),
      field(`IQ level: ${iq.name}`, iq.value, true),
      field(`PP: ${pp.name}`, pp.value, true),
      field(`Gayness level: ${gay.name}`, gay.value),
    ).setFooter({ text: 'Presence requires the privileged Presence Intent; unavailable presence does not imply offline.' });
  return embed;
}

async function serverStats(guild: Guild, members: readonly GuildMember[]): Promise<EmbedBuilder> {
  const owner = await guild.fetchOwner();
  const bots = members.filter(member => member.user.bot).length;
  const online = members.filter(member => !member.user.bot && member.presence && member.presence.status !== 'offline').length;
  const channels = [...guild.channels.cache.values()];
  const count = (type: ChannelType): number => channels.filter(channel => channel.type === type).length;
  const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(`${guild.name} stats:`.slice(0, 256))
    .setDescription(guild.description ?? 'No server description set.')
    .addFields(
      field('Members', `Humans: ${members.length - bots}, bots: ${bots}, fetched: ${members.length}, total: ${guild.memberCount}.\nVisible online humans: ${online} (presence data may be unavailable).`),
      field('Boosts', `Tier ${guild.premiumTier}, ${guild.premiumSubscriptionCount ?? 0} boosts; ${members.filter(member => member.premiumSince).length} current boosters.`),
      field('Locale / voice region', `${guild.preferredLocale}; voice regions are configured per voice channel.`, true),
      field('Roles', `${guild.roles.cache.size}`, true),
      field('Owner', `${owner.displayName} (${owner.user.tag}) · ${owner.id}`),
      field('Channels', `${count(ChannelType.GuildVoice)} voice, ${count(ChannelType.GuildStageVoice)} stage, ${count(ChannelType.GuildText)} text, ${count(ChannelType.GuildCategory)} categories, ${count(ChannelType.GuildAnnouncement)} announcement, ${count(ChannelType.GuildForum)} forum; ${channels.length} total.`),
      field('Created', stamp(guild.createdAt)),
    ).setFooter({ text: `${BOT_NAME} · helping ${guild.client.guilds.cache.size} servers. Stats reflect fetched members and channels visible to the bot.` });
  const icon = guild.iconURL({ size: 128 });
  const banner = guild.bannerURL({ size: 512 });
  if (icon) embed.setThumbnail(icon);
  if (banner) embed.setImage(banner);
  return embed;
}

async function roleStats(role: Role, count: number): Promise<EmbedBuilder> {
  let colorName = '';
  if (role.color !== 0) {
    try {
      const response = await fetch(`https://www.thecolorapi.com/id?hex=${role.hexColor.slice(1)}`, { signal: AbortSignal.timeout(3000) });
      const data: unknown = await response.json();
      if (response.ok && typeof data === 'object' && data !== null && 'name' in data && typeof data.name === 'object' && data.name !== null && 'value' in data.name && typeof data.name.value === 'string') colorName = ` (${data.name.value})`;
    } catch { /* The optional color name must not block role statistics. */ }
  }
  return new EmbedBuilder().setColor(BOT_COLOR).setTitle(`${role.name} stats:`.slice(0, 256)).setDescription(`<@&${role.id}> · ID ${role.id}`)
    .addFields(
      field('Color', `${role.hexColor}${colorName}`, true),
      field('Position', `${role.guild.roles.highest.position - role.position + 1} of ${role.guild.roles.cache.size}`, true),
      field('Members with this role', `${count}`, true),
      field('Managed by external service', `${role.managed}`, true),
      field('Hoisted', `${role.hoist}`, true),
      field('Mentionable', `${role.mentionable}`, true),
      field('Permissions', role.permissions.toArray().join('\n')),
      field('Created', `${stamp(role.createdAt)}\n${Math.floor((role.createdTimestamp - role.guild.createdTimestamp) / 1000)} seconds after server creation.`),
    );
}

export type ListTarget = { kind: 'server' } | { kind: 'user'; id: string } | { kind: 'roles'; ids: string[]; channelId?: string } | { kind: 'unsupported' };

export function parseListTarget(args: readonly string[], authorId: string, currentChannelId: string, roleIds: ReadonlySet<string>, channelIds: ReadonlySet<string>): ListTarget {
  if (!args.length) return { kind: 'server' };
  const first = args[0]!;
  if (args.length === 1 && first.toLowerCase() === 'me') return { kind: 'user', id: authorId };
  const id = entityId(first);
  const channelId = first.toLowerCase() === 'here' ? currentChannelId : id && channelIds.has(id) ? id : undefined;
  if (channelId) {
    if (args.length === 1) return { kind: 'unsupported' };
    return { kind: 'roles', channelId, ids: args.slice(1).map(value => {
      const roleId = entityId(value);
      if (!roleId || !roleIds.has(roleId)) throw new Error(`${value} is not a valid role.`);
      return roleId;
    }) };
  }
  if (args.length > 1 || (id && roleIds.has(id))) return { kind: 'roles', ids: args.map(value => {
    const roleId = entityId(value);
    if (!roleId || !roleIds.has(roleId)) throw new Error(`${value} is not a valid role.`);
    return roleId;
  }) };
  if (id) return { kind: 'user', id };
  throw new Error('Unknown target. Use a member mention/ID, role mention/ID, me, or channel + roles.');
}

export async function runStatistics(invocation: CommandInvocation, args: readonly string[], isList: boolean): Promise<void> {
  const guild = invocation.guild;
  if (!guild || !invocation.member) throw new Error('This command is only available in a server.');
  if (!isList && args.length > 1) throw new Error('Choose either a member or a role for /stats.');
  await guild.roles.fetch();
  const target = parseListTarget(args, invocation.author.id, invocation.channelId, new Set(guild.roles.cache.keys()), new Set(guild.channels.cache.keys()));
  if (target.kind === 'unsupported') throw new Error('Channel and message statistics were not implemented in the original bot. Use stats with a member, role, or no target.');
  if (isList && !invocation.channel.isDMBased() && !invocation.channel.permissionsFor(guild.members.me ?? await guild.members.fetchMe())?.has(PermissionFlagsBits.AttachFiles)) throw new Error('The bot needs Attach Files in this channel.');
  let embed: EmbedBuilder;
  let content = '';
  if (target.kind === 'user') {
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) throw new Error('Unknown member. Message statistics were not implemented in the original bot.');
    embed = userStats(member);
    content = 'Role ID\tPosition\tRole name\n' + [...member.roles.cache.values()].map(role => `${role.id}\t${role.rawPosition}\t${cell(role.name)}`).join('\n');
  } else {
    // Fetch rather than silently presenting an incomplete cache as a full roster.
    const collection = await guild.members.fetch({ time: 60_000 });
    let members = [...collection.values()];
    if (target.kind === 'roles') {
      const channel = target.channelId ? guild.channels.cache.get(target.channelId) : undefined;
      if (target.channelId && (!channel || !channel.permissionsFor(invocation.member)?.has(PermissionFlagsBits.ViewChannel) || !channel.permissionsFor(guild.members.me ?? await guild.members.fetchMe())?.has(PermissionFlagsBits.ViewChannel))) throw new Error('Both you and the bot must be able to view the selected channel.');
      if (channel?.isTextBased()) await assertCanRead(channel, invocation.author.id);
      members = filterMembers(members, target.ids, channel);
      if (target.ids.length === 1 && !channel) embed = await roleStats(guild.roles.cache.get(target.ids[0]!)!, members.length);
      else embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(`Multiple roles${channel ? ` in ${channel.name}` : ''} list:`.slice(0, 256))
        .setDescription('The attachment lists members with every specified role.').addFields(
          field('Role filter', target.ids.map(id => `<@&${id}>`).join('\n')),
          field('Channel filter', channel ? `<#${channel.id}>` : 'Entire server'),
          field('Result', `${members.length} members`),
        );
    } else embed = await serverStats(guild, members);
    const largePermission = target.kind === 'roles' && target.ids.length === 1 && !target.channelId ? PermissionFlagsBits.ManageRoles : PermissionFlagsBits.ManageGuild;
    if (isList && members.length > 1000 && !invocation.member.permissions.has(largePermission)) throw new Error(`Listing more than 1000 members requires ${largePermission === PermissionFlagsBits.ManageRoles ? 'Manage Roles' : 'Manage Server'}.`);
    content = memberTsv(members);
  }
  await invocation.reply({ embeds: [embed], ...(isList ? { files: [textFile(content)] } : {}), allowedMentions: safeMentions });
}
