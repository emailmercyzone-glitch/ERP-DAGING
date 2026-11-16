import type { BusinessEngineState } from '../engine/types';
import { idbGetPreference, idbSetPreference } from '../engine/indexedDbStorage';
import type {
  BackendAdapter,
  BackendAdapterConfig,
  BackendAdapterType,
  OutboxPushResult,
} from './backendAdapter';
import { LocalOnlyBackendAdapter } from './localOnlyAdapter';
import { RestApiBackendAdapter } from './restApiAdapter';
import { SupabaseBackendAdapter } from './supabaseAdapter';
import { GoogleSheetsBackendAdapter } from './googleSheetsAdapter';

/** Stable identity for the remote data namespace; credentials are deliberately excluded. */
export function getBackendConfigIdentity(config: BackendAdapterConfig): string {
  const identity = {
    adapterType: config.adapterType,
    storeId: config.adapterType === 'GOOGLE_SHEETS' ? 'membership-scoped' : (config.storeId || '').trim(),
    endpointUrl: ['REST_API', 'ZIMAOS', 'POSTGRES_BRIDGE'].includes(config.adapterType)
      ? (config.endpointUrl || '').trim().replace(/\/+$/, '')
      : '',
    supabaseUrl: config.adapterType === 'SUPABASE'
      ? (config.supabaseUrl || '').trim().replace(/\/+$/, '').toLowerCase()
      : '',
  };
  return JSON.stringify(identity);
}

/**
 * A remote-to-remote switch is unsafe once local state may contain events
 * accepted by the current/previous server. Migration must move event history
 * and the matching checkpoint before activating another remote namespace.
 */
export function backendSwitchRequiresMigration(
  current: BackendAdapterConfig,
  next: BackendAdapterConfig,
  state: Pick<BusinessEngineState, 'lastServerSeq' | 'syncOutbox'>
): boolean {
  if (getBackendConfigIdentity(current) === getBackendConfigIdentity(next)) return false;
  if (next.adapterType === 'LOCAL_ONLY') return false;
  // A remote namespace may contain events created by other devices even when
  // this device has cursor 0. Never infer global emptiness from one device.
  if (current.adapterType !== 'LOCAL_ONLY') return true;
  // Returning from LOCAL_ONLY to a remote target is allowed only when this
  // device has no evidence of a previous remote history.
  return (Number.isSafeInteger(state.lastServerSeq) && (state.lastServerSeq ?? 0) > 0) ||
    state.syncOutbox.some((item) =>
      item.status === 'SYNCED' || item.status === 'FAILED' || (item.retryCount ?? 0) > 0
    );
}
export const BACKEND_CONFIG_STORAGE_KEY = 'karkasia_backend_adapter_config_v1';
const BACKEND_CONFIG_IDB_KEY = 'backend_adapter_config_v1';

export const DEFAULT_BACKEND_CONFIG: BackendAdapterConfig = {
  adapterType: 'LOCAL_ONLY',
  storeId: 'TOKO_KARKASIA_01',
  endpointUrl: '',
  apiKeyOrToken: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  updatedAt: new Date(0).toISOString(),
};

export const BACKEND_ADAPTER_OPTIONS: Array<{
  type: BackendAdapterType;
  label: string;
  shortLabel: string;
  description: string;
  requiresNetwork: boolean;
}> = [
  {
    type: 'LOCAL_ONLY',
    label: 'Mode Lokal Mandiri (Tanpa Server)',
    shortLabel: 'Lokal Mandiri',
    description:
      'Operasional penuh offline di perangkat menggunakan IndexedDB tanpa internet atau server. Transaksi antre aman di Outbox.',
    requiresNetwork: false,
  },
  {
    type: 'REST_API',
    label: 'REST API Mandiri',
    shortLabel: 'REST API',
    description: 'Server HTTP/JSON apa pun yang menyediakan endpoint /health, /sync/push, dan /sync/pull.',
    requiresNetwork: true,
  },
  {
    type: 'ZIMAOS',
    label: 'ZimaOS Self-Hosted Server',
    shortLabel: 'ZimaOS',
    description: 'Server lokal toko/kantor berbasis ZimaOS Docker di jaringan LAN atau tunnel.',
    requiresNetwork: true,
  },
  {
    type: 'POSTGRES_BRIDGE',
    label: 'PostgreSQL HTTP Bridge',
    shortLabel: 'PostgreSQL',
    description: 'Gateway PostgreSQL mandiri (PostgREST / Node / Go bridge) tanpa ketergantungan cloud vendor.',
    requiresNetwork: true,
  },
  {
    type: 'GOOGLE_SHEETS',
    label: 'Google Sheets via GAS Gateway',
    shortLabel: 'Google Sheets',
    description: 'Sinkronisasi dua arah melalui Apps Script Gateway dengan ACK, idempotency, cursor, dan media.',
    requiresNetwork: true,
  },
  {
    type: 'SUPABASE',
    label: 'Supabase (Opsional)',
    shortLabel: 'Supabase',
    description: 'Koneksi opsional ke project Supabase milik sendiri via URL & Anon Key yang Anda masukkan.',
    requiresNetwork: true,
  },
];

const VALID_TYPES = new Set<BackendAdapterType>([
  'LOCAL_ONLY',
  'REST_API',
  'ZIMAOS',
  'SUPABASE',
  'POSTGRES_BRIDGE',
  'GOOGLE_SHEETS',
]);

export function normalizeBackendConfig(raw: unknown): BackendAdapterConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_BACKEND_CONFIG };
  }
  const obj = raw as Partial<BackendAdapterConfig>;
  const adapterType: BackendAdapterType =
    obj.adapterType && VALID_TYPES.has(obj.adapterType) ? obj.adapterType : 'LOCAL_ONLY';

  return {
    adapterType,
    storeId: typeof obj.storeId === 'string' && obj.storeId.trim() ? obj.storeId.trim() : 'TOKO_KARKASIA_01',
    // Legacy GAS URL/secret values must be scrubbed from browser storage; GAS now uses the server proxy.
    endpointUrl: adapterType === 'GOOGLE_SHEETS' ? '' : (typeof obj.endpointUrl === 'string' ? obj.endpointUrl : ''),
    apiKeyOrToken: adapterType === 'GOOGLE_SHEETS' ? '' : (typeof obj.apiKeyOrToken === 'string' ? obj.apiKeyOrToken : ''),
    supabaseUrl: typeof obj.supabaseUrl === 'string' ? obj.supabaseUrl : '',
    supabaseAnonKey: typeof obj.supabaseAnonKey === 'string' ? obj.supabaseAnonKey : '',
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  };
}

export function loadBackendConfig(): BackendAdapterConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_BACKEND_CONFIG };
  }
  try {
    const raw = window.localStorage.getItem(BACKEND_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BACKEND_CONFIG };
    const normalized = normalizeBackendConfig(JSON.parse(raw));
    // Persist the scrubbed config so a legacy GAS secret is not retained in either browser store.
    if (normalized.adapterType === 'GOOGLE_SHEETS') {
      window.localStorage.setItem(BACKEND_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
      void idbSetPreference(BACKEND_CONFIG_IDB_KEY, normalized);
    }
    return normalized;
  } catch {
    return { ...DEFAULT_BACKEND_CONFIG };
  }
}

export function saveBackendConfig(config: BackendAdapterConfig): BackendAdapterConfig {
  const normalized = normalizeBackendConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(BACKEND_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
    void idbSetPreference(BACKEND_CONFIG_IDB_KEY, normalized);
  }
  return normalized;
}

export async function hydrateBackendConfigFromIdb(): Promise<BackendAdapterConfig | null> {
  const saved = await idbGetPreference<BackendAdapterConfig>(BACKEND_CONFIG_IDB_KEY);
  if (!saved) return null;
  const normalized = normalizeBackendConfig(saved);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(BACKEND_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota errors
    }
  }
  if (normalized.adapterType === 'GOOGLE_SHEETS') {
    void idbSetPreference(BACKEND_CONFIG_IDB_KEY, normalized);
  }
  return normalized;
}

export function createBackendAdapter(
  config: BackendAdapterConfig,
  fetchFn?: typeof fetch
): BackendAdapter {
  const safeFetch = fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  switch (config.adapterType) {
    case 'REST_API':
    case 'ZIMAOS':
    case 'POSTGRES_BRIDGE':
      return new RestApiBackendAdapter(config.adapterType, config, safeFetch);
    case 'SUPABASE':
      return new SupabaseBackendAdapter(config, safeFetch);
    case 'GOOGLE_SHEETS':
      return new GoogleSheetsBackendAdapter(config, safeFetch);
    case 'LOCAL_ONLY':
    default:
      return new LocalOnlyBackendAdapter();
  }
}

/**
 * Executes Outbox push through the active BackendAdapter.
 * Rule 9: SYNCED is ONLY applied to items whose UUID is returned in acknowledgedIds.
 * In LOCAL_ONLY mode, items remain PENDING without fabrication.
 */
export async function executeOutboxSyncWithAdapter(
  state: BusinessEngineState,
  adapter: BackendAdapter
): Promise<{ state: BusinessEngineState; result: OutboxPushResult }> {
  if (adapter.type === 'LOCAL_ONLY') {
    return {
      state,
      result: { ok: true, skippedLocalOnly: true, acknowledgedIds: [], serverSeqs: {}, failedItems: [], message: 'Mode lokal aktif; sinkronisasi server tidak dijalankan.' },
    };
  }

  const pendingOrRetryItems = state.syncOutbox.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');
  let pushResult: OutboxPushResult = {
    ok: true, acknowledgedIds: [], serverSeqs: {}, failedItems: [], message: 'Tidak ada antrean kirim.',
  };

  if (pendingOrRetryItems.length > 0) {
    pushResult = await adapter.pushOutbox(pendingOrRetryItems, { storeName: state.storeName, deviceId: state.deviceId });
  }

  // Network I/O returns only a delta. State reducers/persistence must run later
  // inside App's durable mutation queue against the latest committed snapshot.
  const pullResult = await adapter.pullChanges(state.lastServerSeq ?? 0, { deviceId: state.deviceId });
  const pullMessage = pullResult.ok
    ? `${pullResult.records.length} event ditarik.`
    : `Pull gagal: ${pullResult.message}`;
  return {
    state,
    result: {
      ...pushResult,
      ok: pushResult.ok && pullResult.ok,
      message: `${pushResult.message} ${pullMessage}`,
      pulledRecords: pullResult.ok && !pullResult.skippedLocalOnly ? pullResult.records : [],
      pulledLastServerSeq: pullResult.ok ? pullResult.lastServerSeq : undefined,
      pullSucceeded: pullResult.ok,
    },
  };
}
