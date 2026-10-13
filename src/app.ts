import { once } from 'node:events';
import { Client, Events, GatewayIntentBits, MessageFlags, Partials, Team, TeamMemberMembershipState } from 'discord.js';
import type { Config } from './config.js';
import { assertSchemaReady, createPool, loadPrefixes, query } from './db/index.js';
import { dispatchContext, dispatchInteraction, dispatchMessage } from './discord/dispatch.js';
import { EventIntake } from './discord/intake.js';
import { startHealthServer } from './health.js';
import { configureLogSink, logger } from './logger.js';
import { DurableScheduler } from './scheduler/index.js';
import { createRegistry } from './registry.js';
import { observeRuntime, recordDroppedEvent, withSpan } from './observability.js';
import { refreshPresence } from './features/core/index.js';
import type { Pool } from 'pg';
import type { RuntimeServices } from './contracts/features.js';

export async function startApp(config: Config, dependencies: { client?: Client; pool?: Pool } = {}): Promise<() => Promise<void>> {
  const pool = dependencies.pool ?? createPool(config.databaseUrl);
  pool.on('error', (error: unknown) => logger.error('Idle database connection failed', error));
  const client = dependencies.client ?? new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessageReactions],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
    allowedMentions: { parse: [], repliedUser: false },
    rest: { timeout: 15_000 },
  });
  client.on(Events.Error, error => logger.error('Discord client error', error));
  const startedAt = Date.now();
  const prefixes = new Map<string, string>();
  const ownerIds = new Set<string>();
  for (const id of (process.env.BOT_OWNER_IDS || '').split(',').filter(Boolean)) {
    if (!/^\d{17,20}$/u.test(id)) throw new Error('BOT_OWNER_IDS must contain decimal Discord user IDs');
    ownerIds.add(id);
  }
  const services: RuntimeServices = { client, pool, prefixes, ownerIds, logger, startedAt, env: process.env };
  const registry = createRegistry(services);
  let reconcileRequested = 0;
  let reconcileCompleted = 0;
  services.reload = async () => {
    const nextPrefixes = await loadPrefixes(pool);
    await Promise.all(registry.features.map(feature => feature.hydrate?.()));
    prefixes.clear();
    for (const [guildId, prefix] of nextPrefixes) prefixes.set(guildId, prefix);
    reconcileRequested++;
  };
  let lastDropWarning = 0;
  function dropped(kind: string, critical = false): void {
    recordDroppedEvent(kind);
    if (critical) reconcileRequested++;
    if (Date.now() - lastDropWarning > 10_000) {
      logger.error('Event intake is saturated; menu state will be reconciled through durable jobs');
      lastDropWarning = Date.now();
    }
  }
  let presenceUpdatedAt = 0;
  const scheduler = new DurableScheduler({
    pool, logger,
    handlers: Object.fromEntries(Object.entries(registry.handlers).map(([type, handler]) => [type,
      (job: import('./scheduler/index.js').ScheduledJob, signal: AbortSignal) => withSpan('scheduler.job', { type }, () => handler(job, signal)),
    ])),
    handlerTimeoutMs: 120_000, leaseMs: 180_000,
    async onTick() {
      if (reconcileRequested > reconcileCompleted) {
        const version = reconcileRequested;
        const completed = await Promise.all(registry.features.map(feature => feature.reconcile?.() ?? true));
        if (completed.every(Boolean)) reconcileCompleted = version;
      }
      if (Date.now() - presenceUpdatedAt >= 180_000) {
        refreshPresence(client, startedAt);
        presenceUpdatedAt = Date.now();
      }
    },
  });
  const unobserve = observeRuntime(pool);
  let accepting = false;
  let health: Awaited<ReturnType<typeof startHealthServer>> | undefined;
  const intake = new EventIntake(error => logger.error('Event handler failed', error));
  const logs = new EventIntake(() => { console.error('Optional Discord log delivery failed'); }, 1, 32);
  async function close(): Promise<void> {
    accepting = false;
    configureLogSink(undefined);
    const results = await Promise.allSettled([
      health ? new Promise<void>((resolve, reject) => health!.close(error => error ? reject(error) : resolve())) : Promise.resolve(),
      scheduler.stop(),
      ...registry.features.map(feature => feature.close?.()),
      intake.stop(),
      logs.stop(),
    ]);
    unobserve();
    try { await client.destroy(); }
    finally { await pool.end(); }
    if (results.some(result => result.status === 'rejected')) throw new Error('Resource cleanup failed');
  }
  try {
    // Migrations run separately; missing schema prevents gateway login.
    await assertSchemaReady(pool);
    for (const [guildId, prefix] of await loadPrefixes(pool)) prefixes.set(guildId, prefix);
    await Promise.all(registry.features.map(feature => feature.hydrate?.()));
    health = await startHealthServer(config.healthPort, async () => {
      if (!accepting || !client.isReady()) return false;
      await query(pool, 'SELECT 1');
      return true;
    });
    client.on(Events.InteractionCreate, interaction => {
      if (!accepting) return;
      const command = interaction.isChatInputCommand() || interaction.isContextMenuCommand();
      const admitted = intake.enqueue(command ? `interaction:${interaction.user.id}` : `component:${interaction.id}`, async () => {
        if (interaction.isChatInputCommand()) await dispatchInteraction(interaction, registry.slash);
        else if (interaction.isContextMenuCommand()) await dispatchContext(interaction, registry.context);
        else {
          try { for (const feature of registry.features) if (await feature.onInteraction?.(interaction)) break; }
          catch (error) {
            logger.error('Component action failed', error);
            if (interaction.isRepliable()) {
              const body = { content: 'This action could not complete. Please retry or contact the bot owner.' };
              if (interaction.deferred || interaction.replied) await interaction.editReply(body).catch(() => {});
              else await interaction.reply({ ...body, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
          }
        }
      }, command);
      if (!admitted && interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        dropped('interaction');
        void interaction.reply({ content: 'The bot is busy. Please retry shortly.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    });
    client.on(Events.MessageCreate, message => {
      if (!accepting) return;
      if (!intake.enqueue(`message:${message.channelId}`, async () => {
        for (const feature of registry.features) {
          const result = await feature.onMessage?.(message);
          if (!accepting) return;
          if (result && result !== 'continue') return;
        }
        const prefix = (message.guildId && prefixes.get(message.guildId)) || '!kifo ';
        await dispatchMessage(message, prefix, registry.prefix, ownerIds, registry.slash);
      })) dropped('message');
    });
    client.on(Events.MessageReactionAdd, (reaction, user) => {
      if (accepting && !intake.enqueue(`reaction:${reaction.message.id}:${user.id}`, async () => {
        for (const feature of registry.features) await feature.onReaction?.(reaction, user, true);
      })) dropped('reaction', true);
    });
    client.on(Events.MessageReactionRemove, (reaction, user) => {
      if (accepting && !intake.enqueue(`reaction:${reaction.message.id}:${user.id}`, async () => {
        for (const feature of registry.features) await feature.onReaction?.(reaction, user, false);
      })) dropped('reaction', true);
    });
    client.on(Events.MessageDelete, message => {
      if (accepting && !intake.enqueue(`delete:${message.id}`, async () => {
        for (const feature of registry.features) await feature.onMessageDelete?.(message);
      })) dropped('delete', true);
    });
    client.on(Events.MessageBulkDelete, messages => {
      if (accepting && !intake.enqueue(`delete:${messages.first()?.channelId}`, async () => {
        for (const message of messages.values()) for (const feature of registry.features) await feature.onMessageDelete?.(message);
      })) dropped('delete', true);
    });
    for (const [event, kind] of [[Events.GuildCreate, 'join'], [Events.GuildDelete, 'leave'], [Events.GuildUnavailable, 'unavailable']] as const) {
      client.on(event, guild => {
        if (accepting) intake.enqueue(`guild:${guild.id}`, async () => { for (const feature of registry.features) await feature.onGuild?.(guild, kind); });
      });
    }
    const abortReady = new AbortController();
    const readyTimeout = setTimeout(() => abortReady.abort(), 60_000);
    try {
      await Promise.all([
        once(client, Events.ClientReady, { signal: abortReady.signal }),
        client.login(config.discordToken),
      ]);
    } finally {
      clearTimeout(readyTimeout);
      abortReady.abort();
    }
    const application = await client.application?.fetch();
    const owner = application?.owner;
    if (owner instanceof Team) for (const member of owner.members.values()) {
      if (member.membershipState === TeamMemberMembershipState.Accepted) ownerIds.add(member.id);
    }
    else if (owner?.id) ownerIds.add(owner.id);
    for (const feature of registry.features) await feature.onReady?.();
    if (process.env.DISCORD_LOG_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(process.env.DISCORD_LOG_CHANNEL_ID);
        if (channel?.isSendable()) configureLogSink(record => {
          logs.enqueue('log', async () => {
            await channel.send({ content: `[${record.level}] ${record.message}${record.error ? ` (${record.error})` : ''}`.slice(0, 1_900), allowedMentions: { parse: [] } });
          });
        });
      } catch (error) { logger.error('Optional Discord log channel unavailable', error); }
    }
    refreshPresence(client, startedAt);
    presenceUpdatedAt = Date.now();
    accepting = true;
    if (!config.schedulerPaused) scheduler.start();
    logger.info(config.schedulerPaused ? 'Bot ready; scheduled execution is paused' : 'Bot ready');
    return close;
  } catch (error) {
    await close().catch(cleanupError => logger.error('Startup cleanup failed', cleanupError));
    throw error;
  }
}
