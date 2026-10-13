import { ActionRowBuilder, ChannelType, InteractionContextType, SlashCommandBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits, parseEmoji, type Interaction, type Message } from 'discord.js';
import ms from 'ms';
import type { CommandInvocation } from '../../contracts/invocation.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import { assertCanRead, color, entityId, safeMentions, utilityError } from './shared.js';

export const topData = new SlashCommandBuilder().setName('top').setDescription('Rank unique authors by a reaction in a channel over a time period.').setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addIntegerOption(option => option.setName('winners').setDescription('Number of winning posts, including ties at the cutoff.').setRequired(true).setMinValue(1).setMaxValue(10))
  .addStringOption(option => option.setName('duration').setDescription('Time period between 10s and 14d.').setRequired(true).setMaxLength(100))
  .addChannelOption(option => option.setName('channel').setDescription('Channel to scan; cross-channel results are sent by DM.').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildVoice, ChannelType.GuildStageVoice))
  .addStringOption(option => option.setName('emoji').setDescription('Unicode emoji, custom emoji, or custom emoji ID.').setRequired(true).setMaxLength(100)).toJSON();

export function parseTopArgs(args: readonly string[]): { count: number; duration: number; channelId: string; emojiKey: string } {
  if (args.length !== 4) throw new Error('Usage: /top winners:<1–10> duration:<10s–14d> channel:<channel> emoji:<reaction>');
  const count = Number(args[0]);
  const duration = ms(args[1]! as ms.StringValue);
  const channelId = entityId(args[2]!);
  const parsed = parseEmoji(args[3]!);
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('Select between 1 and 10 posts.');
  if (typeof duration !== 'number' || duration < 10_000 || duration > 14 * 86_400_000) throw new Error('Select a period between 10 seconds and 14 days.');
  if (!channelId) throw new Error('Specify a channel mention or ID.');
  const emojiKey = parsed?.id ?? args[3]!;
  const isCustomId = /^\d{16,22}$/u.test(emojiKey);
  if (!parsed?.id && !isCustomId && !/^(?:\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)$/u.test(emojiKey)) throw new Error('Specify a Unicode or custom emoji.');
  return { count, duration, channelId, emojiKey };
}

export async function scanPages<T extends { id: string; createdTimestamp: number }>(fetchPage: (before?: string) => Promise<readonly T[]>, since: number, signal: AbortSignal, maxPages = 500): Promise<{ messages: T[]; truncated: boolean }> {
  const messages: T[] = [];
  let before: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    signal.throwIfAborted();
    const batch = await new Promise<readonly T[]>((resolve, reject) => {
      const abort = (): void => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      fetchPage(before).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    signal.throwIfAborted();
    if (!batch.length) return { messages, truncated: false };
    const oldest = batch.reduce((a, b) => BigInt(a.id) < BigInt(b.id) ? a : b);
    if (before && BigInt(oldest.id) >= BigInt(before)) throw new Error('Discord pagination did not advance. Please try again.');
    messages.push(...batch.filter(message => message.createdTimestamp >= since));
    if (batch.length < 100 || oldest.createdTimestamp < since) return { messages, truncated: false };
    before = oldest.id;
  }
  return { messages, truncated: true };
}

export function selectWinners<T extends { authorId: string; score: number }>(candidates: readonly T[], count: number): Array<T & { rank: number }> {
  const authors = new Set<string>();
  const winners: Array<T & { rank: number }> = [];
  let rank = 0;
  let previous: number | undefined;
  let cutoff: number | undefined;
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    if (candidate.score < 1 || authors.has(candidate.authorId)) continue;
    if (cutoff !== undefined && candidate.score < cutoff) break;
    authors.add(candidate.authorId);
    if (candidate.score !== previous) rank++;
    previous = candidate.score;
    winners.push({ ...candidate, rank });
    if (winners.length === count) cutoff = candidate.score;
  }
  return winners;
}

export function createTop(): { command: InvocationCommand; onInteraction(interaction: Interaction): Promise<boolean>; close(): Promise<void> } {
  const scans = new Map<string, { userId: string; controller: AbortController }>();
  let closing = false;
  return {
    command: {
      name: 'top', category: 'MANAGEMENT', guildOnly: true, permissions: [PermissionFlagsBits.ManageChannels], usage: ['/top winners:<1–10> duration:<10s–14d> channel:<channel> emoji:<reaction>'], description: 'Rank 1–10 unique authors by a reaction in a channel over 10s–14d; requires Manage Channels.',
      async execute(invocation: CommandInvocation, args) {
        let progress: Message | undefined;
        let scanId: string | undefined;
        try {
          if (closing) throw new Error('The bot is shutting down. Please try again after it restarts.');
          if (!invocation.guild || !invocation.member || invocation.channel.isDMBased()) throw new Error('This command is only available in a server.');
          const options = parseTopArgs(args);
          const channel = await invocation.guild.channels.fetch(options.channelId);
          if (!channel?.isTextBased()) throw new Error('Specify a text channel in this server.');
          if (!invocation.member.permissionsIn(invocation.channel).has(PermissionFlagsBits.ManageChannels) || !invocation.member.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)) throw new Error('You need Manage Channels in this channel and the selected channel.');
          await assertCanRead(channel, invocation.author.id);
          if (closing) throw new Error('The bot is shutting down. Please try again after it restarts.');
          const privateResults = channel.id !== invocation.channelId;
          const controller = new AbortController();
          scanId = invocation.id;
          scans.set(scanId, { userId: invocation.author.id, controller });
          const control = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`utilities:top:cancel:${scanId}`).setLabel('Cancel scan').setStyle(ButtonStyle.Secondary));
          progress = await invocation.reply({ content: privateResults ? 'Scanning the selected channel… Results will be sent to your DMs.' : `Scanning <#${channel.id}> for ${args[3]} reactions…`, components: [control], allowedMentions: safeMentions });
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
          const result = await scanPages(async before => [...(await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) })).values()], Date.now() - options.duration, signal);
          const normalize = (value: string): string => value.replace(/\uFE0F/gu, '');
          const candidates = result.messages.map(item => ({
            message: item,
            authorId: item.author.id,
            score: item.reactions.cache.find(reaction => (reaction.emoji.id ?? normalize(reaction.emoji.name ?? '')) === normalize(options.emojiKey))?.count ?? 0,
          }));
          const allWinners = selectWinners(candidates, options.count);
          const winners = allWinners.slice(0, 100);
          const summary = `Scanned ${result.messages.length} messages. ${winners.length ? `${winners.length} winning posts (one per author; equal scores tie).` : 'No matching posts found.'}${result.truncated ? '\nThe 50,000-message scan limit was reached; results cover only scanned messages. Use a shorter time period.' : ''}${allWinners.length > winners.length ? '\nThe first 100 tied posts are shown; use a shorter time period to narrow the result.' : ''}`;
          // Cross-channel readers need not share the requester's access to the source.
          if (privateResults) await invocation.author.send({ content: summary, allowedMentions: safeMentions }).catch(() => { throw new Error('Could not deliver results in DM. Enable DMs and run top again.'); });
          else await progress.edit({ content: summary, components: [], allowedMentions: safeMentions });
          for (let offset = 0; offset < winners.length; offset += 5) {
            const embeds = winners.slice(offset, offset + 5).map(winner => {
              const item = winner.message;
              const embed = new EmbedBuilder().setColor(color).setTitle(`${winner.rank} place by ${item.author.username} with ${winner.score} ${args[3]}`.slice(0, 256))
                .setURL(item.url).setDescription(item.content.slice(0, 420) || '*No text content.*').setThumbnail(item.author.displayAvatarURL());
              const image = item.attachments.find(attachment => attachment.contentType?.startsWith('image/'));
              if (image) embed.setImage(image.url);
              return embed;
            });
            if (privateResults) await invocation.author.send({ embeds, allowedMentions: safeMentions }).catch(() => { throw new Error('Could not deliver results in DM. Enable DMs and run top again.'); });
            else if (invocation.channel.isSendable()) await invocation.channel.send({ embeds, allowedMentions: safeMentions });
          }
          if (privateResults) await progress.edit({ content: 'Scan complete. Results were sent to your DMs.', components: [], allowedMentions: safeMentions });
        } catch (error) {
          const content = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError') ? 'Scan cancelled or timed out. Use a shorter period and try again.' : error instanceof Error ? error.message : 'The scan failed. Please try again.';
          if (progress) await progress.edit({ content, components: [], allowedMentions: safeMentions });
          else await utilityError(invocation, error);
        } finally { if (scanId) scans.delete(scanId); }
      },
    },
    async close() { closing = true; for (const scan of scans.values()) scan.controller.abort(); },
    async onInteraction(interaction) {
      if (!interaction.isButton() || !interaction.customId.startsWith('utilities:top:cancel:')) return false;
      const scan = scans.get(interaction.customId.slice('utilities:top:cancel:'.length));
      if (!scan || scan.userId !== interaction.user.id) await interaction.reply({ content: scan ? 'Only the person who started this scan can cancel it.' : 'This scan has already finished.', flags: MessageFlags.Ephemeral });
      else { scan.controller.abort(); await interaction.deferUpdate(); }
      return true;
    },
  };
}
