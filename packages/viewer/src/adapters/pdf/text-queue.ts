/** Runs text requests one at a time and only while no page is rendering, so a render never waits behind text. */
export class TextQueue {
  private readonly waiting = new Map<number, () => void>();
  private readonly controllers = new Map<number, AbortController>();
  private renders = 0;
  private current: number | null = null;

  async run<T>(id: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.controllers.set(id, controller);
    try {
      await new Promise<void>((resolve, reject) => {
        this.waiting.set(id, resolve);
        controller.signal.addEventListener('abort', () => {
          this.waiting.delete(id);
          reject(new Error('Text request cancelled'));
        });
        this.next();
      });
      return await task(controller.signal);
    } finally {
      this.controllers.delete(id);
      if (this.current === id) {
        this.current = null;
        this.next();
      }
    }
  }

  cancel(id: number): void {
    this.controllers.get(id)?.abort();
  }

  renderStarted(): void {
    this.renders++;
  }

  renderFinished(): void {
    this.renders--;
    this.next();
  }

  private next(): void {
    if (this.current !== null || this.renders > 0) return;
    const first = this.waiting.entries().next();
    if (first.done) return;
    const [id, start] = first.value;
    this.waiting.delete(id);
    this.current = id;
    start();
  }
}
