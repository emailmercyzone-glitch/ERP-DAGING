import type { BusinessEngineState } from './types';

export const KARKASIA_IDB_NAME = 'karkasia_erp_offline_db';
export const KARKASIA_IDB_VERSION = 3;
const STATE_STORE = 'kv_state';
const PREF_STORE = 'preferences';
const MEDIA_STORE = 'media_blobs';
const MIGRATION_BACKUP_STORE = 'migration_backups';
const MIGRATION_META_STORE = 'migration_meta';
const PRE_V3_BACKUP_KEY = 'pre-v3-engine-state';
const ENGINE_RECORD_KEY = 'engine_state_v1';

/**
 * Pure upgrade planner: existing stores are preserved and never recreated.
 */
export function getIndexedDbUpgradePlan(
  oldVersion: number,
  existingStoreNames: string[]
): { createStores: string[]; backupLegacyState: boolean } {
  const requiredStores = [STATE_STORE, PREF_STORE, MEDIA_STORE, MIGRATION_BACKUP_STORE, MIGRATION_META_STORE];
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
}

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

export function openKarkasiaDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(KARKASIA_IDB_NAME, KARKASIA_IDB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction;
        if (!tx) {
          try { db.close(); } catch { /* ignore */ }
          resolve(null);
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
          fromVersion: event.oldVersion,
        }, 'schema-version');
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
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


/** Read all persisted binary attachments for a portable backup package. */
export async function idbGetAllMediaBlobs(): Promise<Array<{ mediaId: string; blob: Blob }>> {
  const db = await openKarkasiaDb();
  if (!db) return [];
  return new Promise((resolve) => {
    let settled = false;
    const finish = (items: Array<{ mediaId: string; blob: Blob }>) => {
      if (!settled) { settled = true; resolve(items); }
    };
    try {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      tx.oncomplete = () => {
        const keys = keysReq.result || [];
        const values = valuesReq.result || [];
        const items = values.flatMap((value: { blob?: Blob }, index: number) =>
          value?.blob instanceof Blob && typeof keys[index] === 'string'
            ? [{ mediaId: keys[index] as string, blob: value.blob }]
            : []
        );
        db.close();
        finish(items);
      };
      tx.onerror = tx.onabort = () => { db.close(); finish([]); };
    } catch {
      db.close();
      finish([]);
    }
  });
}
