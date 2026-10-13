import { AttachmentBuilder, PermissionFlagsBits, type GuildChannel, type GuildMember, type Role } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { authorizeChannel, authorizePermissionGrant, authorizeTarget } from './authorization.js';
import { commandError, confirm, guildContext, restorationDate, snowflake } from './common.js';
import { setTemporaryPermission } from './operations.js';
import { permissionAliases, resolvePermission, type PermissionState } from './permissions.js';
export function permissionReport(channel: GuildChannel, targetId?: string): string {
  const lines = [`Permissions for #${channel.name} (${channel.id})${channel.permissionsLocked ? `; synchronized with category ${channel.parentId}` : ''}`, 'Type\tID\tAllowed\tDenied'];
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    if (!targetId || overwrite.id === targetId) lines.push(`${overwrite.type}\t${overwrite.id}\t${overwrite.allow.toArray().join(',')}\t${overwrite.deny.toArray().join(',')}`);
  }
  if (targetId && !channel.permissionOverwrites.cache.has(targetId)) lines.push(`No explicit overwrite for ${targetId}; permissions inherited.`);
  return lines.join('\n');
}
async function resolveTarget(channel: GuildChannel, input: string): Promise<GuildMember | Role> {
  const id = snowflake(input);
  const role = await channel.guild.roles.fetch(id);
  return role ?? channel.guild.members.fetch({user:id,force:true});
}
export function createPermsCommand(services: RuntimeServices): PrefixCommand {
  return {name:'perms',category:'management',guildOnly:true,usage:['perms [here|list|channel|member|role]', 'perms <add|rm|deny> <permission> <member/role>... [duration]'],description:'Inspect or change channel overwrites: perms [here|list|channel|member|role], perms <add|rm|deny> <permission> <member/role>... [duration].',
    async execute(message,args) {
      try {
        const {actor,bot,channel} = await guildContext(message);
        if (args.length === 0) {
          let check = 'You and the bot have the required channel permissions.';
          try { authorizeChannel(actor,bot,channel); } catch(error) { check = error instanceof Error ? error.message : 'Missing permissions.'; }
          await message.reply({content:`${check}\nUsage: perms [here|list|channel|member|role], or perms <add|rm|deny> <permission> <member/role>... [duration].\n${permissionAliases()}`});
          return;
        }
        if (args.length === 1) {
          const input = args[0]!;
          let targetChannel = channel;
          let targetId: string | undefined;
          if (!['here','list'].includes(input.toLowerCase())) {
            const id = snowflake(input);
            const resolved = (await channel.guild.channels.fetch()).get(id);
            if (resolved && 'permissionOverwrites' in resolved) targetChannel = resolved;
            else { const target = await resolveTarget(channel,input); targetId = target.id; }
          }
          authorizeChannel(actor,bot,targetChannel);
          await targetChannel.fetch(true);
          await message.reply({files:[new AttachmentBuilder(Buffer.from(permissionReport(targetChannel,targetId)),{name:`permissions-${targetChannel.id}.txt`})]});
          return;
        }
        const mode = args[0]!.toLowerCase();
        if (!['add','rm','deny'].includes(mode) || args.length < 3) throw new Error('Usage: perms <add|rm|deny> <permission> <member/role>... [duration]');
        const permission = resolvePermission(args[1]!);
        if (!permission) throw new Error('Unknown permission. Use perms to list aliases and IDs.');
        const inputs = [...args.slice(2)];
        let duration: string | undefined;
        const last = inputs.at(-1)!;
        if (!/^<?[@!&#]*\d{17,20}>?$/.test(last)) { duration = inputs.pop(); restorationDate(duration); }
        if (!inputs.length) throw new Error('Supply at least one member or role target.');
        const targets = new Map<string,GuildMember | Role>();
        authorizeChannel(actor,bot,channel);
        if (mode === 'add') authorizePermissionGrant(actor,bot,channel,PermissionFlagsBits[permission]);
        for (const input of inputs) {
          const target = await resolveTarget(channel,input);
          authorizeTarget(actor,bot,target);
          targets.set(target.id,target);
        }
        const state: PermissionState = mode === 'add' ? 'allow' : mode === 'deny' ? 'deny' : 'inherit';
        if (!await confirm(message,`${state} ${permission} for ${targets.size} target(s) in <#${channel.id}>${duration ? ` for ${duration}` : ''}`)) return;
        const fresh = await guildContext(message);
        authorizeChannel(fresh.actor,fresh.bot,fresh.channel);
        if (mode === 'add') authorizePermissionGrant(fresh.actor,fresh.bot,fresh.channel,PermissionFlagsBits[permission]);
        const restoreAt = restorationDate(duration);
        const report: string[] = [permissionReport(fresh.channel),'\nChanges\nTarget ID\tPermission\tState\tStatus'];
        let succeeded = 0;
        let failed = 0;
        for (const id of targets.keys()) {
          try {
            const target = await resolveTarget(fresh.channel,id);
            authorizeTarget(fresh.actor,fresh.bot,target);
            await setTemporaryPermission(services,{guild:channel.guild,channel:fresh.channel,targetId:id,permission,state,actorId:actor.id,messageId:message.id,...(restoreAt ? {restoreAt} : {})});
            succeeded++;
            report.push(`${id}\t${permission}\t${state}\tSuccess`);
          } catch(error) {
            failed++;
            report.push(`${id}\t${permission}\t${state}\t${error instanceof Error ? error.message : 'Failed'}`);
          }
        }
        await message.reply({content:`Permission changes: ${succeeded} succeeded, ${failed} failed.${restoreAt ? ` Restore at <t:${Math.floor(restoreAt.getTime()/1000)}>.` : ''}`,files:[new AttachmentBuilder(Buffer.from(report.join('\n')),{name:`permissions-${message.id}.txt`})]});
      } catch (error) { await commandError(message,error); }
    },
  };
}
