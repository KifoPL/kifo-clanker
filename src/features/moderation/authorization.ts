import { PermissionFlagsBits, type GuildChannel, type GuildMember, type Role } from 'discord.js';
export function authorizeChannel(actor: GuildMember, bot: GuildMember, channel: GuildChannel): void {
  for (const [member, label] of [[actor, 'You'], [bot, 'The bot']] as const) {
    if (!channel.permissionsFor(member)?.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      throw new Error(`${label} need Manage Channels and Manage Roles in #${channel.name}.`);
    }
  }
}
export function authorizePermissionGrant(actor: GuildMember, bot: GuildMember, channel: GuildChannel, permission: bigint): void {
  if (!channel.permissionsFor(actor)?.has(permission) || !channel.permissionsFor(bot)?.has(permission)) throw new Error('You and the bot must have the permission being granted in the target channel.');
}
export function authorizeRole(actor: GuildMember, bot: GuildMember, role: Role): void {
  if (role.managed || role.id === role.guild.id) throw new Error('Managed roles and @everyone cannot be assigned or removed.');
  if (!actor.permissions.has(PermissionFlagsBits.ManageRoles) || !bot.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('You and the bot need Manage Roles.');
  if (actor.id !== role.guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) throw new Error('The target role must be below your highest role.');
  if (bot.roles.highest.comparePositionTo(role) <= 0) throw new Error('The target role must be below the bot’s highest role.');
}
export function authorizeTarget(actor: GuildMember, bot: GuildMember, target: GuildMember | Role): void {
  const member = 'user' in target;
  if (target.id === target.guild.id) return; // @everyone channel overwrites are supported.
  const role = member ? target.roles.highest : target;
  if (member && target.id === target.guild.ownerId) throw new Error('The server owner cannot be targeted.');
  if (actor.id !== target.guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) throw new Error('The target must be below your highest role.');
  if (bot.roles.highest.comparePositionTo(role) <= 0) throw new Error('The target must be below the bot’s highest role.');
}
