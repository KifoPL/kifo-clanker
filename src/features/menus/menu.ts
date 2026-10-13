import { EmbedBuilder, PermissionFlagsBits, type Message } from 'discord.js';
import ms from 'ms';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { query } from '../../db/index.js';
import { permissionAliases, resolvePermission } from '../moderation/permissions.js';
import { confirm } from '../moderation/common.js';
import { elevatedMenuPermission, elevatedMenuRole, messageIdFromReference, safeMenuPermission, safeMenuRole } from './safety.js';
import { MenuService, menuEmoji, type Menu } from './service.js';

export function menuDuration(value: string | undefined, now = Date.now()): Date | null {
  if (value === undefined) return null;
  const duration = value.length <= 100 ? ms(value as ms.StringValue) : undefined;
  if (typeof duration !== 'number' || duration < 60_000 || duration > 365.25 * 86_400_000) {
    throw new Error('Set the time period between one minute and one year.');
  }
  return new Date(now + duration);
}

const snowflake = (value: string | undefined): string | undefined => value?.match(/^(?:<[@#]&?)?(\d{17,20})>?$/u)?.[1];

export function menuCommand(services: RuntimeServices, menus: MenuService): PrefixCommand {
  return {
    name: 'menu', description: 'Create, list, or revert reaction role and permission menus.',
    usage: ['menu', 'menu list', 'menu role <role> [duration]', 'menu perm <permission> <channel> [duration]', 'menu revert <message ID or URL>'],
    category: 'Management', guildOnly: true,
    async execute(message, args) {
      if (!message.inGuild()) { await message.reply('Menus are only available in servers.'); return; }
      let actor = await message.guild.members.fetch({ user: message.author.id, force: true });
      let bot = await message.guild.members.fetchMe({ force: true });
      const prefix = services.prefixes.get(message.guildId) ?? '!kifo ';
      const usage = `${prefix}menu role <role> [duration]\n${prefix}menu perm <permission> <channel> [duration]\n${prefix}menu list\n${prefix}menu revert <message ID or URL>`;
      const options = args.at(-1)?.toLowerCase() === 'confirm' ? args.slice(0, -1) : args;
      try {
        if (!args.length) {
          await message.author.send({ embeds: [new EmbedBuilder().setColor(0xa039a0)
            .setTitle('Reaction menus').setDescription(`${usage}\n\nPermission aliases:\n${permissionAliases()}`)] });
          await message.reply('Check your DMs.');
          return;
        }
        const action = args[0]!.toLowerCase();
        if (action === 'list') {
          const wholeGuild = actor.permissions.has(PermissionFlagsBits.ManageGuild);
          if (!wholeGuild && !message.channel.permissionsFor(actor)?.has(PermissionFlagsBits.ManageChannels)) {
            throw new Error('You need Manage Channels here, or Manage Server to list all server menus.');
          }
          const result = await query<Menu>(services.pool,
            `SELECT * FROM menus WHERE guild_id=$1 ${wholeGuild ? '' : 'AND channel_id=$2'} ORDER BY created_at DESC LIMIT 10`,
            wholeGuild ? [message.guildId] : [message.guildId, message.channelId]);
          const lines = result.rows.map(menu => `[${menu.kind === 'role' ? `<@&${menu.target_id}>` : menu.permission} menu](https://discord.com/channels/${menu.guild_id}/${menu.channel_id}/${menu.message_id})`
            + `${menu.expires_at ? ` — reverts <t:${Math.floor(menu.expires_at.getTime() / 1000)}:R>` : ' — permanent'}`);
          await message.reply({ embeds: [new EmbedBuilder().setColor(0xa039a0).setTitle('Active menus (newest 10)')
            .setDescription(lines.join('\n') || 'No menus set.')] });
          return;
        }
        if (!message.channel.permissionsFor(actor)?.has(PermissionFlagsBits.ManageChannels)) throw new Error('You need Manage Channels here.');
        if (action === 'revert') {
          const id = messageIdFromReference(args[1] ?? '');
          const menu = id ? menus.menus.get(id) : undefined;
          if (!menu || menu.guild_id !== message.guildId) throw new Error('Menu not found in this server.');
          const source = await message.guild.channels.fetch(menu.channel_id);
          if (!source || source.isThread() || !source.permissionsFor(actor)?.has(PermissionFlagsBits.ManageChannels)) throw new Error('You need Manage Channels in the menu channel.');
          if (menu.kind === 'role') {
            const role = await message.guild.roles.fetch(menu.target_id);
            if (role) safeMenuRole(actor, bot, role);
          } else {
            const channel = await message.guild.channels.fetch(menu.target_id);
            const permission = resolvePermission(menu.permission ?? '');
            if (channel && !channel.isThread() && permission) safeMenuPermission(actor, bot, channel, permission);
          }
          await menus.expire(menu.message_id);
          await message.reply('Menu reverted.');
          return;
        }
        if (!message.channel.permissionsFor(bot)?.has([PermissionFlagsBits.AddReactions, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])) {
          throw new Error('The bot needs View Channel, Send Messages, and Add Reactions here.');
        }
        let kind: Menu['kind'];
        let targetId: string;
        let permission: string | null = null;
        let expiresAt: Date | null;
        let needsConfirmation = false;
        let rolePermissions: bigint | undefined;
        let rolePermissionNames = '';
        if (action === 'role' && options.length >= 2 && options.length <= 3) {
          kind = 'role';
          const id = snowflake(args[1]);
          const role = id ? await message.guild.roles.fetch(id, { force: true }) : null;
          if (!role) throw new Error('Provide a valid role mention or ID.');
          safeMenuRole(actor, bot, role);
          needsConfirmation = elevatedMenuRole(role);
          rolePermissions = role.permissions.bitfield;
          rolePermissionNames = role.permissions.toArray().join(', ');
          targetId = role.id;
          expiresAt = menuDuration(options[2]);
        } else if (action === 'perm' && options.length >= 3 && options.length <= 4) {
          kind = 'permission';
          const id = snowflake(args[2]);
          const channel = id ? await message.guild.channels.fetch(id, { force: true }) : null;
          const name = resolvePermission(args[1]!);
          if (!channel || channel.isThread() || !name) throw new Error('Provide a valid permission alias and channel mention or ID.');
          safeMenuPermission(actor, bot, channel, name);
          needsConfirmation = elevatedMenuPermission(name);
          targetId = channel.id;
          permission = name;
          expiresAt = menuDuration(options[3]);
        } else throw new Error(`Usage:\n${usage}`);
        if (needsConfirmation) {
          const action = `Create a menu in <#${message.channelId}> granting ${kind === 'role' ? `<@&${targetId}> (${rolePermissionNames})` : `\`${permission}\` in <#${targetId}>`} to every eligible reactor, ${expiresAt ? `reverting at ${expiresAt.toISOString()}` : 'permanently'}. This grants management or moderation privileges.`;
          if (!await confirm(message, action)) return;
          const [freshActor, freshBot, source] = await Promise.all([
            message.guild.members.fetch({ user: message.author.id, force: true }), message.guild.members.fetchMe({ force: true }),
            message.guild.channels.fetch(message.channelId, { force: true }),
          ]);
          actor = freshActor;
          bot = freshBot;
          if (!source || source.isThread() || !source.permissionsFor(actor)?.has(PermissionFlagsBits.ManageChannels)
            || !source.permissionsFor(bot)?.has([PermissionFlagsBits.AddReactions, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])) {
            throw new Error('Menu channel permissions changed while awaiting confirmation.');
          }
          if (kind === 'role') {
            const role = await message.guild.roles.fetch(targetId, { force: true });
            if (!role || role.permissions.bitfield !== rolePermissions) throw new Error('The role or its permissions changed. Run the command again.');
            safeMenuRole(actor, bot, role);
          } else {
            const channel = await message.guild.channels.fetch(targetId, { force: true });
            const name = resolvePermission(permission ?? '');
            if (!channel || channel.isThread() || !name) throw new Error('The destination channel is unavailable.');
            safeMenuPermission(actor, bot, channel, name);
          }
          if (expiresAt && expiresAt.getTime() <= Date.now()) throw new Error('Menu expiry passed while awaiting confirmation.');
        }
        const emoji = menuEmoji(kind);
        const sent = await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xa039a0)
          .setTitle(kind === 'role' ? 'Role menu' : 'Permission menu')
          .setDescription(`React with ${emoji} to receive ${kind === 'role' ? `<@&${targetId}>` : `\`${permission}\` in <#${targetId}>`}. Remove your reaction to restore your previous state.`
            + (expiresAt ? `\nReverts <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.` : ''))] });
        try {
          await menus.persist({ message_id: sent.id, guild_id: message.guildId, channel_id: message.channelId,
            created_by: actor.id, kind, target_id: targetId, permission, expires_at: expiresAt, closing: false }, message as Message);
          await sent.react(emoji);
        } catch (error) {
          await menus.expire(sent.id).catch(cleanup => services.logger.error('Menu creation cleanup failed', cleanup));
          await sent.delete().catch(() => {});
          throw error;
        }
        await message.delete().catch(() => {});
      } catch (error) {
        await message.reply(error instanceof Error ? error.message : 'Menu command failed.');
      }
    },
  };
}
