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

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const BACKUP_FOLDER_NAME = 'ERP DAGING BACKUP';
const MAX_ATTACHMENT_BYTES = 1024 * 1024;

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown';
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('Google Drive mengirim respons yang tidak valid.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format respons Google Drive tidak valid.');
  if (!response.ok) {
    const error = (value as Record<string, unknown>).error;
    const message = error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string'
      ? (error as Record<string, unknown>).message as string
      : 'Permintaan Google Drive gagal.';
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

async function sha256Hex(value: ArrayBuffer | string): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyDriveAccount(fetcher: FetchLike, accessToken: string, expectedEmail: string): Promise<void> {
  const response = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const profile = await readJson(response);
  const actualEmail = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (profile.email_verified !== true || !actualEmail || actualEmail !== expectedEmail.trim().toLowerCase()) {
    throw new Error('Akun Google Drive harus sama dengan akun Owner ERP yang terverifikasi.');
  }
}

async function getOrCreateBackupFolder(fetcher: FetchLike, accessToken: string): Promise<string> {
  const query = `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listUrl = `${DRIVE_API}?q=${encodeURIComponent(query)}&pageSize=100&fields=files(id,name,mimeType)`;
  const listed = await readJson(await fetcher(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  }));
  const folders = Array.isArray(listed.files) ? listed.files as Array<Record<string, unknown>> : [];
  if (folders.length > 1) throw new Error('Ditemukan lebih dari satu folder ERP DAGING BACKUP. Rapikan folder duplikat di Google Drive Owner sebelum melanjutkan.');
  if (folders.length === 1 && typeof folders[0].id === 'string') return folders[0].id;

  const created = await readJson(await fetcher(DRIVE_API + '?fields=id,name,mimeType', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  }));
  if (typeof created.id !== 'string' || !created.id) throw new Error('Google Drive tidak mengembalikan ID folder backup.');
  return created.id;
}

async function uploadDriveFile(
  fetcher: FetchLike,
  accessToken: string,
  metadata: Record<string, unknown>,
  blob: Blob,
): Promise<Record<string, unknown>> {
  const boundary = `erp_daging_${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetcher(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      Accept: 'application/json',
    },
    body,
  });
  return readJson(response);
}

/**
 * Upload one immutable backup snapshot and its attachments to the Owner's shared Drive folder.
 * Access tokens are supplied per invocation and are never persisted by this module.
 */
export async function uploadGoogleDriveBackup(options: {
  accessToken: string;
  expectedOwnerEmail: string;
  backupContent: string;
  originDeviceId: string;
  storeName: string;
  mediaItems: DriveBackupMediaItem[];
  backupId?: string;
  now?: Date;
  fetcher?: FetchLike;
}): Promise<GoogleDriveBackupResult> {
  const fetcher = options.fetcher ?? fetch;
  if (!options.accessToken.trim()) throw new Error('Token Google Drive kosong.');
  if (!options.expectedOwnerEmail.trim()) throw new Error('Email Owner belum tersedia untuk verifikasi akun Google Drive.');
  if (!options.originDeviceId.trim()) throw new Error('Device ID asal tidak tersedia.');
  const now = options.now ?? new Date();
  const backupId = options.backupId ?? crypto.randomUUID();
  const uploadedAt = now.toISOString();

  let envelope: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(options.backupContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    envelope = parsed as Record<string, unknown>;
  } catch {
    throw new Error('Konten backup lokal tidak valid; upload dibatalkan.');
  }

  await verifyDriveAccount(fetcher, options.accessToken, options.expectedOwnerEmail);
  const folderId = await getOrCreateBackupFolder(fetcher, options.accessToken);
  const attachmentManifest: Array<Record<string, unknown>> = [];

  for (const item of options.mediaItems) {
    if (!item.mediaId || !(item.blob instanceof Blob) || item.blob.type !== 'image/jpeg' ||
        item.blob.size <= 0 || item.blob.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Lampiran ${item.mediaId || '(tanpa ID)'} bukan JPEG valid atau melebihi 1 MB.`);
    }
    const bytes = await item.blob.arrayBuffer();
    const checksum = await sha256Hex(bytes);
    const fileName = `${safeName(backupId)}__${safeName(item.mediaId)}.jpg`;
    const uploaded = await uploadDriveFile(fetcher, options.accessToken, {
      name: fileName,
      mimeType: 'image/jpeg',
      parents: [folderId],
      description: `ERP DAGING attachment | backupId=${backupId} | mediaId=${item.mediaId} | sha256=${checksum}`,
      appProperties: {
        app: 'ERP_DAGING',
        backupId,
        mediaId: item.mediaId,
        originDeviceId: options.originDeviceId,
      },
    }, item.blob);
    if (typeof uploaded.id !== 'string' || !uploaded.id) throw new Error(`Google Drive tidak mengembalikan ID lampiran ${item.mediaId}.`);
    attachmentManifest.push({
      mediaId: item.mediaId,
      fileId: uploaded.id,
      fileName,
      mimeType: 'image/jpeg',
      sizeBytes: item.blob.size,
      sha256: checksum,
    });
  }

  const manifestPayload = {
    backupId,
    originDeviceId: options.originDeviceId,
    uploadedAt,
    attachments: attachmentManifest,
  };
  envelope.driveBackup = {
    backupId,
    uploadedAt,
    originDeviceId: options.originDeviceId,
    storeName: options.storeName,
    attachmentManifest,
    manifestSha256: await sha256Hex(JSON.stringify(manifestPayload)),
  };

  const date = uploadedAt.slice(0, 10).replace(/-/g, '');
  const fileName = `ERP_DAGING_${safeName(options.storeName)}_${date}_${safeName(options.originDeviceId)}_${safeName(backupId)}.json`;
  const backupBlob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const uploadedBackup = await uploadDriveFile(fetcher, options.accessToken, {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
    description: `ERP DAGING immutable backup | backupId=${backupId} | originDeviceId=${options.originDeviceId} | attachments=${attachmentManifest.length}`,
    appProperties: {
      app: 'ERP_DAGING',
      backupId,
      originDeviceId: options.originDeviceId,
      backupType: 'snapshot',
    },
  }, backupBlob);
  if (typeof uploadedBackup.id !== 'string' || !uploadedBackup.id) throw new Error('Google Drive tidak mengembalikan ID file backup.');

  return {
    folderId,
    backupFileId: uploadedBackup.id,
    backupFileName: fileName,
    attachmentCount: attachmentManifest.length,
    uploadedAt,
  };
}
