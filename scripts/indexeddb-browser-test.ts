import {
  idbGetEngineState,
  idbGetLatestRestoreSafetySnapshotInfo,
  idbGetMediaBlob,
  idbGetRestoreSafetySnapshot,
  idbRestoreSafetySnapshot,
  idbRestoreStateWithSafetySnapshot,
  idbSaveEngineState,
  idbSaveMediaBlob,
} from '../src/engine/indexedDbStorage';
import type { BusinessEngineState } from '../src/engine/types';
import { applyOutboxSyncResults, applyPulledSyncRecords, createSeededEngineState, persistEngineState } from '../src/engine/businessEngine';
import { executeOutboxSyncWithAdapter } from '../src/adapters/adapterRegistry';
import type { BackendAdapter } from '../src/adapters/backendAdapter';
import { DurableMutationQueue } from '../src/engine/durableMutationQueue';
import { sanitizeSalesStateForStorage } from '../src/auth/rolePolicy';

declare global {
  interface Window {
    __IDB_BROWSER_TEST__?: { status: 'running' | 'passed' | 'failed'; details: string[] };
  }
}

const resultElement = document.querySelector<HTMLPreElement>('#result');
const details: string[] = [];
const publish = (status: 'running' | 'passed' | 'failed') => {
  window.__IDB_BROWSER_TEST__ = { status, details: [...details] };
  if (resultElement) resultElement.textContent = `${status.toUpperCase()}\n${details.join('\n')}`;
  document.title = `IDB_BROWSER_TEST_${status.toUpperCase()}`;
};
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  details.push(`PASS: ${message}`);
}
const getMarker = async () => (await idbGetEngineState() as unknown as { marker?: string } | null)?.marker;
const asState = (value: Record<string, unknown>) => value as unknown as BusinessEngineState;

async function deleteTestDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase('karkasia_erp_offline_db');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Gagal menghapus database test.'));
    request.onblocked = () => reject(new Error('Database test masih terkunci sebelum setup.'));
  });
}

async function runSetup(): Promise<void> {
  await deleteTestDatabase();
  const baseline = asState({
    deviceId: 'DEVICE-IDB-BROWSER-TEST',
    lastUpdatedAt: '2026-11-14T00:00:00.000Z',
    marker: 'baseline',
    transactions: [{ uuid: 'TX-OUTBOX-RECOVERY-01', invoiceNumber: 'INV-OUTBOX-01' }],
    syncOutbox: [{ uuid: 'EVENT-OUTBOX-RECOVERY-01', idempotencyKey: 'KEY-OUTBOX-01', entityType: 'SALE', payload: { invoiceNumber: 'INV-OUTBOX-01' } }],
  });
  const afterRestore = asState({
    ...baseline,
    lastUpdatedAt: '2026-11-14T00:05:00.000Z',
    marker: 'after-file-restore',
    transactions: [{ uuid: 'TX-AFTER-RESTORE', invoiceNumber: 'INV-AFTER-RESTORE' }],
    syncOutbox: [{ uuid: 'EVENT-AFTER-RESTORE', idempotencyKey: 'KEY-AFTER-RESTORE', entityType: 'SALE', payload: {} }],
  });
  const originalBlob = new Blob(['original-evidence'], { type: 'image/jpeg' });
  const importedBlob = new Blob(['imported-evidence'], { type: 'image/jpeg' });

  assert(await idbSaveEngineState(baseline), 'state awal tersimpan di IndexedDB native');
  const savedBaseline = await idbGetEngineState() as unknown as { transactions?: Array<{ uuid: string }>; syncOutbox?: Array<{ uuid: string }> } | null;
  assert(savedBaseline?.transactions?.[0]?.uuid === 'TX-OUTBOX-RECOVERY-01', 'transaksi tersimpan bersama snapshot state');
  assert(savedBaseline?.syncOutbox?.[0]?.uuid === 'EVENT-OUTBOX-RECOVERY-01', 'event Outbox tersimpan bersama transaksi dalam snapshot yang sama');
  assert(await idbSaveMediaBlob('media-original', originalBlob), 'lampiran awal tersimpan');

  const restored = await idbRestoreStateWithSafetySnapshot(
    afterRestore,
    [{ mediaId: 'media-imported', blob: importedBlob }],
    true,
    baseline,
  );
  assert(restored, 'restore file dan snapshot pengaman berhasil dalam transaksi');
  assert(await getMarker() === 'after-file-restore', 'state hasil restore aktif');
  const restoredState = await idbGetEngineState() as unknown as { transactions?: Array<{ uuid: string }>; syncOutbox?: Array<{ uuid: string }> } | null;
  assert(restoredState?.transactions?.[0]?.uuid === 'TX-AFTER-RESTORE', 'transaksi hasil restore menggantikan state sebelumnya');
  assert(restoredState?.syncOutbox?.[0]?.uuid === 'EVENT-AFTER-RESTORE', 'Outbox hasil restore tetap satu snapshot dengan transaksi');
  assert(!(await idbGetMediaBlob('media-original')), 'restore penuh menghapus lampiran lama yang tidak ada di backup');
  assert(await idbGetMediaBlob('media-imported'), 'lampiran backup berhasil menggantikan kumpulan media aktif');

  const failedFileRestore = await idbRestoreStateWithSafetySnapshot(
    asState({ ...afterRestore, marker: 'must-not-commit', unsupportedValue: () => 'DataCloneError' }),
    [{ mediaId: 'media-failed', blob: new Blob(['failed'], { type: 'image/jpeg' }) }],
    true,
    afterRestore,
  );
  assert(!failedFileRestore, 'restore file membatalkan transaksi saat state tidak dapat disimpan');
  assert(await getMarker() === 'after-file-restore', 'restore file gagal tidak mengganti database aktif');
  assert(await idbGetMediaBlob('media-imported'), 'restore file gagal tidak menghapus lampiran aktif');
  assert(!(await idbGetMediaBlob('media-failed')), 'lampiran dari restore gagal tidak ikut tersimpan');

  const snapshotInfo = await idbGetLatestRestoreSafetySnapshotInfo();
  if (!snapshotInfo?.id) throw new Error('Metadata snapshot pengaman tidak tersedia.');
  assert(true, 'metadata snapshot pengaman tersedia');
  const snapshot = await idbGetRestoreSafetySnapshot(snapshotInfo.id);
  if (!snapshot) throw new Error('Payload snapshot pengaman tidak tersedia.');
  assert((snapshot?.state as unknown as { marker?: string } | undefined)?.marker === 'baseline', 'snapshot memuat state sebelum restore');

  const staleExpected = asState({ ...afterRestore, marker: 'state-yang-sudah-berubah' });
  const staleResult = await idbRestoreSafetySnapshot(snapshotInfo.id, staleExpected, snapshot.state);
  assert(!staleResult, 'restore snapshot menolak state aktif yang sudah berubah');
  assert(await getMarker() === 'after-file-restore', 'penolakan stale tidak mengubah state aktif');

  const cloneFailureState = asState({
    ...snapshot.state,
    marker: 'must-not-commit',
    unsupportedValue: () => 'DataCloneError',
  });
  const failedRestore = await idbRestoreSafetySnapshot(snapshotInfo.id, afterRestore, cloneFailureState);
  assert(!failedRestore, 'DataCloneError membatalkan transaksi restore');
  assert(await getMarker() === 'after-file-restore', 'kegagalan penulisan tidak mengganti state aktif');
  assert(await idbGetMediaBlob('media-imported'), 'kegagalan restore tidak menghapus lampiran aktif');

  const validSnapshotRestore = await idbRestoreSafetySnapshot(snapshotInfo.id, afterRestore, snapshot.state);
  assert(validSnapshotRestore, 'snapshot pengaman berhasil dipulihkan');
  assert(await getMarker() === 'baseline', 'state kembali ke snapshot awal');
  assert(await idbGetMediaBlob('media-original'), 'lampiran snapshot awal kembali tersedia');
  assert(!(await idbGetMediaBlob('media-imported')), 'lampiran yang tidak ada di snapshot tidak ikut tertinggal');

  // Exercise the actual application queue -> persistEngineState -> native IndexedDB path.
  let liveState = asState(await idbGetEngineState() as unknown as Record<string, unknown>);
  const queue = new DurableMutationQueue<BusinessEngineState>(
    () => liveState,
    async (next) => await persistEngineState(next).indexedDbPromise,
    (next) => { liveState = next; },
  );
  const committed = await queue.run((current) => ({
    state: {
      ...current,
      marker: 'queue-committed',
      transactions: [...current.transactions, { uuid: 'TX-QUEUE-COMMIT', invoiceNumber: 'INV-QUEUE-COMMIT' } as unknown as BusinessEngineState['transactions'][number]],
      syncOutbox: [...current.syncOutbox, { uuid: 'EVENT-QUEUE-COMMIT', idempotencyKey: 'KEY-QUEUE-COMMIT', entityType: 'SALE', payload: {} } as unknown as BusinessEngineState['syncOutbox'][number]],
    },
    result: 'committed',
  }));
  assert(committed.ok, 'mutation queue menunggu commit IndexedDB native sebelum sukses');
  assert(await getMarker() === 'queue-committed', 'snapshot queue benar-benar tertulis ke IndexedDB');

  const failedMutation = await queue.run((current) => ({
    state: { ...current, marker: 'must-not-publish', unsupportedValue: () => 'DataCloneError' },
    result: 'failed',
  }));
  assert(!failedMutation.ok, 'queue menolak mutasi saat IndexedDB melempar DataCloneError');
  assert((liveState as unknown as { marker?: string }).marker === 'queue-committed', 'state runtime tidak dipublikasikan saat persist gagal');
  assert(await getMarker() === 'queue-committed', 'snapshot IndexedDB tidak tertimpa oleh mutasi gagal');

  const recoveredMutation = await queue.run((current) => ({
    state: { ...current, marker: 'queue-recovered' },
    result: 'recovered',
  }));
  assert(recoveredMutation.ok, 'queue dapat melanjutkan transaksi setelah kegagalan persist');
  assert(await getMarker() === 'queue-recovered', 'transaksi pemulihan berikutnya tersimpan durable');

  // Verify the exact sanitized Sales projection survives a native IndexedDB write and page reload.
  const ownerState = asState({
    schemaVersion: 1, storeName: 'ERP DAGING', deviceId: 'DEVICE-SALES-01', marker: 'sales-projection-committed',
    ownerPin: '123456', ownerPinHash: 'OWNER-HASH-SECRET', ownerPinSalt: 'OWNER-SALT-SECRET',
    cashInHandRupiah: 900000, bankBalanceRupiah: 800000,
    pettyCashSpentTodayRupiah: 25000, pettyCashBalanceRupiah: 75000,
    pettyCashVouchers: [{ id: 'OWNER-OPEX-SECRET', amountRupiah: 25000 }],
    products: [
      { id: 'P-SAFE', sku: 'SAFE', name: 'Daging Aman', basePricePerKg: 150000, movingAvgHppPerKg: 90000, tierPrices: { RETAIL: 150000, HOREKA: 140000, VIP: 130000 }, category: 'A', stockGram: 5000, safetyStockGram: 0 },
    ],
    lots: [
      { id: 'LOT-SAFE', code: 'LOT-SAFE', product: 'Daging Aman', daysLeft: 10, expiryDate: '2026-12-01', weightGram: 5000, maxCapacityGram: 5000, hppKgRupiah: 90000, loc: 'A', isFefo: true, isQuarantined: false },
    ],
    customers: [
      { id: 'C-S1', code: 'S1', name: 'Pelanggan Sales 1', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '081111111111', address: 'Alamat S1', assignedSalesId: 'S-1' },
      { id: 'C-S2', code: 'S2', name: 'Pelanggan Sales 2', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '082222222222', address: 'Alamat S2', assignedSalesId: 'S-2' },
      { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0 },
    ],
    receivables: [
      { id: 'REC-S1', customer: 'Pelanggan Sales 1', customerId: 'C-S1', tier: 'RETAIL', amount: 1000, limit: 1000, dueDate: '2026-11-19', category: 'HARI_INI', daysDiff: 1, invoice: 'INV-S1', itemsSummary: 'Daging', phone: '081111111111', status: 'BELUM_LUNAS' },
      { id: 'REC-S2', customer: 'Pelanggan Sales 2', customerId: 'C-S2', tier: 'RETAIL', amount: 2000, limit: 2000, dueDate: '2026-11-19', category: 'HARI_INI', daysDiff: 1, invoice: 'INV-S2', itemsSummary: 'Daging', phone: '082222222222', status: 'BELUM_LUNAS' },
    ],
    inboundPOs: [{ id: 'OWNER-PO-SECRET', supplier: 'OWNER-SUPPLIER-SECRET' }],
    supplierInvoices: [{ id: 'OWNER-AP-SECRET', supplier: 'OWNER-SUPPLIER-SECRET' }],
    transactions: [
      { uuid: 'TX-S1', idempotencyKey: 'K-S1', invoiceNumber: 'INV-S1', timestamp: '2026-11-18T00:00:00.000Z', customerId: 'C-S1', salesId: 'S-1', customerName: 'Pelanggan Sales 1', customerTier: 'RETAIL', paymentMethod: 'CASH', tempoDays: 0, totalWeightGram: 1000, subtotalRupiah: 150000, shippingFee: 0, isFreeShipping: false, grandTotalRupiah: 150000, totalCogsRupiah: 90000, grossProfitRupiah: 60000, status: 'COMPLETED', items: [{ productId: 'P-SAFE', productName: 'Daging Aman', weightGram: 1000, effectivePricePerKg: 150000, lineTotalRupiah: 150000, movingAvgHppPerKg: 90000 }], lotAllocations: [{ lotId: 'LOT-SAFE', lotCode: 'LOT-SAFE', weightGram: 1000, hppPerKg: 90000, cogsRupiah: 90000 }] },
      { uuid: 'TX-S2', idempotencyKey: 'K-S2', invoiceNumber: 'INV-S2', customerId: 'C-S2', salesId: 'S-2', customerName: 'Pelanggan Sales 2', customerTier: 'RETAIL', paymentMethod: 'CASH', tempoDays: 0, totalWeightGram: 1000, subtotalRupiah: 150000, shippingFee: 0, isFreeShipping: false, grandTotalRupiah: 150000, status: 'COMPLETED', items: [], lotAllocations: [] },
    ],
    stockLedger: [{ uuid: 'OWNER-LEDGER-SECRET', note: 'OWNER-LEDGER-SECRET' }],
    journals: [{ id: 'OWNER-JOURNAL-SECRET', memo: 'OWNER-JOURNAL-SECRET' }],
    auditTrail: [{ id: 'OWNER-AUDIT-SECRET', action: 'OWNER-AUDIT-SECRET' }],
    approvals: [{ id: 'OWNER-APPROVAL-SECRET' }],
    customerReturns: [], receivablePayments: [],
    syncOutbox: [
      { uuid: 'EV-S1', idempotencyKey: 'KEY-S1', entityType: 'SALE', createdAt: '2026-11-18T00:00:00.000Z', status: 'PENDING', summary: 'Sales 1', payload: { salesId: 'S-1', customerId: 'C-S1', invoiceNumber: 'INV-S1', totalCogsRupiah: 90000, items: [{ movingAvgHppPerKg: 90000, lineTotalRupiah: 150000 }] } },
      { uuid: 'EV-S2', idempotencyKey: 'KEY-S2', entityType: 'SALE', createdAt: '2026-11-18T00:00:00.000Z', status: 'PENDING', summary: 'Sales 2', payload: { salesId: 'S-2', customerId: 'C-S2', invoiceNumber: 'INV-S2' } },
      { uuid: 'EV-PO', idempotencyKey: 'KEY-PO', entityType: 'PURCHASE', createdAt: '2026-11-18T00:00:00.000Z', status: 'PENDING', summary: 'Owner purchase', payload: { supplier: 'OWNER-SUPPLIER-SECRET' } },
    ],
    processedIdempotencyKeys: ['KEY-S1', 'KEY-S2', 'KEY-PO'],
    categories: [], bazarPromos: [], suppliers: ['OWNER-SUPPLIER-SECRET'],
    supplierPhones: { 'OWNER-SUPPLIER-SECRET': '089999999999' },
    lastServerSeq: 88, salesProjectionReady: true, salesProjectionSalesId: 'S-1',
    lastUpdatedAt: '2026-11-18T00:00:00.000Z',
  });
  const salesSafeState = sanitizeSalesStateForStorage(ownerState, 'S-1');
  let salesLiveState = asState(await idbGetEngineState() as unknown as Record<string, unknown>);
  const salesQueue = new DurableMutationQueue<BusinessEngineState>(
    () => salesLiveState,
    async (next) => await persistEngineState(next).indexedDbPromise,
    (next) => { salesLiveState = next; },
  );
  const salesCommit = await salesQueue.run(() => ({ state: salesSafeState, result: 'sales-isolated' }));
  assert(salesCommit.ok, 'Sales projection committed through the durable queue into native IndexedDB');
  const storedSales = await idbGetEngineState() as unknown as Record<string, any> | null;
  if (!storedSales) throw new Error('Sales state tidak ditemukan setelah commit.');
  assert(storedSales.salesProjectionSalesId === 'S-1', 'persisted snapshot is bound to the authenticated Sales identity');
  assert(storedSales.cashInHandRupiah === 0 && storedSales.bankBalanceRupiah === 0 && storedSales.pettyCashBalanceRupiah === 0, 'Sales snapshot excludes Owner cash and petty-cash balances');
  assert(storedSales.ownerPinHash === '' && storedSales.ownerPinSalt === '', 'Sales snapshot excludes Owner PIN credentials');
  assert(storedSales.customers.map((row: any) => row.id).sort().join(',') === 'C-S1,CUST_UMUM', 'Sales snapshot contains only assigned and shared UMUM customers');
  assert(storedSales.transactions.map((row: any) => row.invoiceNumber).join(',') === 'INV-S1', 'Sales snapshot contains only invoices created by this Sales identity');
  assert(storedSales.syncOutbox.map((row: any) => row.uuid).join(',') === 'EV-S1', 'Sales snapshot retains only authorized own outbox events');
  assert(storedSales.products[0].movingAvgHppPerKg === 0 && storedSales.lots[0].hppKgRupiah === 0, 'Sales snapshot redacts product and lot HPP');
  assert(!JSON.stringify(storedSales).includes('OWNER-'), 'Owner-only records and secrets are absent from the persisted Sales snapshot');
  assert(!JSON.stringify(storedSales).includes('90000'), 'raw HPP/COGS values are absent from the persisted Sales snapshot');
  sessionStorage.setItem('idb-browser-test-setup', 'passed');
  publish('passed');
}

async function runReplacementRecoverySetup(): Promise<void> {
  const replacementDeviceId = 'DEVICE-IDB-REPLACEMENT-01';
  const sourceDeviceId = 'DEVICE-IDB-SOURCE-01';
  const emptyReplacement = {
    ...createSeededEngineState({
      products: [], lots: [], customers: [], receivables: [],
      inboundPOs: [], supplierInvoices: [], categories: [],
    }),
    deviceId: replacementDeviceId,
    lastServerSeq: 0,
    syncOutbox: [],
    processedIdempotencyKeys: [],
  };
  assert(await idbSaveEngineState(emptyReplacement), 'empty replacement device state initialized in native IndexedDB');

  const history: Array<Record<string, unknown>> = [
    {
      serverSeq: 1, deviceId: sourceDeviceId, uuid: 'IDB-EV-MASTER-01',
      idempotencyKey: 'IDB-MASTER-01', entityType: 'MASTER_DATA',
      createdAt: '2026-11-17T08:00:00.000Z',
      payload: {
        kind: 'MASTER_DATA_PATCH',
        changes: {
          products: [{
            id: 'IDB-PROD-RECOVERY', sku: 'IDB-RECOVERY', name: 'Daging IDB Recovery',
            basePricePerKg: 100000, movingAvgHppPerKg: 50000, stockGram: 5000,
            tierPrices: { RETAIL: 100000 },
          }],
          lots: [{
            id: 'IDB-LOT-RECOVERY', code: 'IDB-LOT-RECOVERY',
            productId: 'IDB-PROD-RECOVERY', product: 'Daging IDB Recovery',
            weightGram: 5000, hppKgRupiah: 50000, isQuarantined: false,
          }],
          customers: [{
            id: 'IDB-CUSTOMER-RECOVERY', code: 'IDB-C-RECOVERY',
            name: 'Pelanggan IDB Recovery', tier: 'RETAIL',
            creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '',
          }],
        },
      },
    },
    {
      serverSeq: 2, deviceId: sourceDeviceId, uuid: 'IDB-EV-OPEN-BANK',
      idempotencyKey: 'IDB-OPEN-BANK', entityType: 'OPNAME',
      createdAt: '2026-11-17T08:01:00.000Z',
      payload: { kind: 'OPENING_BANK_BALANCE', openingBalanceRupiah: 250000, referenceNo: 'IDB-OPEN-01' },
    },
    {
      serverSeq: 3, deviceId: sourceDeviceId, uuid: 'IDB-EV-SALE',
      idempotencyKey: 'IDB-SALE-01', entityType: 'SALE',
      createdAt: '2026-11-17T08:02:00.000Z',
      payload: {
        transactionUuid: 'IDB-TX-RECOVERY-01', invoiceNumber: 'IDB-INV-RECOVERY-01',
        customerId: 'IDB-CUSTOMER-RECOVERY', customerName: 'Pelanggan IDB Recovery',
        paymentMethod: 'CASH', grandTotalRupiah: 100000, subtotalRupiah: 100000,
        discountRupiah: 0, shippingFee: 0, paidAmountRupiah: 100000,
        balanceDueRupiah: 0, totalWeightGram: 1000,
        items: [{
          productId: 'IDB-PROD-RECOVERY', productName: 'Daging IDB Recovery',
          weightGram: 1000, lineTotalRupiah: 100000,
        }],
        lotAllocations: [{
          lotId: 'IDB-LOT-RECOVERY', lotCode: 'IDB-LOT-RECOVERY',
          productId: 'IDB-PROD-RECOVERY', productName: 'Daging IDB Recovery',
          weightGram: 1000,
        }],
      },
    },
  ];

  const adapter = {
    type: 'REST_API', displayName: 'Native IndexedDB Replacement Test', requiresNetwork: true,
    checkHealth: async () => ({ ok: true, adapterType: 'REST_API', latencyMs: 1, message: 'ok' }),
    pushOutbox: async () => ({
      ok: true, acknowledgedIds: [], serverSeqs: {}, failedItems: [], message: 'No local events to push.',
    }),
    pullChanges: async (sinceSeq: number, context: { deviceId: string }) => ({
      ok: true,
      records: history.filter((event) => Number(event.serverSeq) > sinceSeq && event.deviceId !== context.deviceId),
      lastServerSeq: 3,
      message: 'Replacement device history pulled.',
    }),
    parseVoiceOrder: async () => { throw new Error('unused'); },
  } as unknown as BackendAdapter;

  const network = await executeOutboxSyncWithAdapter(emptyReplacement, adapter);
  assert(network.result.pullSucceeded, 'replacement device successfully pulls source-device backend events');
  const appliedAcks = applyOutboxSyncResults(emptyReplacement, {
    acknowledgedIds: network.result.acknowledgedIds,
    serverSeqs: network.result.serverSeqs,
    failedItems: network.result.failedItems,
    backendType: adapter.type,
    adapterDisplayName: adapter.displayName,
  });
  const replayed = applyPulledSyncRecords(
    appliedAcks,
    network.result.pulledRecords ?? [],
    network.result.pulledLastServerSeq,
  );
  assert(replayed.deviceId === replacementDeviceId, 'event replay preserves the replacement device identity');
  assert(replayed.lastServerSeq === 3, 'event replay advances the replacement server cursor');
  assert(replayed.products.some((item) => item.id === 'IDB-PROD-RECOVERY'), 'master data reconstructed from backend history');
  assert(replayed.customers.some((item) => item.id === 'IDB-CUSTOMER-RECOVERY'), 'customer reconstructed from backend history');
  assert(replayed.lots.find((item) => item.id === 'IDB-LOT-RECOVERY')?.weightGram === 4000, 'sale replay deducts lot stock exactly once');
  assert(replayed.transactions.some((item) => item.invoiceNumber === 'IDB-INV-RECOVERY-01'), 'sale transaction reconstructed from backend history');
  assert(replayed.bankBalanceRupiah === 250000, 'opening bank balance reconstructed from backend history');
  assert(replayed.cashInHandRupiah === emptyReplacement.cashInHandRupiah + 100000, 'cash balance reconstructed from backend history');
  assert(replayed.syncOutbox.length === 0, 'backend replay does not fabricate local Outbox events');

  const duplicateReplay = applyPulledSyncRecords(replayed, history, 3);
  assert(duplicateReplay.lots.find((item) => item.id === 'IDB-LOT-RECOVERY')?.weightGram === 4000, 'duplicate event replay does not deduct stock twice');
  assert(duplicateReplay.transactions.filter((item) => item.invoiceNumber === 'IDB-INV-RECOVERY-01').length === 1, 'duplicate event replay does not duplicate invoice');

  let liveState: BusinessEngineState = emptyReplacement;
  const queue = new DurableMutationQueue<BusinessEngineState>(
    () => liveState,
    async (next) => await persistEngineState(next).indexedDbPromise,
    (next) => { liveState = next; },
  );
  const committed = await queue.run(() => ({ state: duplicateReplay, result: 'replacement-recovered' }));
  assert(committed.ok, 'replacement pull/replay state commits through the durable mutation queue');
  const stored = await idbGetEngineState() as unknown as BusinessEngineState | null;
  assert(stored?.deviceId === replacementDeviceId && stored.lastServerSeq === 3, 'replacement identity and cursor are stored in native IndexedDB');
  assert(stored?.lots.find((item) => item.id === 'IDB-LOT-RECOVERY')?.weightGram === 4000, 'reconstructed stock is stored in native IndexedDB');
  sessionStorage.setItem('idb-replacement-recovery', 'committed');
}

async function runReplacementRecoveryVerify(): Promise<void> {
  assert(sessionStorage.getItem('idb-replacement-recovery') === 'committed', 'replacement recovery setup completed before the page reload');
  const recovered = await idbGetEngineState() as unknown as BusinessEngineState | null;
  assert(recovered?.deviceId === 'DEVICE-IDB-REPLACEMENT-01', 'replacement device identity survives a full page reload');
  assert(recovered?.lastServerSeq === 3, 'backend server cursor survives a full page reload');
  assert(recovered?.products.some((item) => item.id === 'IDB-PROD-RECOVERY'), 'pulled product survives a full page reload');
  assert(recovered?.customers.some((item) => item.id === 'IDB-CUSTOMER-RECOVERY'), 'pulled customer survives a full page reload');
  assert(recovered?.lots.find((item) => item.id === 'IDB-LOT-RECOVERY')?.weightGram === 4000, 'replayed lot balance survives a full page reload');
  assert(recovered?.transactions.filter((item) => item.invoiceNumber === 'IDB-INV-RECOVERY-01').length === 1, 'replayed invoice survives a full page reload exactly once');
  assert(recovered?.bankBalanceRupiah === 250000, 'replayed opening bank balance survives a full page reload');
  assert(recovered?.syncOutbox.length === 0, 'replacement reload does not invent local Outbox events');
}

async function runVerify(): Promise<void> {
  assert(sessionStorage.getItem('idb-browser-test-setup') === 'passed', 'halaman dibuka ulang dalam sesi browser yang sama');
  assert((await idbGetEngineState() as unknown as { salesProjectionSalesId?: string } | null)?.salesProjectionSalesId === 'S-1', 'Sales projection identity tetap tersimpan setelah reload halaman');
  const reloadedState = await idbGetEngineState() as unknown as { transactions?: Array<{ uuid: string }>; syncOutbox?: Array<{ uuid: string }> } | null;
  assert(reloadedState?.transactions?.some((item) => item.uuid === 'TX-S1'), 'transaksi Sales yang sudah disanitasi pulih setelah reload halaman');
  assert(reloadedState?.syncOutbox?.some((item) => item.uuid === 'EV-S1'), 'Outbox Sales yang sudah disanitasi pulih setelah reload halaman');
  assert(await idbGetMediaBlob('media-original'), 'lampiran tetap tersimpan setelah reload halaman');
  assert(!(await idbGetMediaBlob('media-imported')), 'lampiran hasil restore lama tetap tidak muncul setelah reload');
  const reloadedSales = await idbGetEngineState() as unknown as Record<string, any> | null;
  assert(reloadedSales?.salesProjectionSalesId === 'S-1', 'Sales identity binding survives a full page reload');
  assert(reloadedSales?.customers?.every((row: any) => row.id === 'C-S1' || row.id === 'CUST_UMUM'), 'no foreign customer reappears after reload');
  assert(reloadedSales?.syncOutbox?.every((row: any) => row.payload?.salesId === 'S-1'), 'no foreign Sales outbox event reappears after reload');
  assert(!JSON.stringify(reloadedSales).includes('OWNER-'), 'Owner-only records remain absent after reload');
  await runReplacementRecoverySetup();
  publish('passed');
}

publish('running');
void (async () => {
  try {
    const phase = new URLSearchParams(window.location.search).get('phase');
    if (phase === 'verify') await runVerify();
    else if (phase === 'replacement-verify') await runReplacementRecoveryVerify();
    else await runSetup();
  } catch (error) {
    details.push(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    publish('failed');
  }
})();
