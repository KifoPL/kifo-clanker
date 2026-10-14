import { AttachmentBuilder, ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, type GuildChannel, type NonThreadGuildBasedChannel } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import { authorizeChannel, authorizeTarget } from './authorization.js';
import { commandError, confirm, guildContext, guildMembers, overwriteChannelTypes, snowflake } from './common.js';
export const cleanData = new SlashCommandBuilder().setName('clean').setDescription('Delete empty permission overwrites in channels or categories.').setContexts(InteractionContextType.Guild)
  .addChannelOption(option => option.setName('channel').addChannelTypes(...overwriteChannelTypes).setDescription('Channel or category to clean; defaults to this channel.'))
  .addBooleanOption(option => option.setName('all').setDescription('Clean every channel in the server; requires Administrator.')).toJSON();

export function createCleanCommand(): InvocationCommand {
  return {name:'clean',category:'management',guildOnly:true,permissions:[PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles],usage:['/clean [channel] [all]'],description:'Delete empty permission overwrites in this channel, a channel/category, or all server channels.',
    async execute(invocation,args) {
      try {
        if (args.length > 1) throw new Error('Select either channel or all, then confirm the cleanup.');
        const {actor,bot} = await guildMembers(invocation);
        const guild = invocation.guild!;
        let channels: GuildChannel[];
        if (args[0]?.toLowerCase() === 'all') {
          if (!actor.permissions.has(PermissionFlagsBits.Administrator)) throw new Error('Cleaning all channels requires Administrator.');
          channels = [...(await guild.channels.fetch()).values()].filter((value): value is NonThreadGuildBasedChannel => value !== null && 'permissionOverwrites' in value);
        } else if (args[0]) {
          const target = await guild.channels.fetch(snowflake(args[0]),{force:true});
          if (!target || !('permissionOverwrites' in target)) throw new Error('Unknown or unsupported target channel.');
          channels = [target];
          if (target.type === ChannelType.GuildCategory) channels.push(...[...(await guild.channels.fetch()).values()].filter((value): value is NonThreadGuildBasedChannel => value !== null && 'permissionOverwrites' in value && value.parentId === target.id));
        } else channels = [(await guildContext(invocation)).channel];
        for (const target of channels) authorizeChannel(actor,bot,target);
        if (!await confirm(invocation,`clean empty permission overwrites in ${channels.length} channel(s)`)) return;
        const results: string[] = ['Channel ID\tName\tStatus\tDeleted\tError'];
        let cleaned = 0;
        let errors = 0;
        for (const target of channels) {
          let deleted = 0;
          try {
            const fresh = await target.fetch(true);
            await fresh.guild.roles.fetch();
            const [currentActor,currentBot] = await Promise.all([fresh.guild.members.fetch({user:actor.id,force:true}),fresh.guild.members.fetchMe({force:true})]);
            if (args[0]?.toLowerCase() === 'all' && !currentActor.permissions.has(PermissionFlagsBits.Administrator)) throw new Error('Cleaning all channels requires Administrator.');
            authorizeChannel(currentActor,currentBot,fresh);
            for (const overwrite of fresh.permissionOverwrites.cache.values()) {
              if (overwrite.allow.bitfield === 0n && overwrite.deny.bitfield === 0n) {
                const targetRole = await fresh.guild.roles.fetch(overwrite.id);
                const targetMember = targetRole ? null : await fresh.guild.members.fetch({user:overwrite.id,force:true}).catch(() => null);
                if (targetRole || targetMember) authorizeTarget(currentActor,currentBot,targetRole ?? targetMember!);
                await overwrite.delete(`clean by ${actor.id}`);
                deleted++;
              }
            }
            cleaned++;
            results.push(`${target.id}\t${target.name}\tSuccess\t${deleted}\t`);
          } catch (error) {
            errors++;
            results.push(`${target.id}\t${target.name}\tError\t${deleted}\t${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        await invocation.reply({content:`Channels found: ${channels.length}; cleaned: ${cleaned}; errors: ${errors}.`,files:[new AttachmentBuilder(Buffer.from(results.join('\n')),{name:`clean-${invocation.id}.txt`})]});
      } catch(error) { await commandError(invocation,error); }
    },
  };
}
