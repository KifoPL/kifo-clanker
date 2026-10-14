import { BOT_COLOR } from '../../constants.js';
import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Interaction } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { enqueueJob, query, withTransaction } from '../../db/index.js';
export const countdownData = new SlashCommandBuilder().setName('countdown').setDescription('Count down to a given time, then show your message.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(option => option.setName('epoch').setDescription('Unix seconds; use /epoch date_to_epoch to get the number.').setRequired(true))
  .addStringOption(option => option.setName('message').setDescription('The message to show when the countdown ends.').setRequired(true).setMaxLength(1500)).toJSON();
interface CountdownConfirmation { id: string; user_id: string; message_id: string; end_at: Date; confirmation_expires_at: Date; status: string }
export function canConfirmCountdown(record: Pick<CountdownConfirmation, 'user_id' | 'message_id' | 'confirmation_expires_at' | 'status'>, userId: string, messageId: string, now = Date.now()): boolean {
  return record.user_id === userId && record.message_id === messageId && record.status === 'pending_confirmation' && record.confirmation_expires_at.getTime() > now;
}
export function createCountdown(services: RuntimeServices): SlashCommand {
  return { data: countdownData, async execute(interaction) {
    if (!interaction.guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) { await interaction.reply({ content: 'You need Manage Messages permission in this server.', flags: MessageFlags.Ephemeral }); return; }
    const epoch = interaction.options.getInteger('epoch', true);
    const end = new Date(epoch * 1000);
    if (!Number.isSafeInteger(epoch) || !Number.isFinite(end.getTime()) || end.getTime() < Date.now() + 60000) { await interaction.reply({ content: 'Choose a valid end time at least 1 minute in the future.', flags: MessageFlags.Ephemeral }); return; }
    await interaction.deferReply();
    const reply = await interaction.fetchReply();
    const id = randomUUID();
    const expires = new Date(Date.now() + 30000);
    const message = interaction.options.getString('message', true);
    await withTransaction(services.pool, async connection => {
      await query(connection, `INSERT INTO countdowns(id,guild_id,channel_id,message_id,user_id,message,end_at,status,confirmation_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'pending_confirmation',$8)`, [id, interaction.guildId, interaction.channelId, reply.id, interaction.user.id, message, end, expires]);
      await enqueueJob(connection, 'countdown.expire', { id }, expires, `countdown-confirmation:${id}`);
    });
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(BOT_COLOR).setTitle('Please review the countdown:').setDescription(`Ends at <t:${epoch}> (<t:${epoch}:R>).\n\n${message}\n\nAccept within 30 seconds, or cancel.`)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`countdown:${id}:yes`).setLabel('Accept').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`countdown:${id}:no`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    )] });
  } };
}
export async function handleCountdownInteraction(services: RuntimeServices, interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton() || !interaction.customId.startsWith('countdown:')) return false;
  const match = /^countdown:([0-9a-f-]{36}):(yes|no)$/iu.exec(interaction.customId);
  if (!match) { await interaction.reply({ content: 'Invalid countdown action.', flags: MessageFlags.Ephemeral }); return true; }
  const record = (await query<CountdownConfirmation>(services.pool, 'SELECT * FROM countdowns WHERE id=$1', [match[1]])).rows[0];
  if (!record || !canConfirmCountdown(record, interaction.user.id, interaction.message.id) || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) { await interaction.reply({ content: 'This confirmation belongs to someone else, has expired, or you lack permission.', flags: MessageFlags.Ephemeral }); return true; }
  await interaction.deferUpdate();
  const accepted = match[2] === 'yes';
  const updated = await withTransaction(services.pool, async connection => {
    const result = await query<CountdownConfirmation>(connection, `UPDATE countdowns SET status=$2, completed_at=CASE WHEN $2='cancelled' THEN clock_timestamp() ELSE NULL END WHERE id=$1 AND status='pending_confirmation' AND confirmation_expires_at > clock_timestamp() AND end_at > clock_timestamp() RETURNING *`, [record.id, accepted ? 'scheduled' : 'cancelled']);
    if (result.rowCount && accepted) await enqueueJob(connection, 'countdown.complete', { id: record.id }, record.end_at, `countdown:${record.id}`);
    return Boolean(result.rowCount);
  });
  await interaction.editReply({ content: updated ? (accepted ? `Countdown started! Ends at <t:${Math.floor(record.end_at.getTime() / 1000)}>.` : 'Countdown cancelled.') : 'This confirmation has expired.', components: [], embeds: [] });
  return true;
}
