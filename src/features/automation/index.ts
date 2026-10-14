import { BOT_URLS } from '../../constants.js';
import ms from 'ms';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, type ThreadAutoArchiveDuration } from 'discord.js';
import type { FeatureDefinition } from '../../contracts/features.js';
import { invocationCommand } from '../../discord/invocation.js';
import { query } from '../../db/query.js';
import { autothreadingCommand, autothreadingData, threadTitle } from './autothreading.js';
import { reactCommand, reactData } from './react.js';
import { claimCooldown, superslowCommand, superslowData } from './superslow.js';
import { ticketCommand, ticketData } from './ticket.js';
import { ticketingCommand, ticketingData } from './ticketing.js';
import { threadsCommand, threadsData } from './threads.js';
import type { AutoSettings, AutomationState, ReactionSettings, SlowSettings, TicketSettings } from './shared.js';

export const automationFeature: FeatureDefinition = {
  name:'automation', commandData:[ticketingData,ticketData,autothreadingData,threadsData,reactData,superslowData],
  create(services) {
    const state: AutomationState = {revision:0,services,reactions:new Map(),slow:new Map(),tickets:new Map(),auto:new Map()};
    return {
      slashCommands:[ticketingCommand(state),ticketCommand(state),autothreadingCommand(state),threadsCommand(),
        invocationCommand(reactData,reactCommand(state),interaction => {
          const action=interaction.options.getSubcommand();
          return action === 'status' ? [] : action === 'on' ? ['on',...interaction.options.getString('emojis',true).trim().split(/\s+/u)] : [action];
        },services,true),
        invocationCommand(superslowData,superslowCommand(state),interaction => {
          const action=interaction.options.getSubcommand();
          return action === 'status' ? [] : action === 'off' ? ['0s'] : action === 'set' ? [interaction.options.getString('duration',true)] : [action];
        },services),
      ],
      async hydrate() {
        for (let attempt=0; attempt<3; attempt++) {
          const revision = state.revision;
          const [reactions,slow,tickets,auto] = await Promise.all([
            query<ReactionSettings>(services.pool,'SELECT channel_id,guild_id,emojis FROM auto_reactions'),
            query<SlowSettings>(services.pool,'SELECT channel_id,guild_id,duration_ms FROM superslow_settings'),
            query<TicketSettings>(services.pool,'SELECT channel_id,guild_id,are_public,slowmode_seconds,archive_minutes FROM ticket_settings'),
            query<AutoSettings>(services.pool,'SELECT channel_id,guild_id,title,bot_auto,slowmode_seconds,archive_minutes FROM autothreading_settings'),
          ]);
          // A command committed during the queries; reread rather than publish a stale snapshot.
          if (revision !== state.revision) continue;
          state.reactions.clear();
          state.slow.clear();
          state.tickets.clear();
          state.auto.clear();
          for (const row of reactions.rows) state.reactions.set(row.channel_id,row);
          for (const row of slow.rows) state.slow.set(row.channel_id,row);
          for (const row of tickets.rows) state.tickets.set(row.channel_id,row);
          for (const row of auto.rows) state.auto.set(row.channel_id,row);
          return;
        }
        throw new Error('Automation settings changed while reloading. Please retry.');
      },
      async onMessage(message) {
        if (!message.guild) return 'continue';
        const ticket = state.tickets.get(message.channelId);
        const slow = state.slow.get(message.channelId);
        const reactions = state.reactions.get(message.channelId);
        const auto = state.auto.get(message.channelId);
        if (!ticket && !slow && !reactions && !auto) return 'continue';
        const bot = await message.guild.members.fetchMe();
        const needsModeration = (ticket && ticket.guild_id === message.guild.id && message.author.id !== services.client.user?.id && !message.interactionMetadata) || (slow && !message.author.bot);
        const member = needsModeration ? message.member ?? (message.webhookId ? null : await message.guild.members.fetch(message.author.id)) : null;
        const managesMessages = member?.permissionsIn(message.channelId).has(PermissionFlagsBits.ManageMessages) ?? false;
        if (ticket && ticket.guild_id === message.guild.id && message.author.id !== services.client.user?.id && !managesMessages && !message.interactionMetadata) {
          if (!bot.permissionsIn(message.channelId).has(PermissionFlagsBits.ManageMessages)) { services.logger.error('Ticket filter cannot delete messages: missing ManageMessages'); return 'continue'; }
          await message.author.send({content:'This channel uses tickets. Use `/ticket` to create a question or report a problem.',components:[new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Ticket guide').setURL(BOT_URLS.guide('ticket')))]}).catch(() => {});
          await message.delete(); return 'deleted';
        }
        if (slow && !message.author.bot && !managesMessages) {
          if (!bot.permissionsIn(message.channelId).has([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages])) { services.logger.error('Superslow cannot enforce cooldown: missing channel permissions'); return 'continue'; }
          const duration = Number(slow.duration_ms);
          if (!await claimCooldown(services.pool,message.channelId,message.author.id,message.createdTimestamp,duration)) {
            const result = await query<{timestamp_ms:string}>(services.pool,'SELECT timestamp_ms FROM superslow_users WHERE channel_id=$1 AND user_id=$2',[message.channelId,message.author.id]);
            const last = result.rows[0];
            const remaining = last ? Math.max(0,Number(last.timestamp_ms)+duration-message.createdTimestamp) : 0;
            await message.author.send(remaining ? `Please wait ${ms(remaining,{long:true})} before speaking in <#${message.channelId}>.` : `You can already talk in <#${message.channelId}>.`).catch(() => {});
            await message.delete(); return 'deleted';
          }
        }
        if (reactions && (!message.author.bot || (message.author.id === services.client.user?.id && message.embeds.length > 0)) && bot.permissionsIn(message.channelId).has(PermissionFlagsBits.AddReactions)) {
          for (const emoji of reactions.emojis) { try { await message.react(emoji); } catch(error) { services.logger.error('Automatic reaction failed',error); } }
        }
        // Ticket commands manage their own starter threads; gateway delivery can precede send() completion.
        if (auto && !(ticket && message.author.id === services.client.user?.id) && auto.guild_id === message.guild.id && (!message.author.bot || auto.bot_auto) && !message.components.length && !message.hasThread) {
          if (!bot.permissionsIn(message.channelId).has([PermissionFlagsBits.CreatePublicThreads,PermissionFlagsBits.SendMessagesInThreads])) { services.logger.error('Automatic thread cannot start: missing permissions'); return 'continue'; }
          const thread = await message.startThread({name:threadTitle(auto.title,message),autoArchiveDuration:auto.archive_minutes as ThreadAutoArchiveDuration,reason:'Automatic threading enabled'});
          if (auto.slowmode_seconds) await thread.setRateLimitPerUser(auto.slowmode_seconds);
        }
        return 'continue';
      },
    };
  },
};
