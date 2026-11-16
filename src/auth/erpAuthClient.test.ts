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
