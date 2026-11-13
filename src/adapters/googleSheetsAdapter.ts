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

  async checkHealth(): Promise<HealthCheckResult> {
    const webhookUrl = (this.config.endpointUrl || '').trim();
    const sheetId = (this.config.googleSheetId || '').trim();
    const token = (this.config.apiKeyOrToken || '').trim();

    if (!webhookUrl && (!sheetId || !token)) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: 0,
        message: 'Isi URL Apps Script Web App atau Spreadsheet ID + OAuth Token terlebih dahulu.',
      };
    }

    const start = Date.now();
    try {
      if (webhookUrl) {
        const healthUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'action=health&token=' + encodeURIComponent((this.config.apiKeyOrToken || '').trim());
        const res = await this.fetchFn(healthUrl, { method: 'GET' });
        const latencyMs = Date.now() - start;
        if (!res.ok) {
          return {
            ok: false,
            adapterType: this.type,
            latencyMs,
            message: `Apps Script Web App merespons HTTP ${res.status}.`,
          };
        }
        return {
          ok: true,
          adapterType: this.type,
          latencyMs,
          message: `Google Sheets Webhook terhubung (${latencyMs} ms).`,
        };
      }

      const res = await this.fetchFn(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=spreadsheetId,properties.title`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          ok: false,
          adapterType: this.type,
          latencyMs,
          message: `Google Sheets API merespons HTTP ${res.status}. Periksa akses & token.`,
        };
      }
      const meta = await res.json().catch(() => null);
      const title = meta?.properties?.title || sheetId;
      return {
        ok: true,
        adapterType: this.type,
        latencyMs,
        message: `Spreadsheet "${title}" terhubung (${latencyMs} ms).`,
      };
    } catch (err) {
      return {
        ok: false,
        adapterType: this.type,
        latencyMs: Date.now() - start,
        message: `Gagal menghubungi Google Sheets: ${err instanceof Error ? err.message : 'Koneksi gagal'}`,
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

    const webhookUrl = (this.config.endpointUrl || '').trim();
    const sheetId = (this.config.googleSheetId || '').trim();
    const token = (this.config.apiKeyOrToken || '').trim();
    const range = (this.config.googleSheetRange || 'OutboxSync!A:H').trim();
    const storeId = (this.config.storeId || 'TOKO_KARKASIA_01').trim();

    if (!webhookUrl && (!sheetId || !token)) {
      const msg = 'Konfigurasi Google Sheets belum lengkap (Webhook URL atau Sheet ID + Token).';
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((i) => ({ uuid: i.uuid, error: msg })),
        message: msg,
      };
    }

    try {
      if (webhookUrl) {
        const res = await this.fetchFn(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_push',
            storeId,
            storeName: context.storeName,
            deviceId: context.deviceId,
            sharedSecret: token,
            events: items.map((i) => ({
              uuid: i.uuid,
              idempotencyKey: i.idempotencyKey,
              entityType: i.entityType,
              createdAt: i.createdAt,
              summary: i.summary,
              payload: i.payload ?? {},
            })),
          }),
        });

        if (!res.ok) {
          const msg = `Google Sheets Webhook menolak kiriman (HTTP ${res.status}).`;
          return {
            ok: false,
            acknowledgedIds: [],
            serverSeqs: {},
            failedItems: items.map((i) => ({ uuid: i.uuid, error: msg })),
            message: msg,
          };
        }

        const data = await res.json().catch(() => null);
        const ackIds: string[] = Array.isArray(data?.acknowledgedIds)
          ? data.acknowledgedIds.filter((x: unknown): x is string => typeof x === 'string')
          : [];
        const ackSet = new Set(ackIds);
        const failedItems = items
          .filter((i) => !ackSet.has(i.uuid))
          .map((i) => ({
            uuid: i.uuid,
            error: 'Webhook Google Sheets tidak mengembalikan acknowledgedIds untuk item ini.',
          }));

        return {
          ok: ackIds.length > 0 && failedItems.length === 0,
          acknowledgedIds: ackIds,
          serverSeqs: data?.serverSeqs && typeof data.serverSeqs === 'object' ? data.serverSeqs : {},
          failedItems,
          message:
            ackIds.length > 0
              ? `${ackIds.length} baris dikonfirmasi masuk ke Google Sheets.`
              : 'Google Sheets Webhook tidak mengembalikan konfirmasi baris.',
        };
      }

      // Direct Google Sheets v4 append
      const rows = items.map((i) => [
        i.uuid,
        i.idempotencyKey,
        i.entityType,
        i.createdAt,
        i.summary,
        JSON.stringify(i.payload ?? {}),
        context.deviceId,
        storeId,
      ]);

      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        sheetId
      )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      const res = await this.fetchFn(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const msg = `Google Sheets API gagal (HTTP ${res.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`;
        return {
          ok: false,
          acknowledgedIds: [],
          serverSeqs: {},
          failedItems: items.map((i) => ({ uuid: i.uuid, error: msg })),
          message: msg,
        };
      }

      const data = await res.json().catch(() => null);
      const updatedRows = Number(data?.updates?.updatedRows ?? 0);
      if (updatedRows >= items.length) {
        return {
          ok: true,
          acknowledgedIds: items.map((i) => i.uuid),
          serverSeqs: {},
          failedItems: [],
          message: `${updatedRows} baris berhasil dicatat ke Google Sheets (${range}).`,
        };
      }

      const partialAck = items.slice(0, Math.max(0, updatedRows)).map((i) => i.uuid);
      const partialFail = items.slice(Math.max(0, updatedRows)).map((i) => ({
        uuid: i.uuid,
        error: 'Jumlah baris tersimpan di Google Sheets lebih sedikit dari paket kiriman.',
      }));
      return {
        ok: false,
        acknowledgedIds: partialAck,
        serverSeqs: {},
        failedItems: partialFail,
        message: `Hanya ${updatedRows} dari ${items.length} baris terkonfirmasi di Google Sheets.`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Koneksi gagal';
      return {
        ok: false,
        acknowledgedIds: [],
        serverSeqs: {},
        failedItems: items.map((i) => ({ uuid: i.uuid, error: msg })),
        message: `Gagal mengirim ke Google Sheets: ${msg}`,
      };
    }
  }

  async pullChanges(sinceSeq: number, context: { deviceId: string }): Promise<PullChangesResult> {
    const webhookUrl = (this.config.endpointUrl || '').trim();
    if (!webhookUrl) return { ok: false, records: [], message: 'Pull multi-device membutuhkan Apps Script Web App. Direct Sheets API hanya mendukung append.' };
    try {
      const query = new URLSearchParams({ action: 'sync_pull', storeId: (this.config.storeId || 'ERP_DAGING').trim(), deviceId: context.deviceId, sinceSeq: String(Math.max(0, sinceSeq)), token: (this.config.apiKeyOrToken || '').trim() });
      const separator = webhookUrl.includes('?') ? '&' : '?';
      const res = await this.fetchFn(`${webhookUrl}${separator}${query.toString()}`, { method: 'GET' });
      if (!res.ok) return { ok: false, records: [], message: `Apps Script pull gagal (HTTP ${res.status}).` };
      const data = await res.json();
      const records = Array.isArray(data?.records) ? data.records : [];
      return { ok: data?.ok === true, records, lastServerSeq: typeof data?.lastServerSeq === 'number' ? data.lastServerSeq : sinceSeq, message: data?.message || `${records.length} event ditarik dari GAS.` };
    } catch (err) {
      return { ok: false, records: [], message: `Gagal menarik event dari GAS: ${err instanceof Error ? err.message : 'Koneksi gagal'}` };
    }
  }

  async parseVoiceOrder(transcript: string): Promise<VoiceParseAdapterResult> {
    return parseIndonesianVoiceOrderLocally(transcript);
  }
}
