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
  });
  const afterRestore = asState({
    ...baseline,
    lastUpdatedAt: '2026-11-14T00:05:00.000Z',
    marker: 'after-file-restore',
  });
  const originalBlob = new Blob(['original-evidence'], { type: 'image/jpeg' });
  const importedBlob = new Blob(['imported-evidence'], { type: 'image/jpeg' });

  assert(await idbSaveEngineState(baseline), 'state awal tersimpan di IndexedDB native');
  assert(await idbSaveMediaBlob('media-original', originalBlob), 'lampiran awal tersimpan');

  const restored = await idbRestoreStateWithSafetySnapshot(
    afterRestore,
    [{ mediaId: 'media-imported', blob: importedBlob }],
    true,
    baseline,
  );
  assert(restored, 'restore file dan snapshot pengaman berhasil dalam transaksi');
  const activeAfterRestore = await idbGetEngineState();
  assert(getMarker() === 'after-file-restore', 'state hasil restore aktif');
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
  assert((await idbGetEngineState())?.marker === 'after-file-restore', 'kegagalan penulisan tidak mengganti state aktif');
  assert(await idbGetMediaBlob('media-imported'), 'kegagalan restore tidak menghapus lampiran aktif');

  const validSnapshotRestore = await idbRestoreSafetySnapshot(snapshotInfo.id, afterRestore, snapshot.state);
  assert(validSnapshotRestore, 'snapshot pengaman berhasil dipulihkan');
  assert(await getMarker() === 'baseline', 'state kembali ke snapshot awal');
  assert(await idbGetMediaBlob('media-original'), 'lampiran snapshot awal kembali tersedia');
  assert(!(await idbGetMediaBlob('media-imported')), 'lampiran yang tidak ada di snapshot tidak ikut tertinggal');

  sessionStorage.setItem('idb-browser-test-setup', 'passed');
  publish('passed');
}

async function runVerify(): Promise<void> {
  assert(sessionStorage.getItem('idb-browser-test-setup') === 'passed', 'halaman dibuka ulang dalam sesi browser yang sama');
  assert((await idbGetEngineState())?.marker === 'baseline', 'state tetap tersimpan setelah reload halaman');
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
