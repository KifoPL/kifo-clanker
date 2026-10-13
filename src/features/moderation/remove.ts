import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { authorizeRole, authorizeTarget } from './authorization.js';
import { commandError, confirm, guildContext, restorationDate, snowflake } from './common.js';
import { removeRole } from './operations.js';
export const removeData = new SlashCommandBuilder().setName('remove').setDescription('Remove a member role permanently or for a chosen duration.').setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption(option => option.setName('member').setDescription('Member whose role should be removed.').setRequired(true))
  .addRoleOption(option => option.setName('role').setDescription('Role to remove.').setRequired(true))
  .addStringOption(option => option.setName('duration').setDescription('Restore after this duration, for example 10m or 2d.').setMaxLength(100)).toJSON();

export function createRemoveCommand(services: RuntimeServices): InvocationCommand {
  return {name:'remove',category:'management',guildOnly:true,permissions:[PermissionFlagsBits.ManageRoles],usage:['/remove member:<member> role:<role> [duration]'],description:'Remove a member role permanently or temporarily after confirmation.',
    async execute(invocation,args) {
      try {
        if (args.length < 2 || args.length > 3) throw new Error('Choose a member and role, with optional duration such as 10m.');
        const {actor,bot,channel} = await guildContext(invocation);
        const memberId = snowflake(args[0]!);
        const roleId = snowflake(args[1]!);
        const [member,role] = await Promise.all([channel.guild.members.fetch({user:memberId,force:true}),channel.guild.roles.fetch(roleId)]);
        if (!role) throw new Error('Unknown role.');
        authorizeRole(actor,bot,role);
        authorizeTarget(actor,bot,member);
        if (!member.roles.cache.has(role.id)) throw new Error('The member does not have this role.');
        // Validate before prompting; start duration only after confirmation.
        restorationDate(args[2]);
        if (!await confirm(invocation,`remove <@&${role.id}> from <@${member.id}>${args[2] ? ` for ${args[2]}` : ' permanently'}`)) return;
        const fresh = await guildContext(invocation);
        const currentMember = await channel.guild.members.fetch({user:memberId,force:true});
        const currentRole = await channel.guild.roles.fetch(roleId);
        if (!currentRole) throw new Error('The role was deleted.');
        authorizeRole(fresh.actor,fresh.bot,currentRole);
        authorizeTarget(fresh.actor,fresh.bot,currentMember);
        const restoreAt = restorationDate(args[2]);
        await removeRole(services,{guild:channel.guild,channel,targetId:member.id,roleId:role.id,actorId:actor.id,messageId:invocation.id,...(restoreAt ? {restoreAt} : {})});
        await invocation.reply({content:`Removed <@&${role.id}> from <@${member.id}>.${restoreAt ? ` Restore at <t:${Math.floor(restoreAt.getTime()/1000)}> (<t:${Math.floor(restoreAt.getTime()/1000)}:R>).` : ''}`,allowedMentions:{parse:[]}});
      } catch (error) { await commandError(invocation,error); }
    },
  };
}
