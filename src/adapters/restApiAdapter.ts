import type { SyncOutboxItem } from '../engine/types';
import type {
  BackendAdapter,
  BackendAdapterConfig,
  HealthCheckResult,
  OutboxPushResult,
  PullChangesResult,
  SyncContext,
  VoiceParseAdapterResult,
} from './backendAdapter';
import { parseIndonesianVoiceOrderLocally } from './localVoiceParser';

const TYPE_DISPLAY_NAMES: Record<'REST_API' | 'ZIMAOS' | 'POSTGRES_BRIDGE', string> = {
  REST_API: 'REST API Mandiri',
  ZIMAOS: 'ZimaOS Self-Hosted Server',
  POSTGRES_BRIDGE: 'PostgreSQL HTTP Bridge',
};

/**
 * Generic HTTP/JSON Adapter supporting REST API, ZimaOS self-hosted containers,
 * and PostgreSQL HTTP Bridge (e.g., PostgREST / custom Go/Node/Rust gateway).
 */
export class RestApiBackendAdapter implements BackendAdapter {
  readonly type: 'REST_API' | 'ZIMAOS' | 'POSTGRES_BRIDGE';
  readonly displayName: string;
  readonly requiresNetwork = true;
  private readonly config: BackendAdapterConfig;
  private readonly fetchFn: typeof fetch;

  constructor(
    type: 'REST_API' | 'ZIMAOS' | 'POSTGRES_BRIDGE',
    config: BackendAdapterConfig,
    fetchFn: typeof fetch = fetch
  ) {
    this.type = type;
    this.displayName = TYPE_DISPLAY_NAMES[type];
    this.config = config;
    this.fetchFn = fetchFn;
  }

  private getBaseUrl(): string {
    return (this.config.endpointUrl || '').trim().replace(/\/+$/, '');
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Store-Id': this.config.storeId || 'TOKO_KARKASIA_01',
      'X-Backend-Adapter': this.type,
    };
    if (this.config.apiKeyOrToken && this.config.apiKeyOrToken.trim()) {
      headers['Authorization'] = `Bearer ${this.config.apiKeyOrToken.trim()}`;
    }
    return headers;
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: 0,
        message: `URL endpoint ${this.displayName} belum diisi.`,
      };
    }

    const start = Date.now();
    try {
      const res = await this.fetchFn(`${baseUrl}/health`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          ok: false,
          adapterType: this.type,
          latencyMs,
          message: `Server merespons HTTP ${res.status}. Pastikan endpoint ${baseUrl}/health aktif.`,
        };
      }
      let serverTime: string | undefined;
      try {
        const body = await res.json();
        serverTime = typeof body?.timestamp === 'string' ? body.timestamp : undefined;
      } catch {
        // Ignore non-JSON health body when HTTP 200
      }
      return {
        ok: true,
        adapterType: this.type,
        latencyMs,
        serverTime,
        message: `${this.displayName} terhubung (${latencyMs} ms).`,
      };
    } catch (err) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: Date.now() - start,
        message: `Tidak dapat menjangkau ${baseUrl}: ${err instanceof Error ? err.message : 'Koneksi gagal'}`,
      };
    }
  }

  async pushOutbox(items: SyncOutboxItem[], context: SyncContext): Promise<OutboxPushResult> {
    if (items.length === 0) {
      return {
        ok: true,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: [],
        message: 'Tidak ada antrean yang perlu dikirim.',
      };
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((item) => ({
          uuid: item.uuid,
          error: `URL endpoint ${this.displayName} belum dikonfigurasi.`,
        })),
        message: `Konfigurasi URL ${this.displayName} belum lengkap. Antrean tetap aman di perangkat (PENDING).`,
      };
    }

    try {
      const res = await this.fetchFn(`${baseUrl}/sync/push`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          storeId: this.config.storeId || 'TOKO_KARKASIA_01',
          storeName: context.storeName,
          deviceId: context.deviceId,
          adapterType: this.type,
          events: items.map((item) => ({
            uuid: item.uuid,
            idempotencyKey: item.idempotencyKey,
            entityType: item.entityType,
            createdAt: item.createdAt,
            summary: item.summary,
            payload: item.payload ?? {},
          })),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const msg = `Server menolak sinkronisasi (HTTP ${res.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`;
        return {
          ok: false,
          acknowledgedIds: [],
          serverSeqs: {},
          failedItems: items.map((item) => ({ uuid: item.uuid, error: msg })),
          message: msg,
        };
      }

      const data = await res.json().catch(() => null);
      const acknowledgedIds: string[] = [];
      const serverSeqs: Record<string, number> = {};
      const ackSet = new Set<string>();

      if (Array.isArray(data?.acknowledgedIds)) {
        for (const id of data.acknowledgedIds) {
          if (typeof id === 'string') {
            ackSet.add(id);
            acknowledgedIds.push(id);
          }
        }
      }

      if (Array.isArray(data?.acks)) {
        for (const ack of data.acks) {
          const ackId = ack?.uuid || ack?.queue_id || ack?.id;
          if (typeof ackId === 'string') {
            if (!ackSet.has(ackId)) {
              ackSet.add(ackId);
              acknowledgedIds.push(ackId);
            }
            if (typeof ack?.server_seq === 'number') {
              serverSeqs[ackId] = ack.server_seq;
            } else if (typeof ack?.serverSeq === 'number') {
              serverSeqs[ackId] = ack.serverSeq;
            }
          }
        }
      }

      if (data?.serverSeqs && typeof data.serverSeqs === 'object') {
        for (const [k, v] of Object.entries(data.serverSeqs)) {
          if (typeof v === 'number') {
            serverSeqs[k] = v;
          }
        }
      }

      // Only items explicitly confirmed by server ACK become SYNCED.
      const rejected = Array.isArray(data?.rejected) ? data.rejected : [];
      const rejectedMap = new Map<string, string>();
      for (const r of rejected) {
        if (typeof r?.uuid === 'string') {
          rejectedMap.set(r.uuid, typeof r?.error === 'string' ? r.error : 'Ditolak server');
        }
      }

      const failedItems: Array<{ uuid: string; error: string }> = [];
      for (const item of items) {
        if (!ackSet.has(item.uuid)) {
          failedItems.push({
            uuid: item.uuid,
            error: rejectedMap.get(item.uuid) || 'Server tidak mengembalikan konfirmasi ACK untuk item ini.',
          });
        }
      }

      const ok = acknowledgedIds.length > 0 && failedItems.length === 0;
      return {
        ok,
        acknowledgedIds,
        serverSeqs,
        failedItems,
        message:
          acknowledgedIds.length > 0
            ? `${acknowledgedIds.length} transaksi dikonfirmasi diterima oleh ${this.displayName}.${failedItems.length > 0 ? ` (${failedItems.length} belum terkonfirmasi)` : ''}`
            : `Tidak ada item yang mendapat konfirmasi ACK dari ${this.displayName}.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungi server';
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((item) => ({ uuid: item.uuid, error: msg })),
        message: `Gagal kirim ke ${this.displayName}: ${msg}`,
      };
    }
  }

  async pullChanges(sinceSeq: number, context: { deviceId: string }): Promise<PullChangesResult> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return {
        ok: false,
        records: [],
        message: `URL endpoint ${this.displayName} belum diisi.`,
      };
    }

    try {
      const url = `${baseUrl}/sync/pull?since_seq=${encodeURIComponent(sinceSeq)}&device_id=${encodeURIComponent(context.deviceId)}&store_id=${encodeURIComponent(this.config.storeId || 'TOKO_KARKASIA_01')}`;
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      if (!res.ok) {
        return {
          ok: false,
          records: [],
          message: `Gagal menarik data (HTTP ${res.status}).`,
        };
      }
      const data = await res.json();
      const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [];
      return {
        ok: true,
        records,
        lastServerSeq: typeof data?.lastServerSeq === 'number' ? data.lastServerSeq : undefined,
        message: `${records.length} pembaruan ditarik dari ${this.displayName}.`,
      };
    } catch (err) {
      return {
        ok: false,
        records: [],
        message: `Gagal menarik data: ${err instanceof Error ? err.message : 'Koneksi gagal'}`,
      };
    }
  }

  async parseVoiceOrder(transcript: string): Promise<VoiceParseAdapterResult> {
    const baseUrl = this.getBaseUrl();
    if (baseUrl) {
      try {
        const res = await this.fetchFn(`${baseUrl}/ai/voice-parse`, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({ transcript }),
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.success && body?.data) {
            return {
              ...body.data,
              source: body.source || `${this.type.toLowerCase()}-remote`,
            };
          }
        }
      } catch {
        // Fall back cleanly to deterministic on-device Indonesian parser
      }
    }
    return parseIndonesianVoiceOrderLocally(transcript);
  }
}
