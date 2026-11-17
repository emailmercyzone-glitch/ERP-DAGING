export type OfflineLeaseRole = 'OWNER' | 'ADMIN' | 'SALES';

export interface OfflineLeaseClaims {
  iss: 'erp-daging';
  aud: 'erp-daging-pwa-offline';
  sub: string;
  storeId: string;
  role: OfflineLeaseRole;
  salesId?: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface OfflineLeaseRecord {
  token: string;
  claims: OfflineLeaseClaims;
}

const MAX_OFFLINE_LEASE_SECONDS = 72 * 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodePem(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\\s/g, '');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Verify a server-signed offline lease and enforce its device/time boundary. */
export async function verifyOfflineLease(
  token: string,
  expectedDeviceId: string,
  publicKeyPem: string = import.meta.env.VITE_ERP_OFFLINE_LEASE_PUBLIC_KEY || '',
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<OfflineLeaseRecord | null> {
  if (!token || !expectedDeviceId || !publicKeyPem || !globalThis.crypto?.subtle) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const payloadBytes = decodeBase64Url(parts[0]);
    const signature = decodeBase64Url(parts[1]);
    const publicKey = await crypto.subtle.importKey(
      'spki', decodePem(publicKeyPem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    const validSignature = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, payloadBytes);
    if (!validSignature) return null;
    const claims: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!isRecord(claims) ||
        claims.iss !== 'erp-daging' || claims.aud !== 'erp-daging-pwa-offline' ||
        typeof claims.sub !== 'string' || !claims.sub ||
        typeof claims.storeId !== 'string' || !claims.storeId ||
        !['OWNER', 'ADMIN', 'SALES'].includes(String(claims.role)) ||
        (claims.role === 'SALES' && (typeof claims.salesId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(claims.salesId))) ||
        (claims.role !== 'SALES' && claims.salesId !== undefined) ||
        claims.deviceId !== expectedDeviceId ||
        typeof claims.issuedAt !== 'number' || !Number.isSafeInteger(claims.issuedAt) ||
        typeof claims.expiresAt !== 'number' || !Number.isSafeInteger(claims.expiresAt) ||
        claims.issuedAt > nowSeconds + 30 || claims.expiresAt <= nowSeconds ||
        claims.expiresAt <= claims.issuedAt || claims.expiresAt - claims.issuedAt > MAX_OFFLINE_LEASE_SECONDS) {
      return null;
    }
    return { token, claims: claims as unknown as OfflineLeaseClaims };
  } catch {
    return null;
  }
}
