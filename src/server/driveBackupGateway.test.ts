import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveBackupGateway } from './driveBackupGateway.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function integrityHash(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  return 'SHA-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function validBackup(deviceId = 'DEV-OWNER-1'): string {
  const exportedAt = '2026-11-17T10:00:00.000Z';
  const state = {
    products: [], lots: [], customers: [], receivables: [], inboundPOs: [], supplierInvoices: [],
    transactions: [], stockLedger: [], journals: [], auditTrail: [], approvals: [],
    processedIdempotencyKeys: [], syncOutbox: [],
  };
  const checksum = integrityHash(JSON.stringify({ originDeviceId: deviceId, exportedAt, state }));
  return JSON.stringify({
    app: 'KARKASIA-ERP', schemaVersion: 1, exportedAt, originDeviceId: deviceId,
    ownerPinRedacted: true, checksum, state,
  });
}

const config = {
  clientId: 'oauth-client-id', clientSecret: 'oauth-client-secret',
  refreshToken: 'owner-refresh-token', ownerEmail: 'owner@example.com',
  folderId: 'FOLDER_ID_123456789',
};

function createFetcher(options: { folderOwner?: string; existingFiles?: unknown[] } = {}) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input), method = init?.method || 'GET';
    const body = init?.body instanceof Blob ? await init.body.text() : typeof init?.body === 'string' ? init.body : undefined;
    calls.push({ url, method, body });
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'SERVER-ACCESS-TOKEN' });
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return json({ email: 'owner@example.com', email_verified: true });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/FOLDER_ID_123456789?')) {
      return json({
        id: 'FOLDER_ID_123456789', name: 'ERP DAGING BACKUP',
        mimeType: 'application/vnd.google-apps.folder', trashed: false,
        owners: [{ emailAddress: options.folderOwner || 'owner@example.com' }],
      });
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
      return json({ files: options.existingFiles || [] });
    }
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
      return json({ id: `DRIVE-FILE-${calls.filter((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')).length}`, name: 'uploaded' });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  return { fetcher, calls };
}

test('server gateway uploads a checksum-verified snapshot to the one Owner folder', async () => {
  const { fetcher, calls } = createFetcher();
  const gateway = createDriveBackupGateway({ fetcher, now: () => new Date('2026-11-17T10:00:00.000Z') });
  const result = await gateway.uploadSnapshot(config, {
    backupId: 'BACKUP-1', originDeviceId: 'DEV-OWNER-1', storeName: 'ERP DAGING',
    backupContent: validBackup(), attachments: [],
  });
  assert.equal(result.folderId, config.folderId);
  assert.equal(result.backupFileId, 'DRIVE-FILE-1');
  assert.equal(result.attachmentCount, 0);
  assert.equal(calls.filter((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')).length, 1);
  assert.ok(calls.some((call) => call.url.includes('openidconnect.googleapis.com/v1/userinfo')));
  assert.ok(calls.every((call) => !call.url.includes('refresh_token=')), 'refresh token must never appear in URL');
});

test('server gateway refuses a snapshot with an invalid envelope checksum before Drive upload', async () => {
  const { fetcher, calls } = createFetcher();
  const gateway = createDriveBackupGateway({ fetcher });
  const bad = JSON.parse(validBackup());
  bad.checksum = 'SHA-TAMPERED';
  await assert.rejects(() => gateway.uploadSnapshot(config, {
    backupId: 'BACKUP-2', originDeviceId: 'DEV-OWNER-1', storeName: 'ERP DAGING',
    backupContent: JSON.stringify(bad), attachments: [],
  }), /Checksum snapshot tidak cocok/);
  assert.equal(calls.filter((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')).length, 0);
});

test('server gateway verifies the refresh-token profile and shared-folder owner', async () => {
  const { fetcher } = createFetcher({ folderOwner: 'someone-else@example.com' });
  const gateway = createDriveBackupGateway({ fetcher });
  await assert.rejects(() => gateway.listSnapshots(config), /dimiliki akun Google Owner/);
});

test('server gateway uploads JPEG attachment with server-computed SHA-256 and idempotency metadata', async () => {
  const { fetcher, calls } = createFetcher();
  const gateway = createDriveBackupGateway({ fetcher });
  const bytes = Buffer.from('jpeg-bytes');
  const result = await gateway.uploadAttachment(config, {
    backupId: 'BACKUP-3', mediaId: 'MEDIA-3', originDeviceId: 'DEV-OWNER-1',
    bytes, mimeType: 'image/jpeg',
  });
  assert.equal(result.fileId, 'DRIVE-FILE-1');
  assert.equal(result.sizeBytes, bytes.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  const multipart = calls.find((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?'))?.body || '';
  assert.match(multipart, /ERP_DAGING/);
  assert.match(multipart, /MEDIA-3/);
  assert.match(multipart, new RegExp(result.sha256));
});

test('reuses an existing attachment across different snapshot backup IDs', async () => {
  const bytes = Buffer.from('jpeg-bytes');
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
  const existing = [{
    id: 'DRIVE-EXISTING-MEDIA', name: 'DEV-OWNER-1__MEDIA-5.jpg',
    mimeType: 'image/jpeg', size: String(bytes.length),
    appProperties: {
      app: 'ERP_DAGING', mediaId: 'MEDIA-5', originDeviceId: 'DEV-OWNER-1',
      backupType: 'attachment', sha256: checksum,
    },
  }];
  const { fetcher, calls } = createFetcher({ existingFiles: existing });
  const gateway = createDriveBackupGateway({ fetcher });
  const result = await gateway.uploadAttachment(config, {
    backupId: 'BACKUP-NEW', mediaId: 'MEDIA-5', originDeviceId: 'DEV-OWNER-1',
    bytes, mimeType: 'image/jpeg',
  });
  assert.equal(result.fileId, 'DRIVE-EXISTING-MEDIA');
  assert.equal(calls.some((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')), false);
});

test('server gateway rejects attachments above 1 MB and non-JPEG content', async () => {
  const { fetcher } = createFetcher();
  const gateway = createDriveBackupGateway({ fetcher });
  await assert.rejects(() => gateway.uploadAttachment(config, {
    backupId: 'BACKUP-4', mediaId: 'MEDIA-4', originDeviceId: 'DEV-OWNER-1',
    bytes: Buffer.from('png'), mimeType: 'image/png',
  }), /JPEG valid/);
  await assert.rejects(() => gateway.uploadAttachment(config, {
    backupId: 'BACKUP-4', mediaId: 'MEDIA-4', originDeviceId: 'DEV-OWNER-1',
    bytes: Buffer.alloc(1024 * 1024 + 1), mimeType: 'image/jpeg',
  }), /JPEG valid/);
});


test('server gateway refuses a snapshot when a referenced return photo is absent from the attachment manifest', async () => {
  const { fetcher, calls } = createFetcher();
  const gateway = createDriveBackupGateway({ fetcher });
  const envelope = JSON.parse(validBackup());
  envelope.state.customerReturns = [{ id: 'RETURN-1', evidenceMediaId: 'MEDIA-MISSING' }];
  envelope.checksum = integrityHash(JSON.stringify({
    originDeviceId: envelope.originDeviceId,
    exportedAt: envelope.exportedAt,
    state: envelope.state,
  }));
  await assert.rejects(() => gateway.uploadSnapshot(config, {
    backupId: 'BACKUP-MISSING-MEDIA', originDeviceId: 'DEV-OWNER-1', storeName: 'ERP DAGING',
    backupContent: JSON.stringify(envelope), attachments: [],
  }), /bukti retur/);
  assert.equal(calls.some((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')), false);
});


test('server gateway retries transient Google API failures but does not retry permanent errors', async () => {
  const base = createFetcher();
  let tokenCalls = 0;
  const retryingFetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      tokenCalls += 1;
      if (tokenCalls === 1) return json({ error: { message: 'temporary unavailable' } }, 503);
    }
    return base.fetcher(input, init);
  };
  const gateway = createDriveBackupGateway({ fetcher: retryingFetcher });
  const uploaded = await gateway.uploadSnapshot(config, {
    backupId: 'BACKUP-RETRY-DRIVE', originDeviceId: 'DEV-OWNER-1',
    storeName: 'ERP DAGING', backupContent: validBackup(), attachments: [],
  });
  assert.equal(uploaded.backupFileId, 'DRIVE-FILE-1');
  assert.equal(tokenCalls, 2);

  let forbiddenCalls = 0;
  const forbiddenFetcher = async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input) === 'https://oauth2.googleapis.com/token') {
      forbiddenCalls += 1;
      return json({ error: { message: 'invalid_client' } }, 403);
    }
    throw new Error('Unexpected request');
  };
  await assert.rejects(() => createDriveBackupGateway({ fetcher: forbiddenFetcher }).listSnapshots(config), /invalid_client/);
  assert.equal(forbiddenCalls, 1);
});


test('server gateway refuses remote-only return evidence without a local backup media ID', async () => {
  const { fetcher, calls } = createFetcher();
  const gateway = createDriveBackupGateway({ fetcher });
  const envelope = JSON.parse(validBackup());
  envelope.state.customerReturns = [{ id: 'RETURN-REMOTE', evidenceRemoteFileId: 'GAS-DRIVE-FILE-1' }];
  envelope.checksum = integrityHash(JSON.stringify({
    originDeviceId: envelope.originDeviceId,
    exportedAt: envelope.exportedAt,
    state: envelope.state,
  }));
  await assert.rejects(() => gateway.uploadSnapshot(config, {
    backupId: 'BACKUP-REMOTE-ONLY', originDeviceId: 'DEV-OWNER-1',
    storeName: 'ERP DAGING', backupContent: JSON.stringify(envelope), attachments: [],
  }), /ID file remote tanpa ID media lokal/);
  assert.equal(calls.some((call) => call.url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')), false);
});
