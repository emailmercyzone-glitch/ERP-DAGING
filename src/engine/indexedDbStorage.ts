import type { BusinessEngineState } from './types';

export const KARKASIA_IDB_NAME = 'karkasia_erp_offline_db';
export const KARKASIA_IDB_VERSION = 4;
const STATE_STORE = 'kv_state';
const PREF_STORE = 'preferences';
const MEDIA_STORE = 'media_blobs';
const MIGRATION_BACKUP_STORE = 'migration_backups';
const MIGRATION_META_STORE = 'migration_meta';
const RESTORE_SNAPSHOT_STORE = 'restore_safety_snapshots';
const PRE_V3_BACKUP_KEY = 'pre-v3-engine-state';
const ENGINE_RECORD_KEY = 'engine_state_v1';

/**
 * Pure upgrade planner: existing stores are preserved and never recreated.
 */
export function getIndexedDbUpgradePlan(
  oldVersion: number,
  existingStoreNames: string[]
): { createStores: string[]; backupLegacyState: boolean } {
  const requiredStores = [STATE_STORE, PREF_STORE, MEDIA_STORE, MIGRATION_BACKUP_STORE, MIGRATION_META_STORE, RESTORE_SNAPSHOT_STORE];
  return {
    createStores: requiredStores.filter((name) => !existingStoreNames.includes(name)),
    backupLegacyState: oldVersion > 0 && oldVersion < 3 && existingStoreNames.includes(STATE_STORE),
  };
}

/** Read the immutable snapshot captured before the v3 IndexedDB upgrade. */
export async function idbGetPreV3MigrationBackup(): Promise<BusinessEngineState | null> {
  const db = await openKarkasiaDb();
  if (!db || !db.objectStoreNames.contains(MIGRATION_BACKUP_STORE)) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: BusinessEngineState | null) => {
      if (!settled) { settled = true; resolve(value); }
    };
    try {
      const tx = db.transaction(MIGRATION_BACKUP_STORE, 'readonly');
      const req = tx.objectStore(MIGRATION_BACKUP_STORE).get(PRE_V3_BACKUP_KEY);
      req.onsuccess = () => {
        const record = req.result as { state?: BusinessEngineState } | undefined;
        finish(record?.state && typeof record.state === 'object' ? record.state : null);
      };
      req.onerror = () => finish(null);
      tx.oncomplete = () => db.close();
      tx.onerror = tx.onabort = () => { db.close(); finish(null); };
    } catch {
      db.close();
      finish(null);
    }
  });
}

export interface IndexedDbDiagnostics {
  supported: boolean;
  dbName: string;
  hasPersistedState: boolean;
  approxBytes: number;
  lastSavedAt: string | null;
  persistentStorage: boolean | null;
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}


/** Ask the browser to protect this origin's storage from automatic eviction.
 * This is best-effort only: false/null never means that IndexedDB is unusable.
 */
export async function idbRequestPersistentStorage(
  storage?: Pick<StorageManager, 'persist' | 'persisted'>
): Promise<boolean | null> {
  try {
    const manager = storage ?? (typeof navigator !== 'undefined' ? navigator.storage : undefined);
    if (!manager || typeof manager.persist !== 'function' || typeof manager.persisted !== 'function') return null;
    if (await manager.persisted()) return true;
    return await manager.persist();
  } catch {
    return false;
  }
}

async function readPersistentStorageStatus(): Promise<boolean | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.persisted !== 'function') return null;
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export function openKarkasiaDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        // A request may succeed after onblocked already returned null.
        // Close that late connection so it cannot block a future schema upgrade.
        if (db) db.close();
        return;
      }
      settled = true;
      resolve(db);
    };

    try {
      const request = window.indexedDB.open(KARKASIA_IDB_NAME, KARKASIA_IDB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction;
        if (!tx) {
          try { db.close(); } catch { /* ignore */ }
          finish(null);
          return;
        }
        const oldVersion = typeof event?.oldVersion === 'number' ? event.oldVersion : 0;
        const plan = getIndexedDbUpgradePlan(oldVersion, Array.from(db.objectStoreNames));
        for (const storeName of plan.createStores) db.createObjectStore(storeName);
        if (plan.backupLegacyState) {
          const snapshotRequest = tx.objectStore(STATE_STORE).get(ENGINE_RECORD_KEY);
          snapshotRequest.onsuccess = () => {
            if (snapshotRequest.result !== undefined) {
              tx.objectStore(MIGRATION_BACKUP_STORE).put({
                state: snapshotRequest.result,
                createdAt: new Date().toISOString(),
                fromVersion: oldVersion,
                toVersion: KARKASIA_IDB_VERSION,
              }, PRE_V3_BACKUP_KEY);
            }
          };
          snapshotRequest.onerror = () => {
            try { tx.abort(); } catch { /* transaction may already be inactive */ }
          };
        }
        tx.objectStore(MIGRATION_META_STORE).put({
          version: KARKASIA_IDB_VERSION,
          migratedAt: new Date().toISOString(),
          fromVersion: oldVersion,
        }, 'schema-version');
      };

      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
}

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueueDbOp<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.catch(() => undefined);
  return next;
}

export async function idbGetEngineState(): Promise<BusinessEngineState | null> {
  const db = await openKarkasiaDb();
  if (!db) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: BusinessEngineState | null) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    try {
      const tx = db.transaction(STATE_STORE, 'readonly');
      const store = tx.objectStore(STATE_STORE);
      const req = store.get(ENGINE_RECORD_KEY);

      req.onsuccess = () => {
        const val = req.result as BusinessEngineState | undefined;
        finish(val && typeof val === 'object' ? val : null);
      };
      req.onerror = () => finish(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => {
        db.close();
        finish(null);
      };
      tx.onerror = () => {
        db.close();
        finish(null);
      };
    } catch {
      db.close();
      finish(null);
    }
  });
}

export function idbSaveEngineState(state: BusinessEngineState): Promise<boolean> {
  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        const store = tx.objectStore(STATE_STORE);
        const req = store.put(state, ENGINE_RECORD_KEY);

        req.onerror = () => finish(false);
        tx.oncomplete = () => {
          db.close();
          finish(true);
        };
        tx.onerror = () => {
          db.close();
          finish(false);
        };
        tx.onabort = () => {
          db.close();
          finish(false);
        };
      } catch {
        db.close();
        finish(false);
      }
    });
  });
}

export function idbClearEngineState(): Promise<boolean> {
  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        const store = tx.objectStore(STATE_STORE);
        const req = store.delete(ENGINE_RECORD_KEY);

        req.onerror = () => finish(false);
        tx.oncomplete = () => {
          db.close();
          finish(true);
        };
        tx.onerror = () => {
          db.close();
          finish(false);
        };
        tx.onabort = () => {
          db.close();
          finish(false);
        };
      } catch {
        db.close();
        finish(false);
      }
    });
  });
}

export async function idbGetPreference<T>(key: string): Promise<T | null> {
  const db = await openKarkasiaDb();
  if (!db) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: T | null) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    try {
      const tx = db.transaction(PREF_STORE, 'readonly');
      const store = tx.objectStore(PREF_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        finish(req.result !== undefined ? (req.result as T) : null);
      };
      req.onerror = () => finish(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => {
        db.close();
        finish(null);
      };
      tx.onerror = () => {
        db.close();
        finish(null);
      };
    } catch {
      db.close();
      finish(null);
    }
  });
}

export function idbSetPreference<T>(key: string, value: T): Promise<boolean> {
  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        const tx = db.transaction(PREF_STORE, 'readwrite');
        const store = tx.objectStore(PREF_STORE);
        const req = store.put(value, key);

        req.onerror = () => finish(false);
        tx.oncomplete = () => {
          db.close();
          finish(true);
        };
        tx.onerror = () => {
          db.close();
          finish(false);
        };
        tx.onabort = () => {
          db.close();
          finish(false);
        };
      } catch {
        db.close();
        finish(false);
      }
    });
  });
}

export async function idbGetDiagnostics(): Promise<IndexedDbDiagnostics> {
  const supported = isIndexedDbAvailable();
  if (!supported) {
    return {
      supported: false,
      dbName: KARKASIA_IDB_NAME,
      hasPersistedState: false,
      approxBytes: 0,
      lastSavedAt: null,
      persistentStorage: await readPersistentStorageStatus(),
    };
  }

  const state = await idbGetEngineState();
  if (!state) {
    return {
      supported: true,
      dbName: KARKASIA_IDB_NAME,
      hasPersistedState: false,
      approxBytes: 0,
      lastSavedAt: null,
    };
  }

  let approxBytes = 0;
  try {
    approxBytes = new Blob([JSON.stringify(state)]).size;
  } catch {
    approxBytes = JSON.stringify(state).length;
  }

  return {
    supported: true,
    dbName: KARKASIA_IDB_NAME,
    hasPersistedState: true,
    approxBytes,
    lastSavedAt: state.lastUpdatedAt ?? null,
    persistentStorage: await readPersistentStorageStatus(),
  };
}


/** Store binary evidence separately from the business-engine JSON state. */
export async function idbSaveMediaBlob(mediaId: string, blob: Blob): Promise<boolean> {
  if (!mediaId || !(blob instanceof Blob) || blob.size <= 0) return false;
  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
      try {
        const tx = db.transaction(MEDIA_STORE, 'readwrite');
        tx.objectStore(MEDIA_STORE).put({ blob, type: blob.type, size: blob.size, savedAt: new Date().toISOString() }, mediaId);
        tx.oncomplete = () => { db.close(); finish(true); };
        tx.onerror = tx.onabort = () => { db.close(); finish(false); };
      } catch { db.close(); finish(false); }
    });
  });
}

export async function idbGetMediaBlob(mediaId: string): Promise<Blob | null> {
  const db = await openKarkasiaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Blob | null) => { if (!settled) { settled = true; resolve(value); } };
    try {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_STORE).get(mediaId);
      req.onsuccess = () => {
        const record = req.result as { blob?: Blob } | undefined;
        finish(record?.blob instanceof Blob ? record.blob : null);
      };
      req.onerror = () => finish(null);
      tx.oncomplete = () => db.close();
      tx.onerror = tx.onabort = () => { db.close(); finish(null); };
    } catch { db.close(); finish(null); }
  });
}


/** Replace the complete attachment set in one IndexedDB transaction. */
export async function idbReplaceAllMediaBlobs(items: Array<{ mediaId: string; blob: Blob }>): Promise<boolean> {
  if (items.some((item) => !item.mediaId || !(item.blob instanceof Blob) || item.blob.size <= 0)) return false;
  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => { if (!settled) { settled = true; resolve(ok); } };
      try {
        const tx = db.transaction(MEDIA_STORE, 'readwrite');
        const store = tx.objectStore(MEDIA_STORE);
        store.clear();
        for (const item of items) {
          store.put({ blob: item.blob, type: item.blob.type, size: item.blob.size, savedAt: new Date().toISOString() }, item.mediaId);
        }
        tx.oncomplete = () => { db.close(); finish(true); };
        tx.onerror = tx.onabort = () => { db.close(); finish(false); };
      } catch { db.close(); finish(false); }
    });
  });
}
/**
 * Atomically records a safety snapshot, restores engine state, and optionally
 * replaces attachments. If the snapshot cannot be stored, the restore aborts.
 */
export async function idbRestoreStateWithSafetySnapshot(
  state: BusinessEngineState,
  attachments: Array<{ mediaId: string; blob: Blob }>,
  importAttachments: boolean,
  expectedCurrentState: BusinessEngineState
): Promise<boolean> {
  if (attachments.some((item) =>
    !item.mediaId || !(item.blob instanceof Blob) || item.blob.size <= 0 ||
    item.blob.type !== 'image/jpeg' || item.blob.size > 1024 * 1024
  )) return false;
  if (new Set(attachments.map((item) => item.mediaId)).size !== attachments.length) return false;

  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let stateReady = false;
      let keysReady = false;
      let valuesReady = false;
      let snapshotWritten = false;
      let previousState: BusinessEngineState | null = null;
      let previousKeys: IDBValidKey[] = [];
      let previousValues: unknown[] = [];
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        db.close();
        resolve(ok);
      };
      try {
        const tx = db.transaction([STATE_STORE, MEDIA_STORE, RESTORE_SNAPSHOT_STORE], 'readwrite');
        const stateStore = tx.objectStore(STATE_STORE);
        const mediaStore = tx.objectStore(MEDIA_STORE);
        const snapshotStore = tx.objectStore(RESTORE_SNAPSHOT_STORE);
        const stateRequest = stateStore.get(ENGINE_RECORD_KEY);
        const keysRequest = mediaStore.getAllKeys();
        const valuesRequest = mediaStore.getAll();

        const commitWhenReady = () => {
          if (!stateReady || !keysReady || !valuesReady || snapshotWritten) return;
          snapshotWritten = true;
          if (previousKeys.length !== previousValues.length ||
              (previousState && JSON.stringify(previousState) !== JSON.stringify(expectedCurrentState))) {
            // A newer local write reached IndexedDB after the restore preflight.
            // Abort instead of replacing a state that was not reviewed by the Owner.
            try { tx.abort(); } catch { /* transaction may already be inactive */ }
            return;
          }
          const previousAttachments = previousValues.map((record, index) => ({
            mediaId: String(previousKeys[index]),
            record,
          }));
          const snapshotId = `restore-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          try {
            snapshotStore.put({
              id: snapshotId,
              createdAt: new Date().toISOString(),
              state: previousState ?? expectedCurrentState,
              attachments: previousAttachments,
              restoreTargetUpdatedAt: state.lastUpdatedAt,
            }, snapshotId);
            stateStore.put(state, ENGINE_RECORD_KEY);
            if (importAttachments) {
              // Import missing attachment IDs only. Never delete or overwrite a blob
              // that is already present on this device.
              const existingMediaIds = new Set(previousKeys.map((key) => String(key)));
              for (const item of attachments) {
                if (existingMediaIds.has(item.mediaId)) continue;
                mediaStore.put({
                  blob: item.blob,
                  type: item.blob.type,
                  size: item.blob.size,
                  savedAt: new Date().toISOString(),
                }, item.mediaId);
              }
            }
          } catch {
            // Synchronous DataCloneError/constraint failures must roll back every
            // queued write in this transaction, including the safety snapshot.
            try { tx.abort(); } catch { /* transaction may already be inactive */ }
          }
        };

        stateRequest.onsuccess = () => {
          previousState = stateRequest.result && typeof stateRequest.result === 'object'
            ? stateRequest.result as BusinessEngineState
            : null;
          stateReady = true;
          commitWhenReady();
        };
        keysRequest.onsuccess = () => {
          previousKeys = keysRequest.result;
          keysReady = true;
          commitWhenReady();
        };
        valuesRequest.onsuccess = () => {
          previousValues = valuesRequest.result;
          valuesReady = true;
          commitWhenReady();
        };
        stateRequest.onerror = keysRequest.onerror = valuesRequest.onerror = () => {
          try { tx.abort(); } catch { /* transaction may already be inactive */ }
        };
        tx.oncomplete = () => finish(true);
        tx.onerror = tx.onabort = () => finish(false);
      } catch {
        finish(false);
      }
    });
  });
}


export interface RestoreSafetySnapshotInfo {
  id: string;
  createdAt: string;
  restoreTargetUpdatedAt: string | null;
  attachmentCount: number;
}

interface StoredRestoreSafetySnapshot extends RestoreSafetySnapshotInfo {
  state: BusinessEngineState;
  attachments: Array<{ mediaId: string; record: unknown }>;
}

/** Return only metadata for the newest recoverable safety snapshot. */
export async function idbGetLatestRestoreSafetySnapshotInfo(): Promise<RestoreSafetySnapshotInfo | null> {
  const db = await openKarkasiaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: RestoreSafetySnapshotInfo | null) => {
      if (!settled) { settled = true; resolve(value); }
    };
    try {
      const tx = db.transaction(RESTORE_SNAPSHOT_STORE, 'readonly');
      const req = tx.objectStore(RESTORE_SNAPSHOT_STORE).getAll();
      req.onsuccess = () => {
        const records = (req.result as StoredRestoreSafetySnapshot[]).filter((item) =>
          item && typeof item.id === 'string' && item.state && Array.isArray(item.attachments) &&
          typeof item.createdAt === 'string'
        );
        records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const latest = records[0];
        finish(latest ? {
          id: latest.id,
          createdAt: latest.createdAt,
          restoreTargetUpdatedAt: latest.restoreTargetUpdatedAt ?? null,
          attachmentCount: latest.attachments.length,
        } : null);
      };
      req.onerror = () => finish(null);
      tx.oncomplete = () => db.close();
      tx.onerror = tx.onabort = () => { db.close(); finish(null); };
    } catch { db.close(); finish(null); }
  });
}


/** Read a snapshot payload for the Owner confirmation flow. */
export async function idbGetRestoreSafetySnapshot(
  snapshotId: string
): Promise<{ state: BusinessEngineState } | null> {
  if (!snapshotId) return null;
  const db = await openKarkasiaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { state: BusinessEngineState } | null) => {
      if (!settled) { settled = true; resolve(value); }
    };
    try {
      const tx = db.transaction(RESTORE_SNAPSHOT_STORE, 'readonly');
      const req = tx.objectStore(RESTORE_SNAPSHOT_STORE).get(snapshotId);
      req.onsuccess = () => {
        const record = req.result as StoredRestoreSafetySnapshot | undefined;
        finish(record?.state && Array.isArray(record.attachments) ? { state: record.state } : null);
      };
      req.onerror = () => finish(null);
      tx.oncomplete = () => db.close();
      tx.onerror = tx.onabort = () => { db.close(); finish(null); };
    } catch { db.close(); finish(null); }
  });
}

/**
 * Restore a stored safety snapshot atomically. The currently active state and
 * media are snapshotted first; stale UI state aborts the operation.
 */
export async function idbRestoreSafetySnapshot(
  snapshotId: string,
  expectedCurrentState: BusinessEngineState,
  restoredState: BusinessEngineState
): Promise<boolean> {
  if (!snapshotId) return false;
  return enqueueDbOp(async () => {
    const db = await openKarkasiaDb();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        db.close();
        resolve(ok);
      };
      try {
        const tx = db.transaction([STATE_STORE, MEDIA_STORE, RESTORE_SNAPSHOT_STORE], 'readwrite');
        const stateStore = tx.objectStore(STATE_STORE);
        const mediaStore = tx.objectStore(MEDIA_STORE);
        const snapshotStore = tx.objectStore(RESTORE_SNAPSHOT_STORE);
        const currentReq = stateStore.get(ENGINE_RECORD_KEY);
        const mediaKeysReq = mediaStore.getAllKeys();
        const mediaValuesReq = mediaStore.getAll();
        const targetReq = snapshotStore.get(snapshotId);
        let ready = 0;
        let current: BusinessEngineState | null = null;
        let mediaKeys: IDBValidKey[] = [];
        let mediaValues: unknown[] = [];
        let target: StoredRestoreSafetySnapshot | null = null;
        const commit = () => {
          if (++ready !== 4) return;
          if (!target || !target.state || !Array.isArray(target.attachments) ||
              mediaKeys.length !== mediaValues.length ||
              (current && JSON.stringify(current) !== JSON.stringify(expectedCurrentState))) {
            try { tx.abort(); } catch { /* transaction may already be inactive */ }
            return;
          }
          const now = new Date().toISOString();
          const currentAttachments = mediaValues.map((record, index) => ({
            mediaId: String(mediaKeys[index]), record,
          }));
          const safetyId = `restore-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          try {
            snapshotStore.put({
              id: safetyId,
              createdAt: now,
              state: current ?? expectedCurrentState,
              attachments: currentAttachments,
              restoreTargetUpdatedAt: restoredState.lastUpdatedAt,
            }, safetyId);
            stateStore.put(restoredState, ENGINE_RECORD_KEY);
            mediaStore.clear();
            for (const item of target.attachments) {
              if (!item || typeof item.mediaId !== 'string' || !item.mediaId || !item.record) {
                try { tx.abort(); } catch { /* transaction may already be inactive */ }
                return;
              }
              mediaStore.put(item.record, item.mediaId);
            }
          } catch {
            // A synchronous write failure must not leave the queued snapshot or
            // partial state/media writes committed.
            try { tx.abort(); } catch { /* transaction may already be inactive */ }
          }
        };
        currentReq.onsuccess = () => { current = currentReq.result && typeof currentReq.result === 'object' ? currentReq.result as BusinessEngineState : null; commit(); };
        mediaKeysReq.onsuccess = () => { mediaKeys = mediaKeysReq.result; commit(); };
        mediaValuesReq.onsuccess = () => { mediaValues = mediaValuesReq.result; commit(); };
        targetReq.onsuccess = () => { target = targetReq.result as StoredRestoreSafetySnapshot | undefined ?? null; commit(); };
        currentReq.onerror = mediaKeysReq.onerror = mediaValuesReq.onerror = targetReq.onerror = () => {
          try { tx.abort(); } catch { /* transaction may already be inactive */ }
        };
        tx.oncomplete = () => finish(true);
        tx.onerror = tx.onabort = () => finish(false);
      } catch { finish(false); }
    });
  });
}

/** Read all persisted binary attachments for a portable backup package. */
export async function idbGetAllMediaBlobs(): Promise<Array<{ mediaId: string; blob: Blob }>> {
  const db = await openKarkasiaDb();
  if (!db) throw new Error('IndexedDB tidak tersedia. Backup lampiran dibatalkan agar tidak menghasilkan file yang tidak lengkap.');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | null, items: Array<{ mediaId: string; blob: Blob }> = []) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(items);
    };
    try {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      let keys: IDBValidKey[] | null = null;
      let values: unknown[] | null = null;
      keysReq.onsuccess = () => { keys = keysReq.result; };
      valuesReq.onsuccess = () => { values = valuesReq.result; };
      keysReq.onerror = valuesReq.onerror = () => finish(new Error('Gagal membaca daftar lampiran dari IndexedDB.'));
      tx.oncomplete = () => {
        try {
          if (!keys || !values || keys.length !== values.length) {
            throw new Error('Daftar lampiran tidak lengkap. Backup dibatalkan.');
          }
          const items = values.map((value: any, index) => {
            if (!value || !(value.blob instanceof Blob) || typeof keys![index] !== 'string') {
              throw new Error('Ditemukan lampiran rusak di penyimpanan. Backup dibatalkan agar data tidak hilang.');
            }
            return { mediaId: keys![index] as string, blob: value.blob };
          });
          db.close();
          finish(null, items);
        } catch (error) {
          db.close();
          finish(error instanceof Error ? error : new Error('Gagal memeriksa lampiran.'));
        }
      };
      tx.onerror = tx.onabort = () => { db.close(); finish(new Error('Transaksi pembacaan lampiran gagal. Backup dibatalkan.')); };
    } catch (error) {
      db.close();
      finish(error instanceof Error ? error : new Error('Tidak dapat membaca lampiran dari IndexedDB.'));
    }
  });
}
