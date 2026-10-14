export class EventIntake {
  private accepting = true;
  private active = 0;
  private readonly keys = new Set<string>();
  private readonly queued: Array<{ key: string; work: () => Promise<void> }> = [];
  private readonly drained: Array<() => void> = [];

  constructor(private readonly onError: (error: unknown) => void, private readonly concurrency = 16, private readonly capacity = 256) {}

  enqueue(key: string, work: () => Promise<void>, requireImmediate = false): boolean {
    if (!this.accepting || this.active + this.queued.length >= this.capacity) return false;
    if (requireImmediate && (this.active >= this.concurrency || this.keys.has(key))) return false;
    this.queued.push({ key, work });
    this.pump();
    return true;
  }

  private pump(): void {
    while (this.active < this.concurrency) {
      const index = this.queued.findIndex(task => !this.keys.has(task.key));
      if (index < 0) break;
      const task = this.queued.splice(index, 1)[0]!;
      this.keys.add(task.key);
      this.active++;
      void Promise.resolve().then(() => this.accepting ? task.work() : undefined).catch(this.onError).finally(() => {
        this.keys.delete(task.key);
        this.active--;
        this.pump();
        if (this.active === 0 && this.queued.length === 0) for (const resolve of this.drained.splice(0)) resolve();
      });
    }
  }

  async stop(): Promise<void> {
    this.accepting = false;
    this.queued.splice(0);
    if (this.active || this.queued.length) await new Promise<void>(resolve => this.drained.push(resolve));
  }
}
