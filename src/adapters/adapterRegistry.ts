import type { BusinessEngineState } from '../engine/types';
import { applyOutboxSyncResults } from '../engine/businessEngine';
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

export const BACKEND_CONFIG_STORAGE_KEY = 'karkasia_backend_adapter_config_v1';
const BACKEND_CONFIG_IDB_KEY = 'backend_adapter_config_v1';

export const DEFAULT_BACKEND_CONFIG: BackendAdapterConfig = {
  adapterType: 'LOCAL_ONLY',
  storeId: 'TOKO_KARKASIA_01',
  endpointUrl: '',
  apiKeyOrToken: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  googleSheetId: '',
  googleSheetRange: 'OutboxSync!A:H',
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
      'Operasional penuh offline di perangkat (IndexedDB/SQLite) tanpa internet atau server. Transaksi antre aman di Outbox.',
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
    label: 'Google Sheets (Webhook / API v4)',
    shortLabel: 'Google Sheets',
    description: 'Sinkronisasi antrean Outbox langsung ke spreadsheet usaha Anda.',
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
    endpointUrl: typeof obj.endpointUrl === 'string' ? obj.endpointUrl : '',
    apiKeyOrToken: typeof obj.apiKeyOrToken === 'string' ? obj.apiKeyOrToken : '',
    supabaseUrl: typeof obj.supabaseUrl === 'string' ? obj.supabaseUrl : '',
    supabaseAnonKey: typeof obj.supabaseAnonKey === 'string' ? obj.supabaseAnonKey : '',
    googleSheetId: typeof obj.googleSheetId === 'string' ? obj.googleSheetId : '',
    googleSheetRange:
      typeof obj.googleSheetRange === 'string' && obj.googleSheetRange.trim()
        ? obj.googleSheetRange
        : 'OutboxSync!A:H',
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
    return normalizeBackendConfig(JSON.parse(raw));
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
): Promise<{
  state: BusinessEngineState;
  result: OutboxPushResult;
}> {
  const pendingOrRetryItems = state.syncOutbox.filter(
    (s) => s.status === 'PENDING' || s.status === 'FAILED'
  );

  if (pendingOrRetryItems.length === 0) {
    return {
      state,
      result: {
        ok: true,
        skippedLocalOnly: adapter.type === 'LOCAL_ONLY',
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: [],
        message: 'Seluruh transaksi sudah tersinkron. Tidak ada antrean tertunda.',
      },
    };
  }

  const pushResult = await adapter.pushOutbox(pendingOrRetryItems, {
    storeName: state.storeName,
    deviceId: state.deviceId,
  });

  if (pushResult.skippedLocalOnly) {
    return { state, result: pushResult };
  }

  const nextState = applyOutboxSyncResults(state, {
    acknowledgedIds: pushResult.acknowledgedIds,
    serverSeqs: pushResult.serverSeqs,
    failedItems: pushResult.failedItems,
    backendType: adapter.type,
    adapterDisplayName: adapter.displayName,
  });

  return { state: nextState, result: pushResult };
}
