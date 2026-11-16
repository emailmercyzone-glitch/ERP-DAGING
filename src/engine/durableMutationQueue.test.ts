import assert from 'node:assert/strict';
import test from 'node:test';
import { DurableMutationQueue } from './durableMutationQueue';

test('mutations calculate from latest committed state when submitted concurrently', async () => {
  let state = { count: 0, outbox: [] as string[] };
  const persisted: typeof state[] = [];
  const queue = new DurableMutationQueue(
    () => state,
    async (next) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      persisted.push(next);
      return true;
    },
    (next) => { state = next; },
  );

  const first = queue.run((current) => ({
    state: { ...current, count: current.count + 1, outbox: [...current.outbox, 'event-1'] },
    result: 'first',
  }));
  const second = queue.run((current) => ({
    state: { ...current, count: current.count + 1, outbox: [...current.outbox, 'event-2'] },
    result: 'second',
  }));

  assert.deepEqual(await Promise.all([first, second]), [
    { ok: true, result: 'first' },
    { ok: true, result: 'second' },
  ]);
  assert.equal(state.count, 2);
  assert.deepEqual(state.outbox, ['event-1', 'event-2']);
  assert.equal(persisted.length, 2);
  assert.equal(persisted[1].count, 2);
});

test('failed durable write does not publish state and later mutation can proceed', async () => {
  let state = { count: 0 };
  let attempts = 0;
  const queue = new DurableMutationQueue(
    () => state,
    async () => ++attempts > 1,
    (next) => { state = next; },
  );

  const failed = await queue.run((current) => ({ state: { count: current.count + 1 }, result: 'failed' }));
  assert.deepEqual(failed, { ok: false, reason: 'PERSISTENCE_FAILED' });
  assert.equal(state.count, 0);

  const succeeded = await queue.run((current) => ({ state: { count: current.count + 1 }, result: 'saved' }));
  assert.deepEqual(succeeded, { ok: true, result: 'saved' });
  assert.equal(state.count, 1);
});

test('outbox and business mutation are persisted in the same state snapshot', async () => {
  let state = { transactions: [] as string[], syncOutbox: [] as string[] };
  let durableSnapshot: typeof state | undefined;
  const queue = new DurableMutationQueue(
    () => state,
    async (next) => { durableSnapshot = structuredClone(next); return true; },
    (next) => { state = next; },
  );

  const result = await queue.run((current) => ({
    state: {
      transactions: [...current.transactions, 'TX-1'],
      syncOutbox: [...current.syncOutbox, 'EVENT-1'],
    },
    result: 'checkout',
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(durableSnapshot, { transactions: ['TX-1'], syncOutbox: ['EVENT-1'] });
  assert.deepEqual(state, durableSnapshot);
});


test('exclusive atomic restore blocks queued mutations until restore publishes', async () => {
  let state = { value: 'before', count: 0 };
  const queue = new DurableMutationQueue(
    () => state,
    async () => true,
    (next) => { state = next; },
  );

  const restore = queue.runExclusive(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    state = { value: 'restored', count: 10 };
    return 'restored';
  });
  const followingMutation = queue.run((current) => ({
    state: { ...current, count: current.count + 1 },
    result: 'mutation',
  }));

  assert.equal(await restore, 'restored');
  assert.deepEqual(await followingMutation, { ok: true, result: 'mutation' });
  assert.deepEqual(state, { value: 'restored', count: 11 });
});
