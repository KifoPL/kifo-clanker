import ms from 'ms';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Pool } from 'pg';
import type { InvocationCommand } from '../../contracts/commands.js';
import { query } from '../../db/query.js';
import { belongsToGuild, requireCommandPermissions, type AutomationState } from './shared.js';

export async function claimCooldown(pool: Pool, channelId: string, userId: string, timestamp: number, duration: number): Promise<boolean> {
  const result = await query(pool, `INSERT INTO superslow_users(channel_id,user_id,timestamp_ms) VALUES($1,$2,$3)
    ON CONFLICT(channel_id,user_id) DO UPDATE SET timestamp_ms=EXCLUDED.timestamp_ms
    WHERE superslow_users.timestamp_ms + $4 <= EXCLUDED.timestamp_ms RETURNING user_id`, [channelId,userId,timestamp,duration]);
  return result.rowCount === 1;
}
export const superslowData = new SlashCommandBuilder().setName('superslow').setDescription('Configure long message cooldowns.').setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(sub => sub.setName('set').setDescription('Set the cooldown in this channel.')
    .addStringOption(option => option.setName('duration').setDescription('Duration from 6h to 1y.').setRequired(true).setMinLength(1).setMaxLength(100)))
  .addSubcommand(sub => sub.setName('off').setDescription('Disable cooldowns and clear their history.'))
  .addSubcommand(sub => sub.setName('status').setDescription('Show the cooldown in this channel.'))
  .addSubcommand(sub => sub.setName('list').setDescription('List cooldowns in this server.')).toJSON();

export function superslowCommand(state: AutomationState): InvocationCommand {
  return { name: 'superslow', category: 'UTILITY', guildOnly: true, permissions: [PermissionFlagsBits.ManageChannels], usage: ['/superslow set duration:<6h–1y>', '/superslow off', '/superslow list', '/superslow status'], description: 'Configure cooldowns from 6h to 1y; 0s disables. Use status or list to inspect settings.', async execute(message, args) {
    if (!await requireCommandPermissions(message, [PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages])) return;
    if (!args[0]) { const setting = state.slow.get(message.channelId); await message.reply(setting ? `Cooldown: ${ms(Number(setting.duration_ms), { long: true })}.` : 'Superslow is off.'); return; }
    if (args[0].toLowerCase() === 'list') { await message.reply([...state.slow.values()].filter(row => belongsToGuild(row, message.guildId!, state)).map(row => `<#${row.channel_id}>: ${ms(Number(row.duration_ms), { long: true })}`).join('\n').slice(0,1900) || 'No superslow channels enabled.'); return; }
    const input = args.join(' ');
    const duration = input.length <= 100 ? ms(input as ms.StringValue) : undefined;
    if (duration === undefined || !Number.isSafeInteger(duration) || duration < 0 || (duration > 0 && duration < 21_600_000) || duration > 31_557_600_000) { await message.reply('Specify 6h to 1y, or 0s to disable.'); return; }
    const wasEnabled = state.slow.has(message.channelId);
    if (duration === 0) { await query(state.services.pool,'DELETE FROM superslow_settings WHERE channel_id=$1',[message.channelId]); state.slow.delete(message.channelId); }
    else { await query(state.services.pool,`INSERT INTO superslow_settings(channel_id,guild_id,duration_ms) VALUES($1,$2,$3)
      ON CONFLICT(channel_id) DO UPDATE SET guild_id=EXCLUDED.guild_id,duration_ms=EXCLUDED.duration_ms`,[message.channelId,message.guildId,duration]); state.slow.set(message.channelId,{channel_id:message.channelId,guild_id:message.guildId,duration_ms:duration}); }
    if ((!wasEnabled || duration === 0) && 'setRateLimitPerUser' in message.channel) {
      try { await message.channel.setRateLimitPerUser(duration ? 10 : 0); } catch { await message.reply('Superslow settings saved, but Discord slowmode could not be updated. Check channel permissions.'); return; }
    }
    await message.reply(duration ? `Superslow cooldown is ${ms(duration,{long:true})}.` : 'Superslow disabled; cooldown history cleared.');
  } };
}
