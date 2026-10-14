import { metrics, trace, SpanStatusCode, type Attributes } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { TelemetryConfig } from './config.js';
import type { Pool } from 'pg';

const tracer = trace.getTracer('kifo-clanker');
function createInstruments() {
  const meter = metrics.getMeter('kifo-clanker');
  return {
    meter,
    duration: meter.createHistogram('bot.operation.duration', { unit: 'ms' }),
    operations: meter.createCounter('bot.operations'),
    jobOutcomes: meter.createCounter('bot.jobs.outcomes'),
    droppedEvents: meter.createCounter('bot.events.dropped'),
    scheduledLag: meter.createHistogram('bot.jobs.lag', { unit: 'ms' }),
  };
}
let instruments: ReturnType<typeof createInstruments> | undefined;
const getInstruments = () => instruments ??= createInstruments();

export function recordScheduledLag(milliseconds: number): void { getInstruments().scheduledLag.record(milliseconds); }

export function recordDroppedEvent(kind: string): void { getInstruments().droppedEvents.add(1, { kind }); }

export function recordScheduledOutcome(outcome: 'completed' | 'retry' | 'failed'): void {
  getInstruments().jobOutcomes.add(1, { outcome });
}

export async function withSpan<T>(name: string, attributes: Attributes, work: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async span => {
    const started = performance.now();
    let outcome = 'success';
    try { return await work(); }
    catch (error) {
      outcome = 'failure';
      // Exception messages can contain credentials or Discord message text.
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      const labels = { operation: name, ...attributes, outcome };
      getInstruments().duration.record(performance.now() - started, labels);
      getInstruments().operations.add(1, labels);
      span.end();
    }
  });
}

export function startTelemetry(config: TelemetryConfig): () => Promise<void> {
  if (!config.traces && !config.metrics) return async () => {};
  const metricReader = config.metrics ? new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(config.metrics), exportIntervalMillis: 10_000 }) : undefined;
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': config.serviceName }),
    autoDetectResources: false,
    logRecordProcessors: [],
    ...(config.traces ? { traceExporter: new OTLPTraceExporter(config.traces) } : { spanProcessors: [] }),
    metricReaders: metricReader ? [metricReader] : [],
  });
  sdk.start();
  // Meters obtained before SDK registration are permanent no-ops; create instruments after startup.
  instruments = undefined;
  return async () => { try { await metricReader?.forceFlush(); } finally { await sdk.shutdown(); } };
}

export function observeRuntime(pool: Pool): () => void {
  const meter = getInstruments().meter;
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  const poolGauge = meter.createObservableGauge('bot.db.pool.connections');
  const poolCallback: Parameters<typeof poolGauge.addCallback>[0] = result => {
    result.observe(pool.totalCount - pool.idleCount, { state: 'active' });
    result.observe(pool.idleCount, { state: 'idle' });
    result.observe(pool.waitingCount, { state: 'waiting' });
  };
  poolGauge.addCallback(poolCallback);
  const runtimeGauge = meter.createObservableGauge('bot.runtime');
  const runtimeCallback: Parameters<typeof runtimeGauge.addCallback>[0] = result => {
    result.observe(process.memoryUsage().rss, { measure: 'rss_bytes' });
    result.observe(process.memoryUsage().heapUsed, { measure: 'heap_bytes' });
    result.observe(delay.max / 1_000_000, { measure: 'event_loop_delay_ms' });
    delay.reset();
  };
  runtimeGauge.addCallback(runtimeCallback);
  return () => {
    delay.disable();
    poolGauge.removeCallback(poolCallback);
    runtimeGauge.removeCallback(runtimeCallback);
  };
}
