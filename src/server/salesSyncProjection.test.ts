import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeSalesMedia,
  authorizeSalesSyncEvent,
  buildSalesOwnershipIndex,
  projectSalesPullRecord,
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
  serverSeq: 2, entityType: 'SALE', uuid: 'SALE-1', idempotencyKey: 'SALE-1',
  payload: {
    salesId: 'S-1', invoiceNumber: 'INV-1', customerId: 'C1',
    receivable: { id: 'REC-1' }, totalCogsRupiah: 700,
    items: [{ productId: 'P1', movingAvgHppPerKg: 70, lineTotalRupiah: 1000 }],
    lotAllocations: [{ lotId: 'L1', hppPerKg: 70, cogsRupiah: 700, weightGram: 1000 }],
  },
};
const returned = {
  serverSeq: 3, entityType: 'RETURN', uuid: 'RET-1', idempotencyKey: 'RET-1',
  payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', evidenceMediaId: 'MEDIA-1', estimatedRefundValue: 1000 },
};
const index = buildSalesOwnershipIndex([master, sale, returned]);

test('Sales push authorization checks authoritative customer and invoice ownership', () => {
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'SALE', payload: { salesId: 'S-1', customerId: 'C1', invoiceNumber: 'INV-2', paymentMethod: 'CASH' },
  }, 'S-1', index).allowed, true);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'SALE', payload: { salesId: 'S-1', customerId: 'C2', invoiceNumber: 'INV-2', paymentMethod: 'CASH' },
  }, 'S-1', index).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'SALE', payload: { salesId: 'S-1', customerId: 'CUST_UMUM', invoiceNumber: 'INV-2', paymentMethod: 'TEMPO' },
  }, 'S-1', index).allowed, false);
});

test('Sales return and receivable payment must belong to the Sales invoice', () => {
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', estimatedRefundValue: 500000 },
  }, 'S-1', index).allowed, true);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'RETURN', payload: { salesId: 'S-1', invoiceNo: 'INV-OTHER', customerId: 'C1', estimatedRefundValue: 1000 },
  }, 'S-1', index).allowed, false);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-1', amountRupiah: 500 },
  }, 'S-1', index).allowed, true);
  assert.equal(authorizeSalesSyncEvent({
    entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT', salesId: 'S-1', invoice: 'INV-1', recId: 'REC-OTHER', amountRupiah: 500 },
  }, 'S-1', index).allowed, false);
});

test('Sales media access is bound to the Sales-owned return invoice', () => {
  assert.equal(authorizeSalesMedia('MEDIA-1', 'S-1', index), true);
  assert.equal(authorizeSalesMedia('MEDIA-1', 'S-2', index), false);
  assert.equal(authorizeSalesMedia('MEDIA-UNKNOWN', 'S-1', index), false);
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
