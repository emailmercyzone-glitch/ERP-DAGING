import type { ProductEntity } from '../../engine/types';

export interface AffiliateCommissionCalculationInput {
  grossReferenceRupiah?: number;
  weightGram?: number;
  pcs?: number;
}

export type AffiliateCommissionCalculation =
  | {
      ok: true;
      commissionType: 'PERSEN' | 'NOMINAL_PER_KG' | 'NOMINAL_PER_PCS';
      commissionValue: number;
      grossReferenceRupiah: number;
      weightGram: number;
      pcs: number;
      commissionRupiah: number;
    }
  | { ok: false; message: string };

/**
 * PERSEN is stored in basis points (1000 = 10%) and applies to the gross
 * reference amount after customer discounts. Fixed modes use IDR per KG/Pcs.
 */
export function calculateAffiliateCommission(
  product: ProductEntity,
  input: AffiliateCommissionCalculationInput
): AffiliateCommissionCalculation {
  if (product.supplyType !== 'AFFILIATE' || !product.affiliatePartner?.trim()) {
    return { ok: false, message: 'Produk belum dikonfigurasi sebagai Affiliate dengan partner yang valid.' };
  }
  const type = product.affiliateCommissionType;
  const value = product.affiliateCommissionValue;
  if (!type || !Number.isSafeInteger(value) || Number(value) <= 0) {
    return { ok: false, message: 'Jenis dan nilai komisi Affiliate belum dikonfigurasi dengan benar.' };
  }
  const gross = input.grossReferenceRupiah ?? 0;
  const weight = input.weightGram ?? 0;
  const pcs = input.pcs ?? 0;
  if (![gross, weight, pcs].every(Number.isSafeInteger) || gross < 0 || weight < 0 || pcs < 0) {
    return { ok: false, message: 'Nilai referensi, Gram, dan Pcs harus integer aman non-negatif.' };
  }
  let commissionRupiah = 0;
  if (type === 'PERSEN') {
    if (value > 10000 || gross <= 0) {
      return { ok: false, message: 'Komisi persen harus 1–100% dan membutuhkan nilai transaksi referensi positif.' };
    }
    commissionRupiah = Math.round((gross * value) / 10000);
  } else if (type === 'NOMINAL_PER_KG') {
    if (weight <= 0) return { ok: false, message: 'Komisi per KG membutuhkan berat Gram positif.' };
    commissionRupiah = Math.round((weight * value) / 1000);
  } else if (type === 'NOMINAL_PER_PCS') {
    if (pcs <= 0) return { ok: false, message: 'Komisi per Pcs membutuhkan jumlah Pcs positif.' };
    commissionRupiah = pcs * value;
  } else {
    return { ok: false, message: 'Jenis komisi Affiliate tidak dikenal.' };
  }
  if (!Number.isSafeInteger(commissionRupiah) || commissionRupiah <= 0) {
    return { ok: false, message: 'Hasil komisi Affiliate harus integer Rupiah positif dalam batas aman.' };
  }
  return {
    ok: true, commissionType: type, commissionValue: value,
    grossReferenceRupiah: gross, weightGram: weight, pcs,
    commissionRupiah,
  };
}
