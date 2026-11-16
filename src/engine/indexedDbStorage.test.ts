import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndexedDbUpgradePlan } from './indexedDbStorage';

test('IndexedDB v2 to v4 creates backup metadata stores without replacing existing stores', () => {
  const plan = getIndexedDbUpgradePlan(2, ['kv_state', 'preferences', 'media_blobs']);
  assert.deepEqual(plan.createStores, ['migration_backups', 'migration_meta', 'restore_safety_snapshots']);
  assert.equal(plan.backupLegacyState, true);
});

test('fresh IndexedDB creates all required stores without attempting a legacy backup', () => {
  const plan = getIndexedDbUpgradePlan(0, []);
  assert.deepEqual(plan.createStores, [
    'kv_state', 'preferences', 'media_blobs', 'migration_backups', 'migration_meta', 'restore_safety_snapshots',
  ]);
  assert.equal(plan.backupLegacyState, false);
});

test('upgrading v3 creates only the restore safety snapshot store', () => {
  const stores = ['kv_state', 'preferences', 'media_blobs', 'migration_backups', 'migration_meta'];
  const plan = getIndexedDbUpgradePlan(3, stores);
  assert.deepEqual(plan.createStores, ['restore_safety_snapshots']);
  assert.equal(plan.backupLegacyState, false);
});

test('opening v4 does not recreate stores or rerun migrations', () => {
  const stores = ['kv_state', 'preferences', 'media_blobs', 'migration_backups', 'migration_meta', 'restore_safety_snapshots'];
  const plan = getIndexedDbUpgradePlan(4, stores);
  assert.deepEqual(plan.createStores, []);
  assert.equal(plan.backupLegacyState, false);
});


test('persistent storage request reports granted when browser storage is already persistent', async () => {
  const { idbRequestPersistentStorage } = await import('./indexedDbStorage');
  const result = await idbRequestPersistentStorage({
    persisted: async () => true,
    persist: async () => false,
  });
  assert.equal(result, true);
});

test('persistent storage request asks for persistence when not already granted', async () => {
  const { idbRequestPersistentStorage } = await import('./indexedDbStorage');
  let requested = false;
  const result = await idbRequestPersistentStorage({
    persisted: async () => false,
    persist: async () => { requested = true; return true; },
  });
  assert.equal(requested, true);
  assert.equal(result, true);
});

test('persistent storage request fails safely when browser API is unavailable', async () => {
  const { idbRequestPersistentStorage } = await import('./indexedDbStorage');
  assert.equal(await idbRequestPersistentStorage({} as StorageManager), null);
  assert.equal(await idbRequestPersistentStorage({
    persisted: async () => { throw new Error('denied'); },
    persist: async () => true,
  }), false);
});
