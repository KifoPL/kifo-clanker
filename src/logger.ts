// Only error classifications are logged: provider messages can contain credentials or user content.
export const logger = {
  info(message: string): void {
    console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), message }));
  },
  error(message: string, error?: unknown): void {
    console.error(JSON.stringify({
      level: 'error', time: new Date().toISOString(), message,
      error: error instanceof Error ? error.name : 'UnknownError',
    }));
  },
};
