import { ChannelType, Collection, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ThreadChannel } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { confirm, requireChannel } from './shared.js';

const counts = ['all','3','5','10','25'].map(value=>({name:value === 'all'?'All':value,value}));
export const threadsData = new SlashCommandBuilder().setName('threads').setDescription('Manage threads in this channel.').setDMPermission(false)
  .addSubcommand(sub => sub.setName('archive').setDescription('Archive oldest active threads.')
    .addStringOption(o=>o.setName('count').setDescription('Number of oldest threads.').setRequired(true).addChoices(...counts))
    .addBooleanOption(o=>o.setName('silent').setDescription('Only you see the result.')))
  .addSubcommand(sub => sub.setName('delete').setDescription('Delete oldest threads.')
    .addStringOption(o=>o.setName('count').setDescription('Number of oldest threads.').setRequired(true).addChoices(...counts))
    .addStringOption(o=>o.setName('which').setDescription('Which threads?').setRequired(true).addChoices({name:'Archived',value:'archived'},{name:'Active',value:'active'},{name:'Both',value:'both'}))
    .addBooleanOption(o=>o.setName('silent').setDescription('Only you see the result.'))).toJSON();
export function threadsCommand(): SlashCommand {
  return {data:threadsData,async execute(interaction) {
    const channel = await requireChannel(interaction,[PermissionFlagsBits.ManageThreads],[PermissionFlagsBits.ManageThreads,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ViewChannel]);
    if (!channel) return;
    const action = interaction.options.getSubcommand();
    const count = interaction.options.getString('count',true);
    const which = action === 'archive' ? 'active' : interaction.options.getString('which',true);
    await interaction.deferReply(interaction.options.getBoolean('silent') ? {flags:MessageFlags.Ephemeral} : {});
    const threads = new Collection<string,ThreadChannel>();
    if (which !== 'archived') { const active = await channel.threads.fetchActive(); for (const [id,thread] of active.threads) threads.set(id,thread); }
    if (which !== 'active') {
      for (const type of channel.type === ChannelType.GuildText ? ['public','private'] as const : ['public'] as const) {
        const archived = await channel.threads.fetchArchived({type,fetchAll:true});
        for (const [id,thread] of archived.threads) threads.set(id,thread);
      }
    }
    const selected = [...threads.values()].sort((a,b)=>(a.createdTimestamp ?? 0)-(b.createdTimestamp ?? 0)).slice(0,count === 'all' ? undefined : Number(count));
    if (!selected.length) { await interaction.editReply('No matching threads.'); return; }
    if (action === 'delete' && !await confirm(interaction,`Permanently delete ${selected.length} ${which} threads?`,'threads-delete')) return;
    // Permissions may have changed while the confirmation was open.
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const bot = await interaction.guild!.members.fetchMe();
    if (!member.permissionsIn(channel).has(PermissionFlagsBits.ManageThreads) || !bot.permissionsIn(channel).has(PermissionFlagsBits.ManageThreads)) { await interaction.editReply('Thread permissions changed; action canceled.'); return; }
    let succeeded = 0;
    let failed = 0;
    for (const thread of selected) {
      try { if (action === 'archive') await thread.setArchived(true,`Bulk archive by ${interaction.user.id}`); else await thread.delete(`Bulk delete by ${interaction.user.id}`); succeeded++; }
      catch { failed++; }
    }
    await interaction.editReply({content:`${action === 'archive' ? 'Archived':'Deleted'} ${succeeded} threads.${failed ? ` Failed: ${failed}.`:''}`,components:[]});
  }};
}
