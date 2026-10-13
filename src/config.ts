export interface Config {
  discordToken: string;
  databaseUrl: string;
  healthPort: number;
  schedulerPaused: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const discordToken = env.DISCORD_TOKEN;
  const databaseUrl = env.DATABASE_URL;
  if (!discordToken?.trim()) throw new Error('DISCORD_TOKEN is required');
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  let url: URL;
  try { url = new URL(databaseUrl); }
  catch { throw new Error('DATABASE_URL must be a PostgreSQL URI'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a PostgreSQL URI');
  }
  const healthPort = Number(env.HEALTH_PORT ?? '8080');
  if (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65535) {
    throw new Error('HEALTH_PORT must be an integer between 1 and 65535');
  }
  if (env.SCHEDULER_PAUSED && !['true', 'false'].includes(env.SCHEDULER_PAUSED)) throw new Error('SCHEDULER_PAUSED must be true or false');
  return { discordToken, databaseUrl, healthPort, schedulerPaused: env.SCHEDULER_PAUSED === 'true' };
}
