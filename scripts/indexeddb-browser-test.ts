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
import { persistEngineState } from '../src/engine/businessEngine';
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
    schemaVersion: 1, storeName: 'ERP DAGING', deviceId: 'DEVICE-SALES-01',
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

async function runVerify(): Promise<void> {
  assert(sessionStorage.getItem('idb-browser-test-setup') === 'passed', 'halaman dibuka ulang dalam sesi browser yang sama');
  assert(await getMarker() === 'queue-recovered', 'state queue tetap tersimpan setelah reload halaman');
  const reloadedState = await idbGetEngineState() as unknown as { transactions?: Array<{ uuid: string }>; syncOutbox?: Array<{ uuid: string }> } | null;
  assert(reloadedState?.transactions?.some((item) => item.uuid === 'TX-QUEUE-COMMIT'), 'transaksi bisnis dari queue pulih setelah reload halaman');
  assert(reloadedState?.syncOutbox?.some((item) => item.uuid === 'EVENT-QUEUE-COMMIT'), 'event Outbox dari transaksi yang sama pulih setelah reload halaman');
  assert(await idbGetMediaBlob('media-original'), 'lampiran tetap tersimpan setelah reload halaman');
  assert(!(await idbGetMediaBlob('media-imported')), 'lampiran hasil restore lama tetap tidak muncul setelah reload');
  const reloadedSales = await idbGetEngineState() as unknown as Record<string, any> | null;
  assert(reloadedSales?.salesProjectionSalesId === 'S-1', 'Sales identity binding survives a full page reload');
  assert(reloadedSales?.customers?.every((row: any) => row.id === 'C-S1' || row.id === 'CUST_UMUM'), 'no foreign customer reappears after reload');
  assert(reloadedSales?.syncOutbox?.every((row: any) => row.payload?.salesId === 'S-1'), 'no foreign Sales outbox event reappears after reload');
  assert(!JSON.stringify(reloadedSales).includes('OWNER-'), 'Owner-only records remain absent after reload');
  publish('passed');
}

publish('running');
void (async () => {
  try {
    if (new URLSearchParams(window.location.search).get('phase') === 'verify') await runVerify();
    else await runSetup();
  } catch (error) {
    details.push(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    publish('failed');
  }
})();
