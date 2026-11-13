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

/**
 * Optional Supabase REST/RPC Adapter.
 * Never initialized at startup; only active when explicitly chosen by operator.
 * Strictly requires HTTP 2xx + explicit acks[] confirmation before marking SYNCED.
 */
export class SupabaseBackendAdapter implements BackendAdapter {
  readonly type = 'SUPABASE' as const;
  readonly displayName = 'Supabase (Opsional)';
  readonly requiresNetwork = true;
  private readonly config: BackendAdapterConfig;
  private readonly fetchFn: typeof fetch;

  constructor(config: BackendAdapterConfig, fetchFn: typeof fetch = fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
  }

  private getCredentials() {
    return {
      url: (this.config.supabaseUrl || '').trim().replace(/\/+$/, ''),
      anonKey: (this.config.supabaseAnonKey || '').trim(),
      storeId: (this.config.storeId || 'TOKO_KARKASIA_01').trim(),
    };
  }

  private buildHeaders(anonKey: string): Record<string, string> {
    const authToken = (this.config.apiKeyOrToken || '').trim() || anonKey;
    return {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${authToken}`,
    };
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const { url, anonKey } = this.getCredentials();
    if (!url || !anonKey) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: 0,
        message: 'Supabase URL dan Anon Key belum diisi.',
      };
    }

    const start = Date.now();
    try {
      const res = await this.fetchFn(`${url}/rest/v1/`, {
        method: 'GET',
        headers: this.buildHeaders(anonKey),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          ok: false,
          adapterType: this.type,
          latencyMs,
          message: `Supabase merespons HTTP ${res.status}. Periksa URL/key atau policy akses.`,
        };
      }
      return {
        ok: true,
        adapterType: this.type,
        latencyMs,
        message: `Supabase REST terhubung (${latencyMs} ms).`,
      };
    } catch (err) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: Date.now() - start,
        message: `Gagal menjangkau Supabase: ${err instanceof Error ? err.message : 'Koneksi gagal'}`,
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

    const { url, anonKey, storeId } = this.getCredentials();
    if (!url || !anonKey) {
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((i) => ({
          uuid: i.uuid,
          error: 'Supabase URL / Anon Key belum dikonfigurasi.',
        })),
        message: 'Supabase URL atau Anon Key belum diisi. Transaksi tetap aman di antrean lokal.',
      };
    }

    try {
      const res = await this.fetchFn(`${url}/rest/v1/rpc/sync_push`, {
        method: 'POST',
        headers: this.buildHeaders(anonKey),
        body: JSON.stringify({
          p_store_id: storeId,
          p_device_id: context.deviceId,
          p_events: items.map((item) => ({
            queue_id: item.uuid,
            idempotency_key: item.idempotencyKey,
            target_table: item.entityType.toLowerCase(),
            record_id: item.uuid,
            operation_type: 'INSERT',
            payload: {
              ...(item.payload ?? {}),
              summary: item.summary,
              createdAt: item.createdAt,
            },
          })),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const msg = `Supabase RPC sync_push gagal (HTTP ${res.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`;
        return {
          ok: false,
          acknowledgedIds: [],
          serverSeqs: {},
          failedItems: items.map((i) => ({ uuid: i.uuid, error: msg })),
          message: msg,
        };
      }

      const data = await res.json().catch(() => null);
      const acks = Array.isArray(data?.acks) ? data.acks : [];
      const ackSet = new Set<string>();
      const acknowledgedIds: string[] = [];
      const serverSeqs: Record<string, number> = {};

      for (const ack of acks) {
        const id = ack?.queue_id || ack?.uuid;
        const serverSeq = ack?.server_seq;
        // A queue ID alone is not proof of persistence. The server must return
        // a real sequence number so unsupported events cannot be falsely ACKed.
        if (
          typeof id === 'string' &&
          typeof serverSeq === 'number' &&
          Number.isFinite(serverSeq) &&
          serverSeq > 0
        ) {
          ackSet.add(id);
          acknowledgedIds.push(id);
          serverSeqs[id] = serverSeq;
        }
      }

      const failedItems = items
        .filter((i) => !ackSet.has(i.uuid))
        .map((i) => ({
          uuid: i.uuid,
          error: 'ACK Supabase tidak memiliki server_seq valid; item tetap pending di Outbox lokal.',
        }));

      return {
        ok: acknowledgedIds.length > 0 && failedItems.length === 0,
        acknowledgedIds,
        serverSeqs,
        failedItems,
        message:
          acknowledgedIds.length > 0
            ? `${acknowledgedIds.length} transaksi dikonfirmasi oleh Supabase.`
            : 'Supabase tidak mengembalikan ACK konfirmasi.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Koneksi gagal';
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((i) => ({ uuid: i.uuid, error: msg })),
        message: `Gagal menghubungi Supabase: ${msg}`,
      };
    }
  }

  async pullChanges(sinceSeq: number, context: { deviceId: string }): Promise<PullChangesResult> {
    const { url, anonKey, storeId } = this.getCredentials();
    if (!url || !anonKey) {
      return {
        ok: false,
        records: [],
        message: 'Supabase URL dan Anon Key belum diisi.',
      };
    }

    try {
      const query = new URLSearchParams({
        select: '*',
        store_id: `eq.${storeId}`,
        server_seq: `gt.${sinceSeq}`,
        device_id: `neq.${context.deviceId}`,
        order: 'server_seq.asc',
        limit: '100',
      });
      const res = await this.fetchFn(`${url}/rest/v1/transactions?${query.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(anonKey),
      });
      if (!res.ok) {
        return {
          ok: false,
          records: [],
          message: `Gagal menarik data Supabase (HTTP ${res.status}).`,
        };
      }
      const records = await res.json();
      const safeRecords = Array.isArray(records) ? records : [];
      return {
        ok: true,
        records: safeRecords,
        message: `${safeRecords.length} catatan ditarik dari Supabase.`,
      };
    } catch (err) {
      return {
        ok: false,
        records: [],
        message: `Gagal menarik data Supabase: ${err instanceof Error ? err.message : 'Koneksi gagal'}`,
      };
    }
  }

  async parseVoiceOrder(transcript: string): Promise<VoiceParseAdapterResult> {
    return parseIndonesianVoiceOrderLocally(transcript);
  }
}
