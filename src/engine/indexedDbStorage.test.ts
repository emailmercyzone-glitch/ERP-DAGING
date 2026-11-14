import assert from 'node:assert/strict';
import test from 'node:test';
import { getIndexedDbUpgradePlan } from './indexedDbStorage';

test('IndexedDB v2 to v3 creates backup metadata stores without replacing existing stores', () => {
  const plan = getIndexedDbUpgradePlan(2, ['kv_state', 'preferences', 'media_blobs']);
  assert.deepEqual(plan.createStores, ['migration_backups', 'migration_meta']);
  assert.equal(plan.backupLegacyState, true);
});

test('fresh IndexedDB creates all required stores without attempting a legacy backup', () => {
  const plan = getIndexedDbUpgradePlan(0, []);
  assert.deepEqual(plan.createStores, [
    'kv_state', 'preferences', 'media_blobs', 'migration_backups', 'migration_meta',
  ]);
  assert.equal(plan.backupLegacyState, false);
});

test('opening an already migrated database does not recreate or back up stores', () => {
  const stores = ['kv_state', 'preferences', 'media_blobs', 'migration_backups', 'migration_meta'];
  const plan = getIndexedDbUpgradePlan(3, stores);
  assert.deepEqual(plan.createStores, []);
  assert.equal(plan.backupLegacyState, false);
});
