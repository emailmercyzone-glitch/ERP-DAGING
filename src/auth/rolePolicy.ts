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
  const knownEntityTypes = new Set(['SALE', 'PURCHASE', 'OPNAME', 'CONVERSION', 'RETURN', 'PAYMENT', 'VOID', 'APPROVAL', 'MASTER_DATA']);
  if (!knownEntityTypes.has(event.entityType)) {
    return { allowed: false, reason: 'Jenis event tidak dikenal dan ditolak secara default.' };
  }
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
    if (event.entityType === 'PAYMENT' && payload.kind !== 'RECEIVABLE_PAYMENT' && payload.kind !== 'PETTY_CASH_OPEX') {
      return { allowed: false, reason: 'Admin hanya dapat menerima pembayaran piutang; pembayaran supplier memerlukan Owner.' };
    }
    const adminAllowed = new Set(['SALE', 'PURCHASE', 'OPNAME', 'CONVERSION', 'PAYMENT', 'MASTER_DATA']);
    if (adminAllowed.has(event.entityType)) return { allowed: true };
    return { allowed: false, reason: 'Role Admin tidak memiliki izin untuk mutasi ini.' };
  }

  if (!authenticatedSalesId || payload.salesId !== authenticatedSalesId) {
    return { allowed: false, reason: 'Identitas Sales pada mutasi tidak sesuai dengan session.' };
  }
  if (event.entityType === 'SALE') {
    const customerName = typeof payload.customerName === 'string' ? payload.customerName.trim().toLocaleUpperCase('id-ID') : '';
    const customerCode = typeof payload.customerCode === 'string' ? payload.customerCode.trim().toLocaleUpperCase('id-ID') : '';
    const isUmum = customerName === 'UMUM' || customerCode === 'UMUM' || payload.customerId === 'CUST_UMUM';
    if (isUmum && payload.paymentMethod !== 'CASH' && payload.paymentMethod !== 'TRANSFER') {
      return { allowed: false, reason: 'Pelanggan UMUM hanya mendukung pembayaran CASH atau TRANSFER langsung; TEMPO dan MIX ditolak.' };
    }
    return { allowed: true };
  }
  if (event.entityType === 'RETURN') {
    const refund = payload.estimatedRefundValue;
    return Number.isSafeInteger(refund) && Number(refund) >= 0 && Number(refund) <= 500000
      ? { allowed: true }
      : { allowed: false, reason: 'Sales hanya dapat mencatat retur sampai Rp500.000.' };
  }
  if (event.entityType === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') return { allowed: true };
  return { allowed: false, reason: 'Role Sales tidak memiliki izin untuk mutasi ini.' };
}

const SALES_COST_FIELDS = new Set([
  'movingAvgHppPerKg', 'hppKgRupiah', 'hppPerKg', 'cogsRupiah', 'totalCogsRupiah',
  'grossProfitRupiah', 'unitCostPerKg', 'valueRupiahDelta', 'movingAvgHppAfterKg',
  'totalLandedCost', 'openingValue', 'totalRawCost', 'primaryNetCost',
  'tetelanValue', 'effectiveSteakHpp', 'secondaryHpp',
]);

function redactSalesCostFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSalesCostFields);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SALES_COST_FIELDS.has(key)) continue;
    result[key] = redactSalesCostFields(nested);
  }
  return result;
}

/** Persistable Sales state: safe operational projection plus only authorized, redacted pending events. */
export function sanitizeSalesStateForStorage(state: BusinessEngineState, salesId: string): BusinessEngineState {
  const projected = projectStateForRole(state, 'SALES', salesId);
  const syncOutbox = state.syncOutbox
    .filter((event) => authorizeLocalOutboxEvent('SALES', event, salesId).allowed)
    .map((event) => ({
      ...event,
      payload: redactSalesCostFields(event.payload ?? {}) as Record<string, unknown>,
    }));
  const allowedKeys = new Set([
    ...syncOutbox.map((event) => event.idempotencyKey),
    ...projected.transactions.map((transaction) => transaction.idempotencyKey),
    ...(projected.receivablePayments ?? []).map((payment) => payment.id),
  ]);
  const projectionReady = state.salesProjectionReady === true;
  return {
    ...projected,
    syncOutbox,
    processedIdempotencyKeys: state.salesProjectionReady === true || state.salesProjectionBuild ? state.processedIdempotencyKeys : state.processedIdempotencyKeys.filter((key) => allowedKeys.has(key)),
    salesProjectionReady: projectionReady,
    ...(projectionReady ? {} : {
      products: [],
      lots: [],
      customers: [],
      receivables: [],
      transactions: [],
      stockLedger: [],
      customerReturns: [],
      receivablePayments: [],
      categories: [],
      bazarPromos: [],
    }),
  };
}

/** Hide all business data until an authenticated role or explicit local-owner mode is known. */
export function projectStateForUnauthenticated(state: BusinessEngineState): BusinessEngineState {
  return {
    ...state,
    ownerPin: undefined,
    ownerPinHash: '',
    ownerPinSalt: '',
    ownerPinNeedsChange: false,
    cashInHandRupiah: 0,
    bankBalanceRupiah: 0,
    pettyCashSpentTodayRupiah: 0,
    products: [],
    lots: [],
    customers: [],
    receivables: [],
    inboundPOs: [],
    supplierInvoices: [],
    transactions: [],
    stockLedger: [],
    journals: [],
    auditTrail: [],
    approvals: [],
    syncOutbox: [],
    processedIdempotencyKeys: [],
    customerReturns: [],
    receivablePayments: [],
    bazarPromos: [],
    categories: [],
    suppliers: [],
    supplierPhones: {},
    remoteSyncEvents: [],
    remoteSyncConflicts: [],
  };
}

/**
 * Sales projection is a read-only view model. It removes supplier/financial
 * collections and all HPP/cost fields while retaining operational stock.
 * The authoritative engine state must never be replaced with this projection.
 */
export function projectStateForRole(state: BusinessEngineState, role: AccessRole, salesId?: string): BusinessEngineState {
  if (role !== 'SALES') return state;
  const sharedUmumCustomers = state.customers.filter((customer) => {
    const name = customer.name.trim().toLocaleUpperCase('id-ID');
    const code = customer.code.trim().toLocaleUpperCase('id-ID');
    return name === 'UMUM' || code === 'UMUM' || customer.id.trim().toLocaleUpperCase('id-ID') === 'CUST_UMUM';
  });
  const sharedUmumIds = new Set(sharedUmumCustomers.map((customer) => customer.id));
  const assignedCustomerIds = new Set(state.customers
    .filter((customer) => customer.assignedSalesId === salesId && !sharedUmumIds.has(customer.id))
    .map((customer) => customer.id));
  const visibleCustomerIds = new Set([...assignedCustomerIds, ...sharedUmumIds]);
  const assignedTransactions = state.transactions
    .filter((transaction) => transaction.salesId === salesId && visibleCustomerIds.has(transaction.customerId));
  const saleIds = new Set(assignedTransactions.map((transaction) => transaction.uuid));
  const invoiceNumbers = new Set(assignedTransactions.map((transaction) => transaction.invoiceNumber));
  const assignedReceivableIds = new Set(state.receivables
    .filter((receivable) => {
      if (receivable.customerId) return assignedCustomerIds.has(receivable.customerId);
      const matches = state.customers.filter((customer) =>
        customer.name.trim().toLowerCase() === receivable.customer.trim().toLowerCase()
      );
      return matches.length === 1 && assignedCustomerIds.has(matches[0].id);
    })
    .map((receivable) => receivable.id));
  return {
    ...state,
    ownerPinHash: '',
    ownerPinSalt: '',
    ownerPinNeedsChange: false,
    cashInHandRupiah: 0,
    bankBalanceRupiah: 0,
    pettyCashSpentTodayRupiah: 0,
    products: state.products.map((product) => ({ ...product, movingAvgHppPerKg: 0 })),
    lots: state.lots.map((lot) => ({ ...lot, hppKgRupiah: 0 })),
    customers: state.customers.filter((customer) => visibleCustomerIds.has(customer.id)),
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
      actorName: '',
      humanLabel: entry.type,
      referenceNo: '',
      note: '',
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
    remoteSyncConflicts: [],
    syncOutbox: [],
  };
}
