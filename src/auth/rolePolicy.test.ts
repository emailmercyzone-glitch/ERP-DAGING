import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeLocalOutboxEvent, hasPendingSalesOutboxForDifferentIdentity, canAccessPrimaryTab, canAccessSecondaryView, projectStateForRole, projectStateForUnauthenticated, sanitizeSalesStateForStorage } from './rolePolicy.ts';
import type { BusinessEngineState } from '../engine/types';

test('primary and secondary navigation follows the Owner/Admin/Sales matrix', () => {
  assert.equal(canAccessPrimaryTab('SALES', 'pos'), true);
  assert.equal(canAccessPrimaryTab('SALES', 'beli'), false);
  assert.equal(canAccessPrimaryTab('SALES', 'home'), false);
  assert.equal(canAccessSecondaryView('ADMIN', 'backup'), false);
  assert.equal(canAccessSecondaryView('ADMIN', 'jurnal'), true);
  assert.equal(canAccessSecondaryView('OWNER', 'backup'), true);
});

test('Admin local mutation boundary rejects void, approval, and returns above Rp500k', () => {
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'VOID' }).allowed, false);
  assert.equal(authorizeLocalOutboxEvent('OWNER', { entityType: 'UNRECOGNIZED_EVENT' as any }).allowed, false);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'UNRECOGNIZED_EVENT' as any }).allowed, false);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'PAYMENT', payload: { kind: 'SUPPLIER_PAYABLE_PAYMENT' } }).allowed, false);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'PAYMENT', payload: { kind: 'RECEIVABLE_PAYMENT' } }).allowed, true);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'PAYMENT', payload: { kind: 'PETTY_CASH_OPEX' } }).allowed, true);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'APPROVAL' }).allowed, false);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'RETURN', payload: { estimatedRefundValue: 500001 } }).allowed, false);
  assert.equal(authorizeLocalOutboxEvent('ADMIN', { entityType: 'RETURN', payload: { estimatedRefundValue: 500000 } }).allowed, true);
});

test('Sales local mutation boundary requires session-bound salesId and permits only assigned workflow event types', () => {
  assert.equal(authorizeLocalOutboxEvent('SALES', { entityType: 'SALE', payload: { salesId: 'S-1' } }, 'S-1').allowed, true);
  assert.equal(authorizeLocalOutboxEvent('SALES', { entityType: 'SALE', payload: { salesId: 'S-2' } }, 'S-1').allowed, false);
  assert.equal(authorizeLocalOutboxEvent('SALES', { entityType: 'PURCHASE', payload: { salesId: 'S-1' } }, 'S-1').allowed, false);
  assert.equal(authorizeLocalOutboxEvent('SALES', { entityType: 'PAYMENT', payload: { salesId: 'S-1', kind: 'RECEIVABLE_PAYMENT' } }, 'S-1').allowed, true);
});

test('Sales local event policy rejects UMUM TEMPO and MIX while allowing cash or direct transfer', () => {
  for (const paymentMethod of ['CASH', 'TRANSFER']) {
    assert.equal(authorizeLocalOutboxEvent('SALES', { entityType: 'SALE', payload: { salesId: 'S-1', customerName: 'UMUM', paymentMethod } }, 'S-1').allowed, true);
  }
  for (const paymentMethod of ['TEMPO', 'MIX']) {
    assert.equal(authorizeLocalOutboxEvent('SALES', { entityType: 'SALE', payload: { salesId: 'S-1', customerName: 'UMUM', paymentMethod } }, 'S-1').allowed, false);
  }
});

test('Sales projection hides HPP, supplier and financial records and keeps only assigned customers', () => {
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-1', ownerPinHash: 'hash', ownerPinSalt: 'salt', ownerPin: '123456',
    cashInHandRupiah: 1000, bankBalanceRupiah: 2000, pettyCashSpentTodayRupiah: 300, supplierBankAccount: 'SECRET-ROOT',
    products: [{ id: 'P1', sku: 'P1', name: 'Produk', supplier: 'SECRET-SUPPLIER', purchaseCostRupiah: 999, basePricePerKg: 10, movingAvgHppPerKg: 7, tierPrices: { RETAIL: 10, HOREKA: 9, VIP: 8 }, category: 'A', stockGram: 1000, safetyStockGram: 100 }],
    lots: [{ id: 'L1', code: 'L1', product: 'Produk', daysLeft: 1, expiryDate: '2026-12-01', weightGram: 1000, maxCapacityGram: 1000, hppKgRupiah: 7, loc: 'A', isFefo: true, isQuarantined: false, supplierInvoice: 'SECRET-INVOICE' }],
    stockLedger: [{ uuid: 'LEDGER-1', idempotencyKey: 'KEY-1', timestamp: '2026-11-17T00:00:00.000Z', actorName: 'Supplier Staff', type: 'IN_PURCHASE', humanLabel: 'Pembelian dari Supplier Rahasia', productName: 'Produk', lotId: 'L1', lotCode: 'LOT-1', weightGramDelta: 1000, unitCostPerKg: 7, valueRupiahDelta: 7, movingAvgHppAfterKg: 7, referenceNo: 'INV-SUP-01', note: 'Supplier Rahasia' }],
    customers: [{ id: 'C1', code: 'C1', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1' }, { id: 'C2', code: 'C2', name: 'Other', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-2' }, { id: 'C3', code: 'C3', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-2' }, { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1' }],
    receivables: [{ id: 'R1', customer: 'Assigned', customerId: 'C1' }, { id: 'R2', customer: 'Assigned' }, { id: 'R-UMUM', customer: 'UMUM', customerId: 'CUST_UMUM' }], customerReturns: [{ id: 'RET-S1', invoiceNo: 'INV-UMUM-S1', customerId: 'CUST_UMUM' }, { id: 'RET-S2', invoiceNo: 'INV-UMUM-S2', customerId: 'CUST_UMUM' }], receivablePayments: [{ id: 'PAY-R1', recId: 'R1', invoice: 'INV-ASSIGNED', customerId: 'C1' }, { id: 'PAY-UMUM-S2', recId: 'R-UMUM', invoice: 'INV-UMUM-S2', customerId: 'CUST_UMUM' }], inboundPOs: [{ id: 'PO1' }], supplierInvoices: [{ id: 'SI1' }], transactions: [
      { uuid: 'TX-UMUM-S1', invoiceNumber: 'INV-UMUM-S1', customerId: 'CUST_UMUM', salesId: 'S-1', totalCogsRupiah: 10, grossProfitRupiah: 5, items: [], lotAllocations: [] },
      { uuid: 'TX-UMUM-S2', invoiceNumber: 'INV-UMUM-S2', customerId: 'CUST_UMUM', salesId: 'S-2', totalCogsRupiah: 10, grossProfitRupiah: 5, items: [], lotAllocations: [] },
    ], journals: [], auditTrail: [], approvals: [], processedIdempotencyKeys: [], lastUpdatedAt: '2026-11-17T00:00:00.000Z', salesProjectionReady: true, salesProjectionSalesId: 'S-1',
  } as unknown as BusinessEngineState;
  const projected = projectStateForRole(state, 'SALES', 'S-1');
  assert.equal(projected.customers.length, 2);
  assert.deepEqual(projected.customers.map((customer) => customer.id).sort(), ['C1', 'CUST_UMUM']);
  assert.deepEqual(projected.transactions.map((transaction) => transaction.uuid), ['TX-UMUM-S1']);
  assert.deepEqual(projected.receivables.map((item) => item.id), ['R1']);
  assert.deepEqual((projected.customerReturns ?? []).map((item) => item.id), ['RET-S1']);
  assert.deepEqual((projected.receivablePayments ?? []).map((item) => item.id), ['PAY-R1']);
  assert.equal(projected.products[0].movingAvgHppPerKg, 0);
  assert.equal(projected.lots[0].hppKgRupiah, 0);
  assert.deepEqual(projected.stockLedger, []);
  assert.equal(projected.cashInHandRupiah, 0);
  assert.equal(projected.inboundPOs.length, 0);
  assert.equal(projected.supplierInvoices.length, 0);
  assert.equal(projected.journals.length, 0);
  assert.equal(projected.ownerPinHash, '');
  assert.equal(projected.ownerPinSalt, '');
  assert.equal(projected.ownerPin, undefined);
  assert.equal('supplierBankAccount' in projected, false);
  assert.equal('supplier' in projected.products[0], false);
  assert.equal('purchaseCostRupiah' in projected.products[0], false);
  assert.equal('supplierInvoice' in projected.lots[0], false);
  assert.deepEqual(projected.remoteSyncConflicts, []);
});


test('unauthenticated UI projection exposes no business or financial records', () => {
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-1', ownerPinHash: 'hash', ownerPinSalt: 'salt',
    cashInHandRupiah: 1000, bankBalanceRupiah: 2000, pettyCashSpentTodayRupiah: 300,
    products: [{ id: 'P1' }], lots: [{ id: 'L1' }], customers: [{ id: 'C1' }],
    receivables: [{ id: 'R1' }], inboundPOs: [{ id: 'PO1' }], supplierInvoices: [{ id: 'SI1' }],
    transactions: [{ uuid: 'TX1' }], stockLedger: [{ uuid: 'LEDGER1' }], journals: [{ uuid: 'J1' }],
    auditTrail: [{ uuid: 'A1' }], approvals: [{ uuid: 'AP1' }], syncOutbox: [{ uuid: 'OUT1' }],
    processedIdempotencyKeys: ['KEY1'], lastUpdatedAt: '2026-11-17T00:00:00.000Z',
  } as unknown as BusinessEngineState;
  const projected = projectStateForUnauthenticated(state);
  for (const key of ['products','lots','customers','receivables','inboundPOs','supplierInvoices','transactions','stockLedger','journals','auditTrail','approvals','syncOutbox','processedIdempotencyKeys'] as const) {
    assert.deepEqual(projected[key], [], key);
  }
  assert.equal(projected.cashInHandRupiah, 0);
  assert.equal(projected.bankBalanceRupiah, 0);
  assert.equal(projected.ownerPinHash, '');
  assert.equal(projected.deviceId, 'DEV-1');
});


test('persisted Sales state retains only own outbox and redacts every cost field', () => {
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-S1', ownerPinHash: 'hash', ownerPinSalt: 'salt',
    cashInHandRupiah: 500000, bankBalanceRupiah: 900000, pettyCashSpentTodayRupiah: 20000,
    products: [{ id: 'P1', sku: 'P1', name: 'Produk', basePricePerKg: 100, movingAvgHppPerKg: 70, tierPrices: { RETAIL: 100, HOREKA: 90, VIP: 80 }, category: 'A', stockGram: 1000, safetyStockGram: 100 }],
    lots: [{ id: 'L1', code: 'L1', product: 'Produk', daysLeft: 1, expiryDate: '2026-12-01', weightGram: 1000, maxCapacityGram: 1000, hppKgRupiah: 70, loc: 'A', isFefo: true, isQuarantined: false }],
    customers: [{ id: 'C1', code: 'C1', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1' }],
    receivables: [], inboundPOs: [], supplierInvoices: [], transactions: [{ uuid: 'TX1', idempotencyKey: 'K1', invoiceNumber: 'INV-1', customerId: 'C1', salesId: 'S-1', items: [], lotAllocations: [] }], stockLedger: [], journals: [], auditTrail: [], approvals: [],
    syncOutbox: [
      { uuid: 'E1', idempotencyKey: 'K1', entityType: 'SALE', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'Invoice S1', payload: { salesId: 'S-1', customerId: 'C1', invoiceNumber: 'INV-1', totalCogsRupiah: 700, items: [{ movingAvgHppPerKg: 70, lineTotalRupiah: 1000 }], lotAllocations: [{ hppPerKg: 70, cogsRupiah: 700, weightGram: 1000 }] } },
      { uuid: 'E2', idempotencyKey: 'K2', entityType: 'SALE', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'Invoice S2', payload: { salesId: 'S-2' } },
      { uuid: 'E3', idempotencyKey: 'K3', entityType: 'PURCHASE', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'Supplier', payload: { salesId: 'S-1' } },
    ],
    processedIdempotencyKeys: ['K1'], salesProjectionReady: true, salesProjectionSalesId: 'S-1', lastUpdatedAt: '2026-11-17T00:00:00.000Z',
  } as unknown as BusinessEngineState;
  const safe = sanitizeSalesStateForStorage(state, 'S-1');
  assert.deepEqual(safe.syncOutbox.map((event) => event.idempotencyKey), ['K1']);
  assert.deepEqual(safe.processedIdempotencyKeys, ['K1']);
  const payload = safe.syncOutbox[0].payload as any;
  assert.equal('totalCogsRupiah' in payload, false);
  assert.equal('movingAvgHppPerKg' in payload.items[0], false);
  assert.equal('hppPerKg' in payload.lotAllocations[0], false);
  assert.equal('cogsRupiah' in payload.lotAllocations[0], false);
  assert.equal(safe.cashInHandRupiah, 0);
  assert.equal(safe.products[0].movingAvgHppPerKg, 0);
});


test('changing the authenticated Sales ID resets its cursor and prior projection before reuse', () => {
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-S1',
    cashInHandRupiah: 0, bankBalanceRupiah: 0, pettyCashSpentTodayRupiah: 0,
    products: [{ id: 'P1', sku: 'P1', name: 'Produk', basePricePerKg: 100, movingAvgHppPerKg: 70, tierPrices: { RETAIL: 100, HOREKA: 90, VIP: 80 }, category: 'A', stockGram: 1000, safetyStockGram: 0 }],
    lots: [{ id: 'L1', code: 'L1', product: 'Produk', daysLeft: 1, expiryDate: '2026-12-01', weightGram: 1000, maxCapacityGram: 1000, hppKgRupiah: 70, loc: 'A', isFefo: true, isQuarantined: false }],
    customers: [{ id: 'C1', code: 'C1', name: 'Sales One', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1' }],
    receivables: [], inboundPOs: [], supplierInvoices: [], transactions: [], stockLedger: [], journals: [], auditTrail: [], approvals: [],
    syncOutbox: [{ uuid: 'E1', idempotencyKey: 'OLD-S1', entityType: 'SALE', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'Old Sales', payload: { salesId: 'S-1' } }],
    processedIdempotencyKeys: ['OLD-REMOTE-S1', 'OLD-S1'],
    salesProjectionReady: true, salesProjectionSalesId: 'S-1', lastServerSeq: 900,
    salesProjectionBuild: undefined, lastUpdatedAt: '2026-11-17T00:00:00.000Z',
  } as unknown as BusinessEngineState;
  const safe = sanitizeSalesStateForStorage(state, 'S-2');
  assert.equal(safe.salesProjectionReady, false);
  assert.equal(safe.salesProjectionSalesId, 'S-2');
  assert.equal(safe.lastServerSeq, 0);
  assert.deepEqual(safe.products, []);
  assert.deepEqual(safe.customers, []);
  assert.deepEqual(safe.syncOutbox, []);
  assert.deepEqual(safe.processedIdempotencyKeys, []);
});


test('Sales device reassignment is blocked when previous identity still has offline outbox events', () => {
  const state = {
    salesProjectionSalesId: 'S-OLD',
    syncOutbox: [{
      uuid: 'SALE-OLD', idempotencyKey: 'SALE-OLD-KEY', entityType: 'SALE',
      createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'Offline sale',
      payload: { salesId: 'S-OLD' },
    }],
  } as unknown as BusinessEngineState;
  assert.equal(hasPendingSalesOutboxForDifferentIdentity(state, 'S-NEW'), true);
  assert.equal(hasPendingSalesOutboxForDifferentIdentity(state, 'S-OLD'), false);
  assert.equal(hasPendingSalesOutboxForDifferentIdentity({ ...state, syncOutbox: [] }, 'S-NEW'), false);
});


test('Sales persisted outbox drops same-salesId events for foreign customers and invoices', () => {
  const customer = (id: string, assignedSalesId: string) => ({
    id, code: id, name: id, tier: 'RETAIL', creditLimit: 0, currentReceivable: 0,
    termDays: 0, phone: '', address: '', assignedSalesId,
  });
  const transaction = (uuid: string, invoiceNumber: string, customerId: string, salesId: string) => ({
    uuid, idempotencyKey: uuid, invoiceNumber, timestamp: '2026-11-17T00:00:00.000Z',
    customerId, salesId, customerName: customerId, customerTier: 'RETAIL', paymentMethod: 'CASH',
    tempoDays: 0, totalWeightGram: 1000, subtotalRupiah: 1000, discountRupiah: 0,
    shippingFee: 0, isFreeShipping: false, grandTotalRupiah: 1000, cashTendered: 1000,
    changeRupiah: 0, status: 'COMPLETED', items: [], lotAllocations: [], totalCogsRupiah: 0,
    grossProfitRupiah: 1000,
  });
  const event = (uuid: string, entityType: string, payload: Record<string, unknown>) => ({
    uuid, idempotencyKey: uuid, entityType, createdAt: '2026-11-17T00:00:00.000Z',
    status: 'PENDING', summary: uuid, payload,
  });
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-S1', ownerPin: '123456',
    ownerPinHash: 'hash', ownerPinSalt: 'salt', cashInHandRupiah: 0,
    bankBalanceRupiah: 0, pettyCashSpentTodayRupiah: 0,
    products: [], lots: [], customers: [customer('C1', 'S-1'), customer('C2', 'S-2'), customer('CUST_UMUM', 'S-1')],
    receivables: [], inboundPOs: [], supplierInvoices: [],
    transactions: [transaction('TX-1', 'INV-1', 'C1', 'S-1')],
    stockLedger: [], journals: [], auditTrail: [], approvals: [],
    syncOutbox: [
      event('SALE-OWN', 'SALE', { salesId: 'S-1', customerId: 'C1', invoiceNumber: 'INV-1' }),
      event('SALE-FOREIGN-CUSTOMER', 'SALE', { salesId: 'S-1', customerId: 'C2' }),
      event('RETURN-OWN', 'RETURN', { salesId: 'S-1', invoiceNo: 'INV-1', customerId: 'C1', estimatedRefundValue: 100 }),
      event('RETURN-FOREIGN-INVOICE', 'RETURN', { salesId: 'S-1', invoiceNo: 'INV-OTHER', customerId: 'C1', estimatedRefundValue: 100 }),
      event('PAYMENT-OWN', 'PAYMENT', { salesId: 'S-1', kind: 'RECEIVABLE_PAYMENT', invoice: 'INV-1', amountRupiah: 100 }),
      event('PAYMENT-FOREIGN-INVOICE', 'PAYMENT', { salesId: 'S-1', kind: 'RECEIVABLE_PAYMENT', invoice: 'INV-OTHER', amountRupiah: 100 }),
    ],
    processedIdempotencyKeys: [], lastUpdatedAt: '2026-11-17T00:00:00.000Z',
    salesProjectionReady: true, salesProjectionSalesId: 'S-1',
  } as unknown as BusinessEngineState;
  const safe = sanitizeSalesStateForStorage(state, 'S-1');
  assert.deepEqual(safe.syncOutbox.map((item) => item.uuid), ['SALE-OWN', 'RETURN-OWN', 'PAYMENT-OWN']);
  assert.equal(safe.ownerPin, undefined);
});


test('Sales projection fails closed before bootstrap and strips unknown fields from persisted entities', () => {
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-S1', ownerPin: '123456',
    ownerPinHash: 'hash', ownerPinSalt: 'salt', cashInHandRupiah: 100,
    pettyCashSpentTodayRupiah: 10, supplierBankAccount: 'SECRET',
    products: [{ id: 'P1', sku: 'P1', name: 'Produk', basePricePerKg: 100, movingAvgHppPerKg: 70, tierPrices: { RETAIL: 100, HOREKA: 90, VIP: 80 }, category: 'A', stockGram: 1000, safetyStockGram: 0, supplier: 'SECRET' }],
    lots: [{ id: 'L1', code: 'L1', product: 'Produk', daysLeft: 1, expiryDate: '2026-12-01', weightGram: 1000, maxCapacityGram: 1000, hppKgRupiah: 70, loc: 'A', isFefo: true, isQuarantined: false, supplierInvoice: 'SECRET' }],
    customers: [{ id: 'C1', code: 'C1', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1', internalOwnerNote: 'SECRET' }],
    receivables: [], inboundPOs: [], supplierInvoices: [], transactions: [], stockLedger: [],
    journals: [], auditTrail: [], approvals: [], syncOutbox: [], processedIdempotencyKeys: [],
    lastUpdatedAt: '2026-11-17T00:00:00.000Z', salesProjectionReady: false, salesProjectionSalesId: 'S-1',
  } as unknown as BusinessEngineState;
  const projected = projectStateForRole(state, 'SALES', 'S-1');
  assert.deepEqual(projected.products, []);
  assert.deepEqual(projected.lots, []);
  assert.deepEqual(projected.customers, []);
  assert.equal(projected.ownerPin, undefined);
  assert.equal('supplierBankAccount' in projected, false);
  const persisted = sanitizeSalesStateForStorage(state, 'S-1');
  assert.deepEqual(persisted.products, []);
  assert.deepEqual(persisted.lots, []);
  assert.equal(persisted.ownerPin, undefined);
  assert.equal('supplierBankAccount' in persisted, false);

  const partialBuild = {
    snapshotId: 'SNAP-1',
    products: [{ id: 'P1', sku: 'P1', name: 'Produk', basePricePerKg: 100, movingAvgHppPerKg: 70, tierPrices: { RETAIL: 100, HOREKA: 90, VIP: 80 }, category: 'A', stockGram: 1000, safetyStockGram: 0, supplier: 'SECRET' }],
    lots: [{ id: 'L1', code: 'L1', product: 'Produk', daysLeft: 1, expiryDate: '2026-12-01', weightGram: 1000, maxCapacityGram: 1000, hppKgRupiah: 70, loc: 'A', isFefo: true, isQuarantined: false, supplierInvoice: 'SECRET' }],
    customers: [
      { id: 'C1', code: 'C1', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1', privateNote: 'SECRET' },
      { id: 'C2', code: 'C2', name: 'Other', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-2' },
    ],
    categories: [], bazarPromos: [],
    receivedParts: { products: [0], lots: [], customers: [0], categories: [], bazarPromos: [] },
    totalParts: { products: 1, lots: 1, customers: 1, categories: 1, bazarPromos: 1 },
  };
  const withPartialBuild = { ...state, salesProjectionBuild: partialBuild } as unknown as BusinessEngineState;
  const safePartialBuild = sanitizeSalesStateForStorage(withPartialBuild, 'S-1').salesProjectionBuild!;
  assert.equal('supplier' in safePartialBuild.products[0], false);
  assert.equal('supplierInvoice' in safePartialBuild.lots[0], false);
  assert.deepEqual(safePartialBuild.customers.map((customer) => customer.id), ['C1']);
  assert.equal('privateNote' in safePartialBuild.customers[0], false);
});


test('reassigned customers remain visible for historical invoices but cannot receive new Sales outbox events', () => {
  const state = {
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-S1', ownerPinHash: 'hash', ownerPinSalt: 'salt',
    cashInHandRupiah: 0, pettyCashSpentTodayRupiah: 0,
    products: [], lots: [],
    customers: [{ id: 'C1', code: 'C1', name: 'Customer 1', tier: 'RETAIL', creditLimit: 0, currentReceivable: 1000, termDays: 0, phone: '', address: '', assignedSalesId: 'S-2' }],
    receivables: [{ id: 'REC-1', customer: 'Customer 1', customerId: 'C1', tier: 'RETAIL', amount: 1000, limit: 1000, dueDate: '2026-11-18', category: 'HARI_INI', daysDiff: 0, invoice: 'INV-1', itemsSummary: 'Daging', phone: '', status: 'BELUM_LUNAS' }],
    inboundPOs: [], supplierInvoices: [],
    transactions: [{
      uuid: 'TX-1', idempotencyKey: 'SALE-KEY', invoiceNumber: 'INV-1', timestamp: '2026-11-17T00:00:00.000Z',
      customerId: 'C1', salesId: 'S-1', customerName: 'Customer 1', customerTier: 'RETAIL',
      paymentMethod: 'TEMPO', tempoDays: 1, totalWeightGram: 1000, subtotalRupiah: 1000,
      shippingFee: 0, isFreeShipping: false, grandTotalRupiah: 1000, totalCogsRupiah: 100,
      grossProfitRupiah: 900, status: 'COMPLETED', items: [], lotAllocations: [],
    }],
    customerReturns: [], receivablePayments: [], stockLedger: [], journals: [], auditTrail: [], approvals: [],
    syncOutbox: [
      { uuid: 'SALE-NEW', idempotencyKey: 'SALE-NEW-KEY', entityType: 'SALE', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'new sale', payload: { salesId: 'S-1', customerId: 'C1', invoiceNumber: 'INV-2' } },
      { uuid: 'SALE-OLD-PENDING', idempotencyKey: 'SALE-OLD-PENDING-KEY', entityType: 'SALE', createdAt: '2026-11-17T00:00:00.000Z', status: 'FAILED', summary: 'offline sale retry', payload: { salesId: 'S-1', customerId: 'C1', invoiceNumber: 'INV-1' } },
      { uuid: 'RETURN-OLD', idempotencyKey: 'RETURN-OLD-KEY', entityType: 'RETURN', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'old invoice return', payload: { salesId: 'S-1', customerId: 'C1', invoiceNo: 'INV-1', estimatedRefundValue: 100 } },
      { uuid: 'PAYMENT-OLD', idempotencyKey: 'PAYMENT-OLD-KEY', entityType: 'PAYMENT', createdAt: '2026-11-17T00:00:00.000Z', status: 'PENDING', summary: 'old invoice payment', payload: { salesId: 'S-1', customerId: 'C1', invoice: 'INV-1', kind: 'RECEIVABLE_PAYMENT', amountRupiah: 100, paymentMethod: 'CASH' } },
    ],
    processedIdempotencyKeys: [], lastUpdatedAt: '2026-11-17T00:00:00.000Z',
    salesProjectionReady: true, salesProjectionSalesId: 'S-1',
  } as unknown as BusinessEngineState;
  const projected = projectStateForRole(state, 'SALES', 'S-1');
  assert.deepEqual(projected.customers.map((customer) => customer.id), ['C1']);
  assert.equal(projected.customers[0].assignedSalesId, 'S-2');
  assert.deepEqual(projected.transactions.map((transaction) => transaction.invoiceNumber), ['INV-1']);
  assert.deepEqual(projected.receivables.map((receivable) => receivable.invoice), ['INV-1']);

  const persisted = sanitizeSalesStateForStorage(state, 'S-1');
  assert.deepEqual(persisted.syncOutbox.map((item) => item.uuid), ['SALE-OLD-PENDING', 'RETURN-OLD', 'PAYMENT-OLD']);
});
