import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncLock } from './syncProtocol.ts';
import { validatePullChangesEnvelope } from './backendAdapter.ts';

test('sync lock prevents a second overlapping sync cycle until released', () => {
  const lock = createSyncLock();
  assert.equal(lock.isLocked, false);
  assert.equal(lock.tryAcquire(), true);
  assert.equal(lock.isLocked, true);
  assert.equal(lock.tryAcquire(), false);
  lock.release();
  assert.equal(lock.isLocked, false);
  assert.equal(lock.tryAcquire(), true);
  lock.release();
});

test('pull envelope normalizes canonical event fields and preserves a valid cursor', () => {
  const result = validatePullChangesEnvelope({
    records: [{
      server_seq: 8,
      queue_id: 'REMOTE-8',
      idempotency_key: 'KEY-8',
      entity_type: 'SALE',
      payload: { invoiceNumber: 'INV-8' },
    }],
    last_server_seq: 10,
  }, 7, 'Test');
  assert.equal(result.ok, true);
  assert.equal(result.lastServerSeq, 10);
  assert.equal(result.records[0].serverSeq, 8);
  assert.equal(result.records[0].uuid, 'REMOTE-8');
  assert.equal(result.records[0].idempotencyKey, 'KEY-8');
  assert.equal(result.records[0].entityType, 'SALE');
});

test('pull envelope fails closed for missing records or an unsafe cursor', () => {
  assert.equal(validatePullChangesEnvelope({ lastServerSeq: 100 }, 5, 'Test').ok, false);
  assert.equal(validatePullChangesEnvelope({ records: [], lastServerSeq: 5.5 }, 5, 'Test').ok, false);
  assert.equal(validatePullChangesEnvelope({ records: [], lastServerSeq: 4 }, 5, 'Test').ok, false);
});

test('pull envelope rejects duplicate, unordered, or out-of-range event sequences', () => {
  const duplicate = validatePullChangesEnvelope({
    records: [{ serverSeq: 6 }, { serverSeq: 6 }],
    lastServerSeq: 6,
  }, 5, 'Test');
  const unordered = validatePullChangesEnvelope({
    records: [{ serverSeq: 7 }, { serverSeq: 6 }],
    lastServerSeq: 7,
  }, 5, 'Test');
  const beyondCursor = validatePullChangesEnvelope({
    records: [{ serverSeq: 8 }],
    lastServerSeq: 7,
  }, 5, 'Test');
  assert.equal(duplicate.ok, false);
  assert.equal(unordered.ok, false);
  assert.equal(beyondCursor.ok, false);
});
