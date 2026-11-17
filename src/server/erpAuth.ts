import crypto from 'node:crypto';

export type ErpRole = 'OWNER' | 'ADMIN' | 'SALES';

export interface ErpMembership {
  googleSub: string;
  storeId: string;
  role: ErpRole;
  active: boolean;
  /** Stable business identity for a Sales membership; required when role is SALES. */
  salesId?: string;
  /** Explicit server-side device allow-list; empty means no device may sync. */
  deviceIds?: string[];
}

export interface GoogleIdentity {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  issuer: string;
  audience: string;
  expiresAt: number;
}

export interface ErpSession {
  sub: string;
  storeId: string;
  role: ErpRole;
  /** Stable business identity bound to this authenticated Sales session. */
  salesId?: string;
  email?: string;
  name?: string;
  picture?: string;
  issuedAt: number;
  expiresAt: number;
}

export type AuthErrorCode =
  | 'AUTH_NOT_CONFIGURED'
  | 'GOOGLE_TOKEN_INVALID'
  | 'GOOGLE_TOKEN_EXPIRED'
  | 'MEMBERSHIP_REQUIRED'
  | 'MEMBERSHIP_AMBIGUOUS'
  | 'SESSION_INVALID'
  | 'SESSION_EXPIRED'
  | 'MEMBERSHIP_REVOKED'
  | 'OFFLINE_LEASE_NOT_CONFIGURED'
  | 'DEVICE_NOT_AUTHORIZED';

export class ErpAuthError extends Error {
  constructor(readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'ErpAuthError';
  }
}


export interface SyncEventAuthorization {
  allowed: boolean;
  reason?: string;
}

/** Server-side role boundary for events entering the shared ERP event log. */
export function authorizeSyncEvent(role: ErpRole, event: unknown, authenticatedSalesId?: string): SyncEventAuthorization {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { allowed: false, reason: 'Format event tidak valid.' };
  }
  const record = event as Record<string, unknown>;
  const entityType = typeof record.entityType === 'string' ? record.entityType : '';
  const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
    ? record.payload as Record<string, unknown>
    : {};

  const knownEntityTypes = new Set([
    'SALE', 'PURCHASE', 'OPNAME', 'CONVERSION', 'RETURN',
    'PAYMENT', 'VOID', 'APPROVAL', 'MASTER_DATA',
  ]);
  if (!knownEntityTypes.has(entityType)) {
    return { allowed: false, reason: 'Jenis event tidak dikenal dan ditolak secara default.' };
  }

  if (role === 'SALES') {
    if (!authenticatedSalesId || !/^[a-zA-Z0-9_-]{1,100}$/.test(authenticatedSalesId) ||
        payload.salesId !== authenticatedSalesId) {
      return { allowed: false, reason: 'Identitas Sales pada event tidak sesuai dengan membership terautentikasi.' };
    }
    // A matching Sales ID proves actor identity, not customer/transaction ownership.
    // Until the gateway can validate assignedSalesId against authoritative store data,
    // accepting SALE/RETURN/PAYMENT here would let a Sales device forge ownership.
    return { allowed: false, reason: 'Event Sales ditahan sampai ownership pelanggan dan transaksi dapat diverifikasi dari data server.' };
  }

  if (role === 'OWNER') return { allowed: true };
  if (role === 'ADMIN') {
    if (entityType === 'RETURN') {
      const refund = payload.estimatedRefundValue;
      if (Number.isSafeInteger(refund) && Number(refund) >= 0 && Number(refund) <= 500000) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Admin hanya dapat mengirim retur sampai Rp500.000; nilai lebih besar atau tidak valid memerlukan Owner.' };
    }
    if (entityType === 'PAYMENT' && payload.kind !== 'RECEIVABLE_PAYMENT' && payload.kind !== 'PETTY_CASH_OPEX') {
      return { allowed: false, reason: 'Admin hanya dapat menerima pembayaran piutang; pembayaran supplier memerlukan Owner.' };
    }
    const adminAllowed = new Set(['SALE', 'PURCHASE', 'OPNAME', 'CONVERSION', 'PAYMENT', 'MASTER_DATA']);
    if (adminAllowed.has(entityType)) return { allowed: true };
    return { allowed: false, reason: 'Role Admin tidak memiliki izin untuk event approval, void, atau retur di atas batas.' };
  }

  if (entityType === 'SALE') return { allowed: true };
  if (entityType === 'RETURN') {
    const refund = payload.estimatedRefundValue;
    if (Number.isSafeInteger(refund) && Number(refund) >= 0 && Number(refund) <= 500000) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Sales hanya dapat mengirim retur sampai Rp500.000; nilai lebih besar memerlukan Owner.' };
  }
  if (entityType === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') {
    return { allowed: true };
  }
  return { allowed: false, reason: 'Role Sales tidak memiliki izin untuk mengirim jenis event ini.' };
}

const SESSION_ISSUER = 'erp-daging';
const SESSION_AUDIENCE = 'erp-daging-pwa';
const SESSION_TTL_SECONDS = 15 * 60;
export const OFFLINE_LEASE_TTL_SECONDS = 72 * 60 * 60;
const OFFLINE_LEASE_ISSUER = 'erp-daging';
const OFFLINE_LEASE_AUDIENCE = 'erp-daging-pwa-offline';
const ALLOWED_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const ALLOWED_ROLES = new Set<ErpRole>(['OWNER', 'ADMIN', 'SALES']);

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function parseMembershipRegistry(raw: string | undefined): ErpMembership[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ERP_AUTH_MEMBERS_JSON harus berupa JSON array yang valid.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('ERP_AUTH_MEMBERS_JSON harus berupa JSON array.');
  }
  const seen = new Set<string>();
  const memberships = parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Membership index ${index} harus berupa object.`);
    }
    const item = entry as Record<string, unknown>;
    const googleSub = typeof item.googleSub === 'string' ? item.googleSub.trim() : '';
    const storeId = typeof item.storeId === 'string' ? item.storeId.trim() : '';
    const role = item.role;
    const salesId = typeof item.salesId === 'string' ? item.salesId.trim() : '';
    if (!googleSub || !storeId || typeof role !== 'string' || !ALLOWED_ROLES.has(role as ErpRole) || typeof item.active !== 'boolean') {
      throw new Error(`Membership index ${index} tidak valid.`);
    }
    if (role === 'SALES' && !/^[a-zA-Z0-9_-]{1,100}$/.test(salesId)) {
      throw new Error(`Membership Sales index ${index} wajib memiliki salesId yang valid.`);
    }
    if (role !== 'SALES' && salesId) {
      throw new Error(`Membership non-Sales index ${index} tidak boleh memiliki salesId.`);
    }
    const deviceIds = item.deviceIds === undefined ? [] : item.deviceIds;
    if (!Array.isArray(deviceIds) || deviceIds.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) || new Set(deviceIds).size !== deviceIds.length) {
      throw new Error(`Membership index ${index} memiliki deviceIds yang tidak valid.`);
    }
    const key = googleSub + ':' + storeId;
    if (seen.has(key)) throw new Error('Membership duplikat untuk Google sub dan store yang sama.');
    seen.add(key);
    return { googleSub, storeId, role: role as ErpRole, active: item.active, ...(salesId ? { salesId } : {}), deviceIds: [...deviceIds] };
  });

  const storeCounts = new Map<string, { OWNER: number; ADMIN: number; SALES: number; devices: Set<string> }>();
  const deviceOwners = new Map<string, string>();
  const salesIdentityOwners = new Map<string, string>();
  for (const membership of memberships) {
    if (!membership.active) continue;
    const stats = storeCounts.get(membership.storeId) || { OWNER: 0, ADMIN: 0, SALES: 0, devices: new Set<string>() };
    stats[membership.role] += 1;
    if (membership.role === 'SALES' && membership.salesId) {
      const salesKey = membership.storeId + ':' + membership.salesId;
      const priorSalesOwner = salesIdentityOwners.get(salesKey);
      if (priorSalesOwner && priorSalesOwner !== membership.googleSub) {
        throw new Error('salesId tidak boleh digunakan oleh lebih dari satu membership aktif di store yang sama.');
      }
      salesIdentityOwners.set(salesKey, membership.googleSub);
    }
    for (const deviceId of membership.deviceIds || []) {
      const ownerKey = membership.storeId + ':' + deviceId;
      const priorOwner = deviceOwners.get(ownerKey);
      if (priorOwner && priorOwner !== membership.googleSub) {
        throw new Error('Device ID tidak boleh terdaftar pada lebih dari satu membership aktif di store yang sama.');
      }
      deviceOwners.set(ownerKey, membership.googleSub);
      stats.devices.add(deviceId);
    }
    if (stats.OWNER > 1 || stats.ADMIN > 2 || stats.SALES > 5 || stats.devices.size > 8) {
      throw new Error('Batas membership/device ERP DAGING terlampaui: maksimal 1 Owner, 2 Admin, 5 Sales, dan 8 perangkat per store.');
    }
    storeCounts.set(membership.storeId, stats);
  }
  return memberships;
}

export function createErpAuthService(options: {
  googleClientId: string;
  sessionSecret: string;
  offlineLeasePrivateKey?: string;
  memberships: ErpMembership[];
  verifyGoogleCredential: (credential: string, audience: string) => Promise<GoogleIdentity>;
  now?: () => number;
}) {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const configured = Boolean(options.googleClientId.trim() && options.sessionSecret.length >= 32);
  const offlineLeasePrivateKey = options.offlineLeasePrivateKey?.replace(/\\n/g, '\n').trim() || '';
  let offlineLeaseConfigured = false;
  try {
    const parsedLeaseKey = crypto.createPrivateKey(offlineLeasePrivateKey);
    offlineLeaseConfigured = parsedLeaseKey.asymmetricKeyType === 'rsa' &&
      (parsedLeaseKey.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048;
  } catch {
    offlineLeaseConfigured = false;
  }

  function currentMembership(sub: string): ErpMembership {
    const active = options.memberships.filter((m) => m.googleSub === sub && m.active);
    if (active.length === 0) {
      throw new ErpAuthError('MEMBERSHIP_REVOKED', 'Akun Google belum memiliki akses ERP DAGING yang aktif.');
    }
    if (active.length > 1) {
      throw new ErpAuthError('MEMBERSHIP_AMBIGUOUS', 'Akun ini memiliki lebih dari satu membership aktif. Pemilihan toko belum diaktifkan.');
    }
    return active[0];
  }

  function issueSession(identity: GoogleIdentity, membership: ErpMembership): string {
    const issuedAt = now();
    const payload: ErpSession & { iss: string; aud: string } = {
      iss: SESSION_ISSUER,
      aud: SESSION_AUDIENCE,
      sub: identity.sub,
      storeId: membership.storeId,
      role: membership.role,
      ...(membership.salesId ? { salesId: membership.salesId } : {}),
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      issuedAt,
      expiresAt: Math.min(issuedAt + SESSION_TTL_SECONDS, identity.expiresAt),
    };
    const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
    const body = encodeJson(payload);
    const unsigned = header + '.' + body;
    return unsigned + '.' + sign(unsigned, options.sessionSecret);
  }

  async function authenticateGoogleCredential(credential: string): Promise<{ accessToken: string; user: ErpSession }> {
    if (!configured) throw new ErpAuthError('AUTH_NOT_CONFIGURED', 'Google Sign-In belum dikonfigurasi di server.');
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 12000) {
      throw new ErpAuthError('GOOGLE_TOKEN_INVALID', 'Google credential tidak valid.');
    }
    let identity: GoogleIdentity;
    try {
      identity = await options.verifyGoogleCredential(credential, options.googleClientId);
    } catch {
      throw new ErpAuthError('GOOGLE_TOKEN_INVALID', 'Google ID token tidak valid atau tidak dapat diverifikasi.');
    }
    if (
      !identity ||
      typeof identity.sub !== 'string' ||
      !identity.sub ||
      identity.audience !== options.googleClientId ||
      !ALLOWED_ISSUERS.has(identity.issuer) ||
      !Number.isFinite(identity.expiresAt) ||
      identity.expiresAt <= now()
    ) {
      throw new ErpAuthError('GOOGLE_TOKEN_INVALID', 'Klaim Google ID token tidak memenuhi validasi.');
    }
    const membership = currentMembership(identity.sub);
    const accessToken = issueSession(identity, membership);
    const session = verifySession(accessToken);
    return { accessToken, user: session };
  }

  function verifySession(token: string): ErpSession {
    if (!configured) throw new ErpAuthError('AUTH_NOT_CONFIGURED', 'Autentikasi ERP belum dikonfigurasi.');
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) throw new ErpAuthError('SESSION_INVALID', 'Session token tidak valid.');
    const unsigned = parts[0] + '.' + parts[1];
    if (!safeEqual(sign(unsigned, options.sessionSecret), parts[2])) {
      throw new ErpAuthError('SESSION_INVALID', 'Signature session tidak valid.');
    }
    let header: Record<string, unknown>;
    let payload: ErpSession & { iss?: string; aud?: string };
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new ErpAuthError('SESSION_INVALID', 'Isi session token rusak.');
    }
    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      payload.iss !== SESSION_ISSUER ||
      payload.aud !== SESSION_AUDIENCE ||
      typeof payload.sub !== 'string' ||
      typeof payload.storeId !== 'string' ||
      !ALLOWED_ROLES.has(payload.role) ||
      (payload.role === 'SALES' && (typeof payload.salesId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.salesId))) ||
      (payload.role !== 'SALES' && payload.salesId !== undefined) ||
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt)
    ) {
      throw new ErpAuthError('SESSION_INVALID', 'Klaim session token tidak valid.');
    }
    if (payload.expiresAt <= now() || payload.issuedAt > now() + 30) {
      throw new ErpAuthError('SESSION_EXPIRED', 'Session telah kedaluwarsa. Silakan login kembali.');
    }
    const membership = currentMembership(payload.sub);
    if (membership.storeId !== payload.storeId || membership.role !== payload.role || membership.salesId !== payload.salesId) {
      throw new ErpAuthError('MEMBERSHIP_REVOKED', 'Hak akses akun berubah. Silakan login kembali.');
    }
    return {
      sub: payload.sub,
      storeId: payload.storeId,
      role: payload.role,
      ...(payload.salesId ? { salesId: payload.salesId } : {}),
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  }

  function issueOfflineLease(session: ErpSession, deviceId: string): { token: string; expiresAt: number; ttlSeconds: number } {
    if (!offlineLeaseConfigured) {
      throw new ErpAuthError('OFFLINE_LEASE_NOT_CONFIGURED', 'Kunci offline authorization belum dikonfigurasi di server.');
    }
    if (typeof deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(deviceId) ||
        !isDeviceAuthorized(session.sub, session.storeId, deviceId)) {
      throw new ErpAuthError('DEVICE_NOT_AUTHORIZED', 'Perangkat ini belum terdaftar pada membership ERP yang aktif.');
    }
    // Re-check current membership instead of copying potentially stale role claims.
    const current = currentMembership(session.sub);
    if (current.storeId !== session.storeId || current.role !== session.role || current.salesId !== session.salesId) {
      throw new ErpAuthError('MEMBERSHIP_REVOKED', 'Membership berubah. Login ulang sebelum menerbitkan offline lease.');
    }
    const issuedAt = now();
    const payload = {
      iss: OFFLINE_LEASE_ISSUER,
      aud: OFFLINE_LEASE_AUDIENCE,
      sub: session.sub,
      storeId: current.storeId,
      role: current.role,
      ...(current.salesId ? { salesId: current.salesId } : {}),
      deviceId,
      issuedAt,
      expiresAt: issuedAt + OFFLINE_LEASE_TTL_SECONDS,
    };
    let signature: string;
    try {
      signature = crypto.sign('RSA-SHA256', Buffer.from(encodeJson(payload)), crypto.createPrivateKey(offlineLeasePrivateKey)).toString('base64url');
    } catch {
      throw new ErpAuthError('OFFLINE_LEASE_NOT_CONFIGURED', 'Kunci offline authorization server tidak valid.');
    }
    return { token: encodeJson(payload) + '.' + signature, expiresAt: payload.expiresAt, ttlSeconds: OFFLINE_LEASE_TTL_SECONDS };
  }

  function isDeviceAuthorized(sub: string, storeId: string, deviceId: string): boolean {
    const membership = currentMembership(sub);
    return membership.storeId === storeId && Array.isArray(membership.deviceIds) && membership.deviceIds.includes(deviceId);
  }

  return {
    isConfigured: () => configured,
    authenticateGoogleCredential,
    verifySession,
    issueOfflineLease,
    isOfflineLeaseConfigured: () => offlineLeaseConfigured,
    isDeviceAuthorized,
  };
}
