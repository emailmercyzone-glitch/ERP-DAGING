import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { createErpAuthService, ErpAuthError, parseMembershipRegistry, authorizeSyncEvent, type ErpRole } from './src/server/erpAuth.ts';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveHost, resolvePort } from './src/server/runtimeConfig.ts';
import { createKeyedLock } from './src/server/keyedLock.ts';
import { authorizeSalesMedia, authorizeSalesSyncEvent, buildSalesOwnershipIndex, buildSalesPullPage, cloneSalesOwnershipIndex } from './src/server/salesSyncProjection.ts';
import { createDriveBackupGateway, type DriveBackupGatewayConfig } from './src/server/driveBackupGateway.ts';
import { authorizeDriveBackupAccess, type DriveBackupAction } from './src/server/driveBackupAccess.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const syncJsonParser = express.json({ limit: '12mb' });
const voiceJsonParser = express.json({ limit: '1mb' });
const backupJsonParser = express.json({ limit: '64mb' });
const backupAttachmentParser = express.raw({ type: 'image/jpeg', limit: '1mb' });
const standardJsonParser = express.json({ limit: '32kb' });
app.use((req: Request, res: Response, next: NextFunction) => {
  const parser = req.path === '/api/sync/gas'
    ? syncJsonParser
    : req.path === '/api/ai/voice-parse'
      ? voiceJsonParser
      : req.path === '/api/backup/drive/attachments'
        ? backupAttachmentParser
        : req.path.startsWith('/api/backup/drive/')
          ? backupJsonParser
          : standardJsonParser;
  parser(req, res, next);
});
// Reject malformed JSON payloads cleanly before any API route reads req.body.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 400) {
    return res.status(400).json({ success: false, error: 'Format payload JSON tidak valid atau terlalu besar.' });
  }
  if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 413) {
    return res.status(413).json({ success: false, error: 'Ukuran payload melebihi batas endpoint.' });
  }
  return next(err);
});
// Security headers must be installed before API routes.
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
const httpServer = http.createServer(app);

const googleOAuthClient = new OAuth2Client();
const erpAuthMemberships = parseMembershipRegistry(process.env.ERP_AUTH_MEMBERS_JSON);
const erpAuth = createErpAuthService({
  googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  sessionSecret: process.env.ERP_AUTH_SESSION_SECRET || '',
  offlineLeasePrivateKey: process.env.ERP_OFFLINE_LEASE_PRIVATE_KEY || '',
  memberships: erpAuthMemberships,
  verifyGoogleCredential: async (credential, audience) => {
    const ticket = await googleOAuthClient.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload || typeof payload.sub !== 'string' || typeof payload.aud !== 'string' || typeof payload.exp !== 'number') {
      throw new Error('Google ID token claims are incomplete.');
    }
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      issuer: typeof payload.iss === 'string' ? payload.iss : '',
      audience: payload.aud,
      expiresAt: payload.exp,
    };
  },
});

const driveBackupGateway = createDriveBackupGateway();

const authRateLimit = new Map<string, { count: number; resetAtMs: number }>();
function rateLimitGoogleAuth(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);
  const entry = authRateLimit.get(ip);
  if (!entry || entry.resetAtMs <= now) {
    authRateLimit.set(ip, { count: 1, resetAtMs: now + 60_000 });
    return next();
  }
  if (entry.count >= 10) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAtMs - now) / 1000))));
    return res.status(429).json({ success: false, error: 'Terlalu banyak percobaan login. Coba lagi sebentar.' });
  }
  entry.count += 1;
  return next();
}

function requireErpSession(req: Request, res: Response, next: NextFunction) {
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return res.status(401).json({ success: false, error: 'Login ERP DAGING diperlukan.' });
  try {
    (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession = erpAuth.verifySession(token);
    return next();
  } catch (error) {
    const message = error instanceof ErpAuthError ? error.message : 'Session tidak valid.';
    return res.status(401).json({ success: false, error: message });
  }
}

function stableCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableCanonicalJson).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + stableCanonicalJson(record[key])).join(',') + '}';
}

async function postSignedGasRequest(
  body: Record<string, unknown>,
  storeId: string
): Promise<Record<string, unknown>> {
  const gasUrl = (process.env.GAS_WEB_APP_URL || '').trim();
  const sharedSecret = process.env.GAS_SYNC_SHARED_SECRET || '';
  const hmacSecret = process.env.GAS_GATEWAY_HMAC_SECRET || '';
  if (!gasUrl || !sharedSecret || hmacSecret.length < 32) throw new Error('Gateway GAS belum dikonfigurasi aman di server.');
  const parsedUrl = new URL(gasUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'script.google.com') {
    throw new Error('Gateway GAS wajib menggunakan URL HTTPS script.google.com.');
  }
  const signedPayload = { ...body, storeId, sharedSecret };
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', hmacSecret)
    .update(timestamp + '.' + nonce + '.' + stableCanonicalJson(signedPayload)).digest('hex');
  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ ...signedPayload, gatewayAuth: { timestamp, nonce, signature } }),
    redirect: 'follow',
  });
  const raw = await response.text();
  let result: unknown;
  try { result = JSON.parse(raw); } catch { throw new Error('Gateway GAS mengirim respons non-JSON.'); }
  if (!response.ok || !result || typeof result !== 'object' || Array.isArray(result) || (result as Record<string, unknown>).ok !== true) {
    throw new Error(result && typeof result === 'object' && typeof (result as Record<string, unknown>).message === 'string'
      ? String((result as Record<string, unknown>).message) : 'Gateway GAS menolak permintaan.');
  }
  return result as Record<string, unknown>;
}

const salesOwnershipCache = new Map<string, {
  expiresAt: number;
  records: Array<Record<string, unknown>>;
  lastServerSeq: number;
  index: ReturnType<typeof buildSalesOwnershipIndex>;
}>();

const acquireStorePushLock = createKeyedLock();

async function getSalesOwnershipSnapshot(storeId: string) {
  const cached = salesOwnershipCache.get(storeId);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const loaded = await fetchAllStoreEventsForSales(storeId);
  const snapshot = {
    ...loaded,
    index: buildSalesOwnershipIndex(loaded.records),
    expiresAt: Date.now() + 10_000,
  };
  salesOwnershipCache.set(storeId, snapshot);
  return snapshot;
}

async function fetchAllStoreEventsForSales(storeId: string): Promise<{
  records: Array<Record<string, unknown>>;
  lastServerSeq: number;
}> {
  const records: Array<Record<string, unknown>> = [];
  let cursor = 0;
  let lastServerSeq = 0;
  for (let page = 0; page < 2000; page++) {
    const result = await postSignedGasRequest({
      action: 'sync_pull',
      deviceId: 'ERP_SERVER_INDEX',
      sinceSeq: cursor,
    }, storeId);
    if (!Array.isArray(result.records) || !Number.isSafeInteger(result.lastServerSeq) || Number(result.lastServerSeq) < cursor) {
      throw new Error('Indeks ownership Sales menerima cursor/event GAS yang tidak valid.');
    }
    const pageRecords = result.records as Array<Record<string, unknown>>;
    records.push(...pageRecords);
    lastServerSeq = Number(result.lastServerSeq);
    if (records.length > 500000) throw new Error('Event log melewati batas aman pembentukan indeks Sales.');
    if (pageRecords.length < 500) return { records, lastServerSeq };
    if (lastServerSeq <= cursor) throw new Error('Cursor GAS tidak maju saat membentuk indeks Sales.');
    cursor = lastServerSeq;
  }
  throw new Error('Indeks Sales terlalu besar untuk diproses dalam satu permintaan.');
}

const gasGatewayRateLimit = new Map<string, { count: number; resetAtMs: number }>();
app.post('/api/sync/gas', requireErpSession, async (req: Request, res: Response) => {
  const session = (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession;
  if (!session) return res.status(401).json({ ok: false, message: 'Session ERP tidak valid.' });
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, message: 'Payload gateway tidak valid.' });
  }
  if (Object.prototype.hasOwnProperty.call(body, 'sharedSecret') || Object.prototype.hasOwnProperty.call(body, 'gatewayAuth')) {
    return res.status(400).json({ ok: false, message: 'Client tidak boleh mengirim secret atau signature gateway.' });
  }
  const action = typeof body.action === 'string' ? body.action : '';
  if (!['health','sync_push','sync_pull','media_upload','media_download'].includes(action)) {
    return res.status(400).json({ ok: false, message: 'Action gateway tidak dikenal.' });
  }
  if (typeof body.storeId === 'string' && body.storeId !== session.storeId) {
    return res.status(403).json({ ok: false, message: 'Store ID tidak sesuai dengan membership akun.' });
  }
  if (['sync_push','sync_pull','media_upload','media_download'].includes(action)) {
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(deviceId)) {
      return res.status(400).json({ ok: false, message: 'Device ID tidak valid.' });
    }
    if (!erpAuth.isDeviceAuthorized(session.sub, session.storeId, deviceId)) {
      return res.status(403).json({ ok: false, message: 'Perangkat belum terdaftar untuk membership ERP ini. Hubungi Owner untuk enrollment.' });
    }
  }
  if (action === 'sync_push' && (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 200)) {
    return res.status(400).json({ ok: false, message: 'Batch sync wajib berisi 1 sampai 200 event.' });
  }
  if (action === 'sync_push' && Array.isArray(body.events) && session.role !== 'SALES') {
    for (const event of body.events) {
      const authorization = authorizeSyncEvent(session.role, event, session.salesId);
      if (!authorization.allowed) {
        return res.status(403).json({ ok: false, message: authorization.reason || 'Role tidak diizinkan mengirim event ini.' });
      }
    }
  }
  if (action === 'media_upload') {
    if (typeof body.mediaId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.mediaId) ||
        typeof body.dataBase64 !== 'string' || body.dataBase64.length > 1400000) {
      return res.status(400).json({ ok: false, message: 'Metadata upload lampiran tidak valid.' });
    }
  }
  if (action === 'media_download' && (typeof body.mediaId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.mediaId))) {
    return res.status(400).json({ ok: false, message: 'ID lampiran tidak valid.' });
  }

  const now = Date.now();
  const rateKey = session.sub + ':' + session.storeId;
  const rate = gasGatewayRateLimit.get(rateKey);
  if (!rate || rate.resetAtMs <= now) gasGatewayRateLimit.set(rateKey, { count: 1, resetAtMs: now + 60_000 });
  else if (rate.count >= 120) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAtMs - now) / 1000))));
    return res.status(429).json({ ok: false, message: 'Terlalu banyak permintaan sinkronisasi. Coba lagi sebentar.' });
  } else rate.count += 1;

  const gasUrl = (process.env.GAS_WEB_APP_URL || '').trim();
  const sharedSecret = process.env.GAS_SYNC_SHARED_SECRET || '';
  const hmacSecret = process.env.GAS_GATEWAY_HMAC_SECRET || '';
  if (!gasUrl || !sharedSecret || hmacSecret.length < 32) {
    return res.status(503).json({ ok: false, message: 'Gateway GAS belum dikonfigurasi aman di server.' });
  }
  let parsedUrl: URL;
  try { parsedUrl = new URL(gasUrl); } catch { return res.status(503).json({ ok: false, message: 'URL gateway GAS di server tidak valid.' }); }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'script.google.com') {
    return res.status(503).json({ ok: false, message: 'Gateway GAS wajib menggunakan URL HTTPS script.google.com.' });
  }

  // Serialize event pushes per store so customer reassignment, invoice creation,
  // and ownership checks cannot race across the small (maximum 8-device) fleet.
  if (action === 'sync_push') {
    const release = await acquireStorePushLock(session.storeId);
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    res.once('finish', releaseOnce);
    res.once('close', releaseOnce);
  }

  if (session.role === 'SALES' && ['sync_push','sync_pull','media_upload','media_download'].includes(action)) {
    let ownershipRecords: Array<Record<string, unknown>>;
    let ownershipIndex: ReturnType<typeof buildSalesOwnershipIndex>;
    let ownershipLastSeq: number;
    try {
      const ownership = await getSalesOwnershipSnapshot(session.storeId);
      ownershipRecords = ownership.records;
      ownershipIndex = ownership.index;
      ownershipLastSeq = ownership.lastServerSeq;
    } catch (error) {
      return res.status(503).json({
        ok: false,
        code: 'SALES_OWNERSHIP_INDEX_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Indeks kepemilikan Sales belum dapat diverifikasi.',
      });
    }

    if (action === 'sync_push' && Array.isArray(body.events)) {
      // authorizeSalesSyncEvent builds invoice/media ownership as it validates a
      // batch. Never mutate the shared cache before GAS confirms the append.
      const validationIndex = cloneSalesOwnershipIndex(ownershipIndex);
      for (const event of body.events) {
        const authorization = authorizeSalesSyncEvent(event, session.salesId || '', validationIndex);
        if (!authorization.allowed) {
          return res.status(403).json({ ok: false, code: 'SALES_OWNERSHIP_DENIED', message: authorization.reason || 'Event Sales tidak memiliki ownership yang valid.' });
        }
      }
    }

    if ((action === 'media_upload' || action === 'media_download') &&
        (typeof body.mediaId !== 'string' || !authorizeSalesMedia(body.mediaId, session.salesId || '', ownershipIndex))) {
      return res.status(403).json({
        ok: false,
        code: 'SALES_MEDIA_OWNERSHIP_DENIED',
        message: 'Lampiran tidak terikat pada retur milik Sales yang sedang login.',
      });
    }

    if (action === 'sync_pull') {
      const sinceSeq = body.sinceSeq === undefined ? 0 : body.sinceSeq;
      if (!Number.isSafeInteger(sinceSeq) || Number(sinceSeq) < 0) {
        return res.status(400).json({ ok: false, message: 'Cursor pull harus integer aman non-negatif.' });
      }
      const page = buildSalesPullPage(
        ownershipRecords, Number(sinceSeq), String(body.deviceId || ''),
        session.salesId || '', ownershipIndex, ownershipLastSeq, 500
      );
      return res.status(200).json({
        ok: true,
        records: page.records,
        lastServerSeq: page.lastServerSeq,
        message: `${page.records.length} event proyeksi Sales ditarik.`,
      });
    }
  }

  const signedPayload: Record<string, unknown> = {
    ...body,
    storeId: session.storeId,
    sharedSecret,
  };
  const timestamp = String(Date.now());
  const nonce = crypto.randomBytes(16).toString('hex');
  const canonical = stableCanonicalJson(signedPayload);
  const signature = crypto.createHmac('sha256', hmacSecret).update(timestamp + '.' + nonce + '.' + canonical).digest('hex');
  const gatewayPayload = { ...signedPayload, gatewayAuth: { timestamp, nonce, signature } };
  try {
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' },
      body: JSON.stringify(gatewayPayload),
      redirect: 'follow',
    });
    const raw = await upstream.text();
    let result: unknown;
    try { result = JSON.parse(raw); } catch {
      return res.status(502).json({ ok: false, message: 'Gateway GAS mengirim respons non-JSON.' });
    }
    // A failed/lost response may still follow a committed GAS append. Always
    // rebuild ownership after a push attempt instead of trusting the old cache.
    if (action === 'sync_push') salesOwnershipCache.delete(session.storeId);
    return res.status(upstream.ok ? 200 : 502).json(result);
  } catch {
    if (action === 'sync_push') salesOwnershipCache.delete(session.storeId);
    return res.status(502).json({ ok: false, message: 'Server tidak dapat menghubungi gateway GAS.' });
  }
});

app.get('/api/health/live', (_req: Request, res: Response) => {
  return res.status(200).json({ success: true, status: 'ok', service: 'ERP DAGING API' });
});

app.get('/api/health/ready', (_req: Request, res: Response) => {
  const authConfigured = erpAuth.isConfigured();
  const ownerMembershipConfigured = erpAuthMemberships.some((membership) => membership.active && membership.role === 'OWNER');
  const gasUrl = (process.env.GAS_WEB_APP_URL || '').trim();
  const gasSecret = process.env.GAS_SYNC_SHARED_SECRET || '';
  const gasHmacSecret = process.env.GAS_GATEWAY_HMAC_SECRET || '';
  const gasGatewayConfigured = /^https:\/\//i.test(gasUrl) && gasSecret.length >= 32 && gasHmacSecret.length >= 32;
  const offlineLeaseSigningKeyConfigured = erpAuth.isOfflineLeaseConfigured();
  const driveBackupGatewayConfigured = Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_OWNER_EMAIL?.trim() &&
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  );
  const ready = authConfigured && ownerMembershipConfigured && offlineLeaseSigningKeyConfigured && driveBackupGatewayConfigured;
  return res.status(ready ? 200 : 503).json({
    success: true,
    ready,
    service: 'ERP DAGING API',
    authentication: {
      configured: authConfigured,
      ownerMembershipConfigured,
      offlineLeaseSigningKeyConfigured,
      driveBackupGatewayConfigured,
    },
    optionalGasGateway: {
      configured: gasGatewayConfigured,
    },
    checkedAt: new Date().toISOString(),
  });
});

function getDriveBackupFailureStatus(error: unknown): number {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const status = Number((error as { statusCode?: unknown }).statusCode);
    if (status === 429) return 503;
    if (Number.isInteger(status) && status >= 500) return 502;
    if (Number.isInteger(status) && status >= 400) return 400;
  }
  return error instanceof TypeError ? 502 : 400;
}

function getDriveBackupSession(
  req: Request,
  res: Response,
  action: DriveBackupAction = 'RESTORE'
): { config: DriveBackupGatewayConfig; deviceId: string } | null {
  const session = (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession;
  if (!session) {
    res.status(401).json({ success: false, error: 'Login ERP DAGING diperlukan.' });
    return null;
  }
  const ownerEmail = (process.env.GOOGLE_DRIVE_OWNER_EMAIL || '').trim().toLowerCase();
  const deviceId = String(req.headers['x-erp-device-id'] || req.query.deviceId || (req.body && typeof req.body === 'object' ? req.body.deviceId : '') || '').trim();
  const decision = authorizeDriveBackupAccess({
    action,
    role: session.role,
    sessionEmail: session.email,
    ownerEmail,
    deviceAuthorized: Boolean(deviceId && erpAuth.isDeviceAuthorized(session.sub, session.storeId, deviceId)),
  });
  if (!decision.allowed) {
    res.status(403).json({ success: false, code: decision.code, error: decision.message });
    return null;
  }
  const config: DriveBackupGatewayConfig = {
    clientId: (process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim(),
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
    ownerEmail,
    folderId: (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim(),
  };
  if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.ownerEmail || !config.folderId) {
    res.status(503).json({ success: false, code: 'DRIVE_GATEWAY_NOT_CONFIGURED', error: 'Konfigurasi Google Drive gateway belum lengkap di server.' });
    return null;
  }
  return { config, deviceId };
}

app.post('/api/backup/drive/attachments', requireErpSession, async (req: Request, res: Response) => {
  const authorized = getDriveBackupSession(req, res, 'UPLOAD');
  if (!authorized) return;
  const backupId = String(req.headers['x-erp-backup-id'] || '').trim();
  const mediaId = String(req.headers['x-erp-media-id'] || '').trim();
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, error: 'Body lampiran harus berupa JPEG binary.' });
  try {
    const result = await driveBackupGateway.uploadAttachment(authorized.config, {
      backupId, mediaId, originDeviceId: authorized.deviceId, bytes: req.body,
      mimeType: String(req.headers['content-type'] || ''),
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(getDriveBackupFailureStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'Upload lampiran Drive gagal.' });
  }
});

app.post('/api/backup/drive/snapshots', requireErpSession, async (req: Request, res: Response) => {
  const authorized = getDriveBackupSession(req, res);
  if (!authorized) return;
  const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
  if (body.originDeviceId !== authorized.deviceId || typeof body.backupId !== 'string' ||
      typeof body.storeName !== 'string' || typeof body.backupContent !== 'string' || !Array.isArray(body.attachments)) {
    return res.status(400).json({ success: false, error: 'Metadata snapshot tidak valid atau Device ID tidak cocok.' });
  }
  try {
    const result = await driveBackupGateway.uploadSnapshot(authorized.config, {
      backupId: body.backupId,
      originDeviceId: authorized.deviceId,
      storeName: body.storeName,
      backupContent: body.backupContent,
      backupRole: (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession!.role,
      attachments: body.attachments as Array<Record<string, unknown>>,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(getDriveBackupFailureStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'Upload snapshot Drive gagal.' });
  }
});

app.get('/api/backup/drive/snapshots', requireErpSession, async (req: Request, res: Response) => {
  const authorized = getDriveBackupSession(req, res);
  if (!authorized) return;
  try {
    const backups = await driveBackupGateway.listSnapshots(authorized.config);
    return res.status(200).json({ success: true, backups });
  } catch (error) {
    return res.status(getDriveBackupFailureStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'Daftar backup Drive gagal dibaca.' });
  }
});

app.get('/api/backup/drive/snapshots/:fileId', requireErpSession, async (req: Request, res: Response) => {
  const authorized = getDriveBackupSession(req, res);
  if (!authorized) return;
  try {
    const envelope = await driveBackupGateway.downloadSnapshot(authorized.config, req.params.fileId);
    return res.status(200).json({ success: true, envelope });
  } catch (error) {
    return res.status(getDriveBackupFailureStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'Snapshot Drive gagal diunduh.' });
  }
});

app.get('/api/backup/drive/attachments/:fileId', requireErpSession, async (req: Request, res: Response) => {
  const authorized = getDriveBackupSession(req, res);
  if (!authorized) return;
  try {
    const bytes = await driveBackupGateway.downloadAttachment(
      authorized.config, req.params.fileId, String(req.query.mediaId || ''), String(req.query.originDeviceId || '')
    );
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(bytes.length));
    return res.status(200).send(bytes);
  } catch (error) {
    return res.status(getDriveBackupFailureStatus(error)).json({ success: false, error: error instanceof Error ? error.message : 'Lampiran Drive gagal diunduh.' });
  }
});

app.get('/api/auth/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    enabled: erpAuth.isConfigured(),
    googleClientId: erpAuth.isConfigured() ? (process.env.GOOGLE_CLIENT_ID || '').trim() : null,
  });
});

app.post('/api/auth/google', rateLimitGoogleAuth, async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'Payload login tidak valid.' });
  }
  try {
    const result = await erpAuth.authenticateGoogleCredential((req.body as Record<string, unknown>).credential as string);
    return res.json({ success: true, accessToken: result.accessToken, user: result.user });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      const status = error.code === 'AUTH_NOT_CONFIGURED' ? 503
        : error.code === 'MEMBERSHIP_REVOKED' || error.code === 'MEMBERSHIP_AMBIGUOUS' ? 403
        : 401;
      return res.status(status).json({ success: false, code: error.code, error: error.message });
    }
    return res.status(401).json({ success: false, code: 'GOOGLE_TOKEN_INVALID', error: 'Google ID token tidak dapat diverifikasi.' });
  }
});

app.post('/api/auth/offline-lease', requireErpSession, (req: Request, res: Response) => {
  const session = (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession;
  if (!session) return res.status(401).json({ success: false, code: 'SESSION_INVALID', error: 'Session ERP tidak valid.' });
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'Payload offline lease tidak valid.' });
  }
  try {
    const deviceId = (req.body as Record<string, unknown>).deviceId;
    const lease = erpAuth.issueOfflineLease(session, typeof deviceId === 'string' ? deviceId : '');
    return res.json({ success: true, ...lease });
  } catch (error) {
    if (error instanceof ErpAuthError) {
      const status = error.code === 'OFFLINE_LEASE_NOT_CONFIGURED' ? 503
        : error.code === 'DEVICE_NOT_AUTHORIZED' || error.code === 'MEMBERSHIP_REVOKED' ? 403 : 401;
      return res.status(status).json({ success: false, code: error.code, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Offline authorization belum dapat diterbitkan.' });
  }
});

app.get('/api/auth/me', requireErpSession, (req: Request, res: Response) => {
  const session = (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession;
  return res.json({ success: true, user: session });
});

const PORT = resolvePort(process.argv, process.env.PORT);
const HOST = resolveHost(process.argv, process.env.HOST);

function requireErpRole(allowedRoles: ErpRole[]) {
  return (req: Request, res: Response, next: NextFunction) => requireErpSession(req, res, () => {
    const session = (req as Request & { erpSession?: ReturnType<typeof erpAuth.verifySession> }).erpSession;
    if (!session || !allowedRoles.includes(session.role)) {
      return res.status(403).json({ success: false, error: 'Role akun tidak memiliki akses ke layanan ini.' });
    }
    return next();
  });
}

// Lightweight per-IP rate limiter for AI endpoints
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_REQUESTS = 20;
const aiRateLimitMap = new Map<string, { count: number; resetAtMs: number }>();

function rateLimitAiEndpoints(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);

  if (aiRateLimitMap.size > 1000) {
    for (const [k, v] of aiRateLimitMap.entries()) {
      if (v.resetAtMs <= now) {
        aiRateLimitMap.delete(k);
      }
    }
  }

  const entry = aiRateLimitMap.get(clientIp);
  if (!entry || entry.resetAtMs <= now) {
    aiRateLimitMap.set(clientIp, { count: 1, resetAtMs: now + AI_RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAtMs - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: `Terlalu banyak permintaan ke layanan AI. Coba lagi dalam ${retryAfterSec} detik.`,
    });
  }

  entry.count += 1;
  return next();
}

function sanitizeInlineText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

// Initialize server-side Gemini client per skill guidelines
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// MOD-14: Gemini AI Business Advisor Endpoint for Owner
// -------------------------------------------------------------
app.post('/api/ai/advisor', requireErpRole(['OWNER']), rateLimitAiEndpoints, async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Payload analisis operasional harus berupa objek JSON.' });
    }
    const body = req.body as Record<string, unknown>;
    if (body.lotsNearingExpiry !== undefined && !Array.isArray(body.lotsNearingExpiry)) {
      return res.status(400).json({ success: false, error: 'Daftar lot mendekati kedaluwarsa harus berupa array.' });
    }

    const metricKeys = ['healthScore','totalSalesToday','cashInHand','cashSoftLimit','overdueReceivables','pendingConflicts','opexToday'];
    for (const key of metricKeys) {
      if (!Number.isSafeInteger(body[key]) || Number(body[key]) < 0) {
        return res.status(400).json({ success: false, error: 'Field ' + key + ' wajib berupa integer non-negatif dari data ERP.' });
      }
    }
    if (Number(body.healthScore) > 100 || Number(body.pendingConflicts) > 100000) {
      return res.status(400).json({ success: false, error: 'Health score atau jumlah konflik berada di luar batas.' });
    }
    if (!Array.isArray(body.lotsNearingExpiry) || body.lotsNearingExpiry.length > 20) {
      return res.status(400).json({ success: false, error: 'lotsNearingExpiry wajib berupa array maksimal 20 lot.' });
    }
    const lotsNearingExpiry: Array<{ lotCode: string; product: string; weightGram: number; daysLeft: number; hppKgRupiah: number }> = [];
    for (const item of body.lotsNearingExpiry) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return res.status(400).json({ success: false, error: 'Data lot untuk AI Advisor tidak valid.' });
      }
      const lot = item as Record<string, unknown>;
      if (typeof lot.lotCode !== 'string' || !lot.lotCode.trim() ||
          typeof lot.product !== 'string' || !lot.product.trim() ||
          !Number.isSafeInteger(lot.weightGram) || Number(lot.weightGram) < 0 ||
          !Number.isSafeInteger(lot.daysLeft) || Number(lot.daysLeft) < 0 ||
          !Number.isSafeInteger(lot.hppKgRupiah) || Number(lot.hppKgRupiah) < 0) {
        return res.status(400).json({ success: false, error: 'Field lotCode, product, weightGram, daysLeft, dan hppKgRupiah harus berupa nilai valid/integer.' });
      }
      lotsNearingExpiry.push({
        lotCode: sanitizeInlineText(lot.lotCode, 40),
        product: sanitizeInlineText(lot.product, 80),
        weightGram: Number(lot.weightGram),
        daysLeft: Number(lot.daysLeft),
        hppKgRupiah: Number(lot.hppKgRupiah),
      });
    }
    const healthScore = Number(body.healthScore);
    const totalSalesToday = Number(body.totalSalesToday);
    const cashInHand = Number(body.cashInHand);
    const cashSoftLimit = Number(body.cashSoftLimit);
    const overdueReceivables = Number(body.overdueReceivables);
    const pendingConflicts = Number(body.pendingConflicts);
    const opexToday = Number(body.opexToday);

    // Check if Gemini client is active
    if (ai && apiKey) {
      const prompt = `
Anda adalah analis operasional ERP DAGING untuk bisnis distribusi daging.
Berikan analisis tajam, ringkas, dan rekomendasi aksi nyata (actionable) berdasarkan data riil operasional hari ini:

DATA OPERASIONAL:
- Health Score Toko: ${healthScore}/100
- Omzet Hari Ini: Rp ${Number(totalSalesToday).toLocaleString('id-ID')}
- Uang Kas di Tangan Sales Lapangan: Rp ${Number(cashInHand).toLocaleString('id-ID')} (Soft Limit: Rp ${Number(cashSoftLimit).toLocaleString('id-ID')})
- Piutang Pelanggan Overdue (>14 hari): Rp ${Number(overdueReceivables).toLocaleString('id-ID')}
- OPEX Kas Kecil Hari Ini: Rp ${Number(opexToday).toLocaleString('id-ID')}
- Kasus Konflik Stok Minus: ${pendingConflicts} kasus
- Lot Kritis Mendekati Kedaluwarsa (FEFO):
${lotsNearingExpiry.map((l) => `  * ${l.product} (${l.lotCode}): sisa ${(l.weightGram / 1000).toLocaleString('id-ID')} kg, ${l.daysLeft} hari lagi ED, HPP Rp ${Number(l.hppKgRupiah).toLocaleString('id-ID')}/kg`).join('\n')}

Formatkan jawaban dalam JSON terstruktur:
- summary: Ringkasan kondisi toko dalam 2 kalimat lugas.
- urgencyLevel: 'CRITICAL' | 'WARNING' | 'HEALTHY'
- cashAlert: Rekomendasi terkait setoran kas sales (peringatkan jika melewati batas Rp 3.000.000).
- fefoStrategy: Strategi flash sale / bundling / konversi trimming tetelan untuk lot yang mau expired agar terhindar dari dead-stock atau drip loss.
- receivableWarning: Instruksi penagihan piutang overdue kepada sales lapangan.
- actionItems: Array of 3 langkah prioritas hari ini (title, detail, pic).
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              urgencyLevel: { type: Type.STRING },
              cashAlert: { type: Type.STRING },
              fefoStrategy: { type: Type.STRING },
              receivableWarning: { type: Type.STRING },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    pic: { type: Type.STRING },
                  },
                  required: ['title', 'detail', 'pic'],
                },
              },
            },
            required: ['summary', 'urgencyLevel', 'cashAlert', 'fefoStrategy', 'receivableWarning', 'actionItems'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, source: 'gemini-3.8-flash', data: parsed });
    }

    return res.status(503).json({ success: false, error: 'AI Advisor belum dikonfigurasi. Data operasional tidak akan diganti dengan angka contoh.' });
  } catch (error: unknown) {
    console.error('Advisor Error:', error);
    return res.status(500).json({ success: false, error: 'Saran harian belum dapat dimuat saat ini. Silakan coba lagi sebentar.' });
  }
});

// -------------------------------------------------------------
// MOD-21: Voice Note Order Parsing for Field Sales
// -------------------------------------------------------------
app.post('/api/ai/voice-parse', requireErpRole(['OWNER','ADMIN','SALES']), rateLimitAiEndpoints, async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Payload pesan suara harus berupa objek JSON.' });
    }
    const voiceBody = req.body as Record<string, unknown>;
    const rawTranscript = voiceBody.transcript;
    if (typeof rawTranscript !== 'string') {
      return res.status(400).json({ success: false, error: 'Transkrip suara wajib diisi' });
    }
    const cleanTranscript = rawTranscript.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanTranscript) {
      return res.status(400).json({ success: false, error: 'Transkrip suara wajib diisi' });
    }
    if (cleanTranscript.length > 1000) {
      return res.status(400).json({ success: false, error: 'Transkrip suara maksimal 1000 karakter.' });
    }
    const transcript = cleanTranscript;
    if (!Array.isArray(voiceBody.productCatalog) || voiceBody.productCatalog.length < 1 || voiceBody.productCatalog.length > 500) {
      return res.status(400).json({ success: false, error: 'Katalog produk aktual wajib dikirim (1–500 item).' });
    }
    const productCatalog: Array<{ sku: string; name: string; unitPriceRupiah: number }> = [];
    for (const item of voiceBody.productCatalog) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return res.status(400).json({ success: false, error: 'Baris katalog produk tidak valid.' });
      }
      const product = item as Record<string, unknown>;
      if (typeof product.sku !== 'string' || !product.sku.trim() ||
          typeof product.name !== 'string' || !product.name.trim() ||
          !Number.isSafeInteger(product.unitPriceRupiah) || Number(product.unitPriceRupiah) < 0) {
        return res.status(400).json({ success: false, error: 'Katalog wajib memiliki SKU, nama, dan harga Rupiah integer.' });
      }
      productCatalog.push({
        sku: sanitizeInlineText(product.sku, 60),
        name: sanitizeInlineText(product.name, 120),
        unitPriceRupiah: Number(product.unitPriceRupiah),
      });
    }
    if (!Array.isArray(voiceBody.customerCatalog) || voiceBody.customerCatalog.length > 5000) {
      return res.status(400).json({ success: false, error: 'customerCatalog wajib berupa array maksimal 5.000 pelanggan.' });
    }
    const customerCatalog: Array<{ id: string; name: string }> = [];
    for (const item of voiceBody.customerCatalog) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return res.status(400).json({ success: false, error: 'Baris customerCatalog tidak valid.' });
      }
      const customer = item as Record<string, unknown>;
      if (typeof customer.id !== 'string' || !customer.id.trim() || typeof customer.name !== 'string' || !customer.name.trim()) {
        return res.status(400).json({ success: false, error: 'customerCatalog wajib memiliki id dan nama.' });
      }
      customerCatalog.push({ id: sanitizeInlineText(customer.id, 60), name: sanitizeInlineText(customer.name, 120) });
    }

    if (ai && apiKey) {
      const systemInstruction = [
        'Anda adalah asisten voice note pencatat pesanan sales lapangan ERP DAGING.',
        'Ekstrak bahasa lisan/chat Indonesia informal menjadi JSON draft. Jangan membuat data master baru.',
        'KATALOG MASTER PRODUK AKTUAL DARI ERP:',
        ...productCatalog.map((item) => '- ' + item.sku + ': ' + item.name + ' (harga Rp ' + item.unitPriceRupiah.toLocaleString('id-ID') + ')'),
        'Pilih SKU hanya dari katalog ini. Jangan membuat SKU, nama produk, atau harga baru.',
        'KATALOG PELANGGAN AKTUAL DARI ERP:',
        ...customerCatalog.map((item) => '- ' + item.id + ': ' + item.name),
        'Gunakan nama pelanggan hanya jika cocok dengan katalog ini; jika tidak cocok gunakan Pelanggan Umum. Jangan mengarang nama pelanggan.',
        'ATURAN KONVERSI:',
        '- Berat harus dalam satuan GRAM bulat (1 kg = 1000 gram, setengah kilo = 500 gram).',
        '- Tempo seminggu = 7 hari; tempo 2 minggu = 14 hari; cash/tunai = 0 hari.',
        '- Jika produk tidak dapat dipastikan dari katalog, kembalikan items kosong dan confidenceScore rendah.',
        '- Hasil adalah draft yang harus diperiksa, bukan transaksi final.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analisis teks pesan suara sales berikut:\n"${transcript}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              paymentMethod: { type: Type.STRING, enum: ['CASH', 'TRANSFER', 'TEMPO'] },
              tempoDays: { type: Type.INTEGER },
              notes: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productSku: { type: Type.STRING },
                    productName: { type: Type.STRING },
                    weightGram: { type: Type.INTEGER },
                    quantityPcs: { type: Type.INTEGER },
                    unitPriceRupiah: { type: Type.INTEGER },
                  },
                  required: ['productSku', 'productName', 'weightGram', 'unitPriceRupiah'],
                },
              },
            },
            required: ['customerName', 'paymentMethod', 'tempoDays', 'items'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, source: 'gemini-3.8-flash', data: parsed });
    }

    return res.status(503).json({ success: false, error: 'AI Voice belum dikonfigurasi. Gunakan parser lokal pada perangkat.' });
  } catch (error: unknown) {
    console.error('Voice Parse Error:', error);
    return res.status(500).json({ success: false, error: 'Pesan suara belum dapat diproses saat ini. Silakan ulangi atau ketik manual.' });
  }
});

// -------------------------------------------------------------
// Vite Server Integration for Development & Production Serving
// -------------------------------------------------------------
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
}

setupViteOrStatic()
  .then(() => {
    httpServer.listen(PORT, HOST, () => {
      console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
      console.log(`  ➜  Network: http://${HOST}:${PORT}/\n`);
      console.log(`[ERP KARKASIA] Dev Server running on http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Failed to initialize Vite / Express server:', err);
    process.exit(1);
  });
