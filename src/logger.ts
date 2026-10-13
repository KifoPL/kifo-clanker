export interface LogRecord { level: 'info' | 'error'; time: string; message: string; error?: string }
let sink: ((record: LogRecord) => void) | undefined;
export function configureLogSink(callback: ((record: LogRecord) => void) | undefined): void { sink = callback; }
function relay(record: LogRecord): void {
  try { sink?.(record); } catch { /* stdout remains available if an optional relay fails */ }
}

// Only error classifications are logged: provider messages can contain credentials or user content.
export const logger = {
  info(message: string): void {
    const record: LogRecord = { level: 'info', time: new Date().toISOString(), message };
    console.log(JSON.stringify(record));
    relay(record);
  },
  error(message: string, error?: unknown): void {
    const record: LogRecord = {
      level: 'error', time: new Date().toISOString(), message,
      error: error instanceof Error ? error.name : 'UnknownError',
    };
    console.error(JSON.stringify(record));
    relay(record);
  },
};
