/**
 * Serializes state mutations from calculation through durable IndexedDB commit.
 * The mutator is evaluated only after all earlier mutations have committed, so
 * it always receives the latest committed state rather than a stale render snapshot.
 */
export class DurableMutationQueue<T> {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private current: () => T,
    private persist: (next: T) => Promise<boolean>,
    private publish: (next: T) => void,
  ) {}

  run<R>(mutate: (current: T) => { state: T; result: R }): Promise<{ ok: true; result: R } | { ok: false; reason: 'PERSISTENCE_FAILED' }> {
    let resolveResult!: (value: { ok: true; result: R } | { ok: false; reason: 'PERSISTENCE_FAILED' }) => void;
    const result = new Promise<{ ok: true; result: R } | { ok: false; reason: 'PERSISTENCE_FAILED' }>((resolve) => {
      resolveResult = resolve;
    });

    const operation = this.tail.then(async () => {
      const current = this.current();
      const mutation = mutate(current);
      if (mutation.state === current) {
        resolveResult({ ok: true, result: mutation.result });
        return;
      }
      let saved = false;
      try {
        saved = await this.persist(mutation.state);
      } catch {
        saved = false;
      }
      if (!saved) {
        resolveResult({ ok: false, reason: 'PERSISTENCE_FAILED' });
        return;
      }
      this.publish(mutation.state);
      resolveResult({ ok: true, result: mutation.result });
    });

    this.tail = operation.catch(() => {
      resolveResult({ ok: false, reason: 'PERSISTENCE_FAILED' });
    });
    return result;
  }

  /**
   * Reserves the mutation lane for an operation that owns its persistence
   * transaction (for example a multi-store backup restore). The operation
   * must publish its committed state before resolving.
   */
  runExclusive<R>(operation: () => Promise<R>): Promise<R> {
    const queued = this.tail.then(operation);
    this.tail = queued.then(() => undefined, () => undefined);
    return queued;
  }

  idle(): Promise<void> {
    return this.tail;
  }
}
