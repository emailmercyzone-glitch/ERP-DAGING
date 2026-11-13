import type { VoiceParseAdapterResult, VoiceParseItemResult } from './backendAdapter';

/**
 * Deterministic on-device Indonesian NLP parser for field sales voice orders.
 * Works 100% offline in Local-Only Mode and serves as fallback for any adapter.
 */
export function parseIndonesianVoiceOrderLocally(transcript: string): VoiceParseAdapterResult {
  const clean = transcript.trim();
  const lower = clean.toLowerCase();

  let customerName = 'Pelanggan Umum';
  if (lower.includes('grand serang') || lower.includes('hotel')) {
    customerName = 'Hotel Grand Serang';
  } else if (lower.includes('steakhouse') || lower.includes('banten prima')) {
    customerName = 'Steakhouse Banten Prima';
  } else if (lower.includes('padang') || lower.includes('sederhana')) {
    customerName = 'Resto Padang Sederhana Cilegon';
  } else if (lower.includes('catering') || lower.includes('krakatau')) {
    customerName = 'Dapur Catering Krakatau';
  } else if (lower.includes('anyer') || lower.includes('cafe')) {
    customerName = 'Cafe & Grill Anyer Beach';
  } else if (lower.includes('swiss-belinn') || lower.includes('cikande')) {
    customerName = 'Hotel Swiss-Belinn Cikande';
  } else if (lower.includes('warung') || lower.includes('bakso')) {
    customerName = 'Warung Bakso KARKASIA';
  }

  let paymentMethod: 'CASH' | 'TRANSFER' | 'TEMPO' = 'CASH';
  let tempoDays = 0;

  const tempoDaysMatch = lower.match(/tempo\s*(\d+)\s*hari/);
  if (tempoDaysMatch) {
    paymentMethod = 'TEMPO';
    tempoDays = Math.max(1, parseInt(tempoDaysMatch[1], 10) || 7);
  } else if (lower.includes('2 minggu') || lower.includes('dua minggu')) {
    paymentMethod = 'TEMPO';
    tempoDays = 14;
  } else if (lower.includes('tempo') || lower.includes('utang') || lower.includes('minggu')) {
    paymentMethod = 'TEMPO';
    tempoDays = 7;
  } else if (lower.includes('transfer') || lower.includes('tf') || lower.includes('bca')) {
    paymentMethod = 'TRANSFER';
  }

  const extractWeightGram = (keywords: string[], defaultGram: number): number => {
    for (const kw of keywords) {
      const beforeRe = new RegExp(`(\\d+[\\.,]?\\d*|setengah)\\s*(kg|kilo|kilogram|gram|gr|g)?\\s*(?:[a-z\\s]{0,18})?${kw}`);
      const afterRe = new RegExp(`${kw}\\s*(?:[a-z\\s]{0,18})?(\\d+[\\.,]?\\d*|setengah)\\s*(kg|kilo|kilogram|gram|gr|g)?`);
      const match = lower.match(beforeRe) || lower.match(afterRe);
      if (match) {
        const rawNum = match[1];
        const unit = (match[2] || 'kg').toLowerCase();
        const qty = rawNum === 'setengah' ? 0.5 : parseFloat(rawNum.replace(',', '.'));
        if (!Number.isNaN(qty) && qty > 0) {
          if (unit === 'gram' || unit === 'gr' || unit === 'g') {
            return Math.max(100, Math.round(qty));
          }
          return Math.max(100, Math.round(qty * 1000));
        }
      }
    }
    return defaultGram;
  };

  const items: VoiceParseItemResult[] = [];

  if (lower.includes('ribeye') || lower.includes('rib eye')) {
    items.push({
      productSku: 'SKU-RIBEYE-AUS',
      productName: 'Ribeye Meltique Australia (Primal)',
      weightGram: extractWeightGram(['ribeye', 'rib eye'], 2000),
      quantityPcs: 1,
      unitPriceRupiah: 240000,
    });
  }

  if (lower.includes('sirloin') || lower.includes('striploin')) {
    items.push({
      productSku: 'SKU-SIRLOIN-USA',
      productName: 'Sirloin Choice USA (Steak Cut)',
      weightGram: extractWeightGram(['sirloin', 'striploin'], 2000),
      quantityPcs: 1,
      unitPriceRupiah: 210000,
    });
  }

  if (lower.includes('shortplate') || lower.includes('short plate') || lower.includes('slice') || lower.includes('shabu')) {
    const gram = extractWeightGram(['shortplate', 'short plate', 'slice', 'shabu'], 3000);
    items.push({
      productSku: 'SKU-SHORTPLATE-US',
      productName: 'US Beef Shortplate 500g Slice',
      weightGram: gram,
      quantityPcs: Math.max(1, Math.round(gram / 500)),
      unitPriceRupiah: 125000,
    });
  }

  if (lower.includes('tenderloin') || lower.includes('has dalam')) {
    items.push({
      productSku: 'SKU-TENDERLOIN-AUS',
      productName: 'Tenderloin Grassfed Australia',
      weightGram: extractWeightGram(['tenderloin', 'has dalam'], 2000),
      quantityPcs: 1,
      unitPriceRupiah: 290000,
    });
  }

  if (lower.includes('tetelan') || lower.includes('cincang') || lower.includes('rawon') || lower.includes('saikoro')) {
    items.push({
      productSku: 'SKU-TETELAN-SP',
      productName: 'Tetelan Rawon Super KARKASIA',
      weightGram: extractWeightGram(['tetelan', 'cincang', 'rawon', 'saikoro'], 3000),
      quantityPcs: 1,
      unitPriceRupiah: 85000,
    });
  }

  if (items.length === 0) {
    items.push({
      productSku: 'SKU-RIBEYE-AUS',
      productName: 'Ribeye Meltique Australia (Primal)',
      weightGram: extractWeightGram(['daging', 'order', 'minta'], 1500),
      quantityPcs: 1,
      unitPriceRupiah: 240000,
    });
  }

  return {
    customerName,
    paymentMethod,
    tempoDays,
    notes: `Diproses secara lokal (offline-ready): "${clean}"`,
    confidenceScore: 0.92,
    source: 'local-nlp-engine',
    items,
  };
}
