import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig, readDatabaseConfig, readDeployConfig, readMysqlExportConfig, readTelemetryConfig } from '../../src/config.js';

const botEnv = { DISCORD_TOKEN: 'fixture-token', DATABASE_URL: 'postgresql://localhost/clanker' };
test('runtime configuration normalizes optional blank values and supplies typed defaults', () => {
  const config = readConfig({ ...botEnv, HEALTH_PORT: '', SCHEDULER_PAUSED: '', LANGUAGE_DETECT_KEY: ' ', BOT_OWNER_IDS: '' });
  assert.equal(config.healthPort, 8080);
  assert.equal(config.schedulerPaused, false);
  assert.deepEqual(config.ownerIds, []);
  assert.equal(config.env.LANGUAGE_DETECT_KEY, undefined);
  assert.equal(config.env.JOKE_API_URL, 'https://www.yomomma.info/');
  assert.deepEqual(config.telemetry, { serviceName: 'kifo-clanker', traces: undefined, metrics: undefined });
  assert.equal(Object.isFrozen(config.env), true);
});
test('runtime validates booleans, integer port bounds and PostgreSQL URLs', () => {
  for (const value of ['TRUE', '1', 'yes']) assert.throws(() => readConfig({ ...botEnv, SCHEDULER_PAUSED: value }), /SCHEDULER_PAUSED/);
  assert.equal(readConfig({ ...botEnv, SCHEDULER_PAUSED: 'true' }).schedulerPaused, true);
  for (const value of ['0', '65536', '3.5', 'Infinity', '-1', '1e3']) assert.throws(() => readConfig({ ...botEnv, HEALTH_PORT: value }), /HEALTH_PORT/);
  for (const value of ['bad', 'https://localhost/db', 'postgresql:///db', 'postgresql://localhost:999999/db']) assert.throws(() => readDatabaseConfig({ DATABASE_URL: value }), /DATABASE_URL/);
});
test('scope readers require only their entry point settings', () => {
  assert.deepEqual(readDatabaseConfig({ DATABASE_URL: botEnv.DATABASE_URL, BOT_OWNER_IDS: 'invalid', DISCORD_TOKEN: '' }), { databaseUrl: botEnv.DATABASE_URL });
  assert.throws(() => readDatabaseConfig({ DISCORD_TOKEN: 'fixture' }), /DATABASE_URL/);
  const deploy = { DISCORD_TOKEN: 'fixture', DISCORD_APPLICATION_ID: '123456789012345678', DISCORD_TEST_GUILD_ID: '234567890123456789' };
  assert.deepEqual(readDeployConfig({ ...deploy, DATABASE_URL: 'invalid' }), { discordToken: 'fixture', applicationId: deploy.DISCORD_APPLICATION_ID, testGuildId: deploy.DISCORD_TEST_GUILD_ID });
  assert.throws(() => readDeployConfig({ DISCORD_TOKEN: 'fixture' }), /DISCORD_APPLICATION_ID.*DISCORD_TEST_GUILD_ID/);
  assert.throws(() => readDeployConfig({ ...deploy, DISCORD_APPLICATION_ID: '123' }), /DISCORD_APPLICATION_ID/);
  assert.equal(readMysqlExportConfig({ MYSQL_SOURCE_URL: 'mysql://reader:secret@localhost/legacy', MYSQL_SOURCE_TIMEZONE: 'Z', DISCORD_TOKEN: '' }).timezone, '+00:00');
});
test('owner and log snowflakes are checked and owner IDs are trimmed and deduplicated', () => {
  assert.deepEqual(readConfig({ ...botEnv, BOT_OWNER_IDS: '123456789012345678, 234567890123456789,123456789012345678' }).ownerIds, ['123456789012345678', '234567890123456789']);
  for (const value of ['abc', '123', '123456789012345678,', '123456789012345678,2']) assert.throws(() => readConfig({ ...botEnv, BOT_OWNER_IDS: value }), /BOT_OWNER_IDS/);
  assert.throws(() => readConfig({ ...botEnv, DISCORD_LOG_CHANNEL_ID: 'invalid' }), /DISCORD_LOG_CHANNEL_ID/);
});
test('provider configuration accepts legacy GitHub alias and validates repository, credentials and HTTPS joke URLs', () => {
  assert.equal(readConfig({ ...botEnv, GITHUB_KEY: 'legacy-key', GITHUB_TOKEN: '' }).env.GITHUB_TOKEN, 'legacy-key');
  assert.equal(readConfig({ ...botEnv, GITHUB_KEY: 'legacy-key', GITHUB_TOKEN: 'new-key' }).env.GITHUB_TOKEN, 'new-key');
  for (const value of ['../repository', 'owner/../repository', 'owner', 'https://github.com/owner/repo']) assert.throws(() => readConfig({ ...botEnv, GITHUB_REPOSITORY: value }), /GITHUB_REPOSITORY/);
  assert.throws(() => readConfig({ ...botEnv, LANGUAGE_DETECT_KEY: 'key\nother' }), /LANGUAGE_DETECT_KEY/);
  for (const value of ['http://provider.example/jokes', 'https://key:secret@provider.example/', 'invalid']) assert.throws(() => readConfig({ ...botEnv, JOKE_API_URL: value }), /JOKE_API_URL/);
});
test('credentials reject ASCII controls and DEL without revealing their values', () => {
  for (const control of ['\u0001', '\u001f', '\u007f']) {
    for (const field of ['DISCORD_TOKEN', 'GITHUB_TOKEN', 'LANGUAGE_DETECT_KEY']) {
      assert.throws(() => readConfig({ ...botEnv, [field]: `PRIVATE_SECRET${control}suffix` }),
        error => error instanceof Error && error.message.includes(field) && !error.message.includes('PRIVATE_SECRET'));
    }
  }
});
test('telemetry supports base URLs, signal overrides, encoded headers and positive timeouts', () => {
  const config = readTelemetryConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector.example/otel/', OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer%20fixture,x-custom=value', OTEL_EXPORTER_OTLP_TIMEOUT: '3000', OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://127.0.0.1:4318/custom/traces', OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: '5000', OTEL_SERVICE_NAME: 'fixture-bot', OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf' });
  assert.equal(config.serviceName, 'fixture-bot');
  assert.deepEqual(config.traces, { url: 'http://127.0.0.1:4318/custom/traces', headers: { Authorization: 'Bearer fixture', 'x-custom': 'value' }, timeoutMillis: 5000 });
  assert.deepEqual(config.metrics, { url: 'https://collector.example/otel/v1/metrics', headers: { Authorization: 'Bearer fixture', 'x-custom': 'value' }, timeoutMillis: 3000 });
  assert.equal(readTelemetryConfig({ OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'http://localhost:4318/v1/metrics' }).traces, undefined);
});
test('malformed telemetry config fails before exporters initialize and error messages never reveal values', () => {
  for (const env of [
    { OTEL_EXPORTER_OTLP_ENDPOINT: 'grpc://collector.example' },
    { OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://user:PRIVATE_SECRET@collector.example' },
    { OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc' },
    { OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: 'http/json' },
    { OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: '-1' },
    { OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer%0D%0APRIVATE_SECRET' },
    { OTEL_EXPORTER_OTLP_HEADERS: 'missing-equals' },
  ]) assert.throws(() => readTelemetryConfig(env), error => error instanceof Error && /OTEL_/.test(error.message) && !error.message.includes('PRIVATE_SECRET'));
  assert.throws(() => readDatabaseConfig({ DATABASE_URL: 'https://user:PRIVATE_SECRET@host.example' }), error => error instanceof Error && !error.message.includes('PRIVATE_SECRET'));
});
test('OTLP headers reject controls and characters unsupported by Node HTTP without revealing values', () => {
  for (const invalid of ['\u0001', '\u001f', '\u007f', '\u0100']) {
    for (const field of ['OTEL_EXPORTER_OTLP_HEADERS', 'OTEL_EXPORTER_OTLP_TRACES_HEADERS', 'OTEL_EXPORTER_OTLP_METRICS_HEADERS']) {
      assert.throws(() => readTelemetryConfig({ [field]: `Authorization=${encodeURIComponent(`PRIVATE_SECRET${invalid}`)}` }),
        error => error instanceof Error && error.message.includes(field) && !error.message.includes('PRIVATE_SECRET'));
    }
  }
});

test('startup registration guild/channel overrides are optional validated runtime snowflakes', () => {
  const guild = '822800862581751848'; const channel = '828100819730956348';
  const configured = readConfig({ ...botEnv, DISCORD_TEST_GUILD_ID: guild, DISCORD_DEPLOY_CHANNEL_ID: channel });
  assert.equal(configured.env.DISCORD_TEST_GUILD_ID, guild);
  assert.equal(configured.env.DISCORD_DEPLOY_CHANNEL_ID, channel);
  const defaults = readConfig({ ...botEnv, DISCORD_TEST_GUILD_ID: ' ', DISCORD_DEPLOY_CHANNEL_ID: '' });
  assert.equal(defaults.env.DISCORD_TEST_GUILD_ID, undefined);
  assert.equal(defaults.env.DISCORD_DEPLOY_CHANNEL_ID, undefined);
  for (const field of ['DISCORD_TEST_GUILD_ID', 'DISCORD_DEPLOY_CHANNEL_ID']) {
    for (const invalid of ['123', 'not-a-channel', '-822800862581751848', '123456789012345678901']) {
      assert.throws(() => readConfig({ ...botEnv, [field]: invalid }), error => error instanceof Error && error.message.includes(field));
    }
  }
});
