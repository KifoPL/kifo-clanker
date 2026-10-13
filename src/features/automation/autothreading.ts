import ms from 'ms';
import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Message } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { query } from '../../db/query.js';
import { archiveMinutes, archives, confirm, manage, recheckPermissions, requireChannel, slowmodes, threadBot, type AutomationState } from './shared.js';

export const autothreadingData = new SlashCommandBuilder().setName('autothreading').setDescription('Set up automatic threads.').setDMPermission(false)
  .addSubcommand(sub => sub.setName('on').setDescription('Enable automatic threads.')
    .addStringOption(o => o.setName('title').setDescription('Title template; see help for placeholders.').setRequired(true).setMinLength(1).setMaxLength(100))
    .addStringOption(o => o.setName('archiving').setDescription('Inactivity before archiving.').setRequired(true).addChoices(...archives))
    .addBooleanOption(o => o.setName('bots').setDescription('Create threads for bot messages.').setRequired(true))
    .addStringOption(o => o.setName('slowmode').setDescription('Thread slowmode.').addChoices(...slowmodes)))
  .addSubcommand(sub => sub.setName('off').setDescription('Disable automatic threads.'))
  .addSubcommand(sub => sub.setName('list').setDescription('List configured channels.'))
  .addSubcommand(sub => sub.setName('help').setDescription('Read the title template guide.')).toJSON();
export function threadTitle(template: string, message: Message): string {
  const shorten = (text: string | null | undefined) => (text ?? 'n/a').slice(0,50);
  const values: Record<string,string> = {member:message.member?.displayName ?? message.author.username,channel:'name' in message.channel ? (message.channel.name ?? 'channel').replaceAll('-',' ') : 'channel',server:message.guild?.name ?? 'server',embed_t:shorten(message.embeds[0]?.title),embed_d:shorten(message.embeds[0]?.description)};
  return template.replace(/\[(member|channel|server|embed_t|embed_d)\]/g,(_, key: string) => values[key] ?? 'n/a').trim().slice(0,100) || 'Discussion';
}
export function autothreadingCommand(state: AutomationState): SlashCommand {
  return {data:autothreadingData,async execute(interaction) {
    const action = interaction.options.getSubcommand();
    const channel = await requireChannel(interaction, action === 'help' || action === 'list' ? [] : manage,action === 'help' || action === 'list' ? [] : [...threadBot,PermissionFlagsBits.ManageChannels]);
    if (!channel) return;
    if (action === 'help') { await interaction.reply({content:'Title placeholders: `[member]`, `[channel]`, `[server]`, `[embed_t]`, `[embed_d]`. All occurrences are replaced; Discord thread names are limited to 100 characters. https://kifopl.github.io/kifo-clanker/docs/guides/autothreading',flags:MessageFlags.Ephemeral}); return; }
    if (action === 'list') { await interaction.reply({content:[...state.auto.values()].filter(row => row.guild_id === interaction.guildId).map(row => `<#${row.channel_id}>: ${row.title}, archive ${row.archive_minutes}m, slowmode ${row.slowmode_seconds}s, bots ${row.bot_auto}`).join('\n').slice(0,1900) || 'No automatic threads configured.',flags:MessageFlags.Ephemeral}); return; }
    if (action === 'off') {
      if (!state.auto.has(channel.id)) { await interaction.reply({content:'Automatic threads are already off.',flags:MessageFlags.Ephemeral}); return; }
      if (!await confirm(interaction,'Disable automatic threads in this channel?','autothreading-off')) return;
      if (!await recheckPermissions(interaction,channel,manage,[...threadBot,PermissionFlagsBits.ManageChannels])) return;
      await query(state.services.pool,'DELETE FROM autothreading_settings WHERE channel_id=$1 AND guild_id=$2',[channel.id,interaction.guildId]); state.auto.delete(channel.id); await interaction.editReply('Automatic threads disabled.'); return;
    }
    if (state.auto.has(channel.id)) { await interaction.reply({content:'Automatic threads are already enabled. Disable them first to change settings.',flags:MessageFlags.Ephemeral}); return; }
    const title = interaction.options.getString('title',true).trim();
    const minutes = archiveMinutes(interaction.options.getString('archiving',true));
    const seconds = ms((interaction.options.getString('slowmode') ?? '0s') as ms.StringValue) / 1000;
    const bots = interaction.options.getBoolean('bots',true);
    if (!title) { await interaction.reply({content:'Title cannot be blank.',flags:MessageFlags.Ephemeral}); return; }
    if (!await confirm(interaction,`Create automatic threads titled ${title}, archiving after ${minutes}m, slowmode ${seconds}s, including bots: ${bots}?`,'autothreading-on')) return;
    if (!await recheckPermissions(interaction,channel,manage,[...threadBot,PermissionFlagsBits.ManageChannels])) return;
    await query(state.services.pool,'INSERT INTO autothreading_settings(channel_id,guild_id,title,bot_auto,slowmode_seconds,archive_minutes) VALUES($1,$2,$3,$4,$5,$6)',[channel.id,interaction.guildId,title,bots,seconds,minutes]);
    state.auto.set(channel.id,{channel_id:channel.id,guild_id:interaction.guildId!,title,bot_auto:bots,slowmode_seconds:seconds,archive_minutes:minutes}); await interaction.editReply('Automatic threads enabled.');
  }};
}
