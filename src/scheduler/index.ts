import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { query } from '../db/query.js';

export interface ScheduledJob {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
}

// Handlers must honor cancellation and make external effects idempotent: leases give at-least-once delivery.
export type ScheduledHandler = (job: ScheduledJob, signal: AbortSignal) => Promise<void>;

interface Options {
  pool: Pool;
  handlers: Readonly<Record<string, ScheduledHandler>>;
  logger: { error(message: string, error?: unknown): void };
  pollIntervalMs?: number;
  batchSize?: number;
  leaseMs?: number;
  handlerTimeoutMs?: number;
}

interface ClaimedJob extends ScheduledJob {
  lease_token: string;
}

const claimSql = `
  WITH exhausted AS (
    UPDATE scheduled_jobs
    SET status = 'failed', lease_token = NULL, lease_until = NULL,
        completed_at = clock_timestamp(), last_error = 'Retry limit reached after lease expiry'
    WHERE id IN (
      SELECT id FROM scheduled_jobs
      WHERE type = ANY($1::text[]) AND attempts >= max_attempts
        AND ((status = 'running' AND lease_until <= clock_timestamp()) OR status = 'pending')
      ORDER BY run_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT $2
    )
  ), candidates AS (
    SELECT id FROM scheduled_jobs
    WHERE type = ANY($1::text[]) AND attempts < max_attempts
      AND ((status = 'pending' AND run_at <= clock_timestamp())
        OR (status = 'running' AND lease_until <= clock_timestamp()))
    ORDER BY run_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT $2
  )
  UPDATE scheduled_jobs AS jobs
  SET status = 'running', attempts = jobs.attempts + 1, lease_token = $3,
      lease_until = clock_timestamp() + $4 * interval '1 millisecond'
  FROM candidates WHERE jobs.id = candidates.id
  RETURNING jobs.id, jobs.type, jobs.payload, jobs.attempts, jobs.lease_token
`;

export class DurableScheduler {
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly leaseMs: number;
  private readonly handlerTimeoutMs: number;
  private readonly types: string[];
  private running = false;
  private loopPromise: Promise<void> | undefined;
  private wake: (() => void) | undefined;

  constructor(private readonly options: Options) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.batchSize = options.batchSize ?? 5;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.handlerTimeoutMs = options.handlerTimeoutMs ?? 30_000;
    this.types = Object.keys(options.handlers);
    for (const value of [this.pollIntervalMs, this.batchSize, this.leaseMs, this.handlerTimeoutMs]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Scheduler limits must be positive integers');
    }
    if (this.handlerTimeoutMs >= this.leaseMs) throw new Error('Handler timeout must be shorter than the lease');
  }

  start(): void {
    if (this.loopPromise) return;
    this.running = true;
    this.loopPromise = this.loop().finally(() => {
      this.running = false;
      this.loopPromise = undefined;
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wake?.();
    await this.loopPromise;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        if (this.types.length > 0) {
          const result = await query<ClaimedJob>(this.options.pool, claimSql,
            [this.types, this.batchSize, randomUUID(), this.leaseMs]);
          // Start the bounded batch together so waiting jobs do not consume their leases.
          await Promise.all(result.rows.map((job) => this.execute(job)));
        }
      } catch (error) {
        this.options.logger.error('Scheduled job polling failed', error);
      }
      if (this.running) await this.pause();
    }
  }

  private pause(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wake = undefined;
        resolve();
      }, this.pollIntervalMs);
      this.wake = () => {
        clearTimeout(timer);
        this.wake = undefined;
        resolve();
      };
    });
  }

  private async execute(job: ClaimedJob): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Scheduled handler timed out')), this.handlerTimeoutMs);
    let failed = false;
    try {
      await this.options.handlers[job.type]!(job, controller.signal);
      failed = controller.signal.aborted;
    } catch {
      failed = true;
    } finally {
      clearTimeout(timer);
    }

    try {
      if (failed) {
        await query(this.options.pool, `
          UPDATE scheduled_jobs
          SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
              run_at = clock_timestamp() + $3 * interval '1 millisecond',
              completed_at = CASE WHEN attempts >= max_attempts THEN clock_timestamp() ELSE NULL END,
              lease_token = NULL, lease_until = NULL, last_error = $4
          WHERE id = $1 AND lease_token = $2 AND status = 'running' AND lease_until > clock_timestamp()
        `, [job.id, job.lease_token, Math.min(60_000, 1_000 * 2 ** Math.min(job.attempts - 1, 6)),
          controller.signal.aborted ? 'Scheduled handler timed out' : 'Scheduled handler failed']);
      } else {
        await query(this.options.pool, `
          UPDATE scheduled_jobs
          SET status = 'completed', completed_at = clock_timestamp(),
              lease_token = NULL, lease_until = NULL, last_error = NULL
          WHERE id = $1 AND lease_token = $2 AND status = 'running' AND lease_until > clock_timestamp()
        `, [job.id, job.lease_token]);
      }
    } catch (error) {
      this.options.logger.error('Scheduled job completion failed', error);
    }
  }
}
