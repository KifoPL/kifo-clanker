import { once } from 'node:events';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import type { Config } from './config.js';
import { assertSchemaReady, createPool, loadPrefixes, query } from './db/index.js';
import { slashCommands } from './commands/index.js';
import { createHelpCommand } from './commands/help.js';
import { dispatchInteraction, dispatchMessage } from './discord/dispatch.js';
import { startHealthServer } from './health.js';
import { logger } from './logger.js';
import { DurableScheduler } from './scheduler/index.js';

export async function startApp(config: Config): Promise<() => Promise<void>> {
  const pool = createPool(config.databaseUrl);
  pool.on('error', (error: unknown) => logger.error('Idle database connection failed', error));
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
    allowedMentions: { parse: [], repliedUser: false },
    rest: { timeout: 15_000 },
  });
  client.on(Events.Error, error => logger.error('Discord client error', error));
  const scheduler = new DurableScheduler({ pool, handlers: {}, logger });
  let accepting = false;
  let health: Awaited<ReturnType<typeof startHealthServer>> | undefined;
  const inFlight = new Set<Promise<void>>();
  function track(work: Promise<void>): void {
    inFlight.add(work);
    void work.finally(() => inFlight.delete(work)).catch(error => logger.error('Event handler failed', error));
  }
  async function close(): Promise<void> {
    accepting = false;
    client.removeAllListeners(Events.InteractionCreate);
    client.removeAllListeners(Events.MessageCreate);
    const results = await Promise.allSettled([
      health ? new Promise<void>((resolve, reject) => health!.close(error => error ? reject(error) : resolve())) : Promise.resolve(),
      scheduler.stop(),
      Promise.allSettled(inFlight),
    ]);
    try { await client.destroy(); }
    finally { await pool.end(); }
    if (results.some(result => result.status === 'rejected')) throw new Error('Resource cleanup failed');
  }
  try {
    // Migrations run separately; missing schema prevents gateway login.
    await assertSchemaReady(pool);
    const prefixes = await loadPrefixes(pool);
    health = await startHealthServer(config.healthPort, async () => {
      if (!accepting || !client.isReady()) return false;
      await query(pool, 'SELECT 1');
      return true;
    });
    client.on(Events.InteractionCreate, interaction => {
      if (accepting && interaction.isChatInputCommand()) track(dispatchInteraction(interaction, slashCommands));
    });
    client.on(Events.MessageCreate, message => {
      if (!accepting) return;
      const prefix = (message.guildId && prefixes.get(message.guildId)) || '!kifo ';
      track(dispatchMessage(message, prefix, [createHelpCommand(prefix)]));
    });
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
    accepting = true;
    scheduler.start();
    logger.info('Migration runtime ready');
    return close;
  } catch (error) {
    await close().catch(cleanupError => logger.error('Startup cleanup failed', cleanupError));
    throw error;
  }
}
