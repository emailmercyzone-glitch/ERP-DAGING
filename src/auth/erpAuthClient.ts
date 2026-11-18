export type ErpRole = 'OWNER' | 'ADMIN' | 'SALES';

export interface ErpAuthUser {
  sub: string;
  storeId: string;
  role: ErpRole;
  /** Server-bound stable identity for SALES memberships. */
  salesId?: string;
  email?: string;
  name?: string;
  picture?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ErpAuthConfig {
  enabled: boolean;
  googleClientId: string | null;
}

export class ErpAuthClientError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ErpAuthClientError';
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseUser(value: unknown): ErpAuthUser {
  if (!isRecord(value)
    || typeof value.sub !== 'string'
    || typeof value.storeId !== 'string'
    || !['OWNER', 'ADMIN', 'SALES'].includes(String(value.role))
    || (value.role === 'SALES' && (typeof value.salesId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.salesId)))
    || (value.role !== 'SALES' && value.salesId !== undefined)
    || typeof value.issuedAt !== 'number'
    || typeof value.expiresAt !== 'number') {
    throw new ErpAuthClientError('Respons identitas ERP tidak valid.');
  }
  return {
    sub: value.sub,
    storeId: value.storeId,
    role: value.role as ErpRole,
    ...(typeof value.salesId === 'string' ? { salesId: value.salesId } : {}),
    email: typeof value.email === 'string' ? value.email : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    picture: typeof value.picture === 'string' ? value.picture : undefined,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  };
}

/**
 * Browser-side transport for the ERP session API.
 * The short-lived bearer token is deliberately memory-only: it is never written
 * to localStorage, IndexedDB, cookies managed by JavaScript, or a URL.
 */
export interface ErpAuthClientOptions {
  /** API origin only, without the /api suffix. Blank keeps same-origin PWA requests. */
  baseUrl?: string;
  /** Native APK has no same-origin API server; without baseUrl it runs local-only. */
  isNative?: boolean;
}

export function createErpAuthClient(fetcher: FetchLike = fetch, options: ErpAuthClientOptions = {}) {
  let accessToken: string | null = null;
  let currentUser: ErpAuthUser | null = null;
  const apiBaseUrl = (options.baseUrl ?? import.meta.env.VITE_ERP_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const isNativeApp = options.isNative ?? import.meta.env.VITE_CAPACITOR_APP === 'true';
  const apiUrl = (path: string) => apiBaseUrl ? `${apiBaseUrl}${path}` : path;

  async function readJson(response: Response): Promise<Record<string, unknown>> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ErpAuthClientError('Server mengirim respons yang tidak dapat dibaca.', response.status);
    }
    if (!isRecord(body)) {
      throw new ErpAuthClientError('Format respons server tidak valid.', response.status);
    }
    if (!response.ok || body.success !== true) {
      throw new ErpAuthClientError(
        typeof body.error === 'string' ? body.error : 'Permintaan autentikasi gagal.',
        response.status,
        typeof body.code === 'string' ? body.code : undefined,
      );
    }
    return body;
  }

  return {
    async getConfig(): Promise<ErpAuthConfig> {
      if (isNativeApp && !apiBaseUrl) return { enabled: false, googleClientId: null };
      const response = await fetcher(apiUrl('/api/auth/config'), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const body = await readJson(response);
      if (typeof body.enabled !== 'boolean'
        || (body.googleClientId !== null && typeof body.googleClientId !== 'string')) {
        throw new ErpAuthClientError('Konfigurasi login server tidak valid.', response.status);
      }
      return { enabled: body.enabled, googleClientId: body.googleClientId as string | null };
    },

    async loginWithGoogleCredential(credential: string): Promise<ErpAuthUser> {
      if (typeof credential !== 'string' || !credential.trim()) {
        throw new ErpAuthClientError('Google credential kosong.');
      }
      const response = await fetcher(apiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ credential }),
        cache: 'no-store',
      });
      const body = await readJson(response);
      if (typeof body.accessToken !== 'string' || !body.accessToken.trim()) {
        throw new ErpAuthClientError('Server tidak memberikan session ERP yang valid.', response.status);
      }
      const user = parseUser(body.user);
      accessToken = body.accessToken;
      currentUser = user;
      return user;
    },

    async requestOfflineLease(deviceId: string): Promise<{ token: string; expiresAt: number; ttlSeconds: number }> {
      if (!accessToken) throw new ErpAuthClientError('Session online diperlukan untuk menerbitkan offline lease.', 401);
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(deviceId)) throw new ErpAuthClientError('Device ID tidak valid.');
      const response = await fetcher(apiUrl('/api/auth/offline-lease'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ deviceId }),
        cache: 'no-store',
      });
      const body = await readJson(response);
      if (typeof body.token !== 'string' || !body.token ||
          typeof body.expiresAt !== 'number' || !Number.isSafeInteger(body.expiresAt) ||
          body.ttlSeconds !== 72 * 60 * 60) {
        throw new ErpAuthClientError('Server mengirim offline lease yang tidak valid.', response.status);
      }
      return { token: body.token, expiresAt: body.expiresAt, ttlSeconds: body.ttlSeconds };
    },

    async getCurrentUser(): Promise<ErpAuthUser> {
      if (!accessToken) {
        throw new ErpAuthClientError('Belum ada session ERP aktif.', 401);
      }
      const response = await fetcher(apiUrl('/api/auth/me'), {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      try {
        const body = await readJson(response);
        currentUser = parseUser(body.user);
        return currentUser;
      } catch (error) {
        if (error instanceof ErpAuthClientError && (error.status === 401 || error.status === 403)) {
          accessToken = null;
          currentUser = null;
        }
        throw error;
      }
    },

    getAccessToken(): string | null {
      return accessToken;
    },

    getCachedUser(): ErpAuthUser | null {
      return currentUser;
    },

    clearSession(): void {
      accessToken = null;
      currentUser = null;
    },
  };
}


/** Shared in-memory session used by the UI and authenticated backend adapters. */
export const erpAuthClient = createErpAuthClient();
