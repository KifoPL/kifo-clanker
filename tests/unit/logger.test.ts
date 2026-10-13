import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureLogSink, logger, type LogRecord } from '../../src/logger.js';

test('optional Discord relay receives sanitized errors and cannot prevent stdout logging', () => {
  const received: LogRecord[] = [];
  configureLogSink(record => received.push(record));
  try {
    logger.error('Provider request failed', new Error('PRIVATE_CREDENTIAL_FIXTURE'));
    assert.equal(received[0]?.error, 'Error');
    assert.ok(!JSON.stringify(received).includes('PRIVATE_CREDENTIAL_FIXTURE'));
    configureLogSink(() => { throw new Error('relay unavailable'); });
    assert.doesNotThrow(() => logger.info('stdout remains available'));
  } finally { configureLogSink(undefined); }
});
