import type { BusinessEngineState } from './types';

export const KARKASIA_IDB_NAME = 'karkasia_erp_offline_db';
export const KARKASIA_IDB_VERSION = 1;
const STATE_STORE = 'kv_state';
const PREF_STORE = 'preferences';
const ENGINE_RECORD_KEY = 'engine_state_v1';

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

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE);
        }
        if (!db.objectStoreNames.contains(PREF_STORE)) {
          db.createObjectStore(PREF_STORE);
        }
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
