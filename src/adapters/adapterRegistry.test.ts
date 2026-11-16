import test from 'node:test';
import assert from 'node:assert/strict';
import { executeOutboxSyncWithAdapter, normalizeBackendConfig } from './adapterRegistry.ts';
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
