import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseIndonesianVoiceOrderLocally } from './src/adapters/localVoiceParser';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  // AI Studio Dev Server strictly runs on port 3000
  return 3000;
}

function getHost(): string {
  const hostArgIndex = process.argv.indexOf('--host');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return '0.0.0.0';
}

const PORT = getPort();
const HOST = getHost();

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// Reject malformed JSON payloads cleanly without exposing parser internals
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 400) {
    return res.status(400).json({ success: false, error: 'Format payload JSON tidak valid atau terlalu besar.' });
  }
  return next(err);
});

// Security headers for all API endpoints
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

function timingSafeTokenEquals(candidate: string, expected: string): boolean {
  const candidateHash = crypto.createHash('sha256').update(candidate).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

function requireOptionalApiToken(req: Request, res: Response, next: NextFunction) {
  const configuredToken = (process.env.API_ACCESS_TOKEN || '').trim();
  if (!configuredToken) {
    return next();
  }
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = typeof req.headers['x-api-token'] === 'string' ? req.headers['x-api-token'].trim() : '';
  const provided = bearerToken || headerToken;
  if (!provided || !timingSafeTokenEquals(provided, configuredToken)) {
    return res.status(401).json({ success: false, error: 'Akses ditolak: token otorisasi API tidak valid.' });
  }
  return next();
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

function coerceNonNegativeNumber(value: unknown, fallback: number, max: number = Number.MAX_SAFE_INTEGER): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(num, max);
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

// Block unauthenticated/accidental exposure of archive ZIP deliverables unless explicitly enabled
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && req.path.toLowerCase().endsWith('.zip') && process.env.ENABLE_ZIP_DOWNLOAD !== 'true') {
    return res.status(403).json({ success: false, error: 'Unduhan arsip dinonaktifkan demi keamanan.' });
  }
  return next();
});

// Deliverable ZIP Download Endpoints (Opt-in via ENABLE_ZIP_DOWNLOAD=true + optional API_ACCESS_TOKEN)
app.get(
  ['/api/download-zip', '/erp_karkasia_v4_3_patched.zip', '/erp_daging_sampora_banten_v4_3_patched.zip'],
  requireOptionalApiToken,
  (_req: Request, res: Response) => {
    if (process.env.ENABLE_ZIP_DOWNLOAD !== 'true') {
      return res.status(403).json({ success: false, error: 'Unduhan arsip dinonaktifkan demi keamanan.' });
    }
    const zipKarkasia = path.resolve(__dirname, 'erp_karkasia_v4_3_patched.zip');
    const zipLegacy = path.resolve(__dirname, 'erp_daging_sampora_banten_v4_3_patched.zip');
    const targetZip = fs.existsSync(zipKarkasia) ? zipKarkasia : zipLegacy;
    if (fs.existsSync(targetZip)) {
      res.setHeader('Content-Type', 'application/zip');
      return res.download(targetZip, path.basename(targetZip));
    }
    return res.status(404).json({ error: 'ZIP deliverable not found' });
  }
);

// -------------------------------------------------------------
// MOD-14: Gemini AI Business Advisor Endpoint for Owner
// -------------------------------------------------------------
app.post('/api/ai/advisor', requireOptionalApiToken, rateLimitAiEndpoints, async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Payload analisis operasional harus berupa objek JSON.' });
    }
    const body = req.body as Record<string, unknown>;
    if (body.lotsNearingExpiry !== undefined && !Array.isArray(body.lotsNearingExpiry)) {
      return res.status(400).json({ success: false, error: 'Daftar lot mendekati kedaluwarsa harus berupa array.' });
    }

    const healthScore = coerceNonNegativeNumber(body.healthScore, 92, 100);
    const totalSalesToday = coerceNonNegativeNumber(body.totalSalesToday, 8450000);
    const cashInHand = coerceNonNegativeNumber(body.cashInHand, 3450000);
    const cashSoftLimit = coerceNonNegativeNumber(body.cashSoftLimit, 3000000);
    const overdueReceivables = coerceNonNegativeNumber(body.overdueReceivables, 12000000);
    const pendingConflicts = coerceNonNegativeNumber(body.pendingConflicts, 0, 100000);
    const opexToday = coerceNonNegativeNumber(body.opexToday, 350000);

    const rawLots = Array.isArray(body.lotsNearingExpiry)
      ? body.lotsNearingExpiry.slice(0, 20)
      : [
          { lotCode: 'LOT-202502-001', product: 'Australian Ribeye Chilled', weightKg: 18.5, daysLeft: 6, landedCostPerKg: 185000 },
          { lotCode: 'LOT-202502-004', product: 'US Beef Shortplate', weightKg: 42.0, daysLeft: 12, landedCostPerKg: 110000 },
        ];
    const lotsNearingExpiry = rawLots
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
      .map((l) => ({
        lotCode: sanitizeInlineText(l.lotCode, 40) || 'LOT-UNKNOWN',
        product: sanitizeInlineText(l.product, 80) || 'Produk Daging',
        weightKg: coerceNonNegativeNumber(l.weightKg, 0, 1_000_000),
        daysLeft: coerceNonNegativeNumber(l.daysLeft, 0, 3650),
        landedCostPerKg: coerceNonNegativeNumber(l.landedCostPerKg, 0, 100_000_000),
      }));

    // Check if Gemini client is active
    if (ai && apiKey) {
      const prompt = `
Anda adalah Chief Business Advisor & Pakar Supply Chain Daging Import untuk UMKM "Toko Daging KARKASIA" (Owner: Ndoro Juragan).
Berikan analisis tajam, ringkas, dan rekomendasi aksi nyata (actionable) berdasarkan data riil operasional hari ini:

DATA OPERASIONAL:
- Health Score Toko: ${healthScore}/100
- Omzet Hari Ini: Rp ${Number(totalSalesToday).toLocaleString('id-ID')}
- Uang Kas di Tangan Sales Lapangan: Rp ${Number(cashInHand).toLocaleString('id-ID')} (Soft Limit: Rp ${Number(cashSoftLimit).toLocaleString('id-ID')})
- Piutang Pelanggan Overdue (>14 hari): Rp ${Number(overdueReceivables).toLocaleString('id-ID')}
- OPEX Kas Kecil Hari Ini: Rp ${Number(opexToday).toLocaleString('id-ID')}
- Kasus Konflik Stok Minus: ${pendingConflicts} kasus
- Lot Kritis Mendekati Kedaluwarsa (FEFO):
${lotsNearingExpiry.map((l) => `  * ${l.product} (${l.lotCode}): sisa ${l.weightKg} kg, ${l.daysLeft} hari lagi ED, HPP Rp ${Number(l.landedCostPerKg).toLocaleString('id-ID')}/kg`).join('\n')}

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

    // Fallback heuristic intelligent advisor if Gemini API key is not yet set
    const isCashOverLimit = cashInHand > cashSoftLimit;
    const hasLotsNearingExpiry = lotsNearingExpiry && lotsNearingExpiry.length > 0;
    const urgency = isCashOverLimit || overdueReceivables > 10000000 ? 'WARNING' : 'HEALTHY';

    const fallbackData = {
      summary: `Operasional Toko KARKASIA berjalan stabil dengan Health Score ${healthScore}/100. Namun terdeteksi ${lotsNearingExpiry.length} lot daging mendekati ED dan saldo kas sales di atas batas aman.`,
      urgencyLevel: urgency,
      cashAlert: isCashOverLimit
        ? `PERINGATAN KAS: Sales memegang uang tunai Rp ${Number(cashInHand).toLocaleString('id-ID')} (melebihi limit aman Rp 3.000.000). Wajib instruksikan setor kas ke rekening BCA KARKASIA sore ini.`
        : `Kas sales aman di angka Rp ${Number(cashInHand).toLocaleString('id-ID')} di bawah plafon Rp 3.000.000.`,
      fefoStrategy: hasLotsNearingExpiry
        ? `LOT KRITIS: Lot ${lotsNearingExpiry[0]?.product} tinggal ${lotsNearingExpiry[0]?.daysLeft} hari lagi kedaluwarsa. Rekomendasi: Flash sale diskon 8% ke resto langganan atau konversi sisa trimming menjadi Daging Cincang/Tetelan (MOD-07).`
        : `Rotasi FEFO gudang terjaga optimal. Semua lot memiliki sisa umur simpan > 30 hari.`,
      receivableWarning: overdueReceivables > 0
        ? `PIUTANG OVERDUE: Terdapat Rp ${Number(overdueReceivables).toLocaleString('id-ID')} tagihan macet > 14 hari. Kunci plafon kredit pelanggan terkait sampai dilakukan pembayaran.`
        : `Semua piutang pelanggan dalam status lancar.`,
      actionItems: [
        {
          title: 'Wajibkan Setor Kas Lapangan',
          detail: `Sales memegang Rp ${Number(cashInHand).toLocaleString('id-ID')}. Blokir penerbitan invoice tunai baru jika belum setor (MOD-11).`,
          pic: 'Admin Kasir & Sales Joko',
        },
        {
          title: 'FEFO Clearance Promo',
          detail: `Tawarkan lot ${lotsNearingExpiry[0]?.product || 'Ribeye'} ke Steakhouse Banten Prima & Resto Padang dengan tempo 3 hari.`,
          pic: 'Sales Lapangan',
        },
        {
          title: 'Monitoring Drip Loss Thawing',
          detail: 'Lakukan pemeriksaan suhu freezer (-18°C) dan pastikan tidak ada kebocoran vakum pack plastik.',
          pic: 'Kepala Gudang',
        },
      ],
    };

    return res.json({ success: true, source: 'edge-heuristic-advisor', data: fallbackData });
  } catch (error: unknown) {
    console.error('Advisor Error:', error);
    return res.status(500).json({ success: false, error: 'Saran harian belum dapat dimuat saat ini. Silakan coba lagi sebentar.' });
  }
});

// -------------------------------------------------------------
// MOD-21: Voice Note Order Parsing for Field Sales
// -------------------------------------------------------------
app.post('/api/ai/voice-parse', requireOptionalApiToken, rateLimitAiEndpoints, async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: 'Payload pesan suara harus berupa objek JSON.' });
    }
    const rawTranscript = (req.body as Record<string, unknown>).transcript;
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

    if (ai && apiKey) {
      const systemInstruction = `
Anda adalah asisten voice note pencatat pesanan sales lapangan untuk supplier daging import "Toko KARKASIA".
Tugas Anda mengekstrak informasi pesanan dari bahasa lisan/chat bahasa Indonesia informal menjadi data terstruktur JSON.

KAMUS MASTER PRODUK KARKASIA:
- SKU-RIBEYE-AUS: Australian Ribeye Chilled (harga Rp 195.000/kg)
- SKU-SHORTPLATE-US: US Beef Shortplate 500g Slice (harga Rp 125.000/kg)
- SKU-STRIPLOIN-AUS: Australian Striploin Chilled (harga Rp 180.000/kg)
- SKU-TETELAN-01: Tetelan & Daging Cincang Super (harga Rp 85.000/kg)

ATURAN KONVERSI:
- Berat harus dalam satuan GRAM bulat (1 kg = 1000 gram, setengah kilo = 500 gram, 2.5 kg = 2500 gram).
- Tanggal tempo jika disebut "tempo seminggu" -> 7 hari; "tempo 2 minggu" -> 14 hari; "cash/tunai" -> 0 hari (metode CASH).
- Pelanggan default jika tidak disebut: "Warung Pelanggan Umum".
`;

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

    // Safe offline fallback: only extract product keywords and explicit weights.
    // Never invent customer names, SKUs, prices, or default quantities.
    const fallbackResult = parseIndonesianVoiceOrderLocally(transcript);
    return res.json({ success: true, source: 'local-nlp-engine', data: fallbackResult });
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
