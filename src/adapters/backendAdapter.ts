import type { SyncOutboxItem } from '../engine/types';

export type BackendAdapterType =
  | 'LOCAL_ONLY'
  | 'REST_API'
  | 'ZIMAOS'
  | 'SUPABASE'
  | 'POSTGRES_BRIDGE'
  | 'GOOGLE_SHEETS';

export interface BackendAdapterConfig {
  adapterType: BackendAdapterType;
  storeId: string;
  endpointUrl?: string;
  apiKeyOrToken?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  googleSheetId?: string;
  googleSheetRange?: string;
  updatedAt: string;
}

export interface HealthCheckResult {
  ok: boolean;
  adapterType: BackendAdapterType;
  latencyMs: number;
  message: string;
  serverTime?: string;
}

export interface OutboxPushResult {
  ok: boolean;
  skippedLocalOnly?: boolean;
  acknowledgedIds: string[];
  serverSeqs: Record<string, number>;
  failedItems: Array<{ uuid: string; error: string }>;
  message: string;
  pulledCount?: number;
}

export interface PullChangesResult {
  ok: boolean;
  skippedLocalOnly?: boolean;
  records: Array<Record<string, unknown>>;
  lastServerSeq?: number;
  message: string;
}

export interface VoiceParseItemResult {
  productSku: string;
  productName: string;
  weightGram: number;
  quantityPcs: number;
  unitPriceRupiah: number;
}

export interface VoiceParseAdapterResult {
  customerName: string;
  paymentMethod: 'CASH' | 'TRANSFER' | 'TEMPO';
  tempoDays: number;
  notes: string;
  confidenceScore: number;
  source: string;
  items: VoiceParseItemResult[];
}

export interface ArchiveUploadResult {
  ok: boolean;
  storedLocally?: boolean;
  locationLabel: string;
  url?: string;
  message: string;
}

export interface SyncContext {
  storeName: string;
  deviceId: string;
}

/**
 * Vendor-agnostic Backend Adapter Contract.
 * Swapping between Local-Only, Google Sheets, PostgreSQL Bridge, Supabase,
 * REST API, or ZimaOS must NEVER alter ERP business logic or UI rules.
 */
export interface BackendAdapter {
  readonly type: BackendAdapterType;
  readonly displayName: string;
  readonly requiresNetwork: boolean;

  checkHealth(): Promise<HealthCheckResult>;
  pushOutbox(items: SyncOutboxItem[], context: SyncContext): Promise<OutboxPushResult>;
  pullChanges(sinceSeq: number, context: { deviceId: string }): Promise<PullChangesResult>;
  parseVoiceOrder(transcript: string): Promise<VoiceParseAdapterResult>;
  uploadMedia?(params: {
    mediaId: string;
    filename: string;
    blob: Blob;
  }): Promise<{ ok: boolean; remoteFileId?: string; url?: string; message: string }>;
  downloadMedia?(params: {
    mediaId: string;
  }): Promise<{ ok: boolean; blob?: Blob; message: string }>;
  uploadArchiveDocument?(params: {
    filename: string;
    blob: Blob;
    description?: string;
  }): Promise<ArchiveUploadResult>;
}
