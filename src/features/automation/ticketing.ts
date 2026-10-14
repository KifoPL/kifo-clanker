import { BOT_URLS } from '../../constants.js';
import ms from 'ms';
import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { query } from '../../db/query.js';
import { archiveMinutes, archives, confirm, manage, recheckPermissions, requireChannel, slowmodes, threadBot, type AutomationState } from './shared.js';

export const ticketingData = new SlashCommandBuilder().setName('ticketing').setDescription('Set up ticketing in this channel.').setDMPermission(false)
  .addSubcommand(sub => sub.setName('on').setDescription('Enable tickets.')
    .addStringOption(o => o.setName('visibility').setDescription('Ticket visibility.').setRequired(true).addChoices({name:'Public',value:'public'},{name:'Private',value:'private'}))
    .addStringOption(o => o.setName('archiving').setDescription('Inactivity before archiving.').setRequired(true).addChoices(...archives))
    .addStringOption(o => o.setName('slowmode').setDescription('Ticket slowmode.').addChoices(...slowmodes)))
  .addSubcommand(sub => sub.setName('off').setDescription('Disable tickets.'))
  .addSubcommand(sub => sub.setName('list').setDescription('List configured channels.'))
  .addSubcommand(sub => sub.setName('help').setDescription('Read the ticketing guide.')).toJSON();
export function ticketingCommand(state: AutomationState): SlashCommand {
  return { data: ticketingData, async execute(interaction) {
    const action = interaction.options.getSubcommand();
    const channel = await requireChannel(interaction, action === 'help' || action === 'list' ? [] : manage,
      action === 'help' || action === 'list' ? [] : [...threadBot,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages]);
    if (!channel) return;
    if (action === 'help') { await interaction.reply({ content:BOT_URLS.guide('ticketing'),flags:MessageFlags.Ephemeral }); return; }
    if (action === 'list') { await interaction.reply({ content:[...state.tickets.values()].filter(row => row.guild_id === interaction.guildId).map(row => `<#${row.channel_id}>: ${row.are_public ? 'public':'private'}, archive ${row.archive_minutes} minutes, slowmode ${row.slowmode_seconds}s`).join('\n').slice(0,1900) || 'No ticketing channels enabled.',flags:MessageFlags.Ephemeral }); return; }
    if (action === 'off') {
      if (!state.tickets.has(channel.id)) { await interaction.reply({content:'Ticketing is already off.',flags:MessageFlags.Ephemeral}); return; }
      if (!await confirm(interaction,'Disable ticketing in this channel?','ticketing-off')) return;
      if (!await recheckPermissions(interaction,channel,manage,[...threadBot,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages])) return;
      await query(state.services.pool,'DELETE FROM ticket_settings WHERE channel_id=$1 AND guild_id=$2',[channel.id,interaction.guildId]); state.tickets.delete(channel.id);
      await interaction.editReply('Ticketing disabled.'); return;
    }
    if (state.tickets.has(channel.id)) { await interaction.reply({content:'Ticketing is already enabled. Disable it first to change settings.',flags:MessageFlags.Ephemeral}); return; }
    const arePublic = interaction.options.getString('visibility',true) === 'public';
    const minutes = archiveMinutes(interaction.options.getString('archiving',true));
    const seconds = ms((interaction.options.getString('slowmode') ?? '0s') as ms.StringValue) / 1000;
    const bot = await interaction.guild!.members.fetchMe();
    if (!arePublic && (channel.type === ChannelType.GuildAnnouncement || !bot.permissionsIn(channel).has(PermissionFlagsBits.CreatePrivateThreads))) { await interaction.reply({content:'Private tickets require a text channel and Create Private Threads permission for the bot.',flags:MessageFlags.Ephemeral}); return; }
    if (!await confirm(interaction,`Enable ${arePublic ? 'public':'private'} tickets, archiving after ${minutes} minutes, with ${seconds}s slowmode?`,'ticketing-on')) return;
    if (!await recheckPermissions(interaction,channel,manage,[...threadBot,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages,...(arePublic ? [] : [PermissionFlagsBits.CreatePrivateThreads])])) return;
    await query(state.services.pool,'INSERT INTO ticket_settings(channel_id,guild_id,are_public,slowmode_seconds,archive_minutes) VALUES($1,$2,$3,$4,$5)',[channel.id,interaction.guildId,arePublic,seconds,minutes]);
    state.tickets.set(channel.id,{channel_id:channel.id,guild_id:interaction.guildId!,are_public:arePublic,slowmode_seconds:seconds,archive_minutes:minutes});
    if (await confirm(interaction,'Ticketing enabled. Post a guide in this channel?','ticketing-guide')) await channel.send({content:`**Tickets are enabled here.** Use \`/ticket\` with a brief title and optional description to ask a question or report a problem. Please search existing answers first and thank anyone who helps. Guide: ${BOT_URLS.guide('ticket')}`,allowedMentions:{parse:[]}});
    await interaction.editReply({content:'Ticketing enabled. Grant members View Channel, Use Application Commands and Send Messages in Threads. Grant moderators and the bot Send Messages, Manage Messages and Manage Threads.',components:[]});
  } };
}
