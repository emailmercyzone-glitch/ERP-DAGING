export type SalePayloadIntegrityError = string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeIntegerMoney(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isRequiredText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Shared domain invariant for SALE events. Used by both local pull reducers and
 * server-side Sales ownership authorization; GAS mirrors the same contract.
 * HPP/COGS fields are intentionally not required because Sales projections redact them.
 */
export function validateSalePayload(payloadValue: unknown): SalePayloadIntegrityError {
  if (!isRecord(payloadValue)) return 'Payload penjualan harus berupa objek.';
  const payload = payloadValue;
  const moneyKeys = ['subtotalRupiah', 'discountRupiah', 'shippingFee', 'grandTotalRupiah', 'paidAmountRupiah', 'balanceDueRupiah'] as const;
  for (const key of moneyKeys) {
    if (!isSafeIntegerMoney(payload[key])) return `Nominal ${key} harus berupa integer Rupiah aman non-negatif.`;
  }
  if (!Number.isSafeInteger(payload.totalWeightGram) || Number(payload.totalWeightGram) <= 0) {
    return 'totalWeightGram harus berupa integer Gram positif.';
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) return 'Rincian item penjualan wajib tersedia.';
  if (!Array.isArray(payload.lotAllocations) || payload.lotAllocations.length === 0) return 'Alokasi lot penjualan wajib tersedia.';

  const itemWeights = new Map<string, number>();
  let itemWeightTotal = 0;
  let itemValueTotal = 0;
  for (const raw of payload.items) {
    if (!isRecord(raw) || !isRequiredText(raw.productId) ||
        !Number.isSafeInteger(raw.weightGram) || Number(raw.weightGram) <= 0 ||
        !isSafeIntegerMoney(raw.lineTotalRupiah)) {
      return 'Rincian item penjualan mengandung produk, berat, atau nilai baris yang tidak valid.';
    }
    const productId = raw.productId.trim();
    itemWeights.set(productId, (itemWeights.get(productId) ?? 0) + Number(raw.weightGram));
    itemWeightTotal += Number(raw.weightGram);
    itemValueTotal += Number(raw.lineTotalRupiah);
  }
  if (!Number.isSafeInteger(itemWeightTotal) || itemWeightTotal !== payload.totalWeightGram) {
    return 'Total berat faktur tidak sama dengan jumlah berat item.';
  }
  if (!Number.isSafeInteger(itemValueTotal) || itemValueTotal !== payload.subtotalRupiah) {
    return 'Subtotal faktur tidak sama dengan jumlah nilai item.';
  }

  const allocatedWeights = new Map<string, number>();
  let allocatedTotal = 0;
  for (const raw of payload.lotAllocations) {
    if (!isRecord(raw) || !isRequiredText(raw.lotId) || !isRequiredText(raw.productId) ||
        !Number.isSafeInteger(raw.weightGram) || Number(raw.weightGram) <= 0) {
      return 'Alokasi lot mengandung ID lot, produk, atau berat yang tidak valid.';
    }
    const productId = raw.productId.trim();
    allocatedWeights.set(productId, (allocatedWeights.get(productId) ?? 0) + Number(raw.weightGram));
    allocatedTotal += Number(raw.weightGram);
  }
  if (!Number.isSafeInteger(allocatedTotal) || allocatedTotal !== payload.totalWeightGram ||
      allocatedWeights.size !== itemWeights.size ||
      [...itemWeights].some(([productId, grams]) => allocatedWeights.get(productId) !== grams)) {
    return 'Total alokasi lot per produk tidak sama dengan berat item faktur.';
  }

  const subtotal = Number(payload.subtotalRupiah);
  const discount = Number(payload.discountRupiah);
  const shipping = Number(payload.shippingFee);
  const total = Number(payload.grandTotalRupiah);
  const paid = Number(payload.paidAmountRupiah);
  const due = Number(payload.balanceDueRupiah);
  if (discount > subtotal || subtotal - discount + shipping !== total || paid + due !== total) {
    return 'Subtotal, diskon, ongkir, total faktur, pembayaran, dan sisa piutang tidak saling rekonsiliasi.';
  }

  const breakdown = payload.paymentBreakdown;
  if (!isRecord(breakdown) ||
      !isSafeIntegerMoney(breakdown.cashPaidRupiah) ||
      !isSafeIntegerMoney(breakdown.transferPaidRupiah) ||
      !isSafeIntegerMoney(breakdown.receivableRupiah) ||
      Number(breakdown.cashPaidRupiah) + Number(breakdown.transferPaidRupiah) + Number(breakdown.receivableRupiah) !== total ||
      Number(breakdown.cashPaidRupiah) + Number(breakdown.transferPaidRupiah) !== paid ||
      Number(breakdown.receivableRupiah) !== due) {
    return 'Rincian CASH/TRANSFER/TEMPO tidak sama dengan total pembayaran dan piutang faktur.';
  }

  const method = typeof payload.paymentMethod === 'string' ? payload.paymentMethod.trim().toUpperCase() : '';
  const cash = Number(breakdown.cashPaidRupiah);
  const transfer = Number(breakdown.transferPaidRupiah);
  const receivable = Number(breakdown.receivableRupiah);
  if (!['CASH', 'TRANSFER', 'TEMPO', 'MIX'].includes(method)) return 'Metode pembayaran faktur tidak valid.';
  if ((method === 'CASH' && (cash !== total || transfer !== 0 || receivable !== 0)) ||
      (method === 'TRANSFER' && (transfer !== total || cash !== 0 || receivable !== 0)) ||
      (method === 'TEMPO' && (receivable !== total || cash !== 0 || transfer !== 0)) ||
      (method === 'MIX' && [cash, transfer, receivable].filter((value) => value > 0).length < 2)) {
    return 'Komposisi pembayaran tidak sesuai metode pembayaran faktur.';
  }

  const invoiceReceivable = isRecord(payload.receivable) ? payload.receivable : undefined;
  if (due > 0) {
    if (!invoiceReceivable || !isRequiredText(invoiceReceivable.id) ||
        Number(invoiceReceivable.amount) !== due ||
        (invoiceReceivable.invoice !== undefined && invoiceReceivable.invoice !== payload.invoiceNumber)) {
      return 'Data piutang faktur tidak sama dengan sisa tagihan.';
    }
  } else if (invoiceReceivable && Number(invoiceReceivable.amount) > 0) {
    return 'Faktur lunas tidak boleh membawa saldo piutang positif.';
  }
  return undefined;
}
