import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type InteractionReplyOptions, type TextChannel, type NewsChannel, type Channel } from 'discord.js';
import type { CommandInvocation } from '../../contracts/invocation.js';
import type { RuntimeServices } from '../../contracts/features.js';

export interface ReactionSettings { channel_id: string; guild_id: string | null; emojis: string[] }
export interface SlowSettings { channel_id: string; guild_id: string | null; duration_ms: string | number }
export interface TicketSettings { channel_id: string; guild_id: string; are_public: boolean; slowmode_seconds: number; archive_minutes: number }
export interface AutoSettings { channel_id: string; guild_id: string; title: string; bot_auto: boolean; slowmode_seconds: number; archive_minutes: number }
export interface AutomationState { revision: number; services: RuntimeServices; reactions: Map<string, ReactionSettings>; slow: Map<string, SlowSettings>; tickets: Map<string, TicketSettings>; auto: Map<string, AutoSettings> }
export const archives = [{ name: '1 hour', value: '1h' }, { name: '1 day', value: '1d' }, { name: '3 days', value: '3d' }, { name: '1 week', value: '1w' }];
export const slowmodes = ['5s','10s','15s','30s','1m','2m','5m','10m','15m','30m','1h','2h','6h'].map(value => ({ name: value, value }));
export function archiveMinutes(value: string): 60 | 1440 | 4320 | 10080 {
  switch (value) { case '1h': return 60; case '1d': return 1440; case '3d': return 4320; case '1w': return 10080; default: throw new Error('Invalid archiving interval.'); }
}
export function isParentChannel(channel: Channel | null): channel is TextChannel | NewsChannel { return channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement; }
export async function requireChannel(interaction: ChatInputCommandInteraction, userPermissions: bigint[], botPermissions: bigint[], ephemeral = true): Promise<TextChannel | NewsChannel | null> {
  if (!interaction.inGuild() || !interaction.guild || !isParentChannel(interaction.channel)) {
    await interaction.reply({ content: 'Use this command in a server text channel, outside threads.', flags: MessageFlags.Ephemeral }); return null;
  }
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  const [channel, member, bot] = await Promise.all([
    interaction.guild.channels.fetch(interaction.channelId, { force: true }),
    interaction.guild.members.fetch({ user: interaction.user.id, force: true }),
    interaction.guild.members.fetchMe({ force: true }),
    interaction.guild.roles.fetch(),
  ]);
  if (!isParentChannel(channel)) { await respond(interaction, { content: 'The server text channel is unavailable.' }); return null; }
  if (!member.permissionsIn(channel).has(userPermissions) || !bot.permissionsIn(channel).has(botPermissions)) {
    await respond(interaction, { content: 'You or the bot lack the required permissions in this channel.' }); return null;
  }
  return channel;
}
export async function respond(interaction: ChatInputCommandInteraction, options: InteractionReplyOptions): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    const { flags: _flags, ...body } = options;
    await interaction.editReply(body);
  } else await interaction.reply(options);
}
export const manage = [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageThreads];
export const threadBot = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageThreads];
export async function confirm(interaction: ChatInputCommandInteraction, content: string, action: string): Promise<boolean> {
  const id = `automation:${interaction.id}:${action}`;
  const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${id}:yes`).setLabel('Confirm').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${id}:no`).setLabel('Cancel').setStyle(ButtonStyle.Secondary))];
  if (interaction.replied || interaction.deferred) await interaction.editReply({ content, components });
  else await interaction.reply({ content, components, flags: MessageFlags.Ephemeral });
  const reply = await interaction.fetchReply();
  try {
    const button = await reply.awaitMessageComponent({ componentType: ComponentType.Button, time: 30_000,
      filter: candidate => candidate.user.id === interaction.user.id && (candidate.customId === `${id}:yes` || candidate.customId === `${id}:no`) });
    await button.deferUpdate();
    await interaction.editReply({ content: button.customId.endsWith(':yes') ? 'Applying…' : 'Canceled.', components: [] });
    return button.customId === `${id}:yes`;
  } catch {
    await interaction.editReply({ content: 'Confirmation expired; no change applied.', components: [] }); return false;
  }
}
export async function requireCommandPermissions(message: CommandInvocation, botPermissions: bigint[]): Promise<boolean> {
  if (!message.guild || !message.member) { await message.reply('Use this command in a server.'); return false; }
  const [channel, member, bot] = await Promise.all([
    message.guild.channels.fetch(message.channelId, { force: true }),
    message.guild.members.fetch({ user: message.author.id, force: true }),
    message.guild.members.fetchMe({ force: true }),
    message.guild.roles.fetch(),
  ]);
  if (!channel?.isTextBased()) { await message.reply('The server text channel is unavailable.'); return false; }
  if (channel.isThread() && (!channel.parentId || !await message.guild.channels.fetch(channel.parentId, { force: true }))) {
    await message.reply('The thread parent is unavailable.'); return false;
  }
  if (!member.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels) || !bot.permissionsIn(channel).has(botPermissions)) {
    await message.reply('You or the bot lack the required permissions in this channel.'); return false;
  }
  message.member = member;
  message.channel = channel;
  return true;
}
export function belongsToGuild(row: { guild_id: string | null; channel_id: string }, guildId: string, state: AutomationState): boolean {
  return row.guild_id === guildId || (row.guild_id === null && state.services.client.guilds.cache.get(guildId)?.channels.cache.has(row.channel_id) === true);
}
export async function recheckPermissions(interaction: ChatInputCommandInteraction, channel: TextChannel | NewsChannel, userPermissions: bigint[], botPermissions: bigint[]): Promise<boolean> {
  const [fresh, member, bot] = await Promise.all([
    channel.guild.channels.fetch(channel.id, { force: true }),
    channel.guild.members.fetch({ user: interaction.user.id, force: true }),
    channel.guild.members.fetchMe({ force: true }),
    channel.guild.roles.fetch(),
  ]);
  if (isParentChannel(fresh) && member.permissionsIn(fresh).has(userPermissions) && bot.permissionsIn(fresh).has(botPermissions)) return true;
  await interaction.editReply({content:'Channel permissions changed; action canceled.',components:[]}); return false;
}
