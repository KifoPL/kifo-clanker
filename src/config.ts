import { z } from 'zod';
import { validateHeaderName, validateHeaderValue } from 'node:http';
import { BOT_REPOSITORY } from './constants.js';

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value, schema.optional());
const secret = z.string({ error: 'is required' }).trim().min(1, 'is required').regex(/^[^\x00-\x1f\x7f]+$/u, 'must not contain control characters');
const snowflake = z.string().regex(/^\d{17,20}$/u, 'must be a decimal Discord snowflake');
const positiveInteger = z.string().regex(/^\d+$/u, 'must be a positive integer').transform(Number).pipe(z.number().int().min(1).max(2_147_483_647));
function validUrl(value: string, protocols: readonly string[], credentials = true): boolean {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && !!url.hostname && (!url.port || (Number(url.port) >= 1 && Number(url.port) <= 65_535))
      && (credentials || (!url.username && !url.password));
  } catch { return false; }
}
const postgresUrl = z.string({ error: 'is required' }).refine(value => validUrl(value, ['postgres:', 'postgresql:']), 'must be a PostgreSQL URI');
const httpUrl = z.string().refine(value => validUrl(value, ['http:', 'https:'], false), 'must be an HTTP(S) URL without embedded credentials');
const httpsUrl = z.string().refine(value => validUrl(value, ['https:'], false), 'must be an HTTPS URL without embedded credentials');
const mysqlUrl = z.string({ error: 'is required' }).superRefine((value, context) => {
  if (!validUrl(value, ['mysql:'])) { context.addIssue({ code: 'custom', message: 'must be a valid MySQL URL with a database name' }); return; }
  const url = new URL(value);
  if (!url.username || !/^\/[^/]+$/u.test(url.pathname)) context.addIssue({ code: 'custom', message: 'must be a valid MySQL URL with a database name' });
  if ([...url.searchParams.keys()].some(name => !['ssl', 'charset'].includes(name))) context.addIssue({ code: 'custom', message: 'only supports ssl and charset query options; export safety options are fixed' });
});
const mysqlTimezone = z.string({ error: 'must be an explicit UTC offset, for example +00:00' }).refine(value => value === 'Z' || (/^[+-](?:0\d|1[0-4]):[0-5]\d$/u.test(value) && (value.slice(1, 3) !== '14' || value.slice(4) === '00')), 'must be an explicit UTC offset, for example +00:00').transform(value => value === 'Z' ? '+00:00' : value);
function decodeHeaders(value: string): Record<string, string> {
  const headers: Array<[string, string]> = [];
  for (const entry of value.split(',')) {
    const separator = entry.indexOf('=');
    if (separator < 1) throw new Error('Invalid headers');
    const name = decodeURIComponent(entry.slice(0, separator).trim());
    const content = decodeURIComponent(entry.slice(separator + 1).trim());
    validateHeaderName(name);
    validateHeaderValue(name, content);
    headers.push([name, content]);
  }
  return Object.fromEntries(headers);
}
const telemetryHeaders = z.string().refine(value => { try { decodeHeaders(value); return true; } catch { return false; } }, 'must contain comma-separated URL-encoded header=value pairs supported by HTTP').transform(decodeHeaders);

// Each entry point selects its relevant fields from this schema; a database tool needs no bot token.
export const environmentSchema = z.object({
  DISCORD_TOKEN: optional(secret),
  DATABASE_URL: optional(postgresUrl),
  HEALTH_PORT: optional(z.string().regex(/^\d+$/u, 'must be an integer between 1 and 65535').transform(Number).pipe(z.number().int().min(1).max(65_535))).default(8080),
  SCHEDULER_PAUSED: optional(z.enum(['true', 'false'], { error: 'must be true or false' }).transform(value => value === 'true')).default(false),
  DISCORD_APPLICATION_ID: optional(snowflake),
  DISCORD_TEST_GUILD_ID: optional(snowflake),
  BOT_OWNER_IDS: optional(z.string().transform(value => value.split(',').map(id => id.trim())).pipe(z.array(snowflake)).transform(value => [...new Set(value)])).default([]),
  DISCORD_LOG_CHANNEL_ID: optional(snowflake),
  DISCORD_DEPLOY_CHANNEL_ID: optional(snowflake),
  LANGUAGE_DETECT_KEY: optional(secret),
  GITHUB_TOKEN: optional(secret),
  GITHUB_KEY: optional(secret),
  GITHUB_REPOSITORY: optional(z.string().regex(/^[\w][\w.-]*\/[\w][\w.-]*$/u, 'must be an owner/repository name')).default(BOT_REPOSITORY),
  JOKE_API_URL: optional(httpsUrl).default('https://www.yomomma.info/'),
  MYSQL_SOURCE_URL: optional(mysqlUrl),
  MYSQL_SOURCE_TIMEZONE: optional(mysqlTimezone),
  OTEL_EXPORTER_OTLP_ENDPOINT: optional(httpUrl),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: optional(httpUrl),
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: optional(httpUrl),
  OTEL_EXPORTER_OTLP_HEADERS: optional(telemetryHeaders),
  OTEL_EXPORTER_OTLP_TRACES_HEADERS: optional(telemetryHeaders),
  OTEL_EXPORTER_OTLP_METRICS_HEADERS: optional(telemetryHeaders),
  OTEL_EXPORTER_OTLP_PROTOCOL: optional(z.literal('http/protobuf', { error: 'must be http/protobuf for the installed exporters' })),
  OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: optional(z.literal('http/protobuf', { error: 'must be http/protobuf for the installed exporters' })),
  OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: optional(z.literal('http/protobuf', { error: 'must be http/protobuf for the installed exporters' })),
  OTEL_EXPORTER_OTLP_TIMEOUT: optional(positiveInteger).default(10_000),
  OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: optional(positiveInteger),
  OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: optional(positiveInteger),
  OTEL_SERVICE_NAME: optional(secret).default('kifo-clanker'),
});
const telemetryFields = {
  OTEL_EXPORTER_OTLP_ENDPOINT: true, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: true, OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: true,
  OTEL_EXPORTER_OTLP_HEADERS: true, OTEL_EXPORTER_OTLP_TRACES_HEADERS: true, OTEL_EXPORTER_OTLP_METRICS_HEADERS: true,
  OTEL_EXPORTER_OTLP_PROTOCOL: true, OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: true, OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: true,
  OTEL_EXPORTER_OTLP_TIMEOUT: true, OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: true, OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: true,
  OTEL_SERVICE_NAME: true,
} as const;
const telemetrySchema = environmentSchema.pick(telemetryFields);
const runtimeSchema = environmentSchema.pick({ DISCORD_TOKEN: true, DATABASE_URL: true, HEALTH_PORT: true, SCHEDULER_PAUSED: true,
  BOT_OWNER_IDS: true, DISCORD_LOG_CHANNEL_ID: true, DISCORD_DEPLOY_CHANNEL_ID: true, DISCORD_TEST_GUILD_ID: true, LANGUAGE_DETECT_KEY: true, GITHUB_TOKEN: true, GITHUB_KEY: true,
  GITHUB_REPOSITORY: true, JOKE_API_URL: true, ...telemetryFields }).extend({ DISCORD_TOKEN: secret, DATABASE_URL: postgresUrl });
export type RuntimeEnvironment = z.infer<typeof runtimeSchema>;
export interface TelemetryConfig {
  serviceName: string;
  traces: { url: string; headers: Record<string, string>; timeoutMillis: number } | undefined;
  metrics: { url: string; headers: Record<string, string>; timeoutMillis: number } | undefined;
}
function parse<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) throw new Error(`Invalid configuration: ${result.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; ')}.`);
  return result.data;
}
function telemetryConfig(env: z.infer<typeof telemetrySchema>): TelemetryConfig {
  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const signalUrl = (signal: string): string | undefined => {
    if (!base) return undefined;
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/$/u, '')}/v1/${signal}`;
    return url.toString();
  };
  const tracesUrl = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? signalUrl('traces');
  const metricsUrl = env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? signalUrl('metrics');
  return { serviceName: env.OTEL_SERVICE_NAME,
    traces: tracesUrl ? { url: tracesUrl, headers: env.OTEL_EXPORTER_OTLP_TRACES_HEADERS ?? env.OTEL_EXPORTER_OTLP_HEADERS ?? {}, timeoutMillis: env.OTEL_EXPORTER_OTLP_TRACES_TIMEOUT ?? env.OTEL_EXPORTER_OTLP_TIMEOUT } : undefined,
    metrics: metricsUrl ? { url: metricsUrl, headers: env.OTEL_EXPORTER_OTLP_METRICS_HEADERS ?? env.OTEL_EXPORTER_OTLP_HEADERS ?? {}, timeoutMillis: env.OTEL_EXPORTER_OTLP_METRICS_TIMEOUT ?? env.OTEL_EXPORTER_OTLP_TIMEOUT } : undefined,
  };
}
export interface Config {
  discordToken: string;
  databaseUrl: string;
  healthPort: number;
  schedulerPaused: boolean;
  ownerIds: readonly string[];
  env: RuntimeEnvironment;
  telemetry: TelemetryConfig;
}
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = parse(runtimeSchema, env);
  parsed.GITHUB_TOKEN ??= parsed.GITHUB_KEY;
  return { discordToken: parsed.DISCORD_TOKEN, databaseUrl: parsed.DATABASE_URL, healthPort: parsed.HEALTH_PORT,
    schedulerPaused: parsed.SCHEDULER_PAUSED, ownerIds: parsed.BOT_OWNER_IDS, env: Object.freeze(parsed), telemetry: telemetryConfig(parsed) };
}
export function readDatabaseConfig(env: NodeJS.ProcessEnv): { databaseUrl: string } {
  return { databaseUrl: parse(environmentSchema.pick({ DATABASE_URL: true }).extend({ DATABASE_URL: postgresUrl }), env).DATABASE_URL };
}
export function readDeployConfig(env: NodeJS.ProcessEnv): { discordToken: string; applicationId: string; testGuildId: string } {
  const parsed = parse(environmentSchema.pick({ DISCORD_TOKEN: true, DISCORD_APPLICATION_ID: true, DISCORD_TEST_GUILD_ID: true })
    .extend({ DISCORD_TOKEN: secret, DISCORD_APPLICATION_ID: snowflake, DISCORD_TEST_GUILD_ID: snowflake }), env);
  return { discordToken: parsed.DISCORD_TOKEN, applicationId: parsed.DISCORD_APPLICATION_ID, testGuildId: parsed.DISCORD_TEST_GUILD_ID };
}
export function readMysqlExportConfig(env: NodeJS.ProcessEnv): { sourceUrl: string; timezone: string } {
  const parsed = parse(environmentSchema.pick({ MYSQL_SOURCE_URL: true, MYSQL_SOURCE_TIMEZONE: true })
    .extend({ MYSQL_SOURCE_URL: mysqlUrl, MYSQL_SOURCE_TIMEZONE: mysqlTimezone }), env);
  return { sourceUrl: parsed.MYSQL_SOURCE_URL, timezone: parsed.MYSQL_SOURCE_TIMEZONE };
}
export function readTelemetryConfig(env: NodeJS.ProcessEnv): TelemetryConfig { return telemetryConfig(parse(telemetrySchema, env)); }
