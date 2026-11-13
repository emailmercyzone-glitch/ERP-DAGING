export type PaymentMethod = 'CASH' | 'TRANSFER' | 'TEMPO';

export type CustomerTier = 'RETAIL' | 'HOREKA' | 'VIP' | 'RESTO' | 'CATERING';

export interface ProductCategoryEntity {
  id: string;
  label: string;
  description?: string;
  color: string;
  isCore?: boolean;
}

export interface ProductGalleryItem {
  url: string;
  title: string;
  tag: string;
}

export interface ProductEntity {
  id: string;
  sku: string;
  name: string;
  basePricePerKg: number;
  movingAvgHppPerKg: number;
  imageUrl?: string;
  gallery?: ProductGalleryItem[];
  tierPrices: {
    RETAIL: number;
    HOREKA: number;
    VIP: number;
  };
  category: string;
  stockGram: number;
  safetyStockGram: number;
  tag?: string;
  alternativeId?: string;
  alternativeName?: string;
  alternativeReason?: string;
}

export interface BatchLotEntity {
  id: string;
  code: string;
  product: string;
  productId?: string;
  daysLeft: number;
  expiryDate: string;
  weightGram: number;
  maxCapacityGram: number;
  hppKgRupiah: number;
  loc: string;
  isFefo: boolean;
  isQuarantined: boolean;
}

export interface CustomerEntity {
  id: string;
  code: string;
  name: string;
  tier: string;
  creditLimit: number;
  currentReceivable: number;
  termDays: number;
  phone: string;
  address: string;
}

export interface ReceivableEntity {
  id: string;
  customer: string;
  customerId?: string;
  tier: string;
  amount: number;
  limit: number;
  dueDate: string;
  category: 'TERLAMBAT' | 'HARI_INI' | 'AKAN_DATANG' | 'LEBIH_7_HARI';
  daysDiff: number;
  invoice: string;
  itemsSummary: string;
  phone: string;
  status: 'BELUM_LUNAS' | 'LUNAS';
}

export interface PurchaseOrderEntity {
  id: string;
  poNumber: string;
  supplier: string;
  container: string;
  eta: string;
  items: string;
  status: 'DALAM_PERJALANAN' | 'SELESAI_BONGKAR' | string;
  totalRupiah: number;
  paymentTerm?: string;
  invoiceDueDate?: string;
  productCut?: string;
  orderWeightKg?: number;
}

export interface SupplierInvoiceEntity {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  supplier: string;
  supplierPhone?: string;
  originCountry: string;
  totalAmountRupiah: number;
  paidAmountRupiah: number;
  remainingAmountRupiah: number;
  dueDate: string;
  daysDiff: number;
  status: 'BELUM_LUNAS' | 'CICILAN' | 'LUNAS';
}

export interface CartLineInput {
  product: ProductEntity;
  weightGram: number;
  pcs: number;
}

export type StockMovementType =
  | 'IN_PURCHASE'
  | 'OUT_SALE'
  | 'IN_RETURN'
  | 'OUT_ADJUST'
  | 'IN_ADJUST'
  | 'OUT_CONVERSION'
  | 'IN_CONVERSION'
  | 'OUT_LOSS'
  | 'OUT_QUARANTINE'
  | 'IN_VOID_REVERSAL';

export interface StockLedgerEntry {
  uuid: string;
  idempotencyKey: string;
  timestamp: string;
  actorName: string;
  type: StockMovementType;
  humanLabel: string;
  productName: string;
  lotId: string;
  lotCode: string;
  weightGramDelta: number;
  unitCostPerKg: number;
  valueRupiahDelta: number;
  movingAvgHppAfterKg: number;
  referenceNo: string;
  note: string;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  uuid: string;
  idempotencyKey: string;
  timestamp: string;
  referenceNo: string;
  category: 'PENJUALAN' | 'PEMBELIAN' | 'PENYESUAIAN' | 'PENGOLAHAN' | 'BIAYA' | 'PEMBAYARAN' | 'PEMBATALAN';
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface AuditTrailEntry {
  uuid: string;
  timestamp: string;
  actorName: string;
  actorRole: 'OWNER' | 'ADMIN' | 'SALES' | 'SYSTEM';
  action: string;
  humanSummary: string;
  referenceId: string;
  integrityHash: string;
}

export interface ApprovalRequest {
  uuid: string;
  createdAt: string;
  type: 'CREDIT_OVERRIDE' | 'VOID_SALE' | 'STOCK_ADJUSTMENT' | 'NEGATIVE_STOCK';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  title: string;
  plainDescription: string;
  amountRupiah: number;
  requestedBy: string;
  resolvedBy?: string;
  resolvedAt?: string;
  referenceId?: string;
}

export interface LotAllocationRecord {
  lotId: string;
  lotCode: string;
  productId?: string;
  productName?: string;
  weightGram: number;
  hppPerKg: number;
  cogsRupiah: number;
}

export interface SalesTransactionRecord {
  uuid: string;
  idempotencyKey: string;
  invoiceNumber: string;
  timestamp: string;
  customerId: string;
  customerName: string;
  customerTier: string;
  paymentMethod: PaymentMethod;
  tempoDays: number;
  totalWeightGram: number;
  subtotalRupiah: number;
  discountRupiah?: number;
  shippingFee: number;
  isFreeShipping: boolean;
  grandTotalRupiah: number;
  paidAmountRupiah?: number;
  cashTendered?: number;
  changeRupiah?: number;
  balanceDueRupiah?: number;
  totalCogsRupiah: number;
  grossProfitRupiah: number;
  status: 'COMPLETED' | 'VOIDED';
  voidReason?: string;
  items: Array<{
    productId: string;
    productName: string;
    weightGram: number;
    effectivePricePerKg: number;
    lineTotalRupiah: number;
    movingAvgHppPerKg: number;
    appliedPromoId?: string;
  }>;
  lotAllocations: LotAllocationRecord[];
}

export interface SyncOutboxItem {
  uuid: string;
  idempotencyKey: string;
  entityType: 'SALE' | 'PURCHASE' | 'OPNAME' | 'CONVERSION' | 'RETURN' | 'PAYMENT' | 'VOID' | 'APPROVAL';
  createdAt: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  summary: string;
  payload?: Record<string, unknown>;
  retryCount?: number;
  lastError?: string;
  syncedAt?: string;
  serverSeq?: number;
  backendType?: string;
}

export interface CustomerReturnEntity {
  id: string;
  returnNumber: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  weightGram: number;
  reason: string;
  resolution: 'CREDIT_NOTE' | 'TUKAR_BARANG' | 'REFUND_KAS';
  refundValueRupiah: number;
  timestamp: string;
  proofPhotoUrl: string;
}

export interface PettyCashVoucherEntity {
  id: string;
  voucherNo: string;
  category: 'COLD_CHAIN' | 'PACKAGING' | 'LOGISTICS' | 'OPERATIONAL' | 'MAINTENANCE';
  categoryLabel: string;
  amountRupiah: number;
  recipient: string;
  description: string;
  timestamp: string;
  receiptPhotoUrl?: string;
  paidBy: string;
  journalRef: string;
}

export interface BusinessEngineState {
  schemaVersion: number;
  storeName: string;
  deviceId: string;
  ownerPin: string;
  cashInHandRupiah: number;
  pettyCashSpentTodayRupiah: number;
  pettyCashBalanceRupiah: number;
  pettyCashVouchers: PettyCashVoucherEntity[];
  customerReturns: CustomerReturnEntity[];
  products: ProductEntity[];
  lots: BatchLotEntity[];
  customers: CustomerEntity[];
  receivables: ReceivableEntity[];
  inboundPOs: PurchaseOrderEntity[];
  supplierInvoices: SupplierInvoiceEntity[];
  transactions: SalesTransactionRecord[];
  stockLedger: StockLedgerEntry[];
  journals: JournalEntry[];
  auditTrail: AuditTrailEntry[];
  approvals: ApprovalRequest[];
  syncOutbox: SyncOutboxItem[];
  processedIdempotencyKeys: string[];
  bazarPromos?: BazarPromoEntity[];
  categories?: ProductCategoryEntity[];
  suppliers?: string[];
  supplierPhones?: Record<string, string>;
  lastUpdatedAt: string;
}

export interface BazarPromoEntity {
  id: string;
  sku: string;
  promoPricePerKg: number;
  startDate: string;
  endDate: string;
  quotaKg: number;
  soldKg: number;
  isActive: boolean;
  badgeLabel: string;
  title?: string;
  productName?: string;
  normalPricePerKg?: number;
  discountRupiahPerKg?: number;
  discountPercent?: number;
}

export interface EngineActionResult {
  ok: boolean;
  state: BusinessEngineState;
  message: string;
  errorCode?: 'DUPLICATE' | 'VALIDATION' | 'APPROVAL_REQUIRED' | 'NOT_FOUND' | 'ALREADY_VOIDED';
  createdInvoice?: SalesTransactionRecord;
  requiredApproval?: ApprovalRequest;
  updatedBazarPromos?: BazarPromoEntity[];
}
