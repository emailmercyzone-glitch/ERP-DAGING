import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeDriveBackupAccess } from './driveBackupAccess.ts';

const ownerEmail = 'owner@example.com';

test('all enrolled business roles may upload through the single Owner-owned Drive gateway', () => {
  for (const role of ['OWNER', 'ADMIN', 'SALES']) {
    assert.deepEqual(authorizeDriveBackupAccess({
      action: 'UPLOAD', role, sessionEmail: 'admin-or-sales@example.com',
      ownerEmail, deviceAuthorized: true,
    }), { allowed: true });
  }
});

test('Drive backup upload still rejects devices outside the authenticated membership', () => {
  const decision = authorizeDriveBackupAccess({
    action: 'UPLOAD', role: 'SALES', sessionEmail: 'sales@example.com',
    ownerEmail, deviceAuthorized: false,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, 'DEVICE_NOT_AUTHORIZED');
});

test('only the Owner account may list/download backups for full restore', () => {
  for (const role of ['ADMIN', 'SALES']) {
    const decision = authorizeDriveBackupAccess({
      action: 'RESTORE', role, sessionEmail: ownerEmail, ownerEmail, deviceAuthorized: true,
    });
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, 'OWNER_ONLY');
  }
  assert.deepEqual(authorizeDriveBackupAccess({
    action: 'RESTORE', role: 'OWNER', sessionEmail: 'OWNER@example.com',
    ownerEmail, deviceAuthorized: true,
  }), { allowed: true });
});

test('restore rejects an Owner session that does not match the configured Drive account', () => {
  const decision = authorizeDriveBackupAccess({
    action: 'RESTORE', role: 'OWNER', sessionEmail: 'different@example.com',
    ownerEmail, deviceAuthorized: true,
  });
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.code, 'DRIVE_OWNER_MISMATCH');
});
