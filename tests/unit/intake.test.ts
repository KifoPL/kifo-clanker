import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventIntake } from '../../src/discord/intake.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test('intake orders same-channel events, allows other channels, and enforces capacity', async () => {
  const release = deferred();
  const started = deferred();
  const secondStarted = deferred();
  const order: string[] = [];
  const errors: unknown[] = [];
  const intake = new EventIntake(error => errors.push(error), 2, 3);
  assert.equal(intake.enqueue('a', async () => { order.push('a1'); started.resolve(); await release.promise; }), true);
  assert.equal(intake.enqueue('a', async () => { order.push('a2'); secondStarted.resolve(); }), true);
  assert.equal(intake.enqueue('b', async () => { order.push('b'); }), true);
  assert.equal(intake.enqueue('c', async () => {}), false);
  await started.promise;
  await Promise.resolve();
  assert.deepEqual(order, ['a1', 'b']);
  release.resolve();
  await secondStarted.promise;
  await intake.stop();
  assert.deepEqual(order, ['a1', 'b', 'a2']);
  assert.deepEqual(errors, []);
});

test('shutdown waits running work, drops unstarted work, and closes admission', async () => {
  const started = deferred();
  const release = deferred();
  let queuedRan = false;
  const intake = new EventIntake(() => {}, 1, 3);
  intake.enqueue('a', async () => { started.resolve(); await release.promise; });
  intake.enqueue('b', async () => { queuedRan = true; });
  await started.promise;
  let stopped = false;
  const stopping = intake.stop().then(() => { stopped = true; });
  assert.equal(intake.enqueue('c', async () => {}), false);
  await Promise.resolve();
  assert.equal(stopped, false);
  release.resolve();
  await stopping;
  assert.equal(queuedRan, false);
});

test('commands needing immediate acknowledgement are rejected rather than waiting behind active work', async () => {
  const release = deferred();
  const started = deferred();
  const intake = new EventIntake(() => {}, 1, 3);
  intake.enqueue('first', async () => { started.resolve(); await release.promise; });
  await started.promise;
  assert.equal(intake.enqueue('second', async () => {}, true), false);
  release.resolve();
  await intake.stop();
});

test('handler rejection is caught and frees the key for subsequent work', async () => {
  const errors: unknown[] = [];
  const second = deferred();
  const intake = new EventIntake(error => errors.push(error));
  intake.enqueue('a', async () => { throw new Error('fixture'); });
  intake.enqueue('a', async () => { second.resolve(); });
  await second.promise;
  await intake.stop();
  assert.equal(errors.length, 1);
});
