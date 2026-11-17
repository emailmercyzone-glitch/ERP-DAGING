import test from 'node:test';
import assert from 'node:assert/strict';
import {
  downloadGoogleDriveBackup,
  listGoogleDriveBackups,
  uploadGoogleDriveBackup,
} from './googleDriveBackup.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function integrityHash(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  return 'SHA-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function backupContent(deviceId = 'DEV-OWNER-1'): string {
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

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

test('uploads attachments and immutable JSON snapshot only through ERP-authenticated gateway', async () => {
  const calls: Array<{ url: string; method: string; headers: Headers; body?: string }> = [];
  const image = new Blob(['verified-jpeg'], { type: 'image/jpeg' });
  const imageHash = await sha256(await image.arrayBuffer());
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : undefined;
    const url = String(input);
    calls.push({ url, method: init?.method || 'GET', headers, body });
    if (url === '/api/backup/drive/attachments') {
      return json({ success: true, fileId: 'DRIVE-MEDIA-1', fileName: 'BACKUP-1__MEDIA-1.jpg', mimeType: 'image/jpeg', sizeBytes: image.size, sha256: imageHash });
    }
    if (url === '/api/backup/drive/snapshots') {
      return json({ success: true, folderId: 'FOLDER-1', backupFileId: 'DRIVE-SNAPSHOT-1', backupFileName: 'ERP_DAGING_backup.json', attachmentCount: 1, uploadedAt: '2026-11-17T10:00:00.000Z' });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  const result = await uploadGoogleDriveBackup({
    sessionToken: 'erp-session-token',
    backupContent: backupContent(),
    originDeviceId: 'DEV-OWNER-1',
    storeName: 'ERP DAGING',
    backupId: 'BACKUP-1',
    mediaItems: [{ mediaId: 'MEDIA-1', blob: image }],
    fetcher,
  });
  assert.equal(result.backupFileId, 'DRIVE-SNAPSHOT-1');
  assert.equal(result.attachmentCount, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.headers.get('Authorization') === 'Bearer erp-session-token'));
  assert.ok(calls.every((call) => call.headers.get('X-ERP-Device-ID') === 'DEV-OWNER-1'));
  assert.equal(calls[0].headers.get('X-ERP-Backup-ID'), 'BACKUP-1');
  assert.equal(calls[0].headers.get('X-ERP-Media-ID'), 'MEDIA-1');
  assert.match(calls[1].body || '', /DRIVE-MEDIA-1/);
  assert.equal(calls.some((call) => call.url.includes('googleapis.com')), false, 'browser never calls Google Drive directly');
});

test('uses a stable backup ID when the same snapshot upload is retried', async () => {
  const backupIds: string[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (url === '/api/backup/drive/snapshots') {
      const body = JSON.parse(String(init?.body));
      backupIds.push(body.backupId);
      return json({ success: true, folderId: 'FOLDER-1', backupFileId: 'DRIVE-SNAPSHOT-1', backupFileName: 'ERP_DAGING_backup.json', attachmentCount: 0, uploadedAt: '2026-11-17T10:00:00.000Z' });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  const options = {
    sessionToken: 'erp-session-token', backupContent: backupContent(),
    originDeviceId: 'DEV-OWNER-1', storeName: 'ERP DAGING', mediaItems: [], fetcher,
  };
  await uploadGoogleDriveBackup(options);
  await uploadGoogleDriveBackup(options);
  assert.equal(backupIds.length, 2);
  assert.equal(backupIds[0], backupIds[1]);
});

test('rejects malformed or oversized attachments before making gateway requests', async () => {
  let calls = 0;
  const fetcher = async (): Promise<Response> => { calls += 1; return json({ success: true }); };
  await assert.rejects(() => uploadGoogleDriveBackup({
    sessionToken: 'erp-session-token',
    backupContent: backupContent(),
    originDeviceId: 'DEV-OWNER-1',
    storeName: 'ERP DAGING',
    mediaItems: [{ mediaId: 'TOO-LARGE', blob: new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/jpeg' }) }],
    fetcher,
  }), /melebihi 1 MB/);
  assert.equal(calls, 0);
});

test('lists only server-approved snapshot metadata', async () => {
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    assert.equal(String(input).startsWith('/api/backup/drive/snapshots?'), true);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer erp-session-token');
    return json({ success: true, backups: [
      { id: 'DRIVE-SNAPSHOT-1', name: 'ERP_DAGING_backup.json', mimeType: 'application/json', backupId: 'BACKUP-1', originDeviceId: 'DEV-OWNER-1' },
      { id: 'NOT-JSON', name: 'photo.jpg', mimeType: 'image/jpeg' },
    ] });
  };
  const backups = await listGoogleDriveBackups({ sessionToken: 'erp-session-token', deviceId: 'DEV-OWNER-1', fetcher });
  assert.equal(backups.length, 1);
  assert.equal(backups[0].backupId, 'BACKUP-1');
});

test('downloads snapshot and attachments only after snapshot and manifest checksum verification', async () => {
  const bytes = new TextEncoder().encode('verified-jpeg').buffer;
  const attachmentHash = await sha256(bytes);
  const manifest = [{
    mediaId: 'MEDIA-1', fileId: 'DRIVE-MEDIA-1', fileName: 'BACKUP-1__MEDIA-1.jpg',
    mimeType: 'image/jpeg', sizeBytes: bytes.byteLength, sha256: attachmentHash,
  }];
  const base = JSON.parse(backupContent()) as Record<string, unknown>;
  const backupId = 'BACKUP-1';
  const originDeviceId = 'DEV-OWNER-1';
  const manifestSha256 = await sha256(JSON.stringify({ backupId, originDeviceId, attachments: manifest }));
  const snapshotSha256 = await sha256(JSON.stringify({
    app: base.app, exportedAt: base.exportedAt, originDeviceId: base.originDeviceId,
    schemaVersion: base.schemaVersion, ownerPinRedacted: base.ownerPinRedacted,
    checksum: base.checksum, state: base.state,
  }));
  const envelope = {
    ...base,
    driveBackup: { backupId, originDeviceId, uploadedAt: '2026-11-17T10:00:00.000Z', attachmentManifest: manifest, manifestSha256, snapshotSha256 },
  };
  let attachmentRequests = 0;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer erp-session-token');
    if (url.includes('/snapshots/DRIVE-SNAPSHOT-1?')) return json({ success: true, envelope });
    if (url.includes('/attachments/DRIVE-MEDIA-1?')) {
      attachmentRequests += 1;
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  const restored = await downloadGoogleDriveBackup({
    sessionToken: 'erp-session-token', deviceId: originDeviceId,
    backupFileId: 'DRIVE-SNAPSHOT-1', backupFileName: 'ERP_DAGING_backup.json', fetcher,
  });
  assert.equal(restored.envelope.app, 'KARKASIA-ERP');
  assert.equal(restored.attachments.length, 1);
  assert.equal(await restored.attachments[0].blob.text(), 'verified-jpeg');
  assert.equal(attachmentRequests, 1);
});

test('rejects a tampered manifest before requesting any attachment', async () => {
  const base = JSON.parse(backupContent()) as Record<string, unknown>;
  const envelope = {
    ...base,
    driveBackup: {
      backupId: 'BACKUP-1', originDeviceId: 'DEV-OWNER-1', uploadedAt: '2026-11-17T10:00:00.000Z',
      attachmentManifest: [], manifestSha256: 'tampered', snapshotSha256: await sha256(JSON.stringify({
        app: base.app, exportedAt: base.exportedAt, originDeviceId: base.originDeviceId,
        schemaVersion: base.schemaVersion, ownerPinRedacted: base.ownerPinRedacted,
        checksum: base.checksum, state: base.state,
      })),
    },
  };
  let attachmentRequests = 0;
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).includes('/snapshots/')) return json({ success: true, envelope });
    attachmentRequests += 1;
    return new Response('unexpected');
  };
  await assert.rejects(() => downloadGoogleDriveBackup({
    sessionToken: 'erp-session-token', deviceId: 'DEV-OWNER-1', backupFileId: 'DRIVE-SNAPSHOT-1', fetcher,
  }), /Checksum snapshot atau manifest/);
  assert.equal(attachmentRequests, 0);
});


test('retries transient gateway upload failures with the same idempotent request', async () => {
  let attachmentCalls = 0;
  let snapshotCalls = 0;
  const image = new Blob(['retry-jpeg'], { type: 'image/jpeg' });
  const imageHash = await sha256(await image.arrayBuffer());
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url === '/api/backup/drive/attachments') {
      attachmentCalls += 1;
      if (attachmentCalls === 1) return json({ success: false, error: 'temporary unavailable' }, 503);
      return json({ success: true, fileId: 'DRIVE-MEDIA-RETRY', fileName: 'media.jpg', mimeType: 'image/jpeg', sizeBytes: image.size, sha256: imageHash });
    }
    if (url === '/api/backup/drive/snapshots') {
      snapshotCalls += 1;
      return json({ success: true, folderId: 'FOLDER-1', backupFileId: 'DRIVE-SNAPSHOT-RETRY', backupFileName: 'backup.json', attachmentCount: 1, uploadedAt: '2026-11-17T10:00:00.000Z' });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  const result = await uploadGoogleDriveBackup({
    sessionToken: 'erp-session-token', backupContent: backupContent(),
    originDeviceId: 'DEV-OWNER-1', storeName: 'ERP DAGING',
    backupId: 'BACKUP-RETRY', mediaItems: [{ mediaId: 'MEDIA-RETRY', blob: image }], fetcher,
  });
  assert.equal(result.backupFileId, 'DRIVE-SNAPSHOT-RETRY');
  assert.equal(attachmentCalls, 2);
  assert.equal(snapshotCalls, 1);
});

test('does not retry permanent authorization errors from the gateway', async () => {
  let calls = 0;
  const fetcher = async (): Promise<Response> => {
    calls += 1;
    return json({ success: false, error: 'Owner only' }, 403);
  };
  await assert.rejects(() => uploadGoogleDriveBackup({
    sessionToken: 'erp-session-token', backupContent: backupContent(),
    originDeviceId: 'DEV-OWNER-1', storeName: 'ERP DAGING',
    backupId: 'BACKUP-FORBIDDEN', mediaItems: [], fetcher,
  }), /Owner only/);
  assert.equal(calls, 1);
});
