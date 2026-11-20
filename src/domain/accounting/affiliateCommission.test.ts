import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAffiliateCommission } from './affiliateCommission';
import type { ProductEntity } from '../../engine/types';

const product = (patch: Partial<ProductEntity>): ProductEntity => ({
  id: 'AFF-1', sku: 'AFF-1', name: 'Produk Digital Affiliate',
  basePricePerKg: 0, stockGram: 0, movingAvgHppPerKg: 0,
  category: 'OTHER', minStockKg: 0,
  supplyType: 'AFFILIATE', affiliatePartner: 'Partner A',
  affiliateCommissionType: 'PERSEN', affiliateCommissionValue: 1000,
  ...patch,
});

test('Affiliate percentage uses basis points against gross reference value', () => {
  const result = calculateAffiliateCommission(product({}), { grossReferenceRupiah: 1_250_000 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.commissionRupiah, 125_000);
});

test('Affiliate fixed per-KG commission uses integer Gram arithmetic', () => {
  const result = calculateAffiliateCommission(product({
    affiliateCommissionType: 'NOMINAL_PER_KG', affiliateCommissionValue: 25_000,
  }), { weightGram: 2_500 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.commissionRupiah, 62_500);
});

test('Affiliate fixed per-Pcs commission uses integer Pcs arithmetic', () => {
  const result = calculateAffiliateCommission(product({
    affiliateCommissionType: 'NOMINAL_PER_PCS', affiliateCommissionValue: 4_000,
  }), { pcs: 7 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.commissionRupiah, 28_000);
});

test('Affiliate calculation rejects missing configuration and unsafe amounts', () => {
  assert.equal(calculateAffiliateCommission(product({ affiliatePartner: '' }), { grossReferenceRupiah: 100_000 }).ok, false);
  assert.equal(calculateAffiliateCommission(product({ affiliateCommissionValue: 10001 }), { grossReferenceRupiah: 100_000 }).ok, false);
  assert.equal(calculateAffiliateCommission(product({}), { grossReferenceRupiah: Number.MAX_SAFE_INTEGER }).ok, false);
});
