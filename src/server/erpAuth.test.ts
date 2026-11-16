import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createErpAuthService,
  authorizeSyncEvent,
  ErpAuthError,
  parseMembershipRegistry,
  type GoogleIdentity,
  type ErpMembership,
} from './erpAuth.ts';

const NOW = 1_800_000_000;
const SECRET = 'test-only-session-secret-at-least-32-bytes';
const CLIENT_ID = 'erp-daging-test.apps.googleusercontent.com';
const identity = (overrides: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
  sub: 'google-sub-owner-001',
  email: 'owner@example.test',
  name: 'ERP Owner',
  issuer: 'https://accounts.google.com',
  audience: CLIENT_ID,
  expiresAt: NOW + 3600,
  ...overrides,
});
const member = (overrides: Partial<ErpMembership> = {}): ErpMembership => ({
  googleSub: 'google-sub-owner-001',
  storeId: 'STORE-ERP-DAGING',
  role: 'OWNER',
  active: true,
  ...overrides,
});

function service(options: {
  memberships?: ErpMembership[];
  googleIdentity?: GoogleIdentity;
  now?: () => number;
} = {}) {
  return createErpAuthService({
    googleClientId: CLIENT_ID,
    sessionSecret: SECRET,
    memberships: options.memberships ?? [member()],
    now: options.now ?? (() => NOW),
    verifyGoogleCredential: async (credential, audience) => {
      assert.equal(credential, 'valid-google-id-token');
      assert.equal(audience, CLIENT_ID);
      return options.googleIdentity ?? identity();
    },
  });
}

test('Google identity is exchanged for a short-lived ERP session only with active membership', async () => {
  const auth = service();
  const result = await auth.authenticateGoogleCredential('valid-google-id-token');
  assert.equal(result.user.sub, 'google-sub-owner-001');
  assert.equal(result.user.storeId, 'STORE-ERP-DAGING');
  assert.equal(result.user.role, 'OWNER');
  assert.equal(auth.verifySession(result.accessToken).role, 'OWNER');
  assert.equal(result.user.expiresAt, NOW + 900);
});

test('email or a valid Google identity without a registered membership cannot enter ERP', async () => {
  const auth = service({ memberships: [] });
  await assert.rejects(
    () => auth.authenticateGoogleCredential('valid-google-id-token'),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'MEMBERSHIP_REVOKED',
  );
});

test('Google audience, issuer, and expiry are checked after token verification', async () => {
  for (const invalid of [
    identity({ audience: 'another-client-id' }),
    identity({ issuer: 'https://attacker.example' }),
    identity({ expiresAt: NOW }),
  ]) {
    const auth = service({ googleIdentity: invalid });
    await assert.rejects(
      () => auth.authenticateGoogleCredential('valid-google-id-token'),
      (error: unknown) => error instanceof ErpAuthError && error.code === 'GOOGLE_TOKEN_INVALID',
    );
  }
});

test('invalid Google credentials are rejected and verifier details are not leaked', async () => {
  const auth = createErpAuthService({
    googleClientId: CLIENT_ID,
    sessionSecret: SECRET,
    memberships: [member()],
    verifyGoogleCredential: async () => { throw new Error('private verifier detail'); },
    now: () => NOW,
  });
  await assert.rejects(
    () => auth.authenticateGoogleCredential('valid-google-id-token'),
    (error: unknown) => error instanceof ErpAuthError &&
      error.code === 'GOOGLE_TOKEN_INVALID' &&
      !error.message.includes('private verifier detail'),
  );
});

test('session signature tampering and expiry are rejected', async () => {
  const auth = service();
  const { accessToken } = await auth.authenticateGoogleCredential('valid-google-id-token');
  const parts = accessToken.split('.');
  const signatureBytes = Buffer.from(parts[2], 'base64url');
  signatureBytes[0] ^= 1;
  const tampered = parts[0] + '.' + parts[1] + '.' + signatureBytes.toString('base64url');
  assert.throws(
    () => auth.verifySession(tampered),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'SESSION_INVALID',
  );
  const expiredAuth = service({ now: () => NOW + 901 });
  assert.throws(
    () => expiredAuth.verifySession(accessToken),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'SESSION_EXPIRED',
  );
});

test('membership changes take effect immediately on existing sessions', async () => {
  const memberships = [member()];
  const auth = service({ memberships });
  const { accessToken } = await auth.authenticateGoogleCredential('valid-google-id-token');
  memberships[0].active = false;
  assert.throws(
    () => auth.verifySession(accessToken),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'MEMBERSHIP_REVOKED',
  );
});

test('role and store changes invalidate old sessions rather than trusting token claims', async () => {
  const memberships = [member()];
  const auth = service({ memberships });
  const { accessToken } = await auth.authenticateGoogleCredential('valid-google-id-token');
  memberships[0].role = 'ADMIN';
  assert.throws(
    () => auth.verifySession(accessToken),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'MEMBERSHIP_REVOKED',
  );
});

test('multiple active store memberships fail closed until store selection is designed', async () => {
  const auth = service({ memberships: [member(), member({ storeId: 'OTHER-STORE' })] });
  await assert.rejects(
    () => auth.authenticateGoogleCredential('valid-google-id-token'),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'MEMBERSHIP_AMBIGUOUS',
  );
});

test('membership registry rejects malformed roles and duplicate user/store entries', () => {
  assert.throws(() => parseMembershipRegistry('[{"googleSub":"u","storeId":"s","role":"SUPERADMIN","active":true}]'));
  assert.throws(() => parseMembershipRegistry(JSON.stringify([member(), member()])));
  assert.deepEqual(parseMembershipRegistry(undefined), []);
});


test('server enforces event permissions from verified ERP role', () => {
  const sale = { entityType: 'SALE', payload: {} };
  const smallReturn = { entityType: 'RETURN', payload: { estimatedRefundValue: 500000 } };
  const largeReturn = { entityType: 'RETURN', payload: { estimatedRefundValue: 500001 } };
  const receivablePayment = { entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT' } };
  const supplierPayment = { entityType: 'PAYMENT', payload: { kind: 'SUPPLIER_PAYMENT' } };
  assert.equal(authorizeSyncEvent('OWNER', { entityType: 'VOID', payload: {} }).allowed, true);
  assert.equal(authorizeSyncEvent('ADMIN', sale).allowed, true);
  assert.equal(authorizeSyncEvent('ADMIN', { entityType: 'VOID', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('ADMIN', { entityType: 'APPROVAL', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('SALES', sale).allowed, true);
  assert.equal(authorizeSyncEvent('SALES', smallReturn).allowed, true);
  assert.equal(authorizeSyncEvent('SALES', largeReturn).allowed, false);
  assert.equal(authorizeSyncEvent('SALES', receivablePayment).allowed, true);
  assert.equal(authorizeSyncEvent('SALES', supplierPayment).allowed, false);
  assert.equal(authorizeSyncEvent('SALES', { entityType: 'MASTER_DATA', payload: {} }).allowed, false);
});
