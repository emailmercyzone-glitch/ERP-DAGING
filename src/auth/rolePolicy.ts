import type { BusinessEngineState, SyncOutboxItem, ProductEntity, BatchLotEntity, CustomerEntity, ReceivableEntity, SalesTransactionRecord, CustomerReturnRecord, ReceivablePaymentRecord, ProductCategoryEntity, BazarPromoEntity, SalesProjectionSnapshotBuild } from '../engine/types';

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

/** Prevent reassignment from silently discarding pending events owned by the previous Sales identity. */
export function hasPendingSalesOutboxForDifferentIdentity(state: BusinessEngineState, salesId: string): boolean {
  return state.syncOutbox.some((item) => {
    const eventSalesId = typeof item.payload?.salesId === 'string'
      ? item.payload.salesId
      : state.salesProjectionSalesId;
    return Boolean(eventSalesId && eventSalesId !== salesId);
  });
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

function projectSalesProduct(product: ProductEntity): ProductEntity {
  return {
    id: product.id, sku: product.sku, name: product.name,
    basePricePerKg: product.basePricePerKg, movingAvgHppPerKg: 0,
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    ...(product.gallery ? { gallery: product.gallery.map((item) => ({ url: item.url, title: item.title, tag: item.tag })) } : {}),
    tierPrices: {
      RETAIL: product.tierPrices.RETAIL,
      HOREKA: product.tierPrices.HOREKA,
      VIP: product.tierPrices.VIP,
    },
    category: product.category, stockGram: product.stockGram,
    safetyStockGram: product.safetyStockGram,
    ...(product.tag ? { tag: product.tag } : {}),
    ...(product.alternativeId ? { alternativeId: product.alternativeId } : {}),
    ...(product.alternativeName ? { alternativeName: product.alternativeName } : {}),
    ...(product.alternativeReason ? { alternativeReason: product.alternativeReason } : {}),
  };
}

function projectSalesLot(lot: BatchLotEntity): BatchLotEntity {
  return {
    id: lot.id, code: lot.code, product: lot.product,
    ...(lot.productId ? { productId: lot.productId } : {}),
    daysLeft: lot.daysLeft, expiryDate: lot.expiryDate,
    weightGram: lot.weightGram, maxCapacityGram: lot.maxCapacityGram,
    hppKgRupiah: 0, loc: lot.loc, isFefo: lot.isFefo,
    isQuarantined: lot.isQuarantined,
  };
}

function projectSalesCustomer(customer: CustomerEntity): CustomerEntity {
  return {
    id: customer.id, code: customer.code, name: customer.name,
    tier: customer.tier, creditLimit: customer.creditLimit,
    currentReceivable: customer.currentReceivable, termDays: customer.termDays,
    phone: customer.phone, address: customer.address,
    ...(customer.assignedSalesId ? { assignedSalesId: customer.assignedSalesId } : {}),
  };
}

function projectSalesReceivable(receivable: ReceivableEntity): ReceivableEntity {
  return {
    id: receivable.id, customer: receivable.customer,
    ...(receivable.customerId ? { customerId: receivable.customerId } : {}),
    tier: receivable.tier, amount: receivable.amount, limit: receivable.limit,
    dueDate: receivable.dueDate, category: receivable.category,
    daysDiff: receivable.daysDiff, invoice: receivable.invoice,
    itemsSummary: receivable.itemsSummary, phone: receivable.phone,
    status: receivable.status,
  };
}

function projectSalesTransaction(transaction: SalesTransactionRecord): SalesTransactionRecord {
  return {
    uuid: transaction.uuid, idempotencyKey: transaction.idempotencyKey,
    invoiceNumber: transaction.invoiceNumber, timestamp: transaction.timestamp,
    customerId: transaction.customerId, ...(transaction.salesId ? { salesId: transaction.salesId } : {}),
    customerName: transaction.customerName, customerTier: transaction.customerTier,
    paymentMethod: transaction.paymentMethod,
    ...(transaction.paymentBreakdown ? { paymentBreakdown: {
      cashPaidRupiah: transaction.paymentBreakdown.cashPaidRupiah,
      transferPaidRupiah: transaction.paymentBreakdown.transferPaidRupiah,
      receivableRupiah: transaction.paymentBreakdown.receivableRupiah,
    } } : {}),
    tempoDays: transaction.tempoDays, totalWeightGram: transaction.totalWeightGram,
    subtotalRupiah: transaction.subtotalRupiah,
    ...(transaction.discountRupiah !== undefined ? { discountRupiah: transaction.discountRupiah } : {}),
    shippingFee: transaction.shippingFee, isFreeShipping: transaction.isFreeShipping,
    grandTotalRupiah: transaction.grandTotalRupiah,
    ...(transaction.paidAmountRupiah !== undefined ? { paidAmountRupiah: transaction.paidAmountRupiah } : {}),
    ...(transaction.cashTendered !== undefined ? { cashTendered: transaction.cashTendered } : {}),
    ...(transaction.changeRupiah !== undefined ? { changeRupiah: transaction.changeRupiah } : {}),
    ...(transaction.balanceDueRupiah !== undefined ? { balanceDueRupiah: transaction.balanceDueRupiah } : {}),
    totalCogsRupiah: 0, grossProfitRupiah: 0,
    status: transaction.status,
    ...(transaction.status === 'VOIDED' ? { voidReason: 'Dibatalkan oleh Owner' } : {}),
    items: transaction.items.map((item) => ({
      productId: item.productId, productName: item.productName,
      weightGram: item.weightGram, effectivePricePerKg: item.effectivePricePerKg,
      lineTotalRupiah: item.lineTotalRupiah, movingAvgHppPerKg: 0,
      ...(item.appliedPromoId ? { appliedPromoId: item.appliedPromoId } : {}),
    })),
    lotAllocations: transaction.lotAllocations.map((allocation) => ({
      lotId: allocation.lotId, lotCode: allocation.lotCode,
      ...(allocation.productId ? { productId: allocation.productId } : {}),
      ...(allocation.productName ? { productName: allocation.productName } : {}),
      weightGram: allocation.weightGram, hppPerKg: 0, cogsRupiah: 0,
    })),
    remoteStockAppliedAllocations: undefined,
  };
}

function isSharedSalesCustomer(customer: CustomerEntity): boolean {
  const name = customer.name.trim().toLocaleUpperCase('id-ID');
  const code = customer.code.trim().toLocaleUpperCase('id-ID');
  return name === 'UMUM' || code === 'UMUM' || customer.id.trim().toLocaleUpperCase('id-ID') === 'CUST_UMUM';
}

function projectSalesCategory(category: ProductCategoryEntity): ProductCategoryEntity {
  return {
    id: category.id, label: category.label,
    ...(category.description ? { description: category.description } : {}),
    color: category.color,
    ...(category.isCore !== undefined ? { isCore: category.isCore } : {}),
    ...(category.deletedAt !== undefined ? { deletedAt: category.deletedAt } : {}),
  };
}

function projectSalesPromo(promo: BazarPromoEntity): BazarPromoEntity {
  return {
    id: promo.id, sku: promo.sku, promoPricePerKg: promo.promoPricePerKg,
    startDate: promo.startDate, endDate: promo.endDate, quotaKg: promo.quotaKg,
    soldKg: promo.soldKg, isActive: promo.isActive, badgeLabel: promo.badgeLabel,
    ...(promo.title ? { title: promo.title } : {}),
    ...(promo.productName ? { productName: promo.productName } : {}),
    ...(promo.normalPricePerKg !== undefined ? { normalPricePerKg: promo.normalPricePerKg } : {}),
    ...(promo.discountRupiahPerKg !== undefined ? { discountRupiahPerKg: promo.discountRupiahPerKg } : {}),
    ...(promo.discountPercent !== undefined ? { discountPercent: promo.discountPercent } : {}),
  };
}

function projectSalesProjectionBuild(
  build: SalesProjectionSnapshotBuild,
  salesId: string
): SalesProjectionSnapshotBuild {
  return {
    snapshotId: build.snapshotId,
    products: build.products.map(projectSalesProduct),
    lots: build.lots.map(projectSalesLot),
    customers: build.customers
      .filter((customer) => customer.assignedSalesId === salesId || isSharedSalesCustomer(customer))
      .map(projectSalesCustomer),
    categories: build.categories.map(projectSalesCategory),
    bazarPromos: build.bazarPromos.map(projectSalesPromo),
    receivedParts: {
      products: [...build.receivedParts.products],
      lots: [...build.receivedParts.lots],
      customers: [...build.receivedParts.customers],
      categories: [...build.receivedParts.categories],
      bazarPromos: [...build.receivedParts.bazarPromos],
    },
    totalParts: { ...build.totalParts },
  };
}

/** Persistable Sales state: safe operational projection plus only authorized, redacted pending events. */
export function sanitizeSalesStateForStorage(state: BusinessEngineState, salesId: string): BusinessEngineState {
  const projected = projectStateForRole(state, 'SALES', salesId);
  const visibleCustomerIds = new Set(projected.customers.map((customer) => customer.id));
  const ownedInvoices = new Map(projected.transactions.map((transaction) => [
    transaction.invoiceNumber,
    { customerId: transaction.customerId, salesId: transaction.salesId },
  ]));
  const syncOutbox = state.syncOutbox
    .filter((event) => {
      if (!authorizeLocalOutboxEvent('SALES', event, salesId).allowed) return false;
      const payload = event.payload ?? {};
      if (event.entityType === 'SALE') {
        const customer = projected.customers.find((item) => item.id === payload.customerId);
        return Boolean(customer && (customer.assignedSalesId === salesId || isSharedSalesCustomer(customer)));
      }
      if (event.entityType === 'RETURN') {
        const invoice = typeof payload.invoiceNo === 'string' ? ownedInvoices.get(payload.invoiceNo) : undefined;
        return Boolean(invoice && invoice.salesId === salesId && invoice.customerId === payload.customerId);
      }
      if (event.entityType === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') {
        const invoice = typeof payload.invoice === 'string' ? ownedInvoices.get(payload.invoice) : undefined;
        return Boolean(invoice && invoice.salesId === salesId);
      }
      return false;
    })
    .map((event) => ({
      ...event,
      payload: redactSalesCostFields(event.payload ?? {}) as Record<string, unknown>,
    }));
  const allowedKeys = new Set([
    ...syncOutbox.map((event) => event.idempotencyKey),
    ...projected.transactions.map((transaction) => transaction.idempotencyKey),
    ...(projected.receivablePayments ?? []).map((payment) => payment.id),
  ]);
  const identityChanged = state.salesProjectionSalesId !== salesId;
  const projectionReady = !identityChanged && state.salesProjectionReady === true;
  return {
    ...projected,
    ownerPin: undefined,
    syncOutbox,
    processedIdempotencyKeys: identityChanged
      ? [...allowedKeys]
      : state.salesProjectionReady === true || state.salesProjectionBuild
        ? state.processedIdempotencyKeys
        : state.processedIdempotencyKeys.filter((key) => allowedKeys.has(key)),
    lastServerSeq: identityChanged ? 0 : state.lastServerSeq,
    salesProjectionSalesId: salesId,
    salesProjectionBuild: identityChanged || !state.salesProjectionBuild ? undefined : projectSalesProjectionBuild(state.salesProjectionBuild, salesId),
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
  const historicalCustomerIds = new Set(state.transactions
    .filter((transaction) => transaction.salesId === salesId)
    .map((transaction) => transaction.customerId));
  const visibleCustomerIds = new Set([...assignedCustomerIds, ...sharedUmumIds, ...historicalCustomerIds]);
  const assignedTransactions = state.transactions
    .filter((transaction) => transaction.salesId === salesId && visibleCustomerIds.has(transaction.customerId));
  const invoiceNumbers = new Set(assignedTransactions.map((transaction) => transaction.invoiceNumber));
  const assignedReceivableIds = new Set(state.receivables
    .filter((receivable) => {
      if (receivable.customerId) return visibleCustomerIds.has(receivable.customerId) || invoiceNumbers.has(receivable.invoice);
      const matches = state.customers.filter((customer) =>
        customer.name.trim().toLowerCase() === receivable.customer.trim().toLowerCase()
      );
      return matches.length === 1 && visibleCustomerIds.has(matches[0].id);
    })
    .map((receivable) => receivable.id));
  const projectionReady = state.salesProjectionReady === true && state.salesProjectionSalesId === salesId;
  const visibleReturns = (state.customerReturns ?? []).filter((item) =>
    invoiceNumbers.has(item.invoiceNo) || visibleCustomerIds.has(item.customerId)
  ).map((item: CustomerReturnRecord) => ({
    id: item.id, invoiceNo: item.invoiceNo, customerId: item.customerId,
    productId: item.productId, weightGram: item.weightGram,
    refundValueRupiah: item.refundValueRupiah, resolution: item.resolution,
    createdAt: item.createdAt,
    ...(item.evidenceMediaId ? { evidenceMediaId: item.evidenceMediaId } : {}),
    ...(item.evidenceRemoteFileId ? { evidenceRemoteFileId: item.evidenceRemoteFileId } : {}),
  }));
  const visiblePayments = (state.receivablePayments ?? []).filter((payment) =>
    (payment.customerId && visibleCustomerIds.has(payment.customerId)) || assignedReceivableIds.has(payment.recId)
  ).map((payment: ReceivablePaymentRecord) => ({
    id: payment.id, recId: payment.recId, invoice: payment.invoice,
    ...(payment.customerId ? { customerId: payment.customerId } : {}),
    amountRupiah: payment.amountRupiah, paymentMethod: payment.paymentMethod,
    createdAt: payment.createdAt, actorName: payment.actorName,
    ...(payment.reversedAt ? { reversedAt: payment.reversedAt } : {}),
  }));
  const visibleCategories = (state.categories ?? []).map((category: ProductCategoryEntity) => ({
    id: category.id, label: category.label,
    ...(category.description ? { description: category.description } : {}),
    color: category.color,
    ...(category.isCore !== undefined ? { isCore: category.isCore } : {}),
    ...(category.deletedAt !== undefined ? { deletedAt: category.deletedAt } : {}),
  }));
  const visiblePromos = (state.bazarPromos ?? []).map((promo: BazarPromoEntity) => ({
    id: promo.id, sku: promo.sku, promoPricePerKg: promo.promoPricePerKg,
    startDate: promo.startDate, endDate: promo.endDate, quotaKg: promo.quotaKg,
    soldKg: promo.soldKg, isActive: promo.isActive, badgeLabel: promo.badgeLabel,
    ...(promo.title ? { title: promo.title } : {}),
    ...(promo.productName ? { productName: promo.productName } : {}),
    ...(promo.normalPricePerKg !== undefined ? { normalPricePerKg: promo.normalPricePerKg } : {}),
    ...(promo.discountRupiahPerKg !== undefined ? { discountRupiahPerKg: promo.discountRupiahPerKg } : {}),
    ...(promo.discountPercent !== undefined ? { discountPercent: promo.discountPercent } : {}),
  }));
  const projectionBuild = state.salesProjectionBuild && state.salesProjectionSalesId === salesId
    ? projectSalesProjectionBuild(state.salesProjectionBuild, salesId)
    : undefined;

  return {
    schemaVersion: state.schemaVersion,
    storeName: state.storeName,
    deviceId: state.deviceId,
    ownerPin: undefined,
    ownerPinHash: '',
    ownerPinSalt: '',
    ownerPinNeedsChange: false,
    cashInHandRupiah: 0,
    bankBalanceRupiah: 0,
    ...(state.bankBalanceInitialized !== undefined ? { bankBalanceInitialized: state.bankBalanceInitialized } : {}),
    customerReturns: projectionReady ? visibleReturns : [],
    receivablePayments: projectionReady ? visiblePayments : [],
    pettyCashSpentTodayRupiah: 0,
    products: projectionReady ? state.products.map(projectSalesProduct) : [],
    lots: projectionReady ? state.lots.map(projectSalesLot) : [],
    customers: projectionReady ? state.customers.filter((customer) => visibleCustomerIds.has(customer.id)).map(projectSalesCustomer) : [],
    receivables: projectionReady ? state.receivables.filter((receivable) => assignedReceivableIds.has(receivable.id)).map(projectSalesReceivable) : [],
    inboundPOs: [],
    supplierInvoices: [],
    transactions: projectionReady ? assignedTransactions.map(projectSalesTransaction) : [],
    stockLedger: [],
    journals: [],
    auditTrail: [],
    approvals: [],
    syncOutbox: [],
    processedIdempotencyKeys: [],
    bazarPromos: projectionReady ? visiblePromos : [],
    categories: projectionReady ? visibleCategories : [],
    suppliers: [],
    supplierPhones: {},
    lastUpdatedAt: state.lastUpdatedAt,
    ...(state.lastServerSeq !== undefined ? { lastServerSeq: state.lastServerSeq } : {}),
    remoteSyncEvents: [],
    remoteSyncConflicts: [],
    salesProjectionReady: projectionReady,
    salesProjectionSalesId: salesId,
    ...(projectionBuild ? { salesProjectionBuild: projectionBuild } : {}),
    ...(state.backupOriginDeviceId ? { backupOriginDeviceId: state.backupOriginDeviceId } : {}),
    ...(state.backupImportedAt ? { backupImportedAt: state.backupImportedAt } : {}),
  };
}
