import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createErpAuthService,
  authorizeSyncEvent,
  ErpAuthError,
  parseMembershipRegistry,
  type GoogleIdentity,
  type ErpMembership,
  type ErpRole,
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

test('Sales membership binds a stable salesId into the verified session', async () => {
  const salesMembership = member({
    googleSub: 'google-sub-sales-001',
    role: 'SALES',
    salesId: 'SALES-001',
    deviceIds: ['DEVICE-SALES-1'],
  });
  const auth = service({
    memberships: [salesMembership],
    googleIdentity: identity({ sub: 'google-sub-sales-001', email: 'sales@example.test' }),
  });
  const result = await auth.authenticateGoogleCredential('valid-google-id-token');
  assert.equal(result.user.role, 'SALES');
  assert.equal(result.user.salesId, 'SALES-001');
  assert.equal(auth.verifySession(result.accessToken).salesId, 'SALES-001');
});

test('changing Sales identity mapping revokes the previous session', async () => {
  const memberships = [member({
    googleSub: 'google-sub-sales-002',
    role: 'SALES',
    salesId: 'SALES-002',
  })];
  const auth = service({
    memberships,
    googleIdentity: identity({ sub: 'google-sub-sales-002' }),
  });
  const { accessToken } = await auth.authenticateGoogleCredential('valid-google-id-token');
  memberships[0].salesId = 'SALES-RENAMED';
  assert.throws(
    () => auth.verifySession(accessToken),
    (error: unknown) => error instanceof ErpAuthError && error.code === 'MEMBERSHIP_REVOKED',
  );
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
  assert.throws(() => parseMembershipRegistry(JSON.stringify([member({
    googleSub: 'sales-without-id', role: 'SALES',
  })])), /wajib memiliki salesId/);
  assert.throws(() => parseMembershipRegistry(JSON.stringify([member({
    googleSub: 'owner-with-sales-id', salesId: 'SALES-001',
  })])), /tidak boleh memiliki salesId/);
  assert.deepEqual(parseMembershipRegistry(undefined), []);
});


test('server enforces event permissions from verified ERP role', () => {
  const sale = { entityType: 'SALE', payload: { salesId: 'SALES-001' } };
  const smallReturn = { entityType: 'RETURN', payload: { salesId: 'SALES-001', estimatedRefundValue: 500000 } };
  const largeReturn = { entityType: 'RETURN', payload: { salesId: 'SALES-001', estimatedRefundValue: 500001 } };
  const receivablePayment = { entityType: 'PAYMENT', payload: { salesId: 'SALES-001', kind: 'RECEIVABLE_PAYMENT' } };
  const supplierPayment = { entityType: 'PAYMENT', payload: { salesId: 'SALES-001', kind: 'SUPPLIER_PAYMENT' } };
  assert.equal(authorizeSyncEvent('OWNER', { entityType: 'VOID', payload: {} }).allowed, true);
  assert.equal(authorizeSyncEvent('ADMIN', sale).allowed, true);
  assert.equal(authorizeSyncEvent('ADMIN', smallReturn).allowed, true);
  assert.equal(authorizeSyncEvent('ADMIN', receivablePayment).allowed, true);
  assert.equal(authorizeSyncEvent('ADMIN', supplierPayment).allowed, false);
  assert.equal(authorizeSyncEvent('ADMIN', largeReturn).allowed, false);
  assert.equal(authorizeSyncEvent('ADMIN', { entityType: 'RETURN', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('ADMIN', { entityType: 'VOID', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('ADMIN', { entityType: 'APPROVAL', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('ADMIN', { entityType: 'UNRECOGNIZED_EVENT', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('OWNER', { entityType: 'UNRECOGNIZED_EVENT', payload: {} }).allowed, false);
  assert.equal(authorizeSyncEvent('SALES', sale, 'SALES-001').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', sale, 'SALES-OTHER').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', { entityType: 'SALE', payload: {} }, 'SALES-001').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', smallReturn, 'SALES-001').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', largeReturn, 'SALES-001').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', receivablePayment, 'SALES-001').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', supplierPayment, 'SALES-001').allowed, false);
  assert.equal(authorizeSyncEvent('SALES', { entityType: 'MASTER_DATA', payload: { salesId: 'SALES-001' } }, 'SALES-001').allowed, false);
});


test('device synchronization is denied unless active membership explicitly lists the device ID', () => {
  const auth = createErpAuthService({
    googleClientId: 'google-client-id',
    sessionSecret: 'x'.repeat(40),
    memberships: [member({ deviceIds: ['DEVICE-A'] })],
    verifyGoogleCredential: async () => identity(),
  });
  assert.equal(auth.isDeviceAuthorized('google-sub-owner-001', 'STORE-ERP-DAGING', 'DEVICE-A'), true);
  assert.equal(auth.isDeviceAuthorized('google-sub-owner-001', 'STORE-ERP-DAGING', 'DEVICE-B'), false);
  const noDeviceList = createErpAuthService({
    googleClientId: 'google-client-id',
    sessionSecret: 'x'.repeat(40),
    memberships: [member()],
    verifyGoogleCredential: async () => identity(),
  });
  assert.equal(noDeviceList.isDeviceAuthorized('google-sub-owner-001', 'STORE-ERP-DAGING', 'DEVICE-A'), false);
});

test('membership registry rejects malformed or duplicate device IDs', () => {
  assert.throws(() => parseMembershipRegistry(JSON.stringify([member({ deviceIds: ['BAD DEVICE'] })])));
  assert.throws(() => parseMembershipRegistry(JSON.stringify([member({ deviceIds: ['DEVICE-A', 'DEVICE-A'] })])));
});


test('membership registry enforces one Owner, two Admin, five Sales and eight devices per store', () => {
  const base = (googleSub: string, role: ErpRole, deviceIds: string[]) => ({
    googleSub, storeId: 'STORE-ERP-DAGING', role, active: true,
    ...(role === 'SALES' ? { salesId: googleSub.replace('SALES-', 'SALES-ID-') } : {}),
    deviceIds,
  });
  assert.throws(() => parseMembershipRegistry(JSON.stringify([
    base('OWNER-1', 'OWNER', ['DEV-1']),
    base('OWNER-2', 'OWNER', ['DEV-2']),
  ])), /maksimal 1 Owner/);
  assert.throws(() => parseMembershipRegistry(JSON.stringify([
    base('OWNER-1', 'OWNER', ['DEV-1']),
    base('ADMIN-1', 'ADMIN', ['DEV-2']),
    base('ADMIN-2', 'ADMIN', ['DEV-3']),
    base('ADMIN-3', 'ADMIN', ['DEV-4']),
  ])), /maksimal 1 Owner/);
  assert.throws(() => parseMembershipRegistry(JSON.stringify([
    base('OWNER-1', 'OWNER', ['DEV-1']),
    base('SALES-1', 'SALES', ['DEV-2']),
    base('SALES-2', 'SALES', ['DEV-3']),
    base('SALES-3', 'SALES', ['DEV-4']),
    base('SALES-4', 'SALES', ['DEV-5']),
    base('SALES-5', 'SALES', ['DEV-6']),
    base('SALES-6', 'SALES', ['DEV-7']),
  ])), /maksimal 1 Owner/);
  assert.throws(() => parseMembershipRegistry(JSON.stringify([
    base('OWNER-1', 'OWNER', ['DEV-1','DEV-2','DEV-3','DEV-4','DEV-5','DEV-6','DEV-7','DEV-8','DEV-9']),
  ])), /maksimal 1 Owner/);
});
