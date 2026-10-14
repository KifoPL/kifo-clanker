import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { DurableScheduler, PermanentJobError, type ScheduledHandler } from '../../src/scheduler/index.js';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const job = (id: string) => ({ id, type: 'reminder', payload: {}, attempts: 1, lease_token: 'lease-token' });

function scheduler(
  handler: ScheduledHandler,
  runQuery: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>,
  limits: { handlerTimeoutMs?: number; leaseMs?: number } = {},
) {
  return new DurableScheduler({
    pool: { query: runQuery } as unknown as Pool,
    handlers: { reminder: handler },
    logger: { error() {} },
    pollIntervalMs: 1,
    ...limits,
  });
}

test('empty handler registry leaves legacy scheduled jobs untouched', async () => {
  let calls = 0;
  const instance = new DurableScheduler({
    pool: { async query() { calls++; return { rows: [] }; } } as unknown as Pool,
    handlers: {}, logger: { error() {} },
  });
  instance.start();
  await instance.stop();
  assert.equal(calls, 0);
});

test('start is idempotent and stop drains the active batch without overlapping polls', async () => {
  const entered = deferred();
  const release = deferred();
  let claims = 0;
  let completion = 0;
  const instance = scheduler(async () => { entered.resolve(); await release.promise; }, async (sql) => {
    if (sql.includes('WITH exhausted')) { claims++; return { rows: [job('1')] }; }
    completion++;
    return { rows: [] };
  });
  instance.start();
  instance.start();
  await entered.promise;
  let stopped = false;
  const stopping = instance.stop().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  assert.equal(claims, 1);
  release.resolve();
  await stopping;
  assert.equal(completion, 1);
  assert.equal(claims, 1);
});

test('each job in a claimed batch settles independently and uses its lease token', async () => {
  const entered = deferred();
  const release = deferred();
  const settlements: Array<{ sql: string; values: unknown[] }> = [];
  const completed = deferred();
  let started = 0;
  const instance = scheduler(async (current) => {
    if (++started === 2) entered.resolve();
    await release.promise;
    if (current.id === '1') throw new Error('External API failed');
  }, async (sql, values) => {
    if (sql.includes('WITH exhausted')) return { rows: [job('1'), job('2')] };
    settlements.push({ sql, values });
    if (settlements.length === 2) completed.resolve();
    return { rows: [] };
  });
  instance.start();
  await entered.promise;
  release.resolve();
  await completed.promise;
  await instance.stop();
  assert.equal(settlements.length, 2);
  const retry = settlements.find((item) => item.values[0] === '1')!;
  const completion = settlements.find((item) => item.values[0] === '2')!;
  assert.match(retry.sql, /attempts >= max_attempts/);
  assert.match(completion.sql, /status = 'completed'/);
  for (const item of settlements) {
    assert.equal(item.values[1], 'lease-token');
    assert.match(item.sql, /lease_token = \$2/);
    assert.match(item.sql, /lease_until > clock_timestamp\(\)/);
  }
});

test('timeout cancels the handler but drainage waits for actual settlement', async () => {
  const aborted = deferred();
  const release = deferred();
  let settlements = 0;
  let retryMessage: unknown;
  const instance = scheduler(async (_job, signal) => {
    signal.addEventListener('abort', () => aborted.resolve(), { once: true });
    await release.promise;
  }, async (sql, values) => {
    if (sql.includes('WITH exhausted')) return { rows: [job('1')] };
    settlements++;
    retryMessage = values[3];
    return { rows: [] };
  }, { handlerTimeoutMs: 10, leaseMs: 1_000 });
  instance.start();
  await aborted.promise;
  const stopping = instance.stop();
  assert.equal(settlements, 0);
  release.resolve();
  await stopping;
  assert.equal(settlements, 1);
  assert.equal(retryMessage, 'Scheduled handler timed out');
});

test('poll failures recover without creating a second scheduler loop', async () => {
  const recovered = deferred();
  let claims = 0;
  const instance = scheduler(async () => {}, async () => {
    if (++claims === 1) throw new Error('Database unavailable');
    recovered.resolve();
    return { rows: [] };
  });
  instance.start();
  await recovered.promise;
  await instance.stop();
  assert.equal(claims, 2);
});

test('handler timeout must fit inside a positive lease', () => {
  assert.throws(() => scheduler(async () => {}, async () => ({ rows: [] }), {
    leaseMs: 10, handlerTimeoutMs: 10,
  }), /shorter than the lease/);
  assert.throws(() => scheduler(async () => {}, async () => ({ rows: [] }), {
    leaseMs: -1,
  }), /positive integers/);
});

test('a cancelled handler stays leased until its underlying work settles', async () => {
  const renewed = deferred();
  const release = deferred();
  let renewals = 0;
  let settlements = 0;
  let signal: AbortSignal | undefined;
  const instance = scheduler(async (_job, cancellation) => {
    signal = cancellation;
    await release.promise;
  }, async (sql) => {
    if (sql.includes('WITH exhausted')) return { rows: [job('1')] };
    if (sql.includes('SET lease_until')) {
      if (++renewals >= 3) renewed.resolve();
      return { rows: [], rowCount: 1 };
    }
    settlements++;
    return { rows: [] };
  }, { handlerTimeoutMs: 40, leaseMs: 90 });
  instance.start();
  await renewed.promise;
  assert.equal(signal?.aborted, true);
  assert.equal(settlements, 0);
  const stopping = instance.stop();
  release.resolve();
  await stopping;
  assert.equal(settlements, 1);
});

test('PermanentJobError writes a terminal failure without exhausting retries', async () => {
  const finished = deferred();
  let permanent: unknown;
  const instance = scheduler(async () => { throw new PermanentJobError('Deleted resource'); }, async (sql, values) => {
    if (sql.includes('WITH exhausted')) return { rows: [job('1')] };
    permanent = values[4];
    finished.resolve();
    return { rows: [{ status: 'failed' }], rowCount: 1 };
  });
  instance.start();
  await finished.promise;
  await instance.stop();
  assert.equal(permanent, true);
});

test('onTick shares the scheduler loop even with no registered durable handlers', async () => {
  const ticked = deferred();
  let claims = 0;
  const instance = new DurableScheduler({
    pool: { async query() { claims++; return { rows: [] }; } } as unknown as Pool,
    handlers: {}, logger: { error() {} },
    onTick: async () => { ticked.resolve(); },
  });
  instance.start();
  await ticked.promise;
  await instance.stop();
  assert.equal(claims, 0);
});

test('stop during a claim releases its jobs without starting handlers', async () => {
  const claiming = deferred();
  const claimed = deferred<{ rows: unknown[] }>();
  let executed = 0;
  let released = false;
  const instance = scheduler(async () => { executed++; }, async sql => {
    if (sql.includes('WITH exhausted')) { claiming.resolve(); return claimed.promise; }
    released = true;
    return { rows: [] };
  });
  instance.start();
  await claiming.promise;
  const stopping = instance.stop();
  claimed.resolve({ rows: [job('1')] });
  await stopping;
  assert.equal(executed, 0);
  assert.equal(released, true);
});

test('maintenance failure cannot prevent durable jobs from being polled', { timeout: 1_000 }, async context => {
  const polled = deferred();
  let warnings = 0;
  const instance = new DurableScheduler({
    pool: { async query() { polled.resolve(); return { rows: [] }; } } as unknown as Pool,
    handlers: { reminder: async () => {} },
    logger: { error() { warnings++; } },
    onTick: async () => { throw new Error('Maintenance unavailable'); },
  });
  context.after(() => instance.stop());
  instance.start();
  await polled.promise;
  await instance.stop();
  assert.equal(warnings, 1);
});
