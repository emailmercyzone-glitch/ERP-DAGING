import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeLocalOutboxEvent, canAccessPrimaryTab, canAccessSecondaryView, projectStateForRole } from './rolePolicy.ts';
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
    schemaVersion: 1, storeName: 'Toko', deviceId: 'DEV-1', ownerPinHash: 'hash', ownerPinSalt: 'salt',
    cashInHandRupiah: 1000, bankBalanceRupiah: 2000, pettyCashSpentTodayRupiah: 300,
    products: [{ id: 'P1', sku: 'P1', name: 'Produk', basePricePerKg: 10, movingAvgHppPerKg: 7, tierPrices: { RETAIL: 10, HOREKA: 9, VIP: 8 }, category: 'A', stockGram: 1000, safetyStockGram: 100 }],
    lots: [{ id: 'L1', code: 'L1', product: 'Produk', daysLeft: 1, expiryDate: '2026-12-01', weightGram: 1000, maxCapacityGram: 1000, hppKgRupiah: 7, loc: 'A', isFefo: true, isQuarantined: false }],
    stockLedger: [{ uuid: 'LEDGER-1', idempotencyKey: 'KEY-1', timestamp: '2026-11-17T00:00:00.000Z', actorName: 'Supplier Staff', type: 'IN_PURCHASE', humanLabel: 'Pembelian dari Supplier Rahasia', productName: 'Produk', lotId: 'L1', lotCode: 'LOT-1', weightGramDelta: 1000, unitCostPerKg: 7, valueRupiahDelta: 7, movingAvgHppAfterKg: 7, referenceNo: 'INV-SUP-01', note: 'Supplier Rahasia' }],
    customers: [{ id: 'C1', code: 'C1', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1' }, { id: 'C2', code: 'C2', name: 'Other', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-2' }, { id: 'C3', code: 'C3', name: 'Assigned', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-2' }, { id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM', tier: 'RETAIL', creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '', assignedSalesId: 'S-1' }],
    receivables: [{ id: 'R1', customer: 'Assigned', customerId: 'C1' }, { id: 'R2', customer: 'Assigned' }, { id: 'R-UMUM', customer: 'UMUM', customerId: 'CUST_UMUM' }], inboundPOs: [{ id: 'PO1' }], supplierInvoices: [{ id: 'SI1' }], transactions: [
      { uuid: 'TX-UMUM-S1', invoiceNumber: 'INV-UMUM-S1', customerId: 'CUST_UMUM', salesId: 'S-1', totalCogsRupiah: 10, grossProfitRupiah: 5, items: [], lotAllocations: [] },
      { uuid: 'TX-UMUM-S2', invoiceNumber: 'INV-UMUM-S2', customerId: 'CUST_UMUM', salesId: 'S-2', totalCogsRupiah: 10, grossProfitRupiah: 5, items: [], lotAllocations: [] },
    ], journals: [], auditTrail: [], approvals: [], processedIdempotencyKeys: [], lastUpdatedAt: '2026-11-17T00:00:00.000Z',
  } as unknown as BusinessEngineState;
  const projected = projectStateForRole(state, 'SALES', 'S-1');
  assert.equal(projected.customers.length, 2);
  assert.deepEqual(projected.customers.map((customer) => customer.id).sort(), ['C1', 'CUST_UMUM']);
  assert.deepEqual(projected.transactions.map((transaction) => transaction.uuid), ['TX-UMUM-S1']);
  assert.deepEqual(projected.receivables.map((item) => item.id), ['R1']);
  assert.equal(projected.products[0].movingAvgHppPerKg, 0);
  assert.equal(projected.lots[0].hppKgRupiah, 0);
  assert.equal(projected.stockLedger[0].unitCostPerKg, 0);
  assert.equal(projected.stockLedger[0].valueRupiahDelta, 0);
  assert.equal(projected.stockLedger[0].referenceNo, '');
  assert.equal(projected.stockLedger[0].note, '');
  assert.equal(projected.stockLedger[0].humanLabel, 'IN_PURCHASE');
  assert.equal(projected.cashInHandRupiah, 0);
  assert.equal(projected.inboundPOs.length, 0);
  assert.equal(projected.supplierInvoices.length, 0);
  assert.equal(projected.journals.length, 0);
  assert.equal(projected.ownerPinHash, '');
  assert.equal(projected.ownerPinSalt, '');
  assert.deepEqual(projected.remoteSyncConflicts, []);
});
