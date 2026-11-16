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
  pulledRecords?: Array<Record<string, unknown>>;
  pulledLastServerSeq?: number;
  pullSucceeded?: boolean;
}

export interface PullChangesResult {
  ok: boolean;
  skippedLocalOnly?: boolean;
  records: Array<Record<string, unknown>>;
  lastServerSeq?: number;
  message: string;
}

export interface VoiceParseContext {
  products: Array<{ sku: string; name: string; unitPriceRupiah: number }>;
  customers?: Array<{ id: string; name: string }>;
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
  parseVoiceOrder(transcript: string, context?: VoiceParseContext): Promise<VoiceParseAdapterResult>;
  uploadMedia?(params: {
    mediaId: string;
    deviceId: string;
    filename: string;
    blob: Blob;
  }): Promise<{ ok: boolean; remoteFileId?: string; url?: string; message: string }>;
  downloadMedia?(params: {
    mediaId: string;
    deviceId: string;
  }): Promise<{ ok: boolean; blob?: Blob; remoteFileId?: string; message: string }>;
}

/** A server ACK is final only when it carries a positive, safe server sequence. */
export function isValidServerSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Parse and validate the common ordered-event pull contract before applying it. */
export function validatePullChangesEnvelope(
  data: unknown,
  sinceSeq: number,
  adapterName: string
): PullChangesResult {
  const failure = (message: string): PullChangesResult => ({
    ok: false,
    records: [],
    message: `${adapterName} pull ditolak: ${message} Cursor lokal tidak dimajukan.`,
  });
  if (!Number.isSafeInteger(sinceSeq) || sinceSeq < 0) return failure('cursor awal tidak valid.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return failure('respons bukan objek JSON.');
  const body = data as Record<string, unknown>;
  if (body.ok === false) return failure(typeof body.message === 'string' ? body.message : 'server melaporkan kegagalan.');
  if (!Array.isArray(body.records)) return failure('field records tidak tersedia atau bukan array.');
  const cursor = body.lastServerSeq ?? body.last_server_seq;
  if (!Number.isSafeInteger(cursor) || Number(cursor) < sinceSeq) return failure('lastServerSeq harus integer aman dan tidak boleh mundur.');
  const records: Array<Record<string, unknown>> = [];
  const seenSequences = new Set<number>();
  let previousSequence = sinceSeq;
  for (const value of body.records) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return failure('records memuat baris yang bukan objek.');
    const record = value as Record<string, unknown>;
    const rawSequence = record.serverSeq ?? record.server_seq;
    if (!Number.isSafeInteger(rawSequence)) return failure('setiap event wajib memiliki serverSeq integer aman.');
    const sequence = Number(rawSequence);
    if (sequence <= sinceSeq || sequence > Number(cursor) || sequence <= previousSequence || seenSequences.has(sequence)) {
      return failure('serverSeq event tidak berurutan, duplikat, atau di luar rentang cursor.');
    }
    seenSequences.add(sequence);
    previousSequence = sequence;
    records.push({
      ...record,
      serverSeq: sequence,
      uuid: record.uuid ?? record.queue_id ?? record.id,
      idempotencyKey: record.idempotencyKey ?? record.idempotency_key,
      entityType: record.entityType ?? record.entity_type,
      payload: record.payload && typeof record.payload === 'object' ? record.payload : {},
    });
  }
  return {
    ok: true,
    records,
    lastServerSeq: Number(cursor),
    message: typeof body.message === 'string' ? body.message : `${records.length} event ditarik.`,
  };
}
