import { startApp } from './app.js';
import { readConfig } from './config.js';
import { logger } from './logger.js';

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
  try { close = await startApp(readConfig(process.env)); }
  catch (error) { logger.error('Startup failed; check configuration and database migrations', error); process.exitCode = 1; }
})();
