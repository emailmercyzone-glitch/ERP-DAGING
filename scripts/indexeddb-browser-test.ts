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
  assert(await idbGetMediaBlob('media-original'), 'lampiran lama tidak dihapus saat impor additive');
  assert(await idbGetMediaBlob('media-imported'), 'lampiran baru berhasil diimpor');

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
