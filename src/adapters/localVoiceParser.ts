import type { VoiceParseAdapterResult, VoiceParseContext, VoiceParseItemResult } from './backendAdapter';

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractWeightGram(transcript: string, productName: string): number {
  const normalizedName = normalizeText(productName);
  const normalizedTranscript = normalizeText(transcript);
  const keyword = normalizedName.split(' ').filter((token) => token.length > 3).sort((a, b) => b.length - a.length).find((token) => normalizedTranscript.includes(token));
  if (!keyword) return 0;
  const position = normalizedTranscript.indexOf(keyword);
  if (position < 0) return 0;
  const segmentStart = Math.max(0, position - 30);
  const segment = normalizedTranscript.slice(segmentStart, Math.min(normalizedTranscript.length, position + keyword.length + 30));
  const pattern = /(setengah|\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|gram|gr|g)\b/gi;
  let match: RegExpExecArray | null;
  let closest: RegExpExecArray | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  while ((match = pattern.exec(segment)) !== null) {
    const distance = Math.abs(segmentStart + match.index - position);
    if (distance < closestDistance) {
      closest = match;
      closestDistance = distance;
    }
  }
  if (!closest) return 0;
  const quantity = closest[1].toLowerCase() === 'setengah' ? 0.5 : Number(closest[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const unit = closest[2].toLowerCase();
  const grams = ['gram', 'gr', 'g'].includes(unit) ? quantity : quantity * 1000;
  const rounded = Math.round(grams);
  return Number.isSafeInteger(rounded) ? rounded : 0;
}

function matchProducts(transcript: string, context?: VoiceParseContext): VoiceParseItemResult[] {
  const catalog = Array.isArray(context?.products) ? context.products : [];
  const normalizedTranscript = normalizeText(transcript);
  const validCatalog = catalog.filter((product) => product &&
    typeof product.sku === 'string' && product.sku.trim() &&
    typeof product.name === 'string' && product.name.trim() &&
    Number.isSafeInteger(product.unitPriceRupiah) && product.unitPriceRupiah > 0);
  const candidates = validCatalog.map((product) => {
    const tokens = normalizeText(product.name).split(' ').filter((token) => token.length > 3);
    const matchedTokens = tokens.filter((token) => normalizedTranscript.includes(token));
    return { product, matchedTokens };
  }).filter((candidate) => candidate.matchedTokens.length > 0);

  if (candidates.length === 0) return [];
  const unambiguous = candidates.filter((candidate) => candidate.matchedTokens.some((token) =>
    validCatalog.filter((other) => normalizeText(other.name).split(' ').includes(token)).length === 1
  ));
  const selected = unambiguous.length > 0 ? unambiguous : candidates.length === 1 ? candidates : [];

  return selected.map(({ product }) => ({
    productSku: product.sku,
    productName: product.name,
    weightGram: extractWeightGram(transcript, product.name),
    quantityPcs: 1,
    unitPriceRupiah: product.unitPriceRupiah,
  }));
}

/** Deterministic parser that uses only the actual ERP master data supplied by the caller. */
export function parseIndonesianVoiceOrderLocally(transcript: string, context?: VoiceParseContext): VoiceParseAdapterResult {
  const clean = transcript.trim();
  const lower = normalizeText(clean);
  const items = matchProducts(clean, context);

  let customerName = 'Pelanggan Umum';
  const customers = Array.isArray(context?.customers) ? context.customers : [];
  const matchedCustomer = customers.find((customer) => customer &&
    typeof customer.name === 'string' && normalizeText(customer.name).length > 2 &&
    lower.includes(normalizeText(customer.name)));
  if (matchedCustomer) customerName = matchedCustomer.name;

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
  } else if (lower.includes('transfer') || lower.includes('tf')) {
    paymentMethod = 'TRANSFER';
  }

  const notes = items.length === 0
    ? 'Produk tidak cocok dengan katalog ERP. Pilih produk secara manual sebelum transaksi.'
    : items.some((item) => item.weightGram === 0)
      ? 'Produk cocok dengan katalog ERP, tetapi berat belum terbaca. Lengkapi berat sebelum transaksi.'
      : 'Draft lokal memakai data master ERP. Periksa pelanggan, berat, harga, dan metode pembayaran sebelum transaksi.';

  return {
    customerName,
    paymentMethod,
    tempoDays,
    notes: 'Diproses lokal dari ucapan: "' + clean + '"',
    confidenceScore: items.length === 0 ? 0.25 : items.every((item) => item.weightGram > 0) ? 0.78 : 0.55,
    source: 'local-nlp-engine',
    items,
  };
}
