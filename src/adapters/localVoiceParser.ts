import type { VoiceParseAdapterResult, VoiceParseItemResult } from './backendAdapter';

/**
 * Offline-safe parser. It extracts only product keywords and weights explicitly
 * present in the transcript; it never invents a customer, SKU, price, or quantity.
 */
export function parseIndonesianVoiceOrderLocally(transcript: string): VoiceParseAdapterResult {
  const clean = transcript.trim();
  const lower = clean.toLowerCase();
  const paymentMethod: VoiceParseAdapterResult['paymentMethod'] =
    /\b(tempo|utang|kredit)\b/.test(lower) ? 'TEMPO'
      : /\b(transfer|tf|bca)\b/.test(lower) ? 'TRANSFER'
        : 'CASH';
  const tempoMatch = lower.match(/tempo\s*(\d+)\s*hari/);
  const tempoDays = paymentMethod === 'TEMPO' && tempoMatch ? Math.max(1, Number(tempoMatch[1])) : 0;

  const groups = [
    { keywords: ['ribeye', 'rib eye'], label: 'ribeye' },
    { keywords: ['sirloin', 'striploin'], label: 'sirloin' },
    { keywords: ['shortplate', 'short plate', 'slice', 'shabu'], label: 'shortplate' },
    { keywords: ['tenderloin', 'has dalam'], label: 'tenderloin' },
    { keywords: ['tetelan', 'cincang', 'rawon', 'saikoro'], label: 'tetelan' },
  ];
  const items: VoiceParseItemResult[] = [];

  const extractExplicitWeight = (keyword: string): number | null => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const units = '(kg|kilo|kilogram|gram|gr|g)';
    const before = lower.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${units}\\s*${escaped}\\b`, 'i'));
    const after = lower.match(new RegExp(`\\b${escaped}\\s*(\\d+(?:[.,]\\d+)?)\\s*${units}\\b`, 'i'));
    const match = before || after;
    if (!match) return null;
    const rawValue = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(rawValue) || rawValue <= 0) return null;
    const unit = match[2].toLowerCase();
    const weightGram = unit === 'gram' || unit === 'gr' || unit === 'g'
      ? Math.round(rawValue)
      : Math.round(rawValue * 1000);
    return weightGram >= 100 ? weightGram : null;
  };

  for (const group of groups) {
    const matchedKeyword = group.keywords.find((keyword) => lower.includes(keyword));
    if (!matchedKeyword) continue;
    const weightGram = extractExplicitWeight(matchedKeyword);
    if (!weightGram) continue;
    items.push({
      productSku: '',
      productName: group.label,
      weightGram,
      quantityPcs: 1,
    });
  }

  return {
    customerName: 'Pelanggan Umum',
    paymentMethod,
    tempoDays,
    notes: items.length
      ? `Ekstraksi lokal dari pesan: "${clean}". Cocokkan nama produk dan berat dengan katalog sebelum transaksi.`
      : `Produk atau berat belum dapat dipastikan dari pesan: "${clean}". Tidak ada item yang dibuat otomatis; input manual diperlukan.`,
    confidenceScore: items.length ? 0.55 : 0.2,
    source: 'local-nlp-engine',
    items,
  };
}
