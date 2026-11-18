import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

const sessionSecret = 'erp-daging-http-route-test-secret-32-bytes';
const memberships = [
  { googleSub: 'owner-route-test', storeId: 'STORE-ERP-DAGING', role: 'OWNER', active: true, deviceIds: ['DEVICE-OWNER-HTTP'] },
  { googleSub: 'sales-route-test', storeId: 'STORE-ERP-DAGING', role: 'SALES', salesId: 'SALES-HTTP-1', active: true, deviceIds: ['DEVICE-SALES-HTTP'] },
];

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'erp-daging-http-test.apps.googleusercontent.com';
process.env.ERP_AUTH_SESSION_SECRET = sessionSecret;
process.env.ERP_AUTH_MEMBERS_JSON = JSON.stringify(memberships);
process.env.GAS_WEB_APP_URL = 'https://script.google.com/macros/s/erp-daging-http-test/exec';
process.env.GAS_SYNC_SHARED_SECRET = 'gas-shared-secret-for-http-route-tests-32';
process.env.GAS_GATEWAY_HMAC_SECRET = 'gas-hmac-secret-for-http-route-tests-32-bytes';
process.env.GOOGLE_DRIVE_CLIENT_ID = 'drive-client-test';
process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'drive-client-secret-test';
process.env.GOOGLE_DRIVE_REFRESH_TOKEN = 'drive-refresh-token-test';
process.env.GOOGLE_DRIVE_OWNER_EMAIL = 'owner@example.test';
process.env.GOOGLE_DRIVE_FOLDER_ID = 'folder-id-test-12345';

const originalFetch = globalThis.fetch;
const upstreamRequests: Array<{ body: Record<string, unknown>; raw: string }> = [];
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const raw = String(init?.body || '{}');
  const body = JSON.parse(raw) as Record<string, unknown>;
  upstreamRequests.push({ body, raw });
  const action = body.action;
  const result = action === 'sync_pull'
    ? { ok: true, records: [], lastServerSeq: 0 }
    : { ok: true, serverSeqs: { 'HTTP-SALE-1': 1 } };
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

const { app } = await import('../../server.ts');
const httpServer = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  httpServer.once('listening', resolve);
  httpServer.once('error', reject);
});
const address = httpServer.address();
if (!address || typeof address === 'string') throw new Error('HTTP test server did not bind a TCP port.');
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  globalThis.fetch = originalFetch;
});

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionToken(role: 'OWNER' | 'SALES'): string {
  const isSales = role === 'SALES';
  const payload = {
    iss: 'erp-daging',
    aud: 'erp-daging-pwa',
    sub: isSales ? 'sales-route-test' : 'owner-route-test',
    storeId: 'STORE-ERP-DAGING',
    role,
    ...(isSales ? { salesId: 'SALES-HTTP-1' } : {}),
    email: isSales ? 'sales@example.test' : 'owner@example.test',
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 900,
  };
  const unsigned = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode(payload);
  const signature = crypto.createHmac('sha256', sessionSecret).update(unsigned).digest('base64url');
  return unsigned + '.' + signature;
}

async function request(path: string, options: {
  method?: string;
  role?: 'OWNER' | 'SALES';
  deviceId?: string;
  body?: Record<string, unknown>;
} = {}) {
  const url = new URL(path, baseUrl);
  const headers: Record<string, string> = {};
  if (options.role) headers.Authorization = `Bearer ${sessionToken(options.role)}`;
  if (options.deviceId) headers['X-Device-Id'] = options.deviceId;
  if (options.body) headers['Content-Type'] = 'application/json';
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = http.request(url, { method: options.method || 'GET', headers }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 0, body: JSON.parse(raw || '{}') }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

test('HTTP sync gateway requires a valid ERP session and enrolled device', async () => {
  const noSession = await request('/api/sync/gas', { method: 'POST', body: { action: 'sync_pull', deviceId: 'DEVICE-OWNER-HTTP' } });
  assert.equal(noSession.status, 401);

  const unknownDevice = await request('/api/sync/gas', {
    method: 'POST', role: 'OWNER', deviceId: 'DEVICE-NOT-ENROLLED',
    body: { action: 'sync_pull', deviceId: 'DEVICE-NOT-ENROLLED', sinceSeq: 0 },
  });
  assert.equal(unknownDevice.status, 403);
  assert.match(String(unknownDevice.body.message), /belum terdaftar/i);
});

test('HTTP sync gateway rejects client-supplied secrets and store spoofing before upstream access', async () => {
  upstreamRequests.length = 0;
  const injectedSecret = await request('/api/sync/gas', {
    method: 'POST', role: 'OWNER', deviceId: 'DEVICE-OWNER-HTTP',
    body: { action: 'sync_pull', deviceId: 'DEVICE-OWNER-HTTP', sinceSeq: 0, sharedSecret: 'forged' },
  });
  assert.equal(injectedSecret.status, 400);

  const wrongStore = await request('/api/sync/gas', {
    method: 'POST', role: 'OWNER', deviceId: 'DEVICE-OWNER-HTTP',
    body: { action: 'sync_pull', storeId: 'ANOTHER-STORE', deviceId: 'DEVICE-OWNER-HTTP', sinceSeq: 0 },
  });
  assert.equal(wrongStore.status, 403);
  assert.equal(upstreamRequests.length, 0);
});

test('HTTP Owner push injects server secrets and forwards the acknowledged event once', async () => {
  upstreamRequests.length = 0;
  const result = await request('/api/sync/gas', {
    method: 'POST', role: 'OWNER', deviceId: 'DEVICE-OWNER-HTTP',
    body: {
      action: 'sync_push',
      deviceId: 'DEVICE-OWNER-HTTP',
      events: [{ uuid: 'HTTP-SALE-1', idempotencyKey: 'HTTP-SALE-1-KEY', entityType: 'SALE', payload: {} }],
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(upstreamRequests.length, 1);
  const upstream = upstreamRequests[0].body;
  assert.equal(upstream.sharedSecret, process.env.GAS_SYNC_SHARED_SECRET);
  assert.equal(typeof upstream.gatewayAuth, 'object');
  assert.equal(upstream.storeId, 'STORE-ERP-DAGING');
  assert.equal(upstream.deviceId, 'DEVICE-OWNER-HTTP');
  assert.equal('sharedSecret' in (result.body as Record<string, unknown>), false);
});

test('HTTP Owner pull forwards cursor and returns the backend page', async () => {
  upstreamRequests.length = 0;
  const result = await request('/api/sync/gas', {
    method: 'POST', role: 'OWNER', deviceId: 'DEVICE-OWNER-HTTP',
    body: { action: 'sync_pull', deviceId: 'DEVICE-OWNER-HTTP', sinceSeq: 17 },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.lastServerSeq, 0);
  assert.equal(upstreamRequests[0].body.sinceSeq, 17);
});

test('HTTP Sales pull uses server ownership index and does not expose the raw upstream request', async () => {
  upstreamRequests.length = 0;
  const result = await request('/api/sync/gas', {
    method: 'POST', role: 'SALES', deviceId: 'DEVICE-SALES-HTTP',
    body: { action: 'sync_pull', deviceId: 'DEVICE-SALES-HTTP', sinceSeq: 0 },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.deepEqual(result.body.records, []);
  assert.equal(upstreamRequests.length, 1, 'Sales route first loads the authoritative ownership index');
  assert.equal(upstreamRequests[0].body.deviceId, 'ERP_SERVER_INDEX');
});

test('HTTP Sales media download fails closed when media ownership is absent', async () => {
  const result = await request('/api/sync/gas', {
    method: 'POST', role: 'SALES', deviceId: 'DEVICE-SALES-HTTP',
    body: { action: 'media_download', deviceId: 'DEVICE-SALES-HTTP', mediaId: 'MEDIA-NOT-OWNED' },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'SALES_MEDIA_OWNERSHIP_DENIED');
});
