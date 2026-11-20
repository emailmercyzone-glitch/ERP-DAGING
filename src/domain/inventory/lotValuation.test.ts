import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLotStock,
  adjustLotStockToPhysical,
  consumeLotStock,
  getLotCarryingValueRupiah,
  restoreLotStock,
} from './lotValuation';

const importedLot = {
  id: 'LOT-EXACT',
  code: 'LOT-EXACT',
  product: 'Daging',
  productId: 'PROD-1',
  daysLeft: 20,
  expiryDate: '2027-01-01',
  weightGram: 7500,
  maxCapacityGram: 10000,
  hppKgRupiah: 133333,
  carryingValueRupiah: 1000001,
  loc: 'FREEZER-A',
  isFefo: false,
  isQuarantined: false,
};

test('exact carrying value is conserved across partial and final FEFO consumption', () => {
  const first = consumeLotStock(importedLot, 2500);
  assert.equal(first.cogsRupiah, 333334);
  assert.equal(first.lot.weightGram, 5000);
  assert.equal(first.lot.carryingValueRupiah, 666667);

  const final = consumeLotStock(first.lot, 5000);
  assert.equal(final.cogsRupiah, 666667);
  assert.equal(final.lot.weightGram, 0);
  assert.equal(final.lot.carryingValueRupiah, 0);
  assert.equal(first.cogsRupiah + final.cogsRupiah, importedLot.carryingValueRupiah);
});

test('legacy lots derive a safe integer carrying value without floating point storage', () => {
  const legacy = { ...importedLot, carryingValueRupiah: undefined };
  const value = getLotCarryingValueRupiah(legacy);
  assert.equal(value, 999998);
  const consumed = consumeLotStock(legacy, 7500);
  assert.equal(consumed.cogsRupiah, value);
  assert.equal(consumed.lot.carryingValueRupiah, 0);
});

test('void/reversal restores the exact value removed by the original allocation', () => {
  const consumed = consumeLotStock(importedLot, 2500);
  const restored = restoreLotStock(consumed.lot, 2500, consumed.cogsRupiah);
  assert.equal(restored.weightGram, importedLot.weightGram);
  assert.equal(restored.carryingValueRupiah, importedLot.carryingValueRupiah);
});

test('stock opname removes exact carrying value and uses integer HPP for additions', () => {
  const reduced = adjustLotStockToPhysical(importedLot, 2500);
  assert.equal(reduced.valueDeltaRupiah, -666667);
  assert.equal(reduced.lot.carryingValueRupiah, 333334);

  const zeroed = adjustLotStockToPhysical(importedLot, 0);
  assert.equal(zeroed.valueDeltaRupiah, -1000001);
  assert.equal(zeroed.lot.carryingValueRupiah, 0);

  const increased = adjustLotStockToPhysical(importedLot, 8500);
  assert.equal(increased.valueDeltaRupiah, 133333);
  assert.equal(increased.lot.carryingValueRupiah, 1133334);
});

test('conversion output can be merged without losing exact lot value', () => {
  const merged = addLotStock(importedLot, 2500, 250000);
  assert.equal(merged.weightGram, 10000);
  assert.equal(merged.carryingValueRupiah, 1250001);
  assert.equal(merged.hppKgRupiah, 125000);
});

test('lot valuation rejects fractional, negative, and overdrawn quantities', () => {
  assert.throws(() => consumeLotStock(importedLot, 0), RangeError);
  assert.throws(() => consumeLotStock(importedLot, 7501), RangeError);
  assert.throws(() => adjustLotStockToPhysical(importedLot, 1.5), RangeError);
  assert.throws(() => restoreLotStock(importedLot, 100, -1), RangeError);
});
