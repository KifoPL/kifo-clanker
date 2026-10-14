import { AttachmentBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type GuildChannel, type GuildMember, type Role } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { authorizeChannel, authorizePermissionGrant, authorizeTarget } from './authorization.js';
import { commandError, confirm, guildContext, overwriteChannelTypes, restorationDate, snowflake } from './common.js';
import { setTemporaryPermission } from './operations.js';
import { permissionAliases, resolvePermission } from './permissions.js';

export const permsData = new SlashCommandBuilder().setName('perms').setDescription('Inspect or change channel permission overwrites.').setContexts(InteractionContextType.Guild)
  .addSubcommand(sub => sub.setName('info').setDescription('Show permission aliases and check your management permissions.'))
  .addSubcommand(sub => sub.setName('report').setDescription('Export channel overwrites, optionally for a member or role.')
    .addChannelOption(option => option.setName('channel').addChannelTypes(...overwriteChannelTypes).setDescription('Channel or category; defaults to this channel.'))
    .addUserOption(option => option.setName('user').setDescription('Show this member’s overwrite.'))
    .addRoleOption(option => option.setName('role').setDescription('Show this role’s overwrite.')))
  .addSubcommand(sub => sub.setName('set').setDescription('Allow, deny, or inherit a permission for selected members or roles.')
    .addStringOption(option => option.setName('permission').setDescription('Permission name, legacy numeric ID, or alias.').setRequired(true).setMaxLength(100))
    .addStringOption(option => option.setName('state').setDescription('Permission overwrite state.').setRequired(true).addChoices({name:'Allow',value:'allow'},{name:'Deny',value:'deny'},{name:'Inherit',value:'inherit'}))
    .addUserOption(option => option.setName('user').setDescription('Member whose overwrite should change.'))
    .addRoleOption(option => option.setName('role').setDescription('Role whose overwrite should change.'))
    .addStringOption(option => option.setName('targets').setDescription('Additional member/role IDs or mentions, separated by spaces or commas.').setMaxLength(2000))
    .addStringOption(option => option.setName('duration').setDescription('Restore the previous state after this duration, for example 10m.').setMaxLength(100))
    .addChannelOption(option => option.setName('channel').addChannelTypes(...overwriteChannelTypes).setDescription('Channel or category; defaults to this channel.'))).toJSON();

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
export function createPermsCommand(services: RuntimeServices): InvocationCommand {
  return {name:'perms',category:'management',guildOnly:true,usage:['/perms info','/perms report [channel] [user] [role]','/perms set permission:<name or alias> state:<allow|deny|inherit> [user] [role] [targets] [duration] [channel]'],description:'Inspect channel overwrites or change selected members and roles, with optional restoration.',
    async execute(invocation,args) {
      try {
        const action = args[0] ?? 'info';
        const channelId = action === 'report' ? args[1] : action === 'set' ? args[3] : undefined;
        const {actor,bot,channel} = await guildContext(invocation,channelId || invocation.channelId);
        if (action === 'info') {
          let check = 'You and the bot have the required channel permissions.';
          try { authorizeChannel(actor,bot,channel); } catch(error) { check = error instanceof Error ? error.message : 'Missing permissions.'; }
          await invocation.reply({content:`${check}\nUse /perms report to inspect overwrites or /perms set to change them.\n${permissionAliases()}`});
          return;
        }
        if (action === 'report') {
          authorizeChannel(actor,bot,channel);
          const reports: string[] = [];
          for (const input of args.slice(2).filter(Boolean)) {
            const target = await resolveTarget(channel,input);
            reports.push(permissionReport(channel,target.id));
          }
          await invocation.reply({files:[new AttachmentBuilder(Buffer.from(reports.length ? reports.join('\n\n') : permissionReport(channel)),{name:`permissions-${channel.id}.txt`})]});
          return;
        }
        if (action !== 'set') throw new Error('Choose /perms info, /perms report, or /perms set.');
        const state = args[1];
        if (state !== 'allow' && state !== 'deny' && state !== 'inherit') throw new Error('Choose Allow, Deny, or Inherit.');
        const permission = resolvePermission(args[2] ?? '');
        if (!permission) throw new Error('Unknown permission. Use /perms info to list aliases and IDs.');
        const duration = args[4] || undefined;
        restorationDate(duration);
        const inputs = args.slice(5);
        if (!inputs.length) throw new Error('Choose at least one member or role, or supply target IDs.');
        const targets = new Map<string,GuildMember | Role>();
        authorizeChannel(actor,bot,channel);
        if (state === 'allow') authorizePermissionGrant(actor,bot,channel,PermissionFlagsBits[permission]);
        for (const input of inputs) {
          const target = await resolveTarget(channel,input);
          authorizeTarget(actor,bot,target);
          targets.set(target.id,target);
        }
        if (!await confirm(invocation,`${state} ${permission} for ${targets.size} target(s) in <#${channel.id}>${duration ? ` for ${duration}` : ''}`)) return;
        const fresh = await guildContext(invocation,channel.id);
        authorizeChannel(fresh.actor,fresh.bot,fresh.channel);
        if (state === 'allow') authorizePermissionGrant(fresh.actor,fresh.bot,fresh.channel,PermissionFlagsBits[permission]);
        const restoreAt = restorationDate(duration);
        const report: string[] = [permissionReport(fresh.channel),'\nChanges\nTarget ID\tPermission\tState\tStatus'];
        let succeeded = 0;
        let failed = 0;
        for (const id of targets.keys()) {
          try {
            const target = await resolveTarget(fresh.channel,id);
            authorizeTarget(fresh.actor,fresh.bot,target);
            await setTemporaryPermission(services,{guild:channel.guild,channel:fresh.channel,targetId:id,permission,state,actorId:actor.id,messageId:invocation.id,...(restoreAt ? {restoreAt} : {})});
            succeeded++;
            report.push(`${id}\t${permission}\t${state}\tSuccess`);
          } catch(error) {
            failed++;
            report.push(`${id}\t${permission}\t${state}\t${error instanceof Error ? error.message : 'Failed'}`);
          }
        }
        await invocation.reply({content:`Permission changes: ${succeeded} succeeded, ${failed} failed.${restoreAt ? ` Restore at <t:${Math.floor(restoreAt.getTime()/1000)}>.` : ''}`,files:[new AttachmentBuilder(Buffer.from(report.join('\n')),{name:`permissions-${invocation.id}.txt`})]});
      } catch (error) { await commandError(invocation,error); }
    },
  };
}
