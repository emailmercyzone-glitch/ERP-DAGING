import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadGoogleDriveBackup } from './googleDriveBackup.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('uploads immutable JSON snapshot and separate JPEG attachments to one Owner Drive folder', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  let uploadCount = 0;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method || 'GET';
    let bodyText = '';
    if (init?.body instanceof Blob) bodyText = await init.body.text();
    else if (typeof init?.body === 'string') bodyText = init.body;
    calls.push({ url, method, body: bodyText });

    if (url.includes('/userinfo')) return json({ email: 'owner@example.com', email_verified: true });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?q=')) return json({ files: [] });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?fields=')) return json({ id: 'FOLDER-1', name: 'ERP DAGING BACKUP' });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
      uploadCount += 1;
      return json({ id: `FILE-${uploadCount}`, name: `uploaded-${uploadCount}` });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await uploadGoogleDriveBackup({
    accessToken: 'drive-access-token',
    expectedOwnerEmail: 'OWNER@example.com',
    backupContent: JSON.stringify({ app: 'KARKASIA-ERP', state: { transactions: [] }, checksum: 'abc' }),
    originDeviceId: 'DEVICE-A',
    storeName: 'ERP DAGING',
    backupId: 'BACKUP-001',
    now: new Date('2026-11-17T10:00:00.000Z'),
    mediaItems: [{ mediaId: 'MEDIA-001', blob: new Blob(['jpeg-bytes'], { type: 'image/jpeg' }) }],
    fetcher,
  });

  assert.equal(result.folderId, 'FOLDER-1');
  assert.equal(result.backupFileId, 'FILE-2');
  assert.equal(result.attachmentCount, 1);
  assert.equal(result.backupFileName, 'ERP_DAGING_ERP_DAGING_20261117_DEVICE-A_BACKUP-001.json');
  assert.equal(uploadCount, 2, 'one JPEG and one JSON file are uploaded separately');
  assert.equal(calls.filter((call) => call.url.includes('/userinfo')).length, 1);
  assert.ok(calls.every((call) => !call.url.includes('access_token=')), 'tokens must never be placed in URLs');
  assert.match(calls[2].body || '', /ERP DAGING BACKUP/);
  assert.match(calls[3].body || '', /BACKUP-001__MEDIA-001\.jpg/);
  assert.match(calls[4].body || '', /attachmentManifest/);
  assert.match(calls[4].body || '', /FILE-1/);
});

test('refuses Drive upload when the authorized Google account is not the ERP Owner account', async () => {
  let driveCalls = 0;
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).includes('/userinfo')) return json({ email: 'different@example.com', email_verified: true });
    driveCalls += 1;
    return json({});
  };
  await assert.rejects(() => uploadGoogleDriveBackup({
    accessToken: 'drive-access-token',
    expectedOwnerEmail: 'owner@example.com',
    backupContent: JSON.stringify({ app: 'KARKASIA-ERP' }),
    originDeviceId: 'DEVICE-A',
    storeName: 'ERP DAGING',
    mediaItems: [],
    fetcher,
  }), /harus sama dengan akun Owner/);
  assert.equal(driveCalls, 0, 'no folder or backup file may be touched for a different Google account');
});

test('rejects malformed or oversized attachments before writing the backup manifest', async () => {
  let uploadCount = 0;
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/userinfo')) return json({ email: 'owner@example.com', email_verified: true });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?q=')) return json({ files: [{ id: 'FOLDER-1' }] });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) uploadCount += 1;
    return json({ id: 'FILE' });
  };
  await assert.rejects(() => uploadGoogleDriveBackup({
    accessToken: 'drive-access-token',
    expectedOwnerEmail: 'owner@example.com',
    backupContent: JSON.stringify({ app: 'KARKASIA-ERP' }),
    originDeviceId: 'DEVICE-A',
    storeName: 'ERP DAGING',
    mediaItems: [{ mediaId: 'TOO-LARGE', blob: new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/jpeg' }) }],
    fetcher,
  }), /melebihi 1 MB/);
  assert.equal(uploadCount, 0);
});


test('lists only ERP DAGING JSON snapshots from the shared Owner folder', async () => {
  const urls: string[] = [];
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/drive/v3/files?q=')) {
      if (decodeURIComponent(url).includes('mimeType = \'application/vnd.google-apps.folder\'')) {
        return json({ files: [{ id: 'FOLDER-1', name: 'ERP DAGING BACKUP' }] });
      }
      return json({ files: [
        { id: 'BACKUP-1', name: 'ERP_DAGING_20261117.json', mimeType: 'application/json', createdTime: '2026-11-17T10:00:00Z', appProperties: { app: 'ERP_DAGING', backupId: 'B-1', originDeviceId: 'DEV-A' } },
        { id: 'OTHER', name: 'other.json', mimeType: 'application/json', appProperties: { app: 'OTHER' } },
        { id: 'IMAGE', name: 'photo.jpg', mimeType: 'image/jpeg', appProperties: { app: 'ERP_DAGING' } },
      ] });
    }
    throw new Error('Unexpected URL: ' + url);
  };
  const { listGoogleDriveBackups } = await import('./googleDriveBackup.ts');
  const files = await listGoogleDriveBackups({ accessToken: 'token', fetcher });
  assert.equal(files.length, 1);
  assert.equal(files[0].id, 'BACKUP-1');
  assert.equal(files[0].backupId, 'B-1');
  assert.equal(files[0].originDeviceId, 'DEV-A');
  assert.equal(urls.length, 2);
});

test('downloads a snapshot only after manifest and every attachment checksum are verified', async () => {
  const attachmentBytes = new TextEncoder().encode('verified-jpeg').buffer;
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', attachmentBytes)), b => b.toString(16).padStart(2, '0')).join('');
  const manifest = [{ mediaId: 'MEDIA-1', fileId: 'MEDIA-FILE-1', fileName: 'B-1__MEDIA-1.jpg', mimeType: 'image/jpeg', sizeBytes: attachmentBytes.byteLength, sha256: checksum }];
  const uploadedAt = '2026-11-17T10:00:00.000Z';
  const manifestPayload = { backupId: 'B-1', originDeviceId: 'DEV-A', uploadedAt, attachments: manifest };
  const manifestSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifestPayload)))), b => b.toString(16).padStart(2, '0')).join('');
  const snapshotPayload = { app: 'KARKASIA-ERP', exportedAt: uploadedAt, originDeviceId: 'DEV-A', schemaVersion: 1, ownerPinRedacted: true, checksum: 'legacy-checksum', state: { transactions: [] } };
  const snapshotSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshotPayload)))), b => b.toString(16).padStart(2, '0')).join('');
  const envelope = { ...snapshotPayload, driveBackup: { backupId: 'B-1', originDeviceId: 'DEV-A', uploadedAt, attachmentManifest: manifest, manifestSha256, snapshotSha256 } };
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/BACKUP-FILE-1?alt=media')) return json(envelope);
    if (url.endsWith('/MEDIA-FILE-1?alt=media')) return new Response(attachmentBytes, { status: 200 });
    throw new Error('Unexpected URL: ' + url);
  };
  const { downloadGoogleDriveBackup } = await import('./googleDriveBackup.ts');
  const restored = await downloadGoogleDriveBackup({ accessToken: 'token', backupFileId: 'BACKUP-FILE-1', fetcher });
  assert.equal(restored.envelope.app, 'KARKASIA-ERP');
  assert.equal(restored.attachments.length, 1);
  assert.equal(restored.attachments[0].mediaId, 'MEDIA-1');
  assert.equal(await restored.attachments[0].blob.text(), 'verified-jpeg');
});

test('rejects a Drive snapshot with a tampered manifest before downloading attachments', async () => {
  let attachmentRequests = 0;
  const snapshotPayload = { app: 'KARKASIA-ERP', exportedAt: '2026-11-17T10:00:00.000Z', originDeviceId: 'DEV-A', schemaVersion: 1, ownerPinRedacted: true, checksum: 'legacy-checksum', state: { transactions: [] } };
  const snapshotSha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshotPayload)))), b => b.toString(16).padStart(2, '0')).join('');
  const envelope = { ...snapshotPayload, driveBackup: { backupId: 'B-1', originDeviceId: 'DEV-A', uploadedAt: '2026-11-17T10:00:00.000Z', attachmentManifest: [], manifestSha256: 'tampered', snapshotSha256 } };
  const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
    if (String(input).endsWith('/BACKUP-FILE-1?alt=media')) return json(envelope);
    attachmentRequests += 1;
    return new Response('unexpected');
  };
  const { downloadGoogleDriveBackup } = await import('./googleDriveBackup.ts');
  await assert.rejects(() => downloadGoogleDriveBackup({ accessToken: 'token', backupFileId: 'BACKUP-FILE-1', fetcher }), /Checksum manifest/);
  assert.equal(attachmentRequests, 0);
});
