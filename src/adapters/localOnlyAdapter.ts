import type { SyncOutboxItem } from '../engine/types';
import type {
  BackendAdapter,
  HealthCheckResult,
  OutboxPushResult,
  PullChangesResult,
  SyncContext,
  VoiceParseAdapterResult,
} from './backendAdapter';
import { parseIndonesianVoiceOrderLocally } from './localVoiceParser';

/**
 * Default Local-Only Adapter.
 * Enforces Rules 2, 7, 8, 9, 10:
 * - Zero network dependency, zero startup requirement.
 * - Never fabricates fake SYNCED confirmations: keeps outbox entries as PENDING locally.
 */
export class LocalOnlyBackendAdapter implements BackendAdapter {
  readonly type = 'LOCAL_ONLY' as const;
  readonly displayName = 'Mode Lokal Mandiri (Tanpa Server)';
  readonly requiresNetwork = false;

  async checkHealth(): Promise<HealthCheckResult> {
    return {
      ok: true,
      adapterType: this.type,
      latencyMs: 0,
      message:
        'Mode Lokal Mandiri aktif. Seluruh transaksi berjalan normal dan disimpan aman di perangkat ini tanpa membutuhkan server.',
      serverTime: new Date().toISOString(),
    };
  }

  async pushOutbox(items: SyncOutboxItem[], _context: SyncContext): Promise<OutboxPushResult> {
    return {
      ok: true,
      skippedLocalOnly: true,
      acknowledgedIds: [],
      serverSeqs: {},
      failedItems: [],
      message:
        items.length > 0
          ? `Mode Lokal Mandiri aktif: ${items.length} transaksi tetap tersimpan aman di antrean lokal (PENDING) hingga Anda menghubungkan server eksternal.`
          : 'Mode Lokal Mandiri aktif. Tidak ada antrean tertunda.',
    };
  }

  async pullChanges(_sinceSeq: number, _context: { deviceId: string }): Promise<PullChangesResult> {
    return {
      ok: true,
      skippedLocalOnly: true,
      records: [],
      message: 'Mode Lokal Mandiri: aplikasi menggunakan database perangkat secara penuh.',
    };
  }

  async parseVoiceOrder(transcript: string): Promise<VoiceParseAdapterResult> {
    return parseIndonesianVoiceOrderLocally(transcript);
  }

}
