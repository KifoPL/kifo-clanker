import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { startTelemetry, withSpan } from '../../src/observability.js';

test('OpenTelemetry exports custom command/query spans without exception text or user identifiers', async () => {
  const requests: Array<{ path: string | undefined; bytes: Buffer }> = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => { requests.push({ path: req.url, bytes: Buffer.concat(chunks) }); res.writeHead(200).end(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const oldEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${address.port}`;
  const stop = startTelemetry(process.env);
  try {
    await withSpan('discord.command', { command: 'ping', kind: 'slash' }, async () => {
      await withSpan('db.query', { operation: 'SELECT' }, async () => {});
    });
    await assert.rejects(withSpan('scheduler.job', { type: 'fixture' }, async () => { throw new Error('PRIVATE_CREDENTIAL_FIXTURE'); }));
    await stop();
    assert.ok(requests.some(request => request.path === '/v1/traces'));
    assert.ok(requests.some(request => request.path === '/v1/metrics'));
    const data = Buffer.concat(requests.map(request => request.bytes));
    assert.ok(data.includes(Buffer.from('discord.command')));
    assert.ok(data.includes(Buffer.from('db.query')));
    assert.equal(data.includes(Buffer.from('PRIVATE_CREDENTIAL_FIXTURE')), false);
  } finally {
    if (oldEndpoint === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = oldEndpoint;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
