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

    const metricKeys = ['healthScore', 'totalSalesToday', 'cashInHand', 'cashSoftLimit', 'overdueReceivables', 'pendingConflicts', 'opexToday'] as const;
    const missingMetrics = metricKeys.filter((key) =>
      typeof body[key] !== 'number' || !Number.isFinite(body[key]) || (body[key] as number) < 0
    );
    if (missingMetrics.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Metrik operasional wajib dikirim sebagai angka valid: ${missingMetrics.join(', ')}.`,
      });
    }
    if ((body.healthScore as number) > 100) {
      return res.status(400).json({ success: false, error: 'Health Score harus berada pada rentang 0–100.' });
    }

    const healthScore = body.healthScore as number;
    const totalSalesToday = body.totalSalesToday as number;
    const cashInHand = body.cashInHand as number;
    const cashSoftLimit = body.cashSoftLimit as number;
    const overdueReceivables = body.overdueReceivables as number;
    const pendingConflicts = body.pendingConflicts as number;
    const opexToday = body.opexToday as number;
    const hasLotData = Array.isArray(body.lotsNearingExpiry);
    const rawLots = hasLotData ? (body.lotsNearingExpiry as unknown[]).slice(0, 20) : [];
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
Anda adalah asisten analisis operasional ERP DAGING untuk usaha distributor daging.
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

Aturan wajib: gunakan hanya fakta pada payload; jangan mengarang nama pelanggan, nama sales, nomor rekening, SKU, atau angka. Soft limit kas hanya memicu peringatan dan tindak lanjut setoran, bukan pemblokiran transaksi. Plafon kredit selalu warning-only dan tidak boleh dijadikan alasan memblokir penjualan atau mewajibkan approval Owner. Jangan menyarankan diskon atau perubahan harga otomatis; ikuti kebijakan harga yang berlaku.

Formatkan jawaban dalam JSON terstruktur:
- summary: Ringkasan kondisi toko dalam 2 kalimat lugas.
- urgencyLevel: 'CRITICAL' | 'WARNING' | 'HEALTHY'
- cashAlert: Rekomendasi terkait setoran kas sales berdasarkan soft limit yang tercantum; hanya peringatan, tidak memblokir transaksi.
- fefoStrategy: Strategi flash sale / bundling / konversi trimming tetelan untuk lot yang mau expired agar terhindar dari dead-stock atau drip loss.
- receivableWarning: Instruksi penagihan piutang overdue kepada sales lapangan.
- actionItems: Array of 3 langkah prioritas hari ini (title, detail, pic). Gunakan hanya data yang tersedia.
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

    // Deterministic fallback uses only the supplied operational data and locked business rules.
    const isCashOverLimit = cashInHand > cashSoftLimit;
    const hasLotsNearingExpiry = Array.isArray(lotsNearingExpiry) && lotsNearingExpiry.length > 0;
    const hasOverdueReceivables = overdueReceivables > 0;
    const urgency = isCashOverLimit || hasOverdueReceivables || hasLotsNearingExpiry ? 'WARNING' : 'HEALTHY';
    const firstCriticalLot = hasLotsNearingExpiry ? lotsNearingExpiry[0] : undefined;

    const fallbackData = {
      summary: [
        `Health Score operasional saat ini ${healthScore}/100.`,
        isCashOverLimit
          ? `Kas sales melewati soft limit sebesar Rp ${Number(cashSoftLimit).toLocaleString('id-ID')}.`
          : 'Kas sales masih berada dalam soft limit.',
        hasLotsNearingExpiry
          ? `${lotsNearingExpiry.length} lot perlu ditinjau karena mendekati kedaluwarsa.`
          : hasLotData ? 'Tidak ada lot mendekati kedaluwarsa pada daftar pemantauan.' : 'Data lot kritis tidak tersedia dalam payload.',
        hasOverdueReceivables
          ? `Piutang overdue tercatat Rp ${Number(overdueReceivables).toLocaleString('id-ID')}.`
          : 'Tidak ada nilai piutang overdue pada ringkasan.',
      ].join(' '),
      urgencyLevel: urgency,
      cashAlert: isCashOverLimit
        ? `Kas sales Rp ${Number(cashInHand).toLocaleString('id-ID')} melewati soft limit Rp ${Number(cashSoftLimit).toLocaleString('id-ID')}. Minta Admin dan Sales terkait meninjau serta mencatat setoran. Ini peringatan; jangan memblokir transaksi otomatis.`
        : `Kas sales Rp ${Number(cashInHand).toLocaleString('id-ID')} masih dalam soft limit Rp ${Number(cashSoftLimit).toLocaleString('id-ID')}.`,
      fefoStrategy: firstCriticalLot
        ? `Prioritaskan penjualan FEFO untuk lot ${firstCriticalLot.product} (${firstCriticalLot.lotCode}), sisa ${firstCriticalLot.weightKg} kg dan ${firstCriticalLot.daysLeft} hari menuju ED. Tinjau tindakan sesuai kebijakan harga yang berlaku; jangan menerapkan diskon otomatis.`
        : hasLotData ? 'Tidak ada lot kritis pada daftar pemantauan. Lanjutkan rotasi FEFO dan pemeriksaan tanggal kedaluwarsa rutin.' : 'Data lot kritis tidak tersedia; sistem tidak dapat menyimpulkan kondisi FEFO.',
      receivableWarning: hasOverdueReceivables
        ? `Piutang overdue Rp ${Number(overdueReceivables).toLocaleString('id-ID')}. Minta Admin/Sales menindaklanjuti dan mencatat janji bayar. Plafon kredit tetap warning-only dan tidak boleh memblokir penjualan.`
        : 'Tidak ada nilai piutang overdue pada ringkasan saat ini.',
      actionItems: [
        {
          title: 'Tinjau setoran kas sales',
          detail: isCashOverLimit
            ? `Saldo kas Rp ${Number(cashInHand).toLocaleString('id-ID')} melewati soft limit. Koordinasikan setoran dan catat penerimaannya tanpa memblokir transaksi.`
            : 'Periksa catatan penerimaan dan setoran kas sales sesuai jadwal operasional.',
          pic: 'Admin & Sales terkait',
        },
        {
          title: firstCriticalLot ? 'Prioritaskan lot mendekati ED' : 'Periksa rotasi FEFO',
          detail: firstCriticalLot
            ? `Tinjau lot ${firstCriticalLot.product} (${firstCriticalLot.lotCode}) dengan sisa ${firstCriticalLot.daysLeft} hari. Terapkan tindakan sesuai kebijakan harga yang berlaku.`
            : 'Pastikan lot terdekat tanggal kedaluwarsa tetap diprioritaskan saat picking.',
          pic: 'Admin Gudang',
        },
        {
          title: hasOverdueReceivables ? 'Tindak lanjuti piutang overdue' : 'Rekonsiliasi piutang',
          detail: hasOverdueReceivables
            ? `Tindak lanjuti total overdue Rp ${Number(overdueReceivables).toLocaleString('id-ID')} dan catat hasil komunikasi; jangan mengubah plafon menjadi pemblokir.`
            : 'Cocokkan pembayaran masuk dengan invoice dan pastikan status piutang akurat.',
          pic: 'Admin & Sales terkait',
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
Anda adalah asisten pencatat pesanan sales lapangan.
Ekstrak hanya informasi yang benar-benar disebutkan dalam transkrip bahasa Indonesia.

ATURAN WAJIB:
- Jangan memakai atau mengarang katalog, SKU, nama pelanggan, harga, berat, jumlah, atau produk contoh.
- Jangan menebak berat. Jika berat produk tidak disebut eksplisit, jangan masukkan item tersebut ke array items.
- productName harus berupa nama/istilah produk yang benar-benar terdengar dalam transkrip.
- productSku hanya boleh diisi jika SKU disebut eksplisit; selain itu isi string kosong.
- unitPriceRupiah hanya boleh diisi jika harga disebut eksplisit; selain itu jangan isi.
- customerName hanya boleh diisi jika nama pelanggan disebut eksplisit; jika tidak, gunakan "Pelanggan Umum".
- paymentMethod hanya boleh mengikuti kata yang eksplisit (cash/tunai, transfer/tf, tempo/utang). Jika tidak disebut, gunakan CASH sebagai tampilan default; aplikasi tidak akan menerapkannya tanpa kata eksplisit.
- tempoDays hanya diisi jika jumlah hari/minggu disebut eksplisit; selain itu 0.
- Jika tidak ada item dengan produk dan berat yang jelas, kembalikan items sebagai array kosong.
- Jangan menambahkan item default dalam kondisi apa pun.
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
                  required: ['productName', 'weightGram'],
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
