import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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

app.use(express.json());

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

// Deliverable ZIP Download Endpoints
app.get(['/api/download-zip', '/erp_karkasia_v4_3_patched.zip', '/erp_daging_sampora_banten_v4_3_patched.zip'], (_req: Request, res: Response) => {
  const zipKarkasia = path.resolve(__dirname, 'erp_karkasia_v4_3_patched.zip');
  const zipLegacy = path.resolve(__dirname, 'erp_daging_sampora_banten_v4_3_patched.zip');
  const targetZip = fs.existsSync(zipKarkasia) ? zipKarkasia : zipLegacy;
  if (fs.existsSync(targetZip)) {
    res.setHeader('Content-Type', 'application/zip');
    res.download(targetZip, path.basename(targetZip));
  } else {
    res.status(404).json({ error: 'ZIP deliverable not found' });
  }
});

// -------------------------------------------------------------
// MOD-14: Gemini AI Business Advisor Endpoint for Owner
// -------------------------------------------------------------
app.post('/api/ai/advisor', async (req: Request, res: Response) => {
  try {
    const {
      healthScore = 92,
      totalSalesToday = 8450000,
      cashInHand = 3450000,
      cashSoftLimit = 3000000,
      overdueReceivables = 12000000,
      lotsNearingExpiry = [
        { lotCode: 'LOT-202502-001', product: 'Australian Ribeye Chilled', weightKg: 18.5, daysLeft: 6, landedCostPerKg: 185000 },
        { lotCode: 'LOT-202502-004', product: 'US Beef Shortplate', weightKg: 42.0, daysLeft: 12, landedCostPerKg: 110000 },
      ],
      pendingConflicts = 0,
      opexToday = 350000,
    } = req.body;

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
${lotsNearingExpiry.map((l: any) => `  * ${l.product} (${l.lotCode}): sisa ${l.weightKg} kg, ${l.daysLeft} hari lagi ED, HPP Rp ${Number(l.landedCostPerKg).toLocaleString('id-ID')}/kg`).join('\n')}

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
  } catch (error: any) {
    console.error('Advisor Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memproses analisis AI' });
  }
});

// -------------------------------------------------------------
// MOD-21: Voice Note Order Parsing for Field Sales
// -------------------------------------------------------------
app.post('/api/ai/voice-parse', async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ success: false, error: 'Transkrip suara wajib diisi' });
    }

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

    // Heuristic NLP fallback for voice note offline/free simulation
    const lower = transcript.toLowerCase();
    let customerName = 'Pelanggan Umum';
    if (lower.includes('steakhouse') || lower.includes('banten prima')) {
      customerName = 'Steakhouse Banten Prima';
    } else if (lower.includes('warung') || lower.includes('bakso')) {
      customerName = 'Warung Bakso KARKASIA';
    } else if (lower.includes('resto') || lower.includes('padang')) {
      customerName = 'Resto Padang Minang Saiyo';
    }

    let paymentMethod = 'CASH';
    let tempoDays = 0;
    if (lower.includes('tempo') || lower.includes('utang') || lower.includes('minggu')) {
      paymentMethod = 'TEMPO';
      tempoDays = lower.includes('2 minggu') ? 14 : 7;
    } else if (lower.includes('transfer') || lower.includes('tf')) {
      paymentMethod = 'TRANSFER';
    }

    const items: any[] = [];
    if (lower.includes('ribeye')) {
      const match = lower.match(/(\d+[\.,]?\d*)\s*(kg|kilo|gram)?\s*ribeye/) || lower.match(/ribeye\s*(\d+[\.,]?\d*)\s*(kg|kilo|gram)?/);
      const qtyNum = match ? parseFloat(match[1].replace(',', '.')) : 2;
      const weightGram = match && match[2] === 'gram' ? Math.round(qtyNum) : Math.round(qtyNum * 1000);
      items.push({
        productSku: 'SKU-RIBEYE-AUS',
        productName: 'Australian Ribeye Chilled',
        weightGram: weightGram || 2000,
        quantityPcs: 1,
        unitPriceRupiah: 195000,
      });
    }

    if (lower.includes('shortplate') || lower.includes('slice')) {
      const match = lower.match(/(\d+[\.,]?\d*)\s*(kg|kilo|gram)?\s*shortplate/) || lower.match(/shortplate\s*(\d+[\.,]?\d*)\s*(kg|kilo|gram)?/);
      const qtyNum = match ? parseFloat(match[1].replace(',', '.')) : 3;
      const weightGram = match && match[2] === 'gram' ? Math.round(qtyNum) : Math.round(qtyNum * 1000);
      items.push({
        productSku: 'SKU-SHORTPLATE-US',
        productName: 'US Beef Shortplate 500g Slice',
        weightGram: weightGram || 3000,
        quantityPcs: 6,
        unitPriceRupiah: 125000,
      });
    }

    if (lower.includes('tetelan') || lower.includes('cincang')) {
      const match = lower.match(/(\d+[\.,]?\d*)\s*(kg|kilo|gram)?\s*tetelan/) || lower.match(/tetelan\s*(\d+[\.,]?\d*)\s*(kg|kilo|gram)?/);
      const qtyNum = match ? parseFloat(match[1].replace(',', '.')) : 3;
      const weightGram = match && match[2] === 'gram' ? Math.round(qtyNum) : Math.round(qtyNum * 1000);
      items.push({
        productSku: 'SKU-TETELAN-01',
        productName: 'Tetelan & Daging Cincang Super',
        weightGram: weightGram || 3000,
        quantityPcs: 1,
        unitPriceRupiah: 85000,
      });
    }

    if (items.length === 0) {
      items.push({
        productSku: 'SKU-RIBEYE-AUS',
        productName: 'Australian Ribeye Chilled',
        weightGram: 1500,
        quantityPcs: 1,
        unitPriceRupiah: 195000,
      });
    }

    const fallbackResult = {
      customerName,
      paymentMethod,
      tempoDays,
      notes: `Ditranskripsi via Voice Note Sales: "${transcript}"`,
      confidenceScore: 0.94,
      items,
    };

    return res.json({ success: true, source: 'edge-nlp-parser', data: fallbackResult });
  } catch (error: any) {
    console.error('Voice Parse Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Gagal memproses pesan suara' });
  }
});

// -------------------------------------------------------------
// Vite Server Integration for Development & Production Serving
// -------------------------------------------------------------
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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
    app.listen(PORT, HOST, () => {
      console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
      console.log(`  ➜  Network: http://${HOST}:${PORT}/\n`);
      console.log(`[ERP KARKASIA] Dev Server running on http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal: Failed to initialize Vite / Express server:', err);
    process.exit(1);
  });
