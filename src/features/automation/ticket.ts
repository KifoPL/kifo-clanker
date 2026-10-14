import { BOT_COLOR } from '../../constants.js';
import { ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ThreadChannel, type ThreadAutoArchiveDuration } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import { requireChannel, respond, threadBot, type AutomationState } from './shared.js';

export const ticketData = new SlashCommandBuilder().setName('ticket').setDescription('Create a ticket.').setDMPermission(false)
  .addStringOption(o => o.setName('title').setDescription('Your question or problem.').setRequired(true).setMinLength(1).setMaxLength(256))
  .addStringOption(o => o.setName('description').setDescription('Additional details.').setMaxLength(4000)).toJSON();
export function ticketCommand(state: AutomationState): SlashCommand {
  return {data:ticketData,async execute(interaction) {
    const setting = state.tickets.get(interaction.channelId);
    if (!setting || setting.guild_id !== interaction.guildId) { await respond(interaction,{content:'This channel does not have tickets enabled.',flags:MessageFlags.Ephemeral}); return; }
    const channel = await requireChannel(interaction,[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.UseApplicationCommands,PermissionFlagsBits.SendMessagesInThreads],[...threadBot,setting.are_public ? PermissionFlagsBits.CreatePublicThreads : PermissionFlagsBits.CreatePrivateThreads]);
    if (!channel) return;
    const title = interaction.options.getString('title',true).trim();
    if (!title) { await respond(interaction,{content:'Provide a nonempty title.',flags:MessageFlags.Ephemeral}); return; }
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle(title).setDescription(interaction.options.getString('description') || 'No additional details.')
      .setAuthor({name:`${member.displayName}, ${interaction.user.tag}`.slice(0,256),iconURL:interaction.user.displayAvatarURL()}).setFooter({text:`Asked by ${interaction.user.tag}`}).setTimestamp();
    let thread: ThreadChannel;
    if (setting.are_public) {
      const starter = await channel.send({content:`<@${interaction.user.id}>`,embeds:[embed],allowedMentions:{users:[interaction.user.id]}});
      try { thread = await starter.startThread({name:title.slice(0,100),autoArchiveDuration:setting.archive_minutes as ThreadAutoArchiveDuration,reason:'New ticket'}); }
      catch (error) { await starter.delete().catch(() => {}); throw error; }
    } else {
      if (channel.type !== ChannelType.GuildText) { await interaction.editReply('Private tickets require a text channel.'); return; }
      thread = await channel.threads.create({name:title.slice(0,100),type:ChannelType.PrivateThread,autoArchiveDuration:setting.archive_minutes as ThreadAutoArchiveDuration,invitable:false,reason:'New private ticket'});
      try { await thread.members.add(interaction.user.id); await thread.send({content:`<@${interaction.user.id}>`,embeds:[embed],allowedMentions:{users:[interaction.user.id]}}); }
      catch(error) { await thread.delete('Incomplete ticket creation').catch(() => {}); throw error; }
    }
    if (setting.slowmode_seconds) await thread.setRateLimitPerUser(setting.slowmode_seconds);
    await interaction.editReply(`Created your ticket: <#${thread.id}>.`);
  }};
}
