import type { BusinessEngineState, SyncOutboxItem } from '../engine/types';

export type AccessRole = 'OWNER' | 'ADMIN' | 'SALES';
export type PrimaryTabId = 'home' | 'pos' | 'beli' | 'warehouse' | 'bayar';
export type SecondaryViewId = 'laporan' | 'approval' | 'jurnal' | 'audit' | 'backup' | 'pajak' | 'pengaturan';

const PRIMARY_ACCESS: Record<AccessRole, ReadonlySet<PrimaryTabId>> = {
  OWNER: new Set(['home', 'pos', 'beli', 'warehouse', 'bayar']),
  ADMIN: new Set(['home', 'pos', 'beli', 'warehouse', 'bayar']),
  SALES: new Set(['pos', 'warehouse', 'bayar']),
};

const SECONDARY_ACCESS: Record<AccessRole, ReadonlySet<SecondaryViewId>> = {
  OWNER: new Set(['laporan', 'approval', 'jurnal', 'audit', 'backup', 'pajak', 'pengaturan']),
  ADMIN: new Set(['laporan', 'jurnal', 'audit', 'pajak', 'pengaturan']),
  SALES: new Set(),
};

export function canAccessPrimaryTab(role: AccessRole, tab: PrimaryTabId): boolean {
  return PRIMARY_ACCESS[role].has(tab);
}

export function canAccessSecondaryView(role: AccessRole, view: SecondaryViewId): boolean {
  return SECONDARY_ACCESS[role].has(view);
}

/** Enforce the same role event boundary before a local mutation is committed. */
export function authorizeLocalOutboxEvent(
  role: AccessRole,
  event: Pick<SyncOutboxItem, 'entityType' | 'payload'>,
  authenticatedSalesId?: string
): { allowed: boolean; reason?: string } {
  const payload = event.payload ?? {};
  if (role === 'OWNER') return { allowed: true };

  if (role === 'ADMIN') {
    if (event.entityType === 'RETURN') {
      const refund = payload.estimatedRefundValue;
      return Number.isSafeInteger(refund) && Number(refund) >= 0 && Number(refund) <= 500000
        ? { allowed: true }
        : { allowed: false, reason: 'Admin hanya dapat mencatat retur sampai Rp500.000.' };
    }
    if (event.entityType === 'VOID' || event.entityType === 'APPROVAL') {
      return { allowed: false, reason: 'Mutasi ini hanya dapat dilakukan Owner.' };
    }
    if (event.entityType === 'PAYMENT' && payload.kind !== 'RECEIVABLE_PAYMENT') {
      return { allowed: false, reason: 'Admin hanya dapat menerima pembayaran piutang; pembayaran supplier memerlukan Owner.' };
    }
    return { allowed: true };
  }

  if (!authenticatedSalesId || payload.salesId !== authenticatedSalesId) {
    return { allowed: false, reason: 'Identitas Sales pada mutasi tidak sesuai dengan session.' };
  }
  if (event.entityType === 'SALE') return { allowed: true };
  if (event.entityType === 'RETURN') {
    const refund = payload.estimatedRefundValue;
    return Number.isSafeInteger(refund) && Number(refund) >= 0 && Number(refund) <= 500000
      ? { allowed: true }
      : { allowed: false, reason: 'Sales hanya dapat mencatat retur sampai Rp500.000.' };
  }
  if (event.entityType === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') return { allowed: true };
  return { allowed: false, reason: 'Role Sales tidak memiliki izin untuk mutasi ini.' };
}

/**
 * Sales projection is a read-only view model. It removes supplier/financial
 * collections and all HPP/cost fields while retaining operational stock.
 * The authoritative engine state must never be replaced with this projection.
 */
export function projectStateForRole(state: BusinessEngineState, role: AccessRole, salesId?: string): BusinessEngineState {
  if (role !== 'SALES') return state;
  const assignedCustomerIds = new Set(state.customers
    .filter((customer) => customer.assignedSalesId === salesId)
    .map((customer) => customer.id));
  const assignedCustomerNames = new Set(state.customers
    .filter((customer) => assignedCustomerIds.has(customer.id))
    .map((customer) => customer.name));
  const assignedTransactions = state.transactions
    .filter((transaction) => transaction.salesId === salesId && assignedCustomerIds.has(transaction.customerId));
  const saleIds = new Set(assignedTransactions.map((transaction) => transaction.uuid));
  const invoiceNumbers = new Set(assignedTransactions.map((transaction) => transaction.invoiceNumber));
  const assignedReceivableIds = new Set(state.receivables
    .filter((receivable) => receivable.customerId
      ? assignedCustomerIds.has(receivable.customerId)
      : assignedCustomerNames.has(receivable.customer))
    .map((receivable) => receivable.id));
  return {
    ...state,
    cashInHandRupiah: 0,
    bankBalanceRupiah: 0,
    pettyCashSpentTodayRupiah: 0,
    products: state.products.map((product) => ({ ...product, movingAvgHppPerKg: 0 })),
    lots: state.lots.map((lot) => ({ ...lot, hppKgRupiah: 0 })),
    customers: state.customers.filter((customer) => assignedCustomerIds.has(customer.id)),
    receivables: state.receivables.filter((receivable) => assignedReceivableIds.has(receivable.id)),
    transactions: assignedTransactions.map((transaction) => ({
      ...transaction,
      totalCogsRupiah: 0,
      grossProfitRupiah: 0,
      items: transaction.items.map((item) => ({ ...item, movingAvgHppPerKg: 0 })),
      lotAllocations: transaction.lotAllocations.map((allocation) => ({
        ...allocation,
        hppPerKg: 0,
        cogsRupiah: 0,
      })),
      remoteStockAppliedAllocations: undefined,
    })),
    customerReturns: (state.customerReturns ?? []).filter((item) => invoiceNumbers.has(item.invoiceNo) || assignedCustomerIds.has(item.customerId)),
    receivablePayments: (state.receivablePayments ?? []).filter((payment) =>
      (payment.customerId && assignedCustomerIds.has(payment.customerId)) || assignedReceivableIds.has(payment.recId)
    ),
    inboundPOs: [],
    supplierInvoices: [],
    stockLedger: state.stockLedger.map((entry) => ({
      ...entry,
      unitCostPerKg: 0,
      valueRupiahDelta: 0,
      movingAvgHppAfterKg: 0,
    })),
    journals: [],
    approvals: [],
    auditTrail: [],
    suppliers: [],
    supplierPhones: {},
    remoteSyncEvents: [],
    syncOutbox: [],
  };
}
