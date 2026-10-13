import { startApp } from './app.js';
import { readConfig } from './config.js';
import { logger } from './logger.js';
import { startTelemetry } from './observability.js';

let close: (() => Promise<void>) | undefined;
let closing = false;
let startup: Promise<void>;
async function shutdown(exitCode: number): Promise<void> {
  process.exitCode = Math.max(process.exitCode ? Number(process.exitCode) : 0, exitCode);
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => {
    logger.error('Shutdown deadline exceeded');
    process.exit(1);
  }, 15_000);
  try { await startup; await close?.(); }
  catch (error) { logger.error('Shutdown failed', error); process.exit(1); }
  finally { clearTimeout(deadline); }
}
process.once('SIGTERM', () => { void shutdown(0); });
process.once('SIGINT', () => { void shutdown(0); });
process.on('uncaughtException', error => { logger.error('Fatal exception', error); void shutdown(1); });
process.on('unhandledRejection', error => { logger.error('Unhandled rejection', error); void shutdown(1); });
startup = (async () => {
  let stopTelemetry: (() => Promise<void>) | undefined;
  try {
    const config = readConfig(process.env);
    stopTelemetry = startTelemetry(process.env);
    const stopApp = await startApp(config);
    close = async () => { try { await stopApp(); } finally { await stopTelemetry?.(); } };
  } catch (error) {
    logger.error('Startup failed; check configuration and database migrations', error);
    await stopTelemetry?.();
    process.exitCode = 1;
  }
})();
