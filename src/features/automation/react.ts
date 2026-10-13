import { PermissionFlagsBits, SlashCommandBuilder, parseEmoji } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import { query } from '../../db/query.js';
import { belongsToGuild, requireCommandPermissions, type AutomationState } from './shared.js';

export const reactData = new SlashCommandBuilder().setName('react').setDescription('Configure automatic reactions.').setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(sub => sub.setName('on').setDescription('Enable automatic reactions in this channel.')
    .addStringOption(option => option.setName('emojis').setDescription('1–20 emojis separated by spaces.').setRequired(true).setMinLength(1).setMaxLength(2000)))
  .addSubcommand(sub => sub.setName('off').setDescription('Disable automatic reactions.'))
  .addSubcommand(sub => sub.setName('status').setDescription('Show reactions configured in this channel.'))
  .addSubcommand(sub => sub.setName('list').setDescription('List automatic reactions in this server.')).toJSON();

export function reactCommand(state: AutomationState): InvocationCommand {
  return { name: 'react', category: 'UTILITY', guildOnly: true, permissions: [PermissionFlagsBits.ManageChannels], usage: ['/react on emojis:<emojis>', '/react off', '/react list', '/react status'], description: 'Configure automatic reactions: on <emojis>, off, list, or status.', async execute(message, args) {
    if (!await requireCommandPermissions(message, [PermissionFlagsBits.AddReactions, PermissionFlagsBits.SendMessages])) return;
    const option = args[0]?.toLowerCase();
    if (!option) { await message.reply(state.reactions.get(message.channelId)?.emojis.join(' ') || 'Automatic reactions are off.'); return; }
    if (option === 'list') { await message.reply([...state.reactions.values()].filter(row => belongsToGuild(row, message.guildId!, state)).map(row => `<#${row.channel_id}>: ${row.emojis.join(' ')}`).join('\n').slice(0, 1900) || 'No automatic reactions enabled.'); return; }
    if (option === 'off') {
      await query(state.services.pool, 'DELETE FROM auto_reactions WHERE channel_id=$1', [message.channelId]);
      state.reactions.delete(message.channelId); await message.reply('Automatic reactions are off.'); return;
    }
    const emojis = [...new Set(args.slice(1).map(value => parseEmoji(value)?.id ?? value))];
    if (option !== 'on' || emojis.length === 0 || emojis.length > 20 || emojis.some(value => !state.services.client.emojis.cache.has(value) && !/\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(value))) {
      await message.reply('Use /react on with 1–20 valid emojis separated by spaces.'); return;
    }
    // Validate with Discord before persisting inaccessible custom emoji or malformed Unicode.
    const probe = await message.reply('Validating reactions…');
    for (const emoji of emojis) { try { await probe.react(emoji); } catch { await message.reply(`Cannot use reaction ${emoji}. No configuration changed.`); return; } }
    await query(state.services.pool, `INSERT INTO auto_reactions(channel_id,guild_id,emojis) VALUES($1,$2,$3)
      ON CONFLICT(channel_id) DO UPDATE SET guild_id=EXCLUDED.guild_id,emojis=EXCLUDED.emojis`, [message.channelId,message.guildId,emojis]);
    state.reactions.set(message.channelId, { channel_id: message.channelId, guild_id: message.guildId, emojis }); await message.reply('Automatic reactions are on.');
  } };
}
