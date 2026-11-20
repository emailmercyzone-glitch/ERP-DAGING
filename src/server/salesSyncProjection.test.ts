import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeSalesMedia,
  cloneSalesOwnershipIndex,
  authorizeSalesSyncEvent,
  buildSalesOwnershipIndex,
  projectSalesPullRecord,
  buildSalesPullPage,
} from './salesSyncProjection.ts';

const master = {
  serverSeq: 1, entityType: 'MASTER_DATA', uuid: 'MD-1', idempotencyKey: 'MD-1',
  payload: { kind: 'MASTER_DATA_PATCH', changes: { customers: [
    { id: 'C1', code: 'C1', name: 'Assigned One', assignedSalesId: 'S-1' },
    { id: 'C2', code: 'C2', name: 'Assigned Two', assignedSalesId: 'S-2' },
    { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM' },
  ] } },
};
const sale = {
  serverSeq: 2, entityType: 'SALE', uuid: 'SALE-1', idempotencyKey: 'SALE-1', createdAt: '2026-11-16T10:00:00.000Z',
  payload: {
    salesId: 'S-1', invoiceNumber: 'INV-1', customerId: 'C1',
    receivable: { id: 'REC-1', amount: 1000 }, totalCogsRupiah: 700,
    items: [{ productId: 'P1', weightGram: 1000, movingAvgHppPerKg: 70, lineTotalRupiah: 1000 }],
    lotAllocations: [{ lotId: 'L1', hppPerKg: 70, cogsRupiah: 700, weightGram: 1000 }],
  },
};
const returned = {
  serverSeq: 3, entityType: 'RETURN', uuid: 'RET-1', idempotencyKey: 'RET-1', createdAt: '2026-11-16T11:00:00.000Z',
  payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS', evidenceMediaId: 'MEDIA-1', estimatedRefundValue: 100 },
};
const index = buildSalesOwnershipIndex([master, sale, returned]);

const validCashSalePayload = {
  salesId: 'S-1', customerId: 'C1', invoiceNumber: 'INV-2', paymentMethod: 'CASH',
  totalWeightGram: 1000, subtotalRupiah: 1000, discountRupiah: 0, shippingFee: 0,
  grandTotalRupiah: 1000, paidAmountRupiah: 1000, balanceDueRupiah: 0,
  paymentBreakdown: { cashPaidRupiah: 1000, transferPaidRupiah: 0, receivableRupiah: 0 },
  items: [{ productId: 'P1', weightGram: 1000, lineTotalRupiah: 1000 }],
  lotAllocations: [{ lotId: 'L1', productId: 'P1', weightGram: 1000 }],
};

test('Sales push authorization checks authoritative customer ownership and reconciled invoice values', () => {
  assert.equal(authorizeSalesSyncEvent({ entityType: 'SALE', payload: { ...validCashSalePayload } }, 'S-1', index).allowed, true);
  assert.equal(authorizeSalesSyncEvent({ entityType: 'SALE', payload: { ...validCashSalePayload, customerId: 'C2' } }, 'S-1', index).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'SALE', payload: { ...validCashSalePayload, customerId: 'CUST_UMUM', paymentMethod: 'TEMPO' },
  }, 'S-1', index).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'SALE', payload: {
      ...validCashSalePayload, grandTotalRupiah: 900, paidAmountRupiah: 900,
      paymentBreakdown: { cashPaidRupiah: 900, transferPaidRupiah: 0, receivableRupiah: 0 },
    },
  }, 'S-1', index).allowed, false, 'grand total must reconcile with subtotal and discount');
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'SALE', payload: {
      ...validCashSalePayload, lotAllocations: [{ lotId: 'L1', productId: 'P1', weightGram: 900 }],
    },
  }, 'S-1', index).allowed, false, 'lot allocation weight must reconcile with sold items');
});

test('Sales return and receivable payment must belong to the Sales invoice and remaining balance', () => {
  const returnIndex = cloneSalesOwnershipIndex(index);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'RETURN', createdAt: '2026-11-16T11:00:00.000Z', payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100 },
  }, 'S-1', returnIndex).allowed, true);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-OTHER', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100 },
  }, 'S-1', cloneSalesOwnershipIndex(index)).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', paymentMethod: 'CASH', amountRupiah: 500 },
  }, 'S-1', cloneSalesOwnershipIndex(index)).allowed, true);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-OTHER', paymentMethod: 'CASH', amountRupiah: 500 },
  }, 'S-1', cloneSalesOwnershipIndex(index)).allowed, false);

  const paymentIndex = cloneSalesOwnershipIndex(index);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', paymentMethod: 'CASH', amountRupiah: 900 },
  }, 'S-1', paymentIndex).allowed, true);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', paymentMethod: 'CASH', amountRupiah: 200 },
  }, 'S-1', paymentIndex).allowed, false, 'payment cannot exceed the remaining receivable');
});


test('Sales return is rejected when event timestamp is outside the 24-hour invoice window', () => {
  const lateReturn = authorizeSalesSyncEvent({
    entityType: 'RETURN', createdAt: '2026-11-17T10:00:01.000Z',
    payload: {
      salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1',
      productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS',
      estimatedRefundValue: 100,
    },
  }, 'S-1', cloneSalesOwnershipIndex(index));
  assert.equal(lateReturn.allowed, false);
  assert.match(lateReturn.reason ?? '', /1x24 jam/);
});

test('Sales cannot collect payment or submit return against a voided invoice', () => {
  const voidedIndex = buildSalesOwnershipIndex([master, sale, returned, {
    serverSeq: 4, entityType: 'VOID', uuid: 'VOID-1', idempotencyKey: 'VOID-1',
    payload: { invoiceNumber: 'INV-1', transactionUuid: 'SALE-1' },
  }]);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', paymentMethod: 'CASH', amountRupiah: 100 },
  }, 'S-1', voidedIndex).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100 },
  }, 'S-1', voidedIndex).allowed, false);
});

test('Sales cannot forge an over-return, a different product, or an underfunded credit note', () => {
  const overReturn = authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 950, resolution: 'REFUND_KAS', estimatedRefundValue: 950 },
  }, 'S-1', cloneSalesOwnershipIndex(index));
  assert.equal(overReturn.allowed, false, 'prior return plus new return cannot exceed sold quantity');

  const wrongProduct = authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P-OTHER', weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100 },
  }, 'S-1', cloneSalesOwnershipIndex(index));
  assert.equal(wrongProduct.allowed, false);

  const creditIndex = cloneSalesOwnershipIndex(index);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', paymentMethod: 'CASH', amountRupiah: 950 },
  }, 'S-1', creditIndex).allowed, true);
  const underfundedCreditNote = authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'CREDIT_NOTE', estimatedRefundValue: 100 },
  }, 'S-1', creditIndex);
  assert.equal(underfundedCreditNote.allowed, false, 'credit note cannot exceed remaining invoice receivable');
});

test('Sales return media IDs cannot be reused across invoices or Sales identities', () => {
  const secondSale = {
    serverSeq: 10, entityType: 'SALE', uuid: 'SALE-2', idempotencyKey: 'SALE-2-KEY', createdAt: '2026-11-16T10:00:00.000Z',
    payload: {
      salesId: 'S-2', invoiceNumber: 'INV-2', customerId: 'C2',
      receivable: { id: 'REC-2', amount: 1000 },
      items: [{ productId: 'P1', weightGram: 1000, lineTotalRupiah: 1000 }],
      lotAllocations: [{ lotId: 'L2', lotCode: 'L2', productId: 'P1', productName: 'Daging', weightGram: 1000 }],
    },
  };
  const secondReturn = {
    serverSeq: 11, entityType: 'RETURN', uuid: 'RET-2', idempotencyKey: 'RET-2-KEY', createdAt: '2026-11-16T11:00:00.000Z',
    payload: {
      salesId: 'S-2', invoiceNo: 'INV-2', customerId: 'C2', productId: 'P1',
      weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100,
      evidenceMediaId: 'MEDIA-1',
    },
  };
  const collisionIndex = buildSalesOwnershipIndex([master, sale, returned, secondSale, secondReturn]);
  assert.equal(authorizeSalesMedia('MEDIA-1', 'S-1', collisionIndex), false);
  assert.equal(authorizeSalesMedia('MEDIA-1', 'S-2', collisionIndex), false);

  const working = cloneSalesOwnershipIndex(index);
  const collidingReturn = authorizeSalesSyncEvent({
    uuid: 'RET-COLLISION', idempotencyKey: 'RET-COLLISION-KEY', entityType: 'RETURN', createdAt: '2026-11-16T11:00:00.000Z',
    payload: {
      salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1',
      weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100,
      evidenceMediaId: 'MEDIA-1',
    },
  }, 'S-1', working);
  assert.equal(collidingReturn.allowed, false);
});

test('Sales media access is bound to the Sales-owned return invoice', () => {
  assert.equal(authorizeSalesMedia('MEDIA-1', 'S-1', index), true);
  assert.equal(authorizeSalesMedia('MEDIA-1', 'S-2', index), false);
  assert.equal(authorizeSalesMedia('MEDIA-UNKNOWN', 'S-1', index), false);
});

test('Sales invoice projection fail-closes on newly named nested cost and supplier fields', () => {
  const raw = {
    serverSeq: 40, entityType: 'SALE', uuid: 'SALE-SENSITIVE', idempotencyKey: 'SALE-SENSITIVE-KEY',
    payload: {
      salesId: 'S-1', invoiceNumber: 'INV-1', customerId: 'C1',
      items: [{
        productId: 'P1', weightGram: 1000, lineTotalRupiah: 1000,
        unitPurchaseCost: 700, profitRupiah: 300, marginPercent: 30,
        supplierName: 'Private Supplier', nested: { hppSnapshot: 700, landedCostUsd: 1 },
      }],
    },
  };
  const projection = projectSalesPullRecord(raw, 'S-1', index)!;
  const item = (projection.payload as any).items[0];
  assert.equal(item.lineTotalRupiah, 1000);
  for (const key of ['unitPurchaseCost', 'profitRupiah', 'marginPercent', 'supplierName']) {
    assert.equal(key in item, false, `must not expose ${key}`);
  }
  assert.deepEqual(item.nested, {});
});

test('Sales master-data projection filters customers and strips cost/supplier fields', () => {
  const record = {
    serverSeq: 4, entityType: 'MASTER_DATA', uuid: 'MD-2', idempotencyKey: 'MD-2',
    payload: { kind: 'MASTER_DATA_PATCH', changes: {
      products: [{ id: 'P1', sku: 'P1', name: 'Daging', basePricePerKg: 100, movingAvgHppPerKg: 70, stockGram: 1000, supplier: 'RAHASIA' }],
      lots: [{ id: 'L1', code: 'L1', product: 'Daging', weightGram: 1000, hppKgRupiah: 70 }],
      customers: [
        { id: 'C1', code: 'C1', name: 'Assigned One', assignedSalesId: 'S-1' },
        { id: 'C2', code: 'C2', name: 'Assigned Two', assignedSalesId: 'S-2' },
        { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM' },
      ],
      supplierInvoices: [{ id: 'SUP-1', supplier: 'RAHASIA' }],
    } },
  };
  const projected = projectSalesPullRecord(record, 'S-1', index)!;
  const changes = (projected.payload as any).changes;
  assert.deepEqual(changes.customers.map((row: any) => row.id), ['C1', 'CUST_UMUM']);
  assert.equal('movingAvgHppPerKg' in changes.products[0], false);
  assert.equal('supplier' in changes.products[0], false);
  assert.equal('hppKgRupiah' in changes.lots[0], false);
  assert.equal('supplierInvoices' in changes, false);
});

test('Sales event projection strips HPP/COGS and transforms purchase into safe stock delta', () => {
  const saleProjection = projectSalesPullRecord(sale, 'S-1', index)!;
  const salePayload = saleProjection.payload as any;
  assert.equal('totalCogsRupiah' in salePayload, false);
  assert.equal('movingAvgHppPerKg' in salePayload.items[0], false);
  assert.equal('hppPerKg' in salePayload.lotAllocations[0], false);
  assert.equal('cogsRupiah' in salePayload.lotAllocations[0], false);

  const otherSalesProjection = projectSalesPullRecord(sale, 'S-2', index)!;
  assert.equal(otherSalesProjection.entityType, 'SALES_STOCK');
  assert.equal((otherSalesProjection.payload as any).kind, 'SALE_STOCK_OUT');
  assert.deepEqual((otherSalesProjection.payload as any).lotAllocations.map((item: any) => item.lotId), ['L1']);
  assert.equal('invoiceNumber' in (otherSalesProjection.payload as any), false);
  assert.equal('customerId' in (otherSalesProjection.payload as any), false);

  const voidEvent = {
    serverSeq: 8, entityType: 'VOID', uuid: 'VOID-1', idempotencyKey: 'VOID-1-KEY',
    payload: { transactionUuid: 'SALE-1', invoiceNumber: 'INV-1', reason: 'alasan privat owner' },
  };
  const ownVoid = projectSalesPullRecord(voidEvent, 'S-1', index)!;
  assert.equal(ownVoid.entityType, 'SALES_VOID');
  assert.equal((ownVoid.payload as any).reason, 'Dibatalkan oleh Owner');
  const otherVoid = projectSalesPullRecord(voidEvent, 'S-2', index)!;
  assert.equal(otherVoid.entityType, 'SALES_STOCK');
  assert.equal((otherVoid.payload as any).kind, 'VOID_STOCK_IN');

  const purchaseProjection = projectSalesPullRecord({
    serverSeq: 5, entityType: 'PURCHASE', uuid: 'PUR-1', idempotencyKey: 'PUR-1',
    payload: { productId: 'P1', lotId: 'L2', lotCode: 'LOT-2', expiryDate: '2027-01-01', actualWeightGram: 5000, hppKgRupiah: 70, totalLandedCost: 350 },
  }, 'S-1', index)!;
  assert.equal(purchaseProjection.entityType, 'SALES_STOCK');
  assert.equal((purchaseProjection.payload as any).weightGram, 5000);
  assert.equal('hppKgRupiah' in (purchaseProjection.payload as any), false);
});


test('Opening Balance projection sends Sales only safe lot quantities, never carrying cost or supplier metadata', () => {
  const projection = projectSalesPullRecord({
    serverSeq: 99, entityType: 'OPNAME', uuid: 'OPENING-1', idempotencyKey: 'OPENING-1',
    payload: {
      kind: 'OPENING_BALANCE_IMPORT', referenceNo: 'CUTOVER-1',
      cashBalanceRupiah: 100000, bankBalanceRupiah: 200000,
      lots: [{
        id: 'LOT-1', code: 'LOT-1', product: 'Ribeye', productId: 'P1',
        daysLeft: 30, expiryDate: '2027-01-01', weightGram: 5000,
        maxCapacityGram: 10000, hppKgRupiah: 150000,
        carryingValueRupiah: 750000, supplierCode: 'SUP-SECRET',
        loc: 'FREEZER-A', isFefo: false, isQuarantined: false,
      }],
    },
  }, 'S-1', buildSalesOwnershipIndex([master]))!;
  assert.equal(projection.entityType, 'SALES_STOCK');
  const payload = projection.payload as any;
  assert.equal(payload.kind, 'OPENING_BALANCE_IMPORT');
  assert.equal(payload.lots.length, 1);
  assert.equal(payload.lots[0].weightGram, 5000);
  assert.equal('hppKgRupiah' in payload.lots[0], false);
  assert.equal('carryingValueRupiah' in payload.lots[0], false);
  assert.equal('supplierCode' in payload.lots[0], false);
  assert.equal('cashBalanceRupiah' in payload, false);
  assert.equal('bankBalanceRupiah' in payload, false);
});

test('Sales bootstrap projection emits only assigned customer rows and strips lot/product HPP', () => {
  const snapshotCustomerEvent = {
    serverSeq: 6, entityType: 'MASTER_DATA', uuid: 'SNAP-CUSTOMERS', idempotencyKey: 'SNAP-CUSTOMERS-KEY',
    payload: {
      kind: 'MASTER_DATA_PATCH', snapshot: true, snapshotId: 'SNAP-1',
      collection: 'customers', part: 0, totalParts: 1,
      changes: { customers: [
        { id: 'C1', code: 'C1', name: 'Assigned One', assignedSalesId: 'S-1', creditLimit: 0, currentReceivable: 0, tier: 'RETAIL', termDays: 0, phone: '', address: '' },
        { id: 'C2', code: 'C2', name: 'Assigned Two', assignedSalesId: 'S-2', creditLimit: 0, currentReceivable: 0, tier: 'RETAIL', termDays: 0, phone: '', address: '' },
        { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM', creditLimit: 0, currentReceivable: 0, tier: 'RETAIL', termDays: 0, phone: '', address: '' },
      ] },
    },
  };
  const snapshotIndex = buildSalesOwnershipIndex([snapshotCustomerEvent]);
  const projectedCustomers = projectSalesPullRecord(snapshotCustomerEvent, 'S-1', snapshotIndex)!;
  assert.equal(projectedCustomers.entityType, 'SALES_SNAPSHOT');
  assert.deepEqual((projectedCustomers.payload as any).rows.map((row: any) => row.id), ['C1', 'CUST_UMUM']);

  const productEvent = {
    serverSeq: 7, entityType: 'MASTER_DATA', uuid: 'SNAP-PRODUCTS', idempotencyKey: 'SNAP-PRODUCTS-KEY',
    payload: {
      kind: 'MASTER_DATA_PATCH', snapshot: true, snapshotId: 'SNAP-1',
      collection: 'products', part: 0, totalParts: 1,
      changes: { products: [{ id: 'P1', sku: 'P1', name: 'Daging', basePricePerKg: 100, movingAvgHppPerKg: 70, tierPrices: { RETAIL: 100, HOREKA: 90, VIP: 80 }, category: 'A', stockGram: 1000, safetyStockGram: 0 }] },
    },
  };
  const projectedProduct = projectSalesPullRecord(productEvent, 'S-1', snapshotIndex)!;
  assert.equal(projectedProduct.entityType, 'SALES_SNAPSHOT');
  assert.equal('movingAvgHppPerKg' in (projectedProduct.payload as any).rows[0], false);
});


test('Sales batch validation uses an isolated ownership index until upstream push succeeds', () => {
  const working = cloneSalesOwnershipIndex(index);
  const accepted = authorizeSalesSyncEvent({
    entityType: 'SALE',
    payload: { ...validCashSalePayload, invoiceNumber: 'INV-TEMP' },
  }, 'S-1', working);
  assert.equal(accepted.allowed, true);
  assert.equal(working.invoices.has('INV-TEMP'), true);
  assert.equal(index.invoices.has('INV-TEMP'), false, 'failed upstream push must not mutate the shared ownership cache');
});


test('Sales retries are accepted only when UUID, idempotency key and payload match exactly', () => {
  const working = cloneSalesOwnershipIndex(index);
  const saleRetry = {
    uuid: 'SALE-RETRY', idempotencyKey: 'SALE-RETRY-KEY', entityType: 'SALE', createdAt: '2026-11-16T10:00:00.000Z',
    payload: { ...validCashSalePayload, invoiceNumber: 'INV-RETRY' },
  };
  assert.equal(authorizeSalesSyncEvent(saleRetry, 'S-1', working).allowed, true);
  assert.equal(authorizeSalesSyncEvent(saleRetry, 'S-1', working).allowed, true, 'exact lost-response retry is idempotent');
  assert.equal(authorizeSalesSyncEvent({
    ...saleRetry, payload: { ...saleRetry.payload, grandTotalRupiah: 2000 },
  }, 'S-1', working).allowed, false, 'same key with changed payload is rejected');

  const returnRetry = {
    uuid: 'RETURN-RETRY', idempotencyKey: 'RETURN-RETRY-KEY', entityType: 'RETURN', createdAt: '2026-11-16T11:00:00.000Z',
    payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100 },
  };
  assert.equal(authorizeSalesSyncEvent(returnRetry, 'S-1', working).allowed, true);
  assert.equal(authorizeSalesSyncEvent(returnRetry, 'S-1', working).allowed, true, 'return retry does not double-count returned weight');
  assert.equal(authorizeSalesSyncEvent({
    ...returnRetry, payload: { ...returnRetry.payload, weightGram: 200, estimatedRefundValue: 200 },
  }, 'S-1', working).allowed, false);

  const paymentRetry = {
    uuid: 'PAYMENT-RETRY', idempotencyKey: 'PAYMENT-RETRY-KEY', entityType: 'PAYMENT',
    payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', paymentMethod: 'CASH', amountRupiah: 500 },
  };
  assert.equal(authorizeSalesSyncEvent(paymentRetry, 'S-1', working).allowed, true);
  assert.equal(authorizeSalesSyncEvent(paymentRetry, 'S-1', working).allowed, true, 'payment retry does not double-deduct receivable');
  assert.equal(authorizeSalesSyncEvent({
    ...paymentRetry, payload: { ...paymentRetry.payload, amountRupiah: 600 },
  }, 'S-1', working).allowed, false);
});


test('customer reassignment preserves original Sales invoice history but blocks new sales', () => {
  const reassignment = {
    serverSeq: 4, entityType: 'MASTER_DATA', uuid: 'MD-REASSIGN', idempotencyKey: 'MD-REASSIGN-KEY',
    payload: { kind: 'MASTER_DATA_PATCH', changes: { customers: [
      { id: 'C1', code: 'C1', name: 'Assigned One', assignedSalesId: 'S-2' },
    ] } },
  };
  const reassignedIndex = buildSalesOwnershipIndex([master, sale, returned, reassignment]);
  assert.equal(reassignedIndex.customerSales.get('C1'), 'S-2');
  assert.equal(reassignedIndex.salesCustomerHistory.get('S-1')?.has('C1'), true);

  const oldSalesProjection = projectSalesPullRecord(reassignment, 'S-1', reassignedIndex)!;
  const oldSalesCustomers = (oldSalesProjection.payload as any).changes.customers;
  assert.equal(oldSalesCustomers[0].assignedSalesId, 'S-2', 'original Sales receives current assignment so local POS blocks new sales');
  const newSalesProjection = projectSalesPullRecord(reassignment, 'S-2', reassignedIndex)!;
  assert.equal((newSalesProjection.payload as any).changes.customers[0].assignedSalesId, 'S-2');

  assert.equal(authorizeSalesSyncEvent({
    uuid: 'NEW-SALE-OLD-OWNER', idempotencyKey: 'NEW-SALE-OLD-OWNER-KEY', entityType: 'SALE',
    payload: { salesId: 'S-1', invoiceNumber: 'INV-NEW', customerId: 'C1', paymentMethod: 'CASH' },
  }, 'S-1', cloneSalesOwnershipIndex(reassignedIndex)).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    uuid: 'RETURN-OLD-OWNER', idempotencyKey: 'RETURN-OLD-OWNER-KEY', entityType: 'RETURN', createdAt: '2026-11-16T11:00:00.000Z',
    payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS', estimatedRefundValue: 100 },
  }, 'S-1', cloneSalesOwnershipIndex(reassignedIndex)).allowed, true, 'original Sales can still handle their historical invoice');
});


test('customer reassignment delta reaches a former Sales device even without historical invoices', () => {
  const firstAssignment = {
    serverSeq: 1, entityType: 'MASTER_DATA', uuid: 'MD-C3-S1', idempotencyKey: 'MD-C3-S1',
    payload: { kind: 'MASTER_DATA_PATCH', changes: { customers: [
      { id: 'C3', code: 'C3', name: 'Customer 3', assignedSalesId: 'S-1' },
    ] } },
  };
  const reassignment = {
    serverSeq: 2, entityType: 'MASTER_DATA', uuid: 'MD-C3-S2', idempotencyKey: 'MD-C3-S2',
    payload: { kind: 'MASTER_DATA_PATCH', changes: { customers: [
      { id: 'C3', code: 'C3', name: 'Customer 3', assignedSalesId: 'S-2' },
    ] } },
  };
  const reassignedIndex = buildSalesOwnershipIndex([firstAssignment, reassignment]);
  assert.equal(reassignedIndex.salesCustomerHistory.get('S-1'), undefined);
  const oldSalesDelta = projectSalesPullRecord(reassignment, 'S-1', reassignedIndex)!;
  const oldSalesPayload = oldSalesDelta.payload as any;
  assert.deepEqual(oldSalesPayload.removeCustomerIds, ['C3']);
  assert.deepEqual(oldSalesPayload.changes, {},
    'former Sales receives a customer tombstone ID, not the reassigned customer record');
  assert.equal(JSON.stringify(oldSalesPayload).includes('Customer 3'), false);
  assert.equal(JSON.stringify(oldSalesPayload).includes('08123456789'), false);

  const laterEdit = {
    serverSeq: 4, entityType: 'MASTER_DATA', uuid: 'MD-C3-PHONE', idempotencyKey: 'MD-C3-PHONE',
    payload: { kind: 'MASTER_DATA_PATCH', changes: { customers: [
      { id: 'C3', code: 'C3', name: 'Customer 3', phone: '08123456789', assignedSalesId: 'S-2' },
    ] } },
  };
  const formerSalesLaterEdit = projectSalesPullRecord(laterEdit, 'S-1', reassignedIndex);
  assert.equal(formerSalesLaterEdit, null, 'former Sales receives no later edits to the reassigned customer');

  const snapshot = {
    serverSeq: 3, entityType: 'MASTER_DATA', uuid: 'SNAP-CUSTOMERS-C3', idempotencyKey: 'SNAP-CUSTOMERS-C3',
    payload: { kind: 'MASTER_DATA_PATCH', snapshot: true, snapshotId: 'SNAP-C3', collection: 'customers', part: 0, totalParts: 1,
      changes: { customers: [{ id: 'C3', code: 'C3', name: 'Customer 3', assignedSalesId: 'S-2' }] } },
  };
  const oldSalesSnapshot = projectSalesPullRecord(snapshot, 'S-1', reassignedIndex)!;
  assert.deepEqual((oldSalesSnapshot.payload as any).rows, [], 'newly provisioned old Sales devices do not receive customers already reassigned away');
});


test('Sales pull pagination advances over filtered raw events without skipping later stock deltas', () => {
  const records = [
    { serverSeq: 1, deviceId: 'DEVICE-S1', entityType: 'SALE', uuid: 'OWN-1', idempotencyKey: 'OWN-1', payload: { salesId: 'S-1', invoiceNumber: 'INV-OWN', customerId: 'C1', items: [{ productId: 'P1', weightGram: 100, lineTotalRupiah: 100 }], lotAllocations: [{ lotId: 'L1', weightGram: 100 }] } },
    { serverSeq: 2, deviceId: 'DEVICE-OTHER', entityType: 'UNSUPPORTED', uuid: 'SKIP-2', idempotencyKey: 'SKIP-2', payload: {} },
    { serverSeq: 3, deviceId: 'DEVICE-OTHER', entityType: 'UNSUPPORTED', uuid: 'SKIP-3', idempotencyKey: 'SKIP-3', payload: {} },
    { serverSeq: 4, deviceId: 'DEVICE-OTHER', entityType: 'SALE', uuid: 'SALE-S2', idempotencyKey: 'SALE-S2', payload: { salesId: 'S-2', invoiceNumber: 'INV-S2', customerId: 'C2', items: [{ productId: 'P1', weightGram: 250, lineTotalRupiah: 500 }], lotAllocations: [{ lotId: 'L1', weightGram: 250 }] } },
    { serverSeq: 5, deviceId: 'DEVICE-OTHER', entityType: 'SALE', uuid: 'SALE-S1', idempotencyKey: 'SALE-S1', payload: { salesId: 'S-1', invoiceNumber: 'INV-S1', customerId: 'C1', items: [{ productId: 'P1', weightGram: 100, lineTotalRupiah: 200 }], lotAllocations: [{ lotId: 'L1', weightGram: 100 }] } },
  ];
  const ownership = buildSalesOwnershipIndex([master, ...records]);
  const first = buildSalesPullPage(records, 0, 'DEVICE-S1', 'S-1', ownership, 5, 2);
  assert.deepEqual(first.records, [], 'first raw page may contain only own-device or unsupported events');
  assert.equal(first.lastServerSeq, 3, 'cursor advances to the last raw event examined, not the last projected event');

  const second = buildSalesPullPage(records, first.lastServerSeq, 'DEVICE-S1', 'S-1', ownership, 5, 2);
  assert.equal(second.lastServerSeq, 5);
  assert.equal(second.records.length, 2);
  assert.equal(second.records[0].entityType, 'SALES_STOCK');
  assert.equal((second.records[0].payload as any).kind, 'SALE_STOCK_OUT');
  assert.equal('invoiceNumber' in (second.records[0].payload as any), false);
  assert.equal(second.records[1].entityType, 'SALE');
  assert.equal((second.records[1].payload as any).invoiceNumber, 'INV-S1');
});
