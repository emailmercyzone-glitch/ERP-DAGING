import crypto from 'node:crypto';

export type ErpRole = 'OWNER' | 'ADMIN' | 'SALES';

export interface ErpMembership {
  googleSub: string;
  storeId: string;
  role: ErpRole;
  active: boolean;
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
  | 'MEMBERSHIP_REVOKED';

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
export function authorizeSyncEvent(role: ErpRole, event: unknown): SyncEventAuthorization {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return { allowed: false, reason: 'Format event tidak valid.' };
  }
  const record = event as Record<string, unknown>;
  const entityType = typeof record.entityType === 'string' ? record.entityType : '';
  const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
    ? record.payload as Record<string, unknown>
    : {};

  if (role === 'OWNER') return { allowed: true };
  if (role === 'ADMIN') {
    if (entityType === 'APPROVAL' || entityType === 'VOID') {
      return { allowed: false, reason: 'Event approval dan void hanya dapat disinkronkan oleh Owner.' };
    }
    return { allowed: true };
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
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Membership index ${index} harus berupa object.`);
    }
    const item = entry as Record<string, unknown>;
    const googleSub = typeof item.googleSub === 'string' ? item.googleSub.trim() : '';
    const storeId = typeof item.storeId === 'string' ? item.storeId.trim() : '';
    const role = item.role;
    if (!googleSub || !storeId || typeof role !== 'string' || !ALLOWED_ROLES.has(role as ErpRole) || typeof item.active !== 'boolean') {
      throw new Error(`Membership index ${index} tidak valid.`);
    }
    const key = googleSub + ':' + storeId;
    if (seen.has(key)) throw new Error('Membership duplikat untuk Google sub dan store yang sama.');
    seen.add(key);
    return { googleSub, storeId, role: role as ErpRole, active: item.active };
  });
}

export function createErpAuthService(options: {
  googleClientId: string;
  sessionSecret: string;
  memberships: ErpMembership[];
  verifyGoogleCredential: (credential: string, audience: string) => Promise<GoogleIdentity>;
  now?: () => number;
}) {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const configured = Boolean(options.googleClientId.trim() && options.sessionSecret.length >= 32);

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
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt)
    ) {
      throw new ErpAuthError('SESSION_INVALID', 'Klaim session token tidak valid.');
    }
    if (payload.expiresAt <= now() || payload.issuedAt > now() + 30) {
      throw new ErpAuthError('SESSION_EXPIRED', 'Session telah kedaluwarsa. Silakan login kembali.');
    }
    const membership = currentMembership(payload.sub);
    if (membership.storeId !== payload.storeId || membership.role !== payload.role) {
      throw new ErpAuthError('MEMBERSHIP_REVOKED', 'Hak akses akun berubah. Silakan login kembali.');
    }
    return {
      sub: payload.sub,
      storeId: payload.storeId,
      role: payload.role,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  }

  return {
    isConfigured: () => configured,
    authenticateGoogleCredential,
    verifySession,
  };
}
