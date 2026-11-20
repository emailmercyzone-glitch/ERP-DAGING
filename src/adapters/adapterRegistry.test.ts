import test from 'node:test';
import assert from 'node:assert/strict';
import { backendSwitchRequiresMigration, executeOutboxSyncWithAdapter, normalizeBackendConfig } from './adapterRegistry.ts';
import type { BackendAdapter } from './backendAdapter.ts';
import { applyOutboxSyncResults, applyPulledSyncRecords, createSeededEngineState } from '../engine/businessEngine.ts';

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
  assert.equal(backendSwitchRequiresMigration(current, differentTarget, emptyState), true);
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

test('backend namespace identity preserves case-sensitive endpoint paths', () => {
  const current = normalizeBackendConfig({ adapterType: 'REST_API', storeId: 'STORE-ERP', endpointUrl: 'https://api.example.test/ERP' });
  const differentPathCase = { ...current, endpointUrl: 'https://api.example.test/erp' };
  assert.equal(backendSwitchRequiresMigration(current, differentPathCase, { lastServerSeq: 0, syncOutbox: [] }), true);
});


test('Outbox sync sends long offline queues in ordered batches of at most 200', async () => {
  const items = Array.from({ length: 450 }, (_, index) => ({
    uuid: `BATCH-${index + 1}`,
    idempotencyKey: `BATCH-KEY-${index + 1}`,
    entityType: 'SALE' as const,
    createdAt: new Date(index).toISOString(),
    status: 'PENDING' as const,
    summary: `Batch event ${index + 1}`,
  }));
  const state = {
    ...createSeededEngineState({ products: [], lots: [], customers: [], receivables: [], inboundPOs: [], supplierInvoices: [], categories: [] }),
    syncOutbox: items,
    lastServerSeq: 0,
  };
  const batchSizes: number[] = [];
  const sentIds: string[] = [];
  let nextSeq = 1;
  const adapter = {
    type: 'REST_API', displayName: 'Test REST', requiresNetwork: true,
    checkHealth: async () => ({ ok: true, adapterType: 'REST_API', latencyMs: 1, message: 'ok' }),
    pushOutbox: async (batch: typeof items) => {
      batchSizes.push(batch.length);
      sentIds.push(...batch.map((item) => item.uuid));
      const serverSeqs = Object.fromEntries(batch.map((item) => [item.uuid, nextSeq++]));
      return { ok: true, acknowledgedIds: batch.map((item) => item.uuid), serverSeqs, failedItems: [], message: `ACK ${batch.length}` };
    },
    pullChanges: async () => ({ ok: true, records: [], lastServerSeq: 450, message: 'pull ok' }),
    parseVoiceOrder: async () => { throw new Error('unused'); },
  } as unknown as BackendAdapter;

  const result = await executeOutboxSyncWithAdapter(state, adapter);
  assert.deepEqual(batchSizes, [200, 200, 50]);
  assert.deepEqual(sentIds, items.map((item) => item.uuid));
  assert.equal(result.result.ok, true);
  assert.equal(result.result.acknowledgedIds.length, 450);
  assert.equal(Object.keys(result.result.serverSeqs).length, 450);
});

test('Outbox sync stops after the first incomplete batch to preserve event order', async () => {
  const items = Array.from({ length: 250 }, (_, index) => ({
    uuid: `STOP-${index + 1}`, idempotencyKey: `STOP-KEY-${index + 1}`,
    entityType: 'SALE' as const, createdAt: new Date(index).toISOString(),
    status: 'PENDING' as const, summary: `Stop event ${index + 1}`,
  }));
  const state = {
    ...createSeededEngineState({ products: [], lots: [], customers: [], receivables: [], inboundPOs: [], supplierInvoices: [], categories: [] }),
    syncOutbox: items,
    lastServerSeq: 0,
  };
  const batchSizes: number[] = [];
  const adapter = {
    type: 'REST_API', displayName: 'Test REST', requiresNetwork: true,
    checkHealth: async () => ({ ok: true, adapterType: 'REST_API', latencyMs: 1, message: 'ok' }),
    pushOutbox: async (batch: typeof items) => {
      batchSizes.push(batch.length);
      return {
        ok: false,
        acknowledgedIds: [batch[0].uuid],
        serverSeqs: { [batch[0].uuid]: 1 },
        failedItems: batch.slice(1).map((item) => ({ uuid: item.uuid, error: 'rejected' })),
        message: 'partial batch',
      };
    },
    pullChanges: async () => ({ ok: true, records: [], lastServerSeq: 1, message: 'pull ok' }),
    parseVoiceOrder: async () => { throw new Error('unused'); },
  } as unknown as BackendAdapter;

  const result = await executeOutboxSyncWithAdapter(state, adapter);
  assert.deepEqual(batchSizes, [200]);
  assert.equal(result.result.ok, false);
  assert.equal(result.result.acknowledgedIds.length, 1);
  assert.equal(result.result.failedItems.length, 199);
});


test('Outbox sync sends dependent events oldest-first even though new engine events are prepended', async () => {
  const newerReturn = {
    uuid: 'RETURN-NEW', idempotencyKey: 'RETURN-NEW-KEY', entityType: 'RETURN' as const,
    createdAt: '2026-11-17T10:01:00.000Z', status: 'PENDING' as const, summary: 'Return',
  };
  const olderSale = {
    uuid: 'SALE-OLD', idempotencyKey: 'SALE-OLD-KEY', entityType: 'SALE' as const,
    createdAt: '2026-11-17T10:00:00.000Z', status: 'PENDING' as const, summary: 'Sale',
  };
  const state = {
    ...createSeededEngineState({ products: [], lots: [], customers: [], receivables: [], inboundPOs: [], supplierInvoices: [], categories: [] }),
    syncOutbox: [newerReturn, olderSale],
    lastServerSeq: 0,
  };
  let pushed: string[] = [];
  const adapter = {
    type: 'REST_API', displayName: 'Test REST', requiresNetwork: true,
    checkHealth: async () => ({ ok: true, adapterType: 'REST_API', latencyMs: 1, message: 'ok' }),
    pushOutbox: async (batch: Array<typeof olderSale | typeof newerReturn>) => {
      pushed = batch.map((item) => item.entityType);
      return { ok: true, acknowledgedIds: batch.map((item) => item.uuid), serverSeqs: Object.fromEntries(batch.map((item, index) => [item.uuid, index + 1])), failedItems: [], message: 'ACK' };
    },
    pullChanges: async () => ({ ok: true, records: [], lastServerSeq: 2, message: 'pull ok' }),
    parseVoiceOrder: async () => { throw new Error('unused'); },
  } as unknown as BackendAdapter;
  const result = await executeOutboxSyncWithAdapter(state, adapter);
  assert.equal(result.result.ok, true);
  assert.deepEqual(pushed, ['SALE', 'RETURN']);
});

test('normalizes the legacy placeholder store ID to ERP_DAGING', () => {
  assert.equal(normalizeBackendConfig({}).storeId, 'ERP_DAGING');
  assert.equal(
    normalizeBackendConfig({ adapterType: 'REST_API', storeId: 'TOKO_KARKASIA_01' }).storeId,
    'ERP_DAGING'
  );
  assert.equal(
    normalizeBackendConfig({ adapterType: 'REST_API', storeId: 'STORE-ERP' }).storeId,
    'STORE-ERP'
  );
});


test('replacement device recovers backend history by pull and event replay without importing a foreign snapshot', async () => {
  const replacementDeviceId = 'DEVICE-REPLACEMENT-01';
  const sourceDeviceId = 'DEVICE-OWNER-ORIGINAL';
  const replacement = {
    ...createSeededEngineState({
      products: [], lots: [], customers: [], receivables: [],
      inboundPOs: [], supplierInvoices: [], categories: [],
    }),
    deviceId: replacementDeviceId,
    lastServerSeq: 0,
    syncOutbox: [],
    processedIdempotencyKeys: [],
  };

  const history: Array<Record<string, unknown>> = [
    {
      serverSeq: 1, deviceId: sourceDeviceId, uuid: 'EV-MASTER-1',
      idempotencyKey: 'MASTER-BOOTSTRAP-1', entityType: 'MASTER_DATA',
      createdAt: '2026-11-17T08:00:00.000Z',
      payload: {
        kind: 'MASTER_DATA_PATCH',
        changes: {
          products: [{
            id: 'PROD-RECOVERY', sku: 'SKU-RECOVERY', name: 'Daging Recovery',
            basePricePerKg: 100000, movingAvgHppPerKg: 50000, stockGram: 5000,
            tierPrices: { RETAIL: 100000 },
          }],
          lots: [{
            id: 'LOT-RECOVERY', code: 'LOT-RECOVERY', productId: 'PROD-RECOVERY',
            product: 'Daging Recovery', weightGram: 5000, hppKgRupiah: 50000,
            isQuarantined: false,
          }],
          customers: [{
            id: 'CUSTOMER-RECOVERY', code: 'C-RECOVERY', name: 'Pelanggan Recovery',
            tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0,
            phone: '', address: '',
          }],
        },
      },
    },
    {
      serverSeq: 2, deviceId: sourceDeviceId, uuid: 'EV-OPEN-BANK-RECOVERY',
      idempotencyKey: 'OPEN-BANK-RECOVERY', entityType: 'OPNAME',
      createdAt: '2026-11-17T08:01:00.000Z',
      payload: { kind: 'OPENING_BANK_BALANCE', openingBalanceRupiah: 250000, referenceNo: 'OPEN-BANK-01' },
    },
    {
      serverSeq: 3, deviceId: sourceDeviceId, uuid: 'EV-SALE-RECOVERY',
      idempotencyKey: 'SALE-RECOVERY-1', entityType: 'SALE',
      createdAt: '2026-11-17T08:02:00.000Z',
      payload: {
        transactionUuid: 'TX-RECOVERY-1', invoiceNumber: 'INV-RECOVERY-1',
        customerId: 'CUSTOMER-RECOVERY', customerName: 'Pelanggan Recovery',
        paymentMethod: 'CASH', grandTotalRupiah: 100000,
        subtotalRupiah: 100000, discountRupiah: 0, shippingFee: 0,
        paidAmountRupiah: 100000, balanceDueRupiah: 0, totalWeightGram: 1000,
        paymentBreakdown: { cashPaidRupiah: 100000, transferPaidRupiah: 0, receivableRupiah: 0 },
        items: [{
          productId: 'PROD-RECOVERY', productName: 'Daging Recovery',
          weightGram: 1000, lineTotalRupiah: 100000,
        }],
        lotAllocations: [{
          lotId: 'LOT-RECOVERY', lotCode: 'LOT-RECOVERY',
          productId: 'PROD-RECOVERY', productName: 'Daging Recovery',
          weightGram: 1000,
        }],
      },
    },
  ];

  let pullCalls = 0;
  const adapter = {
    type: 'REST_API', displayName: 'Replacement Recovery Test', requiresNetwork: true,
    checkHealth: async () => ({ ok: true, adapterType: 'REST_API', latencyMs: 1, message: 'ok' }),
    pushOutbox: async () => ({
      ok: true, acknowledgedIds: [], serverSeqs: {}, failedItems: [], message: 'No local events to push.',
    }),
    pullChanges: async (sinceSeq: number, context: { deviceId: string }) => {
      pullCalls++;
      assert.equal(context.deviceId, replacementDeviceId, 'replacement keeps its newly generated device identity');
      const records = history.filter((event) =>
        Number(event.serverSeq) > sinceSeq && event.deviceId !== context.deviceId
      );
      return {
        ok: true, records, lastServerSeq: 3,
        message: 'Replacement device history pulled.',
      };
    },
    parseVoiceOrder: async () => { throw new Error('unused'); },
  } as unknown as BackendAdapter;

  const network = await executeOutboxSyncWithAdapter(replacement, adapter);
  assert.equal(network.result.pullSucceeded, true);
  assert.equal(network.result.pulledRecords?.length, 3);
  assert.equal(network.result.pulledLastServerSeq, 3);

  const recovered = applyPulledSyncRecords(
    applyOutboxSyncResults(replacement, {
      acknowledgedIds: network.result.acknowledgedIds,
      serverSeqs: network.result.serverSeqs,
      failedItems: network.result.failedItems,
      backendType: adapter.type,
      adapterDisplayName: adapter.displayName,
    }),
    network.result.pulledRecords ?? [],
    network.result.pulledLastServerSeq
  );

  assert.equal(recovered.deviceId, replacementDeviceId);
  assert.equal(recovered.lastServerSeq, 3);
  assert.equal(recovered.products.some((product) => product.id === 'PROD-RECOVERY'), true);
  assert.equal(recovered.customers.some((customer) => customer.id === 'CUSTOMER-RECOVERY'), true);
  assert.equal(recovered.lots.find((lot) => lot.id === 'LOT-RECOVERY')?.weightGram, 4000);
  assert.equal(recovered.transactions.filter((tx) => tx.invoiceNumber === 'INV-RECOVERY-1').length, 1);
  assert.equal(recovered.cashInHandRupiah, replacement.cashInHandRupiah + 100000);
  assert.equal(recovered.bankBalanceRupiah, 250000);
  assert.equal(recovered.syncOutbox.length, 0, 'pull/replay must not fabricate a local Outbox event');

  const duplicateReplay = applyPulledSyncRecords(recovered, history, 3);
  assert.equal(duplicateReplay.deviceId, replacementDeviceId);
  assert.equal(duplicateReplay.lastServerSeq, 3);
  assert.equal(duplicateReplay.transactions.filter((tx) => tx.invoiceNumber === 'INV-RECOVERY-1').length, 1);
  assert.equal(duplicateReplay.lots.find((lot) => lot.id === 'LOT-RECOVERY')?.weightGram, 4000);

  const catchUp = await executeOutboxSyncWithAdapter(duplicateReplay, adapter);
  assert.equal(pullCalls, 2);
  assert.equal(catchUp.result.pullSucceeded, true);
  assert.equal(catchUp.result.pulledRecords?.length, 0, 'a caught-up replacement device receives no duplicate history');
  assert.equal(catchUp.result.pulledLastServerSeq, 3);
});
