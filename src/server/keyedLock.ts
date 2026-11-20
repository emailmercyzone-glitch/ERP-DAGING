/** Small in-process keyed mutex for serializing writes to one internal store. */
export function createKeyedLock(): (key: string) => Promise<() => void> {
  const tails = new Map<string, Promise<void>>();

  return async (key: string): Promise<() => void> => {
    const previous = tails.get(key) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    tails.set(key, current);
    await previous;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseCurrent();
      if (tails.get(key) === current) tails.delete(key);
    };
  };
}
