import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeSyncEvent } from './erpAuth.ts';
import {
  authorizeSalesMedia,
  buildSalesPullPage,
  authorizeSalesSyncEvent,
  buildSalesOwnershipIndex,
  projectSalesPullRecord,
} from './salesSyncProjection.ts';

type Device = { id: string; role: 'OWNER' | 'ADMIN' | 'SALES'; salesId?: string };
const devices: Device[] = [
  { id: 'DEV-OWNER-01', role: 'OWNER' },
  { id: 'DEV-ADMIN-01', role: 'ADMIN' },
  { id: 'DEV-ADMIN-02', role: 'ADMIN' },
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `DEV-SALES-0${index + 1}`, role: 'SALES' as const, salesId: `SALES-${index + 1}`,
  })),
];

test('8-device acceptance harness: one Owner, two Admin, five isolated Sales identities', () => {
  assert.equal(devices.length, 8);
  assert.equal(devices.filter((device) => device.role === 'OWNER').length, 1);
  assert.equal(devices.filter((device) => device.role === 'ADMIN').length, 2);
  assert.equal(devices.filter((device) => device.role === 'SALES').length, 5);

  const master = {
    serverSeq: 1, deviceId: 'DEV-OWNER-01', entityType: 'MASTER_DATA', uuid: 'MASTER-SNAPSHOT',
    payload: { kind: 'MASTER_DATA_PATCH', snapshot: true, snapshotId: 'BOOTSTRAP-1', collection: 'customers', part: 0, totalParts: 1,
      changes: { customers: [
        ...Array.from({ length: 5 }, (_, index) => ({
          id: `CUSTOMER-${index + 1}`, code: `C-${index + 1}`, name: `Customer ${index + 1}`,
          assignedSalesId: `SALES-${index + 1}`,
        })),
        { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM' },
      ] } },
  };
  const ownership = buildSalesOwnershipIndex([master]);
  const serverLog: Array<Record<string, unknown>> = [master];
  const acceptedIdempotency = new Set<string>();
  let nextSeq = 2;

  const pushWhenReconnected = (device: Device, queued: Array<Record<string, unknown>>) => {
    assert.equal(device.role, 'SALES');
    const accepted: Array<Record<string, unknown>> = [];
    for (const event of queued) {
      const decision = authorizeSalesSyncEvent(event, device.salesId!, ownership);
      if (!decision.allowed) continue;
      const key = String(event.idempotencyKey || '');
      if (acceptedIdempotency.has(key)) continue;
      acceptedIdempotency.add(key);
      const stored = { ...event, deviceId: device.id, serverSeq: nextSeq++ };
      serverLog.push(stored);
      accepted.push(stored);
    }
    return accepted;
  };

  // All five Sales devices queue one sale while offline; reconnect pushes only their own assigned customer.
  const queuedSales = devices.filter((device) => device.role === 'SALES').map((device, index) => ({
    uuid: `SALE-EVENT-${index + 1}`,
    idempotencyKey: `SALE-IDEMPOTENCY-${index + 1}`,
    entityType: 'SALE',
    createdAt: '2026-11-19T10:00:00.000Z',
    payload: {
      salesId: device.salesId,
      invoiceNumber: `INV-SALES-${index + 1}`,
      customerId: `CUSTOMER-${index + 1}`,
      paymentMethod: 'CASH', totalWeightGram: 1000, subtotalRupiah: 100000, discountRupiah: 0, shippingFee: 0,
      grandTotalRupiah: 100000, paidAmountRupiah: 100000, balanceDueRupiah: 0,
      paymentBreakdown: { cashPaidRupiah: 100000, transferPaidRupiah: 0, receivableRupiah: 0 },
      totalCogsRupiah: 999999999,
      items: [{ productId: 'P1', productName: 'Daging', weightGram: 1000, lineTotalRupiah: 100000 }],
      lotAllocations: [{ lotId: `LOT-${index + 1}`, lotCode: `LOT-${index + 1}`, productId: 'P1', productName: 'Daging', weightGram: 1000 }],
    },
  }));
  const pushed = queuedSales.map((event, index) =>
    pushWhenReconnected(devices.filter((device) => device.role === 'SALES')[index], [event])
  );
  assert.equal(pushed.flat().length, 5);
  assert.equal(serverLog.filter((event) => event.entityType === 'SALE').length, 5);

  // Retry after a lost response is idempotent and cannot duplicate the transaction.
  const retry = pushWhenReconnected(devices[3], [queuedSales[0]]);
  assert.equal(retry.length, 0);
  assert.equal(serverLog.filter((event) => event.idempotencyKey === 'SALE-IDEMPOTENCY-1').length, 1);

  // A Sales identity cannot sell to another Sales' assigned customer or reuse an existing invoice.
  const crossCustomer = authorizeSalesSyncEvent({
    uuid: 'CROSS-CUSTOMER', idempotencyKey: 'CROSS-CUSTOMER-KEY', entityType: 'SALE',
    payload: { salesId: 'SALES-1', invoiceNumber: 'INV-CROSS', customerId: 'CUSTOMER-2', paymentMethod: 'CASH', totalWeightGram: 1000, subtotalRupiah: 100000, discountRupiah: 0, shippingFee: 0, grandTotalRupiah: 100000, paidAmountRupiah: 100000, balanceDueRupiah: 0, paymentBreakdown: { cashPaidRupiah: 100000, transferPaidRupiah: 0, receivableRupiah: 0 }, items: [{ productId: 'P1', weightGram: 1000, lineTotalRupiah: 100000 }], lotAllocations: [{ lotId: 'L1', productId: 'P1', weightGram: 1000 }] },
  }, 'SALES-1', ownership);
  assert.equal(crossCustomer.allowed, false);
  const duplicateInvoice = authorizeSalesSyncEvent({
    uuid: 'DUPLICATE-INVOICE', idempotencyKey: 'DUPLICATE-INVOICE-KEY', entityType: 'SALE',
    payload: { salesId: 'SALES-1', invoiceNumber: 'INV-SALES-1', customerId: 'CUSTOMER-1', paymentMethod: 'CASH', totalWeightGram: 1000, subtotalRupiah: 100000, discountRupiah: 0, shippingFee: 0, grandTotalRupiah: 100000, paidAmountRupiah: 100000, balanceDueRupiah: 0, paymentBreakdown: { cashPaidRupiah: 100000, transferPaidRupiah: 0, receivableRupiah: 0 }, items: [{ productId: 'P1', weightGram: 1000, lineTotalRupiah: 100000 }], lotAllocations: [{ lotId: 'L1', productId: 'P1', weightGram: 1000 }] },
  }, 'SALES-1', ownership);
  assert.equal(duplicateInvoice.allowed, false);

  // Return evidence is attached to the original invoice and can only be used by its Sales owner.
  const returnEvent = {
    uuid: 'RETURN-1', idempotencyKey: 'RETURN-1-KEY', entityType: 'RETURN', createdAt: '2026-11-19T11:00:00.000Z',
    payload: {
      salesId: 'SALES-1', invoiceNo: 'INV-SALES-1', customerId: 'CUSTOMER-1',
      productId: 'P1', weightGram: 100, resolution: 'REFUND_KAS',
      evidenceMediaId: 'MEDIA-RETURN-1', estimatedRefundValue: 10000,
    },
  };
  const returnAccepted = authorizeSalesSyncEvent(returnEvent, 'SALES-1', ownership);
  assert.equal(returnAccepted.allowed, true);
  assert.equal(authorizeSalesMedia('MEDIA-RETURN-1', 'SALES-1', ownership), true);
  assert.equal(authorizeSalesMedia('MEDIA-RETURN-1', 'SALES-2', ownership), false);
  assert.equal(authorizeSalesSyncEvent(returnEvent, 'SALES-2', ownership).allowed, false);

  // Pull projection never exposes another Sales' sale or any HPP/COGS field.
  const sales2Record = serverLog.find((event) => event.entityType === 'SALE' && (event.payload as any).salesId === 'SALES-2')!;
  const sales2StockDelta = projectSalesPullRecord(sales2Record, 'SALES-1', ownership)!;
  assert.equal(sales2StockDelta.entityType, 'SALES_STOCK');
  assert.equal((sales2StockDelta.payload as any).kind, 'SALE_STOCK_OUT');
  assert.equal('invoiceNumber' in (sales2StockDelta.payload as any), false);
  assert.equal('customerId' in (sales2StockDelta.payload as any), false);
  const sales1Record = serverLog.find((event) => event.entityType === 'SALE' && (event.payload as any).salesId === 'SALES-1')!;
  const projected = projectSalesPullRecord(sales1Record, 'SALES-1', ownership)!;
  const payload = projected.payload as any;
  assert.equal('totalCogsRupiah' in payload, false);
  assert.equal((payload as any).salesId, 'SALES-1');
});

test('8-device acceptance harness: cursor pagination advances across hidden events without data leakage', () => {
  const master = {
    serverSeq: 1, deviceId: 'DEV-OWNER-01', entityType: 'MASTER_DATA', uuid: 'MD',
    payload: { kind: 'MASTER_DATA_PATCH', changes: { customers: [
      { id: 'C1', code: 'C1', name: 'Customer 1', assignedSalesId: 'SALES-1' },
      { id: 'C2', code: 'C2', name: 'Customer 2', assignedSalesId: 'SALES-2' },
    ] } },
  };
  const sale2 = {
    serverSeq: 2, deviceId: 'DEV-SALES-02', entityType: 'SALE', uuid: 'SALE-S2',
    idempotencyKey: 'SALE-S2', payload: {
      salesId: 'SALES-2', invoiceNumber: 'INV-S2', customerId: 'C2',
      lotAllocations: [{ lotId: 'LOT-2', lotCode: 'LOT-2', productId: 'P1', productName: 'Daging', weightGram: 1000 }],
    },
  };
  const hiddenSalesEvents = Array.from({ length: 501 }, (_, index) => ({
    serverSeq: index + 3, deviceId: 'DEV-SALES-02', entityType: 'RETURN',
    uuid: `RET-S2-${index}`, idempotencyKey: `RET-S2-${index}`,
    payload: { salesId: 'SALES-2', invoiceNo: 'INV-S2', customerId: 'C2', estimatedRefundValue: 1000 },
  }));
  const ownDeviceEvent = {
    serverSeq: 504, deviceId: 'DEV-SALES-01', entityType: 'OPNAME', uuid: 'OWN-DEVICE-EVENT',
    idempotencyKey: 'OWN-DEVICE-EVENT', payload: { kind: 'STOCK_ADJUSTMENT', reason: 'private' },
  };
  const records = [master, sale2, ...hiddenSalesEvents, ownDeviceEvent];
  const ownership = buildSalesOwnershipIndex(records);
  const first = buildSalesPullPage(records, 0, 'DEV-SALES-01', 'SALES-1', ownership, 504, 500);
  assert.equal(first.lastServerSeq, 500);
  assert.equal(first.records.length, 2, 'master data and anonymized stock delta are visible');
  const second = buildSalesPullPage(records, first.lastServerSeq, 'DEV-SALES-01', 'SALES-1', ownership, 504, 500);
  assert.equal(second.lastServerSeq, 504, 'cursor advances across hidden events and the current device event');
  assert.equal(second.records.length, 0, 'other Sales return details remain hidden while cursor advances');
});


test('8-device acceptance harness: Owner and Admin devices follow their real event permission boundaries', () => {
  const owner = devices.find((device) => device.role === 'OWNER')!;
  const admins = devices.filter((device) => device.role === 'ADMIN');
  assert.equal(authorizeSyncEvent(owner.role, { entityType: 'VOID', payload: { transactionUuid: 'TX-1' } }).allowed, true);
  assert.equal(authorizeSyncEvent(owner.role, { entityType: 'APPROVAL', payload: { approvalUuid: 'AP-1' } }).allowed, true);
  assert.equal(admins.length, 2);
  for (const admin of admins) {
    assert.equal(authorizeSyncEvent(admin.role, { entityType: 'SALE', payload: {} }).allowed, true);
    assert.equal(authorizeSyncEvent(admin.role, { entityType: 'PURCHASE', payload: {} }).allowed, true);
    assert.equal(authorizeSyncEvent(admin.role, { entityType: 'VOID', payload: {} }).allowed, false);
    assert.equal(authorizeSyncEvent(admin.role, { entityType: 'APPROVAL', payload: {} }).allowed, false);
    assert.equal(authorizeSyncEvent(admin.role, { entityType: 'PAYMENT', payload: { kind: 'SUPPLIER_PAYMENT' } }).allowed, false);
    assert.equal(authorizeSyncEvent(admin.role, { entityType: 'RETURN', payload: { estimatedRefundValue: 500001 } }).allowed, false);
  }
});
