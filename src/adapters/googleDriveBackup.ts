export interface DriveBackupMediaItem {
  mediaId: string;
  blob: Blob;
}

export interface GoogleDriveBackupResult {
  folderId: string;
  backupFileId: string;
  backupFileName: string;
  attachmentCount: number;
  uploadedAt: string;
}

export interface GoogleDriveBackupListItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  backupId?: string;
  originDeviceId?: string;
  backupRole?: 'OWNER' | 'ADMIN' | 'SALES';
}

export interface RestoredDriveBackup {
  backupFileId: string;
  backupFileName: string;
  envelope: Record<string, unknown>;
  attachments: Array<{ mediaId: string; blob: Blob; sha256: string }>;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const MAX_ATTACHMENT_BYTES = 1024 * 1024;

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

async function fetchWithRetry(fetcher: FetchLike, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(input, init);
      if (!RETRYABLE_HTTP_STATUSES.has(response.status) || attempt === 2) return response;
      const retryAfter = Number(response.headers.get('retry-after'));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(2000, retryAfter * 1000)
        : 250 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw new Error('Permintaan backup gateway gagal setelah retry.');
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('Server backup mengirim respons yang tidak valid.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format respons server backup tidak valid.');
  const record = value as Record<string, unknown>;
  if (!response.ok || record.success !== true) {
    throw new Error(typeof record.error === 'string' ? record.error : 'Permintaan backup gateway gagal.');
  }
  return record;
}

async function sha256Hex(value: ArrayBuffer | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function snapshotSha256(envelope: Record<string, unknown>): Promise<string> {
  const payload: Record<string, unknown> = {
    app: envelope.app,
    exportedAt: envelope.exportedAt,
    originDeviceId: envelope.originDeviceId,
    schemaVersion: envelope.schemaVersion,
    ownerPinRedacted: envelope.ownerPinRedacted,
    checksum: envelope.checksum,
    state: envelope.state,
  };
  if (typeof envelope.backupRole === 'string') payload.backupRole = envelope.backupRole;
  return sha256Hex(JSON.stringify(payload));
}

function manifestSha256(backupId: string, originDeviceId: string, attachments: unknown[]): Promise<string> {
  return sha256Hex(JSON.stringify({ backupId, originDeviceId, attachments }));
}

function authHeaders(sessionToken: string, deviceId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    'X-ERP-Device-ID': deviceId,
    Accept: 'application/json',
  };
}

/** All Google Drive access is server-side; the browser only sends ERP-authenticated backup data. */
export async function uploadGoogleDriveBackup(options: {
  sessionToken: string;
  backupContent: string;
  originDeviceId: string;
  storeName: string;
  mediaItems: DriveBackupMediaItem[];
  backupId?: string;
  backupRole?: 'OWNER' | 'ADMIN' | 'SALES';
  fetcher?: FetchLike;
}): Promise<GoogleDriveBackupResult> {
  const fetcher = options.fetcher ?? fetch;
  if (!options.sessionToken.trim()) throw new Error('Session ERP aktif diperlukan untuk mengirim backup Drive.');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(options.originDeviceId)) throw new Error('Device ID asal tidak valid.');
  const backupRole = options.backupRole ?? 'OWNER';
  if (!['OWNER', 'ADMIN', 'SALES'].includes(backupRole)) throw new Error('Role backup tidak valid.');
  const backupId = options.backupId ?? `BKP-${(await sha256Hex(JSON.stringify({ originDeviceId: options.originDeviceId, backupRole, backupContent: options.backupContent, mediaIds: options.mediaItems.map((item) => item.mediaId).sort() }))).slice(0, 48)}`;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(backupId)) throw new Error('Backup ID tidak valid.');
  let envelope: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(options.backupContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    envelope = parsed as Record<string, unknown>;
  } catch {
    throw new Error('Konten backup lokal tidak valid; upload dibatalkan.');
  }
  if (envelope.originDeviceId !== options.originDeviceId || envelope.ownerPinRedacted !== true) {
    throw new Error('Metadata backup tidak cocok dengan perangkat atau belum menghapus PIN Owner.');
  }

  envelope.backupRole = backupRole;
  const backupContent = JSON.stringify(envelope);

  const attachmentManifest: Array<Record<string, unknown>> = [];
  for (const item of options.mediaItems) {
    if (!item.mediaId || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.mediaId) ||
        !(item.blob instanceof Blob) || item.blob.type !== 'image/jpeg' ||
        item.blob.size <= 0 || item.blob.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Lampiran ${item.mediaId || '(tanpa ID)'} bukan JPEG valid atau melebihi 1 MB.`);
    }
    const response = await fetchWithRetry(fetcher, '/api/backup/drive/attachments', {
      method: 'POST',
      headers: {
        ...authHeaders(options.sessionToken, options.originDeviceId),
        'Content-Type': 'image/jpeg',
        'X-ERP-Backup-ID': backupId,
        'X-ERP-Media-ID': item.mediaId,
      },
      body: item.blob,
      cache: 'no-store',
    });
    const uploaded = await readJson(response);
    if (typeof uploaded.fileId !== 'string' || typeof uploaded.fileName !== 'string' ||
        typeof uploaded.sha256 !== 'string' || uploaded.mimeType !== 'image/jpeg' ||
        uploaded.sizeBytes !== item.blob.size) {
      throw new Error(`Metadata upload lampiran ${item.mediaId} dari gateway tidak valid.`);
    }
    attachmentManifest.push({
      mediaId: item.mediaId,
      fileId: uploaded.fileId,
      fileName: uploaded.fileName,
      mimeType: 'image/jpeg',
      sizeBytes: uploaded.sizeBytes,
      sha256: uploaded.sha256,
    });
  }

  const response = await fetchWithRetry(fetcher, '/api/backup/drive/snapshots', {
    method: 'POST',
    headers: {
      ...authHeaders(options.sessionToken, options.originDeviceId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      backupId,
      originDeviceId: options.originDeviceId,
      storeName: options.storeName,
      backupContent,
      attachments: attachmentManifest,
    }),
    cache: 'no-store',
  });
  const result = await readJson(response);
  if (typeof result.folderId !== 'string' || typeof result.backupFileId !== 'string' ||
      typeof result.backupFileName !== 'string' || typeof result.uploadedAt !== 'string' ||
      typeof result.attachmentCount !== 'number') {
    throw new Error('Respons upload snapshot dari gateway tidak lengkap.');
  }
  return {
    folderId: result.folderId,
    backupFileId: result.backupFileId,
    backupFileName: result.backupFileName,
    attachmentCount: result.attachmentCount,
    uploadedAt: result.uploadedAt,
  };
}

/** Returns false when Drive backup is intentionally not configured on the server. */
export async function isGoogleDriveBackupGatewayConfigured(options: {
  sessionToken: string;
  deviceId: string;
  fetcher?: FetchLike;
}): Promise<boolean> {
  if (!options.sessionToken.trim()) return false;
  const fetcher = options.fetcher ?? fetch;
  const params = new URLSearchParams({ deviceId: options.deviceId });
  const response = await fetchWithRetry(fetcher, `/api/backup/drive/status?${params.toString()}`, {
    headers: authHeaders(options.sessionToken, options.deviceId),
    cache: 'no-store',
  });
  const body = await readJson(response);
  return body.configured === true;
}

/** List immutable snapshots through the authenticated server gateway. */
export async function listGoogleDriveBackups(options: {
  sessionToken: string;
  deviceId: string;
  fetcher?: FetchLike;
}): Promise<GoogleDriveBackupListItem[]> {
  if (!options.sessionToken.trim()) throw new Error('Session ERP Owner diperlukan untuk membaca backup Drive.');
  const fetcher = options.fetcher ?? fetch;
  const params = new URLSearchParams({ deviceId: options.deviceId });
  const response = await fetchWithRetry(fetcher, `/api/backup/drive/snapshots?${params.toString()}`, {
    headers: authHeaders(options.sessionToken, options.deviceId),
    cache: 'no-store',
  });
  const body = await readJson(response);
  if (!Array.isArray(body.backups)) throw new Error('Gateway tidak mengembalikan daftar snapshot.');
  return body.backups.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const file = item as Record<string, unknown>;
    if (typeof file.id !== 'string' || typeof file.name !== 'string' || file.mimeType !== 'application/json') return [];
    const backupRole = file.backupRole === 'ADMIN' || file.backupRole === 'SALES' ? file.backupRole : 'OWNER';
    // The restore picker is for full-store restores only. Sales snapshots are
    // device-scoped projections and must never replace the Owner database.
    if (backupRole === 'SALES') return [];
    return [{
      id: file.id, name: file.name, mimeType: 'application/json',
      ...(typeof file.size === 'string' ? { size: file.size } : {}),
      ...(typeof file.createdTime === 'string' ? { createdTime: file.createdTime } : {}),
      ...(typeof file.backupId === 'string' ? { backupId: file.backupId } : {}),
      ...(typeof file.originDeviceId === 'string' ? { originDeviceId: file.originDeviceId } : {}),
      backupRole,
    }];
  });
}

/** Download a snapshot and all its attachments through the server gateway, verifying hashes twice. */
export async function downloadGoogleDriveBackup(options: {
  sessionToken: string;
  deviceId: string;
  backupFileId: string;
  backupFileName?: string;
  fetcher?: FetchLike;
}): Promise<RestoredDriveBackup> {
  if (!options.sessionToken.trim()) throw new Error('Session ERP Owner diperlukan untuk restore Drive.');
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(options.backupFileId)) throw new Error('ID file backup tidak valid.');
  const fetcher = options.fetcher ?? fetch;
  const params = new URLSearchParams({ deviceId: options.deviceId });
  const response = await fetchWithRetry(fetcher, `/api/backup/drive/snapshots/${encodeURIComponent(options.backupFileId)}?${params.toString()}`, {
    headers: authHeaders(options.sessionToken, options.deviceId),
    cache: 'no-store',
  });
  const body = await readJson(response);
  if (!body.envelope || typeof body.envelope !== 'object' || Array.isArray(body.envelope)) {
    throw new Error('Gateway tidak mengembalikan envelope snapshot.');
  }
  const envelope = body.envelope as Record<string, unknown>;
  const metadata = envelope.driveBackup && typeof envelope.driveBackup === 'object'
    ? envelope.driveBackup as Record<string, unknown> : null;
  if (!metadata || typeof metadata.backupId !== 'string' || typeof metadata.originDeviceId !== 'string' ||
      !Array.isArray(metadata.attachmentManifest) || typeof metadata.manifestSha256 !== 'string' ||
      typeof metadata.snapshotSha256 !== 'string') {
    throw new Error('Snapshot tidak memiliki manifest ERP DAGING yang lengkap.');
  }
  if (await snapshotSha256(envelope) !== metadata.snapshotSha256 ||
      await manifestSha256(metadata.backupId, metadata.originDeviceId, metadata.attachmentManifest) !== metadata.manifestSha256) {
    throw new Error('Checksum snapshot atau manifest tidak cocok; restore dibatalkan.');
  }

  if (envelope.backupRole === 'SALES') throw new Error('Backup Sales hanya berisi proyeksi operasional dan tidak dapat dipakai untuk full restore toko.');
  if (envelope.backupRole !== undefined && envelope.backupRole !== 'OWNER' && envelope.backupRole !== 'ADMIN') {
    throw new Error('Role asal backup tidak valid untuk restore penuh.');
  }

  const attachments: Array<{ mediaId: string; blob: Blob; sha256: string }> = [];
  for (const item of metadata.attachmentManifest as Array<Record<string, unknown>>) {
    if (typeof item.mediaId !== 'string' || typeof item.fileId !== 'string' ||
        typeof item.sha256 !== 'string' || item.mimeType !== 'image/jpeg' ||
        !Number.isSafeInteger(item.sizeBytes) || Number(item.sizeBytes) <= 0 || Number(item.sizeBytes) > MAX_ATTACHMENT_BYTES) {
      throw new Error('Metadata lampiran snapshot tidak valid; restore dibatalkan.');
    }
    const query = new URLSearchParams({
      deviceId: options.deviceId, backupId: metadata.backupId, mediaId: item.mediaId, originDeviceId: metadata.originDeviceId,
    });
    const mediaResponse = await fetchWithRetry(fetcher, `/api/backup/drive/attachments/${encodeURIComponent(item.fileId)}?${query.toString()}`, {
      headers: { ...authHeaders(options.sessionToken, options.deviceId), Accept: 'image/jpeg' },
      cache: 'no-store',
    });
    if (!mediaResponse.ok) throw new Error(`Lampiran ${item.mediaId} gagal diunduh dari gateway (HTTP ${mediaResponse.status}).`);
    const bytes = await mediaResponse.arrayBuffer();
    if (bytes.byteLength !== item.sizeBytes || await sha256Hex(bytes) !== item.sha256) {
      throw new Error(`Checksum/ukuran lampiran ${item.mediaId} tidak cocok; restore dibatalkan.`);
    }
    attachments.push({ mediaId: item.mediaId, blob: new Blob([bytes], { type: 'image/jpeg' }), sha256: item.sha256 });
  }
  return {
    backupFileId: options.backupFileId,
    backupFileName: options.backupFileName || options.backupFileId,
    envelope,
    attachments,
  };
}
