import crypto from 'crypto';

export interface DriveBackupGatewayConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  ownerEmail: string;
  folderId: string;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const MAX_BACKUP_BYTES = 12 * 1024 * 1024;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown';
}

function sha256(value: string | Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function computeIntegrityHash(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  return 'SHA-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

async function readJson(response: Response): Promise<JsonRecord> {
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('Google Drive mengirim respons yang tidak valid.'); }
  if (!isRecord(value)) throw new Error('Format respons Google Drive tidak valid.');
  if (!response.ok) {
    const error = value.error;
    const message = isRecord(error) && typeof error.message === 'string' ? error.message : 'Permintaan Google Drive gagal.';
    throw new Error(message);
  }
  return value;
}

function validateConfig(config: DriveBackupGatewayConfig): void {
  if (!config.clientId.trim() || !config.clientSecret.trim() || !config.refreshToken.trim()) {
    throw new Error('Kredensial server Google Drive belum dikonfigurasi.');
  }
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(config.folderId)) throw new Error('GOOGLE_DRIVE_FOLDER_ID tidak valid.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.ownerEmail)) throw new Error('GOOGLE_DRIVE_OWNER_EMAIL tidak valid.');
}

function validateBackupEnvelope(raw: string, originDeviceId: string): JsonRecord {
  if (Buffer.byteLength(raw, 'utf8') <= 0 || Buffer.byteLength(raw, 'utf8') > MAX_BACKUP_BYTES) {
    throw new Error('Ukuran snapshot backup tidak valid atau melebihi 12 MB.');
  }
  let envelope: unknown;
  try { envelope = JSON.parse(raw); } catch { throw new Error('Konten backup bukan JSON valid.'); }
  if (!isRecord(envelope) || envelope.app !== 'KARKASIA-ERP' ||
      envelope.ownerPinRedacted !== true || envelope.schemaVersion !== 1 ||
      envelope.originDeviceId !== originDeviceId ||
      typeof envelope.exportedAt !== 'string' || !Number.isFinite(Date.parse(envelope.exportedAt)) ||
      typeof envelope.checksum !== 'string' || !isRecord(envelope.state)) {
    throw new Error('Envelope backup ERP DAGING tidak lengkap atau tidak cocok dengan perangkat asal.');
  }
  const state = envelope.state;
  const requiredArrays = [
    'products','lots','customers','receivables','inboundPOs','supplierInvoices',
    'transactions','stockLedger','journals','auditTrail','approvals',
    'processedIdempotencyKeys','syncOutbox',
  ];
  if (requiredArrays.some((key) => !Array.isArray(state[key]))) throw new Error('Snapshot tidak memuat seluruh koleksi ERP yang diwajibkan.');
  if ('ownerPin' in state || 'ownerPinHash' in state || 'ownerPinSalt' in state || 'ownerPinNeedsChange' in state) {
    throw new Error('Snapshot tidak boleh membawa material PIN Owner.');
  }
  const expected = computeIntegrityHash(JSON.stringify({
    originDeviceId: envelope.originDeviceId,
    exportedAt: envelope.exportedAt,
    state,
  }));
  if (expected !== envelope.checksum) throw new Error('Checksum snapshot tidak cocok; upload dibatalkan.');
  return envelope;
}

function buildSnapshotSha256(envelope: JsonRecord): string {
  return sha256(JSON.stringify({
    app: envelope.app,
    exportedAt: envelope.exportedAt,
    originDeviceId: envelope.originDeviceId,
    schemaVersion: envelope.schemaVersion,
    ownerPinRedacted: envelope.ownerPinRedacted,
    checksum: envelope.checksum,
    state: envelope.state,
  }));
}

function buildManifestSha256(backupId: string, originDeviceId: string, uploadedAt: string, attachments: unknown[]): string {
  return sha256(JSON.stringify({ backupId, originDeviceId, uploadedAt, attachments }));
}

export function createDriveBackupGateway(options: { fetcher?: FetchLike; now?: () => Date } = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());

  async function getAccessToken(config: DriveBackupGatewayConfig): Promise<string> {
    validateConfig(config);
    const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
    });
    const tokenBody = await readJson(tokenResponse);
    if (typeof tokenBody.access_token !== 'string' || !tokenBody.access_token) throw new Error('Google Drive tidak menerbitkan access token server.');
    const accessToken = tokenBody.access_token;
    const profile = await readJson(await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    }));
    const actualEmail = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
    if (profile.email_verified !== true || actualEmail !== config.ownerEmail.trim().toLowerCase()) {
      throw new Error('Refresh token Google Drive bukan milik akun Google Owner ERP yang dikonfigurasi.');
    }
    const folder = await readJson(await fetcher(`${DRIVE_API}/${encodeURIComponent(config.folderId)}?fields=id,name,mimeType,trashed,owners(emailAddress)`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    }));
    const owners = Array.isArray(folder.owners) ? folder.owners as JsonRecord[] : [];
    const folderOwner = owners.some((owner) => typeof owner.emailAddress === 'string' &&
      owner.emailAddress.trim().toLowerCase() === config.ownerEmail.trim().toLowerCase());
    if (folder.name !== 'ERP DAGING BACKUP' || folder.mimeType !== 'application/vnd.google-apps.folder' ||
        folder.trashed === true || !folderOwner) {
      throw new Error('Folder Drive harus bernama ERP DAGING BACKUP dan dimiliki akun Google Owner.');
    }
    return accessToken;
  }

  async function listByAppProperties(config: DriveBackupGatewayConfig, token: string, backupId: string, mediaId?: string): Promise<JsonRecord[]> {
    const clauses = [
      `'${config.folderId}' in parents`,
      `appProperties has { key='app' and value='ERP_DAGING' }`,
      `appProperties has { key='backupId' and value='${backupId}' }`,
      'trashed = false',
    ];
    if (mediaId) clauses.push(`appProperties has { key='mediaId' and value='${mediaId}' }`);
    else clauses.push(`appProperties has { key='backupType' and value='snapshot' }`);
    const files: JsonRecord[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: clauses.join(' and '), pageSize: '100',
        fields: 'files(id,name,mimeType,size,createdTime,parents,appProperties),nextPageToken',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const result = await readJson(await fetcher(`${DRIVE_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      }));
      if (Array.isArray(result.files)) files.push(...result.files.filter(isRecord));
      pageToken = typeof result.nextPageToken === 'string' && result.nextPageToken ? result.nextPageToken : undefined;
    } while (pageToken);
    return files;
  }

  async function uploadFile(
    token: string,
    metadata: JsonRecord,
    bytes: Buffer,
    mimeType: string,
  ): Promise<JsonRecord> {
    const boundary = `erp_daging_${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ]);
    return readJson(await fetcher(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,parents,appProperties`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        Accept: 'application/json',
      },
      body,
    }));
  }

  async function getFile(config: DriveBackupGatewayConfig, token: string, fileId: string): Promise<JsonRecord> {
    if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) throw new Error('ID file Drive tidak valid.');
    const file = await readJson(await fetcher(`${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,appProperties,trashed`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    }));
    const parents = Array.isArray(file.parents) ? file.parents : [];
    const props = isRecord(file.appProperties) ? file.appProperties : {};
    if (file.trashed === true || !parents.includes(config.folderId) || props.app !== 'ERP_DAGING') {
      throw new Error('File Drive bukan bagian dari folder backup ERP DAGING Owner.');
    }
    return file;
  }

  return {
    async uploadAttachment(config: DriveBackupGatewayConfig, input: {
      backupId: string; mediaId: string; originDeviceId: string; bytes: Buffer; mimeType: string;
    }) {
      const token = await getAccessToken(config);
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.backupId) ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(input.mediaId) ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(input.originDeviceId) ||
          input.mimeType !== 'image/jpeg' || input.bytes.length <= 0 || input.bytes.length > MAX_ATTACHMENT_BYTES) {
        throw new Error('Lampiran wajib JPEG valid maksimal 1 MB dengan ID yang valid.');
      }
      const checksum = sha256(input.bytes);
      const existing = await listByAppProperties(config, token, input.backupId, input.mediaId);
      if (existing.length > 1) throw new Error('Ditemukan duplikasi lampiran dengan backupId/mediaId yang sama.');
      if (existing.length === 1) {
        const props = isRecord(existing[0].appProperties) ? existing[0].appProperties : {};
        if (props.sha256 !== checksum || Number(existing[0].size) !== input.bytes.length ||
            props.originDeviceId !== input.originDeviceId) {
          throw new Error('ID lampiran sudah pernah digunakan dengan konten berbeda; upload ditolak.');
        }
        return {
          fileId: String(existing[0].id), fileName: String(existing[0].name),
          mimeType: 'image/jpeg', sizeBytes: input.bytes.length, sha256: checksum,
        };
      }
      const fileName = `${safeName(input.backupId)}__${safeName(input.mediaId)}.jpg`;
      const uploaded = await uploadFile(token, {
        name: fileName, mimeType: 'image/jpeg', parents: [config.folderId],
        description: `ERP DAGING attachment | backupId=${input.backupId} | mediaId=${input.mediaId} | sha256=${checksum}`,
        appProperties: {
          app: 'ERP_DAGING', backupId: input.backupId, mediaId: input.mediaId,
          originDeviceId: input.originDeviceId, backupType: 'attachment', sha256: checksum,
        },
      }, input.bytes, 'image/jpeg');
      if (typeof uploaded.id !== 'string' || !uploaded.id) throw new Error('Google Drive tidak mengembalikan ID lampiran.');
      return { fileId: uploaded.id, fileName, mimeType: 'image/jpeg', sizeBytes: input.bytes.length, sha256: checksum };
    },

    async uploadSnapshot(config: DriveBackupGatewayConfig, input: {
      backupId: string; originDeviceId: string; storeName: string; backupContent: string;
      attachments: Array<Record<string, unknown>>;
    }) {
      const token = await getAccessToken(config);
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.backupId) ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(input.originDeviceId) ||
          typeof input.storeName !== 'string' || !input.storeName.trim() ||
          !Array.isArray(input.attachments) || input.attachments.length > 5000) {
        throw new Error('Metadata backup tidak valid.');
      }
      const envelope = validateBackupEnvelope(input.backupContent, input.originDeviceId);
      const attachmentManifest: JsonRecord[] = [];
      for (const item of input.attachments) {
        if (!isRecord(item) || typeof item.mediaId !== 'string' || typeof item.fileId !== 'string' ||
            typeof item.sha256 !== 'string' || item.mimeType !== 'image/jpeg' ||
            !Number.isSafeInteger(item.sizeBytes) || Number(item.sizeBytes) <= 0 || Number(item.sizeBytes) > MAX_ATTACHMENT_BYTES) {
          throw new Error('Manifest lampiran backup tidak valid.');
        }
        const file = await getFile(config, token, item.fileId);
        const props = isRecord(file.appProperties) ? file.appProperties : {};
        if (props.backupId !== input.backupId || props.mediaId !== item.mediaId ||
            props.originDeviceId !== input.originDeviceId || props.backupType !== 'attachment' ||
            props.sha256 !== item.sha256 || Number(file.size) !== item.sizeBytes) {
          throw new Error(`Lampiran ${item.mediaId} tidak cocok dengan metadata upload gateway.`);
        }
        attachmentManifest.push({
          mediaId: item.mediaId, fileId: item.fileId, fileName: String(file.name),
          mimeType: 'image/jpeg', sizeBytes: Number(item.sizeBytes), sha256: item.sha256,
        });
      }
      const uploadedAt = now().toISOString();
      const manifestSha256 = buildManifestSha256(input.backupId, input.originDeviceId, uploadedAt, attachmentManifest);
      const snapshotSha256 = buildSnapshotSha256(envelope);
      envelope.driveBackup = {
        backupId: input.backupId, uploadedAt, originDeviceId: input.originDeviceId,
        storeName: input.storeName, attachmentManifest, manifestSha256, snapshotSha256,
      };
      const backupFileName = `ERP_DAGING_${safeName(input.storeName)}_${uploadedAt.slice(0, 10).replace(/-/g, '')}_${safeName(input.originDeviceId)}_${safeName(input.backupId)}.json`;
      const existing = await listByAppProperties(config, token, input.backupId);
      if (existing.length > 1) throw new Error('Ditemukan duplikasi snapshot dengan backupId yang sama.');
      if (existing.length === 1) {
        const props = isRecord(existing[0].appProperties) ? existing[0].appProperties : {};
        if (props.snapshotSha256 !== snapshotSha256 || props.manifestSha256 !== manifestSha256) {
          throw new Error('backupId sudah dipakai oleh snapshot berbeda; upload ditolak.');
        }
        return { folderId: config.folderId, backupFileId: String(existing[0].id), backupFileName: String(existing[0].name), attachmentCount: attachmentManifest.length, uploadedAt };
      }
      const uploaded = await uploadFile(token, {
        name: backupFileName, mimeType: 'application/json', parents: [config.folderId],
        description: `ERP DAGING immutable snapshot | backupId=${input.backupId} | originDeviceId=${input.originDeviceId} | attachments=${attachmentManifest.length}`,
        appProperties: {
          app: 'ERP_DAGING', backupId: input.backupId, originDeviceId: input.originDeviceId,
          backupType: 'snapshot', snapshotSha256, manifestSha256,
        },
      }, Buffer.from(JSON.stringify(envelope, null, 2), 'utf8'), 'application/json');
      if (typeof uploaded.id !== 'string' || !uploaded.id) throw new Error('Google Drive tidak mengembalikan ID snapshot.');
      return { folderId: config.folderId, backupFileId: uploaded.id, backupFileName, attachmentCount: attachmentManifest.length, uploadedAt };
    },

    async listSnapshots(config: DriveBackupGatewayConfig) {
      const token = await getAccessToken(config);
      const files: JsonRecord[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${config.folderId}' in parents and mimeType = 'application/json' and trashed = false and appProperties has { key='app' and value='ERP_DAGING' } and appProperties has { key='backupType' and value='snapshot' }`,
          pageSize: '100', orderBy: 'createdTime desc',
          fields: 'files(id,name,mimeType,size,createdTime,appProperties),nextPageToken',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const listed = await readJson(await fetcher(`${DRIVE_API}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        }));
        if (Array.isArray(listed.files)) files.push(...listed.files.filter(isRecord));
        pageToken = typeof listed.nextPageToken === 'string' && listed.nextPageToken ? listed.nextPageToken : undefined;
      } while (pageToken);
      return files.flatMap((file) => {
        const props = isRecord(file.appProperties) ? file.appProperties : {};
        if (typeof file.id !== 'string' || typeof file.name !== 'string' ||
            file.mimeType !== 'application/json' || props.app !== 'ERP_DAGING' || props.backupType !== 'snapshot') return [];
        return [{
          id: file.id, name: file.name, mimeType: 'application/json',
          ...(typeof file.size === 'string' ? { size: file.size } : {}),
          ...(typeof file.createdTime === 'string' ? { createdTime: file.createdTime } : {}),
          ...(typeof props.backupId === 'string' ? { backupId: props.backupId } : {}),
          ...(typeof props.originDeviceId === 'string' ? { originDeviceId: props.originDeviceId } : {}),
        }];
      });
    },

    async downloadSnapshot(config: DriveBackupGatewayConfig, fileId: string) {
      const token = await getAccessToken(config);
      const file = await getFile(config, token, fileId);
      const props = isRecord(file.appProperties) ? file.appProperties : {};
      if (file.mimeType !== 'application/json' || props.backupType !== 'snapshot') throw new Error('File bukan snapshot ERP DAGING.');
      const response = await fetcher(`${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Gagal mengunduh snapshot Drive (HTTP ${response.status}).`);
      const raw = await response.text();
      const envelope = validateBackupEnvelope(raw, String(props.originDeviceId || ''));
      const driveBackup = isRecord(envelope.driveBackup) ? envelope.driveBackup : null;
      if (!driveBackup || driveBackup.backupId !== props.backupId ||
          driveBackup.snapshotSha256 !== props.snapshotSha256 || driveBackup.manifestSha256 !== props.manifestSha256 ||
          !Array.isArray(driveBackup.attachmentManifest)) {
        throw new Error('Manifest snapshot tidak cocok dengan metadata file Drive.');
      }
      const manifestSha256 = buildManifestSha256(
        String(driveBackup.backupId), String(driveBackup.originDeviceId),
        String(driveBackup.uploadedAt), driveBackup.attachmentManifest,
      );
      if (manifestSha256 !== driveBackup.manifestSha256 ||
          buildSnapshotSha256(envelope) !== driveBackup.snapshotSha256) {
        throw new Error('Checksum snapshot/manifest Drive tidak cocok.');
      }
      return envelope;
    },

    async downloadAttachment(config: DriveBackupGatewayConfig, fileId: string, backupId: string, mediaId: string) {
      const token = await getAccessToken(config);
      const file = await getFile(config, token, fileId);
      const props = isRecord(file.appProperties) ? file.appProperties : {};
      if (file.mimeType !== 'image/jpeg' || props.backupType !== 'attachment' ||
          props.backupId !== backupId || props.mediaId !== mediaId) {
        throw new Error('Lampiran bukan milik snapshot yang diminta.');
      }
      const response = await fetcher(`${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'image/jpeg' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Gagal mengunduh lampiran Drive (HTTP ${response.status}).`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length <= 0 || bytes.length > MAX_ATTACHMENT_BYTES ||
          bytes.length !== Number(file.size) || sha256(bytes) !== props.sha256) {
        throw new Error('Checksum atau ukuran lampiran Drive tidak cocok.');
      }
      return bytes;
    },
  };
}
