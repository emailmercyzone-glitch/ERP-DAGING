/**
 * Prevents overlapping sync cycles. Acquire synchronously before the first
 * network await and always release from a finally block.
 */
export function createSyncLock() {
  let locked = false;
  return {
    tryAcquire(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    release(): void {
      locked = false;
    },
    get isLocked(): boolean {
      return locked;
    },
  };
}
