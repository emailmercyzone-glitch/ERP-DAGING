import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateConsignmentReturnAdjustment } from './consignmentReturns';
import type { BatchLotEntity, ConsignmentPayableRecord, LotAllocationRecord } from '../../engine/types';

const lot: BatchLotEntity = {
  id: 'LOT-CONSIGN-RET', code: 'LOT-CONSIGN-RET', product: 'Ribeye Konsinyasi',
  productId: 'PROD-CONSIGN-RET', daysLeft: 40, expiryDate: '2027-01-31',
  weightGram: 2_500, maxCapacityGram: 30_000, hppKgRupiah: 0,
  carryingValueRupiah: 0, ownershipType: 'CONSIGNMENT',
  consignmentOwnerName: 'Pemilik A', consignmentSetorPerKgRupiah: 130_000,
  loc: 'FREEZER-A-01', isFefo: false, isQuarantined: false,
};
const allocation: LotAllocationRecord = {
  lotId: lot.id, lotCode: lot.code, productId: lot.productId,
  productName: lot.product, weightGram: 2_500, hppPerKg: 0,
  cogsRupiah: 0, carryingValueRupiah: 0, ownershipType: 'CONSIGNMENT',
  consignmentSetorPerKgRupiah: 130_000, consignmentPayableRupiah: 325_000,
};
const payable: ConsignmentPayableRecord = {
  id: 'AP-CONSIGN-RET', idempotencyKey: 'SALE-CONSIGN-RET',
  invoiceNo: 'INV-CONSIGN-RET', lotId: lot.id, lotCode: lot.code,
  ownerName: 'Pemilik A', weightGram: 2_500, setorPerKgRupiah: 130_000,
  amountRupiah: 325_000, paidAmountRupiah: 0, remainingAmountRupiah: 325_000,
  status: 'UNPAID', createdAt: '2026-11-20T00:00:00.000Z',
};

test('Consignment return reduces payable cumulatively without rounding drift', () => {
  const first = calculateConsignmentReturnAdjustment({
    invoiceNo: payable.invoiceNo, productId: lot.productId!, soldWeightGram: 2_500,
    priorReturnedGram: 0, returnWeightGram: 1_000,
    allocations: [allocation], lots: [lot], payables: [payable],
  });
  assert.equal(first.ok, true);
  assert.equal(first.isConsignment, true);
  assert.equal(first.totalPayableReversalRupiah, 130_000);
  assert.equal(first.updatedPayables[0].remainingAmountRupiah, 195_000);
  assert.equal(first.updatedPayables[0].status, 'PARTIAL');

  const second = calculateConsignmentReturnAdjustment({
    invoiceNo: payable.invoiceNo, productId: lot.productId!, soldWeightGram: 2_500,
    priorReturnedGram: 1_000, returnWeightGram: 1_500,
    allocations: [allocation], lots: [lot], payables: first.updatedPayables,
  });
  assert.equal(second.ok, true);
  assert.equal(second.totalPayableReversalRupiah, 195_000);
  assert.equal(second.updatedPayables[0].remainingAmountRupiah, 0);
  assert.equal(second.updatedPayables[0].status, 'VOIDED');
});

test('Consignment return is held after any owner settlement', () => {
  const paid = { ...payable, paidAmountRupiah: 50_000, remainingAmountRupiah: 275_000, status: 'PARTIAL' as const };
  const result = calculateConsignmentReturnAdjustment({
    invoiceNo: payable.invoiceNo, productId: lot.productId!, soldWeightGram: 2_500,
    priorReturnedGram: 0, returnWeightGram: 500,
    allocations: [allocation], lots: [lot], payables: [paid],
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /sudah dibayar/);
});

test('Mixed OWN and CONSIGNMENT sale allocation is held for Owner review', () => {
  const ownLot = { ...lot, id: 'LOT-OWN-RET', code: 'LOT-OWN-RET', ownershipType: 'OWN' as const };
  const ownAllocation = { ...allocation, lotId: ownLot.id, lotCode: ownLot.code, weightGram: 1_000, ownershipType: 'OWN' as const };
  const mixedConsignmentAllocation = { ...allocation, weightGram: 1_500, consignmentPayableRupiah: 195_000 };
  const result = calculateConsignmentReturnAdjustment({
    invoiceNo: payable.invoiceNo, productId: lot.productId!, soldWeightGram: 2_500,
    priorReturnedGram: 0, returnWeightGram: 500,
    allocations: [ownAllocation, mixedConsignmentAllocation], lots: [ownLot, lot], payables: [payable],
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /campuran/);
});
