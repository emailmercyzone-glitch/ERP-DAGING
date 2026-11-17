import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createErpAuthClient, ErpAuthClientError } from './erpAuthClient.ts';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const user = {
  sub: 'google-sub-1',
  storeId: 'TOKO_01',
  role: 'OWNER',
  issuedAt: 100,
  expiresAt: 1000,
};

test('reads public auth config without exposing server secrets', async () => {
  const client = createErpAuthClient(async () => response({ success: true, enabled: true, googleClientId: 'public-client-id' }));
  assert.deepEqual(await client.getConfig(), { enabled: true, googleClientId: 'public-client-id' });
});

test('exchanges Google credential and keeps ERP token in memory', async () => {
  let sentBody = '';
  const client = createErpAuthClient(async (_input, init) => {
    sentBody = String(init?.body || '');
    return response({ success: true, accessToken: 'short-lived-token', user });
  });
  assert.equal((await client.loginWithGoogleCredential('google-id-token')).role, 'OWNER');
  assert.deepEqual(JSON.parse(sentBody), { credential: 'google-id-token' });
  assert.equal(client.getAccessToken(), 'short-lived-token');
  assert.equal(client.getCachedUser()?.sub, 'google-sub-1');
  client.clearSession();
  assert.equal(client.getAccessToken(), null);
  assert.equal(client.getCachedUser(), null);
});

test('preserves authenticated Sales ID and rejects missing or forged role identity', async () => {
  const salesUser = { ...user, role: 'SALES', salesId: 'SALES-001' };
  const client = createErpAuthClient(async () => response({ success: true, accessToken: 'sales-token', user: salesUser }));
  const authenticated = await client.loginWithGoogleCredential('valid-token');
  assert.equal(authenticated.salesId, 'SALES-001');
  assert.equal(client.getCachedUser()?.salesId, 'SALES-001');

  const missingSalesId = createErpAuthClient(async () => response({
    success: true, accessToken: 'token', user: { ...user, role: 'SALES' },
  }));
  await assert.rejects(() => missingSalesId.loginWithGoogleCredential('valid-token'), /Respons identitas ERP tidak valid/);

  const forgedOwnerSalesId = createErpAuthClient(async () => response({
    success: true, accessToken: 'token', user: { ...user, salesId: 'SALES-001' },
  }));
  await assert.rejects(() => forgedOwnerSalesId.loginWithGoogleCredential('valid-token'), /Respons identitas ERP tidak valid/);
});

test('rejects empty credential and malformed server identity', async () => {
  const client = createErpAuthClient(async () => response({ success: true, accessToken: 'token', user: { ...user, role: 'SUPERADMIN' } }));
  await assert.rejects(() => client.loginWithGoogleCredential(' '), ErpAuthClientError);
  await assert.rejects(() => client.loginWithGoogleCredential('valid-token'), /Respons identitas ERP tidak valid/);
  assert.equal(client.getAccessToken(), null);
});

test('validates the active session with bearer token', async () => {
  let authorization = '';
  const client = createErpAuthClient(async (input, init) => {
    if (String(input) === '/api/auth/google') return response({ success: true, accessToken: 'token-123', user });
    authorization = new Headers(init?.headers).get('Authorization') || '';
    return response({ success: true, user: { ...user, role: 'ADMIN' } });
  });
  await client.loginWithGoogleCredential('google-token');
  assert.equal((await client.getCurrentUser()).role, 'ADMIN');
  assert.equal(authorization, 'Bearer token-123');
});

test('clears client session after server rejects the ERP session', async () => {
  const client = createErpAuthClient(async (input) => {
    if (String(input) === '/api/auth/google') return response({ success: true, accessToken: 'token-123', user });
    return response({ success: false, code: 'MEMBERSHIP_REVOKED', error: 'Membership revoked' }, 403);
  });
  await client.loginWithGoogleCredential('google-token');
  await assert.rejects(() => client.getCurrentUser(), /Membership revoked/);
  assert.equal(client.getAccessToken(), null);
  assert.equal(client.getCachedUser(), null);
});

test('does not silently treat a missing session as authenticated', async () => {
  const client = createErpAuthClient(async () => response({ success: true, user }));
  await assert.rejects(() => client.getCurrentUser(), /Belum ada session ERP aktif/);
});


test('requests a 72-hour offline lease with the current bearer session and device ID', async () => {
  const calls: Array<{ url: string; authorization: string; body: string }> = [];
  const client = createErpAuthClient(async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      authorization: new Headers(init?.headers).get('Authorization') || '',
      body: String(init?.body || ''),
    });
    if (url === '/api/auth/google') return response({ success: true, accessToken: 'session-token', user });
    return response({ success: true, token: 'signed.lease', expiresAt: 1000 + 72 * 60 * 60, ttlSeconds: 72 * 60 * 60 });
  });
  await client.loginWithGoogleCredential('google-token');
  const lease = await client.requestOfflineLease('DEVICE-1');
  assert.equal(lease.token, 'signed.lease');
  assert.equal(calls[1].url, '/api/auth/offline-lease');
  assert.equal(calls[1].authorization, 'Bearer session-token');
  assert.deepEqual(JSON.parse(calls[1].body), { deviceId: 'DEVICE-1' });
  await assert.rejects(() => client.requestOfflineLease('bad device'), /Device ID tidak valid/);
});
