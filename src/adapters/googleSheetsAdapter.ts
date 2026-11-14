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
 * Google Sheets Adapter.
 * Supports:
 * 1) Google Apps Script Web App Webhook URL (endpointUrl) -> POST JSON rows & expect acknowledgedIds
 * 2) Direct Google Sheets API v4 (googleSheetId + OAuth Bearer token in apiKeyOrToken)
 */
export class GoogleSheetsBackendAdapter implements BackendAdapter {
  readonly type = 'GOOGLE_SHEETS' as const;
  readonly displayName = 'Google Sheets';
  readonly requiresNetwork = true;
  private readonly config: BackendAdapterConfig;
  private readonly fetchFn: typeof fetch;

  constructor(config: BackendAdapterConfig, fetchFn: typeof fetch = fetch) {
    this.config = config;
    this.fetchFn = fetchFn;
  }

  private getWebhookUrl(): string {
    return (this.config.endpointUrl || '').trim();
  }

  private getSharedSecret(): string {
    return (this.config.apiKeyOrToken || '').trim();
  }

  private buildRequestBody(value: Record<string, unknown>): string {
    return JSON.stringify({
      ...value,
      storeId: (this.config.storeId || 'TOKO_KARKASIA_01').trim(),
      sharedSecret: this.getSharedSecret(),
    });
  }

  private async postAction(body: Record<string, unknown>): Promise<Response> {
    const url = this.getWebhookUrl();
    const secret = this.getSharedSecret();
    if (!url || !secret) {
      throw new Error('URL GAS Web App dan Shared Secret wajib dikonfigurasi.');
    }
    return this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: this.buildRequestBody(body),
    });
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await this.postAction({ action: 'health' });
      const latencyMs = Date.now() - start;
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        return {
          ok: false,
          adapterType: this.type,
          latencyMs,
          message: data?.message || `Apps Script Web App menolak pemeriksaan koneksi (HTTP ${response.status}).`,
        };
      }
      return {
        ok: true,
        adapterType: this.type,
        latencyMs,
        serverTime: typeof data.serverTime === 'string' ? data.serverTime : undefined,
        message: `Google Sheets Webhook terhubung (${latencyMs} ms).`,
      };
    } catch (error) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Gagal menghubungi Apps Script Web App.',
      };
    }
  }

  async pushOutbox(items: SyncOutboxItem[], context: SyncContext): Promise<OutboxPushResult> {
    if (items.length === 0) {
      return { ok: true, acknowledgedIds: [], serverSeqs: {}, failedItems: [], message: 'Tidak ada antrean yang perlu dikirim.' };
    }
    try {
      const response = await this.postAction({
        action: 'sync_push',
        storeName: context.storeName,
        deviceId: context.deviceId,
        events: items.map((item) => ({
          uuid: item.uuid,
          idempotencyKey: item.idempotencyKey,
          entityType: item.entityType,
          createdAt: item.createdAt,
          summary: item.summary,
          payload: item.payload ?? {},
        })),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        const message = data?.message || `Google Sheets Webhook menolak kiriman (HTTP ${response.status}).`;
        return {
          ok: false,
          acknowledgedIds: [],
          serverSeqs: {},
          failedItems: items.map((item) => ({ uuid: item.uuid, error: message })),
          message,
        };
      }
      const acknowledgedIds = Array.isArray(data.acknowledgedIds)
        ? [...new Set(data.acknowledgedIds.filter((id: unknown): id is string => typeof id === 'string'))]
        : [];
      const serverSeqs: Record<string, number> = {};
      if (data.serverSeqs && typeof data.serverSeqs === 'object') {
        for (const [uuid, seq] of Object.entries(data.serverSeqs)) {
          if (typeof seq === 'number' && Number.isFinite(seq)) serverSeqs[uuid] = seq;
        }
      }
      const acknowledgedSet = new Set(acknowledgedIds);
      const failedItems = items
        .filter((item) => !acknowledgedSet.has(item.uuid))
        .map((item) => ({ uuid: item.uuid, error: 'Server tidak mengembalikan ACK untuk event ini.' }));
      return {
        ok: failedItems.length === 0,
        acknowledgedIds,
        serverSeqs,
        failedItems,
        message: `${acknowledgedIds.length} event mendapat ACK; ${failedItems.length} event belum terkonfirmasi.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Koneksi GAS gagal.';
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((item) => ({ uuid: item.uuid, error: message })),
        message,
      };
    }
  }

  async pullChanges(sinceSeq: number, context: { deviceId: string }): Promise<PullChangesResult> {
    try {
      const response = await this.postAction({
        action: 'sync_pull',
        deviceId: context.deviceId,
        sinceSeq: Math.max(0, sinceSeq),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) {
        return { ok: false, records: [], message: data?.message || `Apps Script pull gagal (HTTP ${response.status}).` };
      }
      return {
        ok: true,
        records: Array.isArray(data.records) ? data.records : [],
        lastServerSeq: typeof data.lastServerSeq === 'number' ? data.lastServerSeq : sinceSeq,
        message: typeof data.message === 'string' ? data.message : 'Event berhasil ditarik dari GAS.',
      };
    } catch (error) {
      return { ok: false, records: [], message: error instanceof Error ? error.message : 'Gagal menarik event dari GAS.' };
    }
  }

  async downloadMedia(params: { mediaId: string }): Promise<{ ok: boolean; blob?: Blob; remoteFileId?: string; message: string }> {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(params.mediaId)) return { ok: false, message: 'ID lampiran tidak valid.' };
    try {
      const response = await this.postAction({ action: 'media_download', mediaId: params.mediaId });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true || typeof data.dataBase64 !== 'string' || typeof data.fileId !== 'string') {
        return { ok: false, message: data?.message || `Unduh foto gagal (HTTP ${response.status}).` };
      }
      const binary = atob(data.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return {
        ok: true,
        remoteFileId: data.fileId,
        blob: new Blob([bytes], { type: typeof data.mimeType === 'string' ? data.mimeType : 'image/jpeg' }),
        message: 'Foto bukti berhasil diunduh dari penyimpanan GAS.',
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Unduh foto gagal.' };
    }
  }

  async uploadMedia(params: { mediaId: string; filename: string; blob: Blob }): Promise<{ ok: boolean; remoteFileId?: string; url?: string; message: string }> {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(params.mediaId)) return { ok: false, message: 'ID lampiran tidak valid.' };
    if (params.blob.size <= 0 || params.blob.size > 1024 * 1024) {
      return { ok: false, message: 'Ukuran foto harus lebih dari 0 dan maksimal 1 MB.' };
    }
    if (params.blob.type !== 'image/jpeg') {
      return { ok: false, message: 'Lampiran harus berupa JPEG.' };
    }
    try {
      const bytes = new Uint8Array(await params.blob.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      const response = await this.postAction({
        action: 'media_upload',
        mediaId: params.mediaId,
        filename: params.filename,
        mimeType: 'image/jpeg',
        dataBase64: btoa(binary),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true || typeof data.fileId !== 'string') {
        return { ok: false, message: data?.message || `Upload foto gagal (HTTP ${response.status}).` };
      }
      return { ok: true, remoteFileId: data.fileId, message: 'Foto berhasil diunggah melalui gateway GAS.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Upload foto gagal.' };
    }
  }

  async parseVoiceOrder(transcript: string): Promise<VoiceParseAdapterResult> {
    return parseIndonesianVoiceOrderLocally(transcript);
  }
}
