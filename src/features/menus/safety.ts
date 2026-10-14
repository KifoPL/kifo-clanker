import { PermissionFlagsBits, type GuildChannel, type GuildMember, type Role } from 'discord.js';
import { authorizeRole } from '../moderation/authorization.js';
import type { PermissionName } from '../moderation/permissions.js';

const elevated = Object.entries(PermissionFlagsBits).filter(([name]) => name.startsWith('Manage')
  || ['Administrator', 'KickMembers', 'BanMembers', 'ModerateMembers', 'MentionEveryone',
    'MuteMembers', 'DeafenMembers', 'MoveMembers', 'ViewAuditLog', 'ViewGuildInsights'].includes(name)).map(([, bit]) => bit);

export function safeMenuRole(actor: GuildMember, bot: GuildMember, role: Role): void {
  authorizeRole(actor, bot, role);
  if (!actor.permissions.has(role.permissions) || !bot.permissions.has(role.permissions)) {
    throw new Error('The creator and bot must hold every permission granted by the role.');
  }
}

export function elevatedMenuRole(role: Role): boolean { return role.permissions.any(elevated); }
export function elevatedMenuPermission(permission: PermissionName): boolean { return elevated.includes(PermissionFlagsBits[permission]); }

export function safeMenuPermission(actor: GuildMember, bot: GuildMember, channel: GuildChannel, permission: PermissionName): void {
  const bit = PermissionFlagsBits[permission];
  for (const member of [actor, bot]) {
    if (!channel.permissionsFor(member)?.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, bit])) {
      throw new Error('You and the bot need Manage Channels, Manage Roles, and the granted permission in the destination channel.');
    }
  }
}

export function explicitlyDenied(channel: GuildChannel, member: GuildMember, permission: PermissionName): boolean {
  const bit = PermissionFlagsBits[permission];
  const personal = channel.permissionOverwrites.cache.get(member.id);
  if (personal?.deny.has(bit)) return true;
  if (personal?.allow.has(bit)) return false;
  return member.roles.cache.some(role => channel.permissionOverwrites.cache.get(role.id)?.deny.has(bit) === true);
}

export function messageIdFromReference(value: string): string | undefined {
  if (/^\d{17,20}$/u.test(value)) return value;
  return /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/\d{17,20}\/\d{17,20}\/(\d{17,20})\/?$/u.exec(value)?.[1];
}
