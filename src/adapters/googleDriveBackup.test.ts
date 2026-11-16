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
  assert.match(calls[1].body || '', /ERP DAGING BACKUP/);
  assert.match(calls[2].body || '', /BACKUP-001__MEDIA-001\.jpg/);
  assert.match(calls[3].body || '', /attachmentManifest/);
  assert.match(calls[3].body || '', /FILE-1/);
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
