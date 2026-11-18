import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyOfflineLease, type OfflineLeaseClaims } from './offlineLease.ts';

const NOW = 1_800_000_000;
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const baseClaims: OfflineLeaseClaims = {
  iss: 'erp-daging', aud: 'erp-daging-pwa-offline', sub: 'google-sub-1',
  storeId: 'STORE-1', role: 'OWNER', deviceId: 'DEVICE-1',
  issuedAt: NOW, expiresAt: NOW + 72 * 60 * 60,
};
function signedToken(claims: OfflineLeaseClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payload), keys.privateKey).toString('base64url');
  return payload + '.' + signature;
}

test('verifies a valid signed lease for its exact device and returns bound claims', async () => {
  const token = signedToken(baseClaims);
  const result = await verifyOfflineLease(token, 'DEVICE-1', publicPem, NOW);
  assert.equal(result?.claims.sub, 'google-sub-1');
  assert.equal(result?.claims.role, 'OWNER');
  assert.equal(result?.claims.expiresAt, NOW + 72 * 60 * 60);
});

test('rejects signature tampering and device mismatch', async () => {
  const token = signedToken(baseClaims);
  const [payload, signature] = token.split('.');
  const bytes = Buffer.from(signature, 'base64url');
  bytes[0] ^= 1;
  assert.equal(await verifyOfflineLease(payload + '.' + bytes.toString('base64url'), 'DEVICE-1', publicPem, NOW), null);
  assert.equal(await verifyOfflineLease(token, 'DEVICE-OTHER', publicPem, NOW), null);
});

test('rejects expired, future-issued, and overlong leases', async () => {
  assert.equal(await verifyOfflineLease(signedToken({ ...baseClaims, expiresAt: NOW }), 'DEVICE-1', publicPem, NOW), null);
  assert.equal(await verifyOfflineLease(signedToken({ ...baseClaims, issuedAt: NOW + 60 }), 'DEVICE-1', publicPem, NOW), null);
  assert.equal(await verifyOfflineLease(signedToken({ ...baseClaims, expiresAt: NOW + 72 * 60 * 60 + 1 }), 'DEVICE-1', publicPem, NOW), null);
});

test('rejects mismatched account, store, role and Sales identity binding', async () => {
  const token = signedToken({ ...baseClaims, role: 'SALES', salesId: 'SALES-1' });
  assert.equal(await verifyOfflineLease(token, 'DEVICE-1', publicPem, NOW, { sub: 'another-user' }), null);
  assert.equal(await verifyOfflineLease(token, 'DEVICE-1', publicPem, NOW, { storeId: 'ANOTHER-STORE' }), null);
  assert.equal(await verifyOfflineLease(token, 'DEVICE-1', publicPem, NOW, { role: 'ADMIN' }), null);
  assert.equal(await verifyOfflineLease(token, 'DEVICE-1', publicPem, NOW, { salesId: 'SALES-2' }), null);
});

function signedRawToken(claims: unknown): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payload), keys.privateKey).toString('base64url');
  return payload + '.' + signature;
}

test('enforces exact expiry, maximum TTL, and bounded future-issued clock skew', async () => {
  assert.ok(await verifyOfflineLease(
    signedToken({ ...baseClaims, issuedAt: NOW + 30, expiresAt: NOW + 30 + 72 * 60 * 60 }),
    'DEVICE-1', publicPem, NOW,
  ));
  assert.equal(await verifyOfflineLease(
    signedToken({ ...baseClaims, issuedAt: NOW + 31, expiresAt: NOW + 31 + 72 * 60 * 60 }),
    'DEVICE-1', publicPem, NOW,
  ), null);
  assert.ok(await verifyOfflineLease(
    signedToken({ ...baseClaims, expiresAt: NOW + 1 }),
    'DEVICE-1', publicPem, NOW,
  ));
  assert.equal(await verifyOfflineLease(
    signedToken({ ...baseClaims, expiresAt: NOW }),
    'DEVICE-1', publicPem, NOW,
  ), null);
  assert.ok(await verifyOfflineLease(
    signedToken({ ...baseClaims, expiresAt: NOW + 72 * 60 * 60 }),
    'DEVICE-1', publicPem, NOW,
  ));
});

test('rejects malformed token structure, invalid claims, and a signature from another key', async () => {
  const otherKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherPublicPem = otherKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.equal(await verifyOfflineLease('not-a-token', 'DEVICE-1', publicPem, NOW), null);
  assert.equal(await verifyOfflineLease(signedToken(baseClaims), 'DEVICE-1', otherPublicPem, NOW), null);
  for (const invalidClaims of [
    { ...baseClaims, role: 'SUPERADMIN' },
    { ...baseClaims, salesId: 'SALES-1' },
    { ...baseClaims, issuedAt: NOW + 0.5 },
    { ...baseClaims, expiresAt: NOW + 0.5 },
    { ...baseClaims, expiresAt: NOW - 1 },
    { ...baseClaims, expiresAt: NOW + 72 * 60 * 60 + 1 },
    { ...baseClaims, sub: '' },
    { ...baseClaims, storeId: '' },
    { ...baseClaims, deviceId: 'DEVICE-OTHER' },
    { ...baseClaims, role: 'SALES', salesId: undefined },
    { ...baseClaims, role: 'SALES', salesId: 'invalid sales id' },
  ]) {
    assert.equal(await verifyOfflineLease(signedRawToken(invalidClaims), 'DEVICE-1', publicPem, NOW), null);
  }
});

