import { PermissionFlagsBits } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { authorizeRole, authorizeTarget } from './authorization.js';
import { commandError, confirm, guildContext, restorationDate, snowflake } from './common.js';
import { removeRole } from './operations.js';
export function createRemoveCommand(services: RuntimeServices): PrefixCommand {
  return {name:'remove',category:'management',guildOnly:true,permissions:[PermissionFlagsBits.ManageRoles],usage:['remove <member> <role> [duration]'],description:'Remove a member role permanently or temporarily: remove <member> <role> [duration].',
    async execute(message,args) {
      try {
        if (args.length < 2 || args.length > 3) throw new Error('Usage: remove <member> <role> [duration, e.g. 10m]');
        const {actor,bot,channel} = await guildContext(message);
        const memberId = snowflake(args[0]!);
        const roleId = snowflake(args[1]!);
        const [member,role] = await Promise.all([channel.guild.members.fetch({user:memberId,force:true}),channel.guild.roles.fetch(roleId)]);
        if (!role) throw new Error('Unknown role.');
        authorizeRole(actor,bot,role);
        authorizeTarget(actor,bot,member);
        if (!member.roles.cache.has(role.id)) throw new Error('The member does not have this role.');
        // Validate before prompting; start duration only after confirmation.
        restorationDate(args[2]);
        if (!await confirm(message,`remove <@&${role.id}> from <@${member.id}>${args[2] ? ` for ${args[2]}` : ' permanently'}`)) return;
        const fresh = await guildContext(message);
        const currentMember = await channel.guild.members.fetch({user:memberId,force:true});
        const currentRole = await channel.guild.roles.fetch(roleId);
        if (!currentRole) throw new Error('The role was deleted.');
        authorizeRole(fresh.actor,fresh.bot,currentRole);
        authorizeTarget(fresh.actor,fresh.bot,currentMember);
        const restoreAt = restorationDate(args[2]);
        await removeRole(services,{guild:channel.guild,channel,targetId:member.id,roleId:role.id,actorId:actor.id,messageId:message.id,...(restoreAt ? {restoreAt} : {})});
        await message.reply({content:`Removed <@&${role.id}> from <@${member.id}>.${restoreAt ? ` Restore at <t:${Math.floor(restoreAt.getTime()/1000)}> (<t:${Math.floor(restoreAt.getTime()/1000)}:R>).` : ''}`,allowedMentions:{parse:[]}});
      } catch (error) { await commandError(message,error); }
    },
  };
}
