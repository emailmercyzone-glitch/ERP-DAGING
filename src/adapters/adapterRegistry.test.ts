import test from 'node:test';
import assert from 'node:assert/strict';
import { backendSwitchRequiresMigration, executeOutboxSyncWithAdapter, normalizeBackendConfig } from './adapterRegistry.ts';
import type { BackendAdapter } from './backendAdapter.ts';
import { createSeededEngineState } from '../engine/businessEngine.ts';

test('legacy GAS endpoint and shared secret are scrubbed from browser adapter config', () => {
  const normalized = normalizeBackendConfig({
    adapterType: 'GOOGLE_SHEETS',
    storeId: 'STORE-ERP',
    endpointUrl: 'https://script.google.com/macros/s/private/exec',
    apiKeyOrToken: 'legacy-gas-shared-secret',
    updatedAt: new Date(0).toISOString(),
  });
  assert.equal(normalized.endpointUrl, '');
  assert.equal(normalized.apiKeyOrToken, '');
  assert.equal(normalized.storeId, 'STORE-ERP');
});

test('non-GAS adapter credentials remain available to their configured adapter', () => {
  const normalized = normalizeBackendConfig({
    adapterType: 'REST_API',
    storeId: 'STORE-ERP',
    endpointUrl: 'https://api.example.test',
    apiKeyOrToken: 'rest-token',
    updatedAt: new Date(0).toISOString(),
  });
  assert.equal(normalized.endpointUrl, 'https://api.example.test');
  assert.equal(normalized.apiKeyOrToken, 'rest-token');
});


test('sync network phase returns deltas without mutating or persisting a stale state snapshot', async () => {
  const item = {
    uuid: 'SYNC-DELTA-1',
    idempotencyKey: 'SYNC-DELTA-KEY-1',
    entityType: 'SALE' as const,
    createdAt: new Date(0).toISOString(),
    status: 'PENDING' as const,
    summary: 'Network delta test',
  };
  const state = { ...createSeededEngineState({ products: [], lots: [], customers: [], receivables: [], inboundPOs: [], supplierInvoices: [], categories: [] }), syncOutbox: [item], lastServerSeq: 0 };
  const adapter = {
    type: 'REST_API',
    displayName: 'Test REST',
    requiresNetwork: true,
    checkHealth: async () => ({ ok: true, adapterType: 'REST_API', latencyMs: 1, message: 'ok' }),
    pushOutbox: async () => ({
      ok: true, acknowledgedIds: [item.uuid], serverSeqs: { [item.uuid]: 3 }, failedItems: [], message: 'ACK',
    }),
    pullChanges: async () => ({ ok: true, records: [], lastServerSeq: 3, message: 'pull ok' }),
    parseVoiceOrder: async () => { throw new Error('unused'); },
  } as unknown as BackendAdapter;

  const result = await executeOutboxSyncWithAdapter(state, adapter);
  assert.equal(result.state, state);
  assert.equal(result.state.syncOutbox[0].status, 'PENDING');
  assert.deepEqual(result.result.acknowledgedIds, [item.uuid]);
  assert.equal(result.result.pulledLastServerSeq, 3);
});

test('backend switch ignores credential rotation but detects a different remote namespace', () => {
  const current = normalizeBackendConfig({ adapterType: 'REST_API', storeId: 'STORE-ERP', endpointUrl: 'https://old.example.test/api/', apiKeyOrToken: 'old-token' });
  const rotatedCredential = { ...current, apiKeyOrToken: 'new-token' };
  const differentTarget = { ...current, endpointUrl: 'https://new.example.test/api' };
  const emptyState = { lastServerSeq: 0, syncOutbox: [] };
  assert.equal(backendSwitchRequiresMigration(current, rotatedCredential, emptyState), false);
  assert.equal(backendSwitchRequiresMigration(current, differentTarget, emptyState), false);
});

test('backend switch requires migration when local state may contain remotely accepted events', () => {
  const current = normalizeBackendConfig({ adapterType: 'REST_API', storeId: 'STORE-ERP', endpointUrl: 'https://old.example.test/api' });
  const next = normalizeBackendConfig({ adapterType: 'SUPABASE', storeId: 'STORE-ERP', supabaseUrl: 'https://new-project.supabase.co', supabaseAnonKey: 'public-anon-key' });
  const syncedState = { lastServerSeq: 0, syncOutbox: [{ uuid: 'SYNCED-1', idempotencyKey: 'SYNCED-KEY-1', entityType: 'SALE' as const, createdAt: new Date(0).toISOString(), status: 'SYNCED' as const, summary: 'Already acknowledged' }] };
  const cursorState = { lastServerSeq: 12, syncOutbox: [] };
  assert.equal(backendSwitchRequiresMigration(current, next, syncedState), true);
  assert.equal(backendSwitchRequiresMigration(current, next, cursorState), true);
});

test('switching to local-only preserves local data and does not require remote migration', () => {
  const current = normalizeBackendConfig({ adapterType: 'REST_API', storeId: 'STORE-ERP', endpointUrl: 'https://old.example.test/api' });
  const localOnly = normalizeBackendConfig({ adapterType: 'LOCAL_ONLY' });
  const state = { lastServerSeq: 12, syncOutbox: [{ uuid: 'SYNCED-1', idempotencyKey: 'SYNCED-KEY-1', entityType: 'SALE' as const, createdAt: new Date(0).toISOString(), status: 'SYNCED' as const, summary: 'Already acknowledged' }] };
  assert.equal(backendSwitchRequiresMigration(current, localOnly, state), false);
});
