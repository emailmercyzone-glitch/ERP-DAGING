import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyedLock } from './keyedLock.ts';

test('keyed lock serializes writes for the same store and permits independent stores', async () => {
  const acquire = createKeyedLock();
  const releaseA = await acquire('STORE-A');
  let sameStoreAcquired = false;
  const waitingB = acquire('STORE-A').then((release) => {
    sameStoreAcquired = true;
    return release;
  });
  const releaseOtherStore = await acquire('STORE-B');
  assert.equal(sameStoreAcquired, false, 'same-store write waits for the active lock');
  releaseOtherStore();
  releaseA();
  const releaseB = await waitingB;
  assert.equal(sameStoreAcquired, true);
  releaseB();
});

test('keyed lock release is idempotent and does not leave a key stuck', async () => {
  const acquire = createKeyedLock();
  const release = await acquire('STORE-A');
  release();
  release();
  const releaseAgain = await acquire('STORE-A');
  releaseAgain();
});
