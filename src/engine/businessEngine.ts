import type {
  ApprovalRequest,
  AuditTrailEntry,
  BatchLotEntity,
  BazarPromoEntity,
  BusinessEngineState,
  CartLineInput,
  CustomerEntity,
  CustomerReturnEntity,
  EngineActionResult,
  JournalEntry,
  JournalLine,
  LotAllocationRecord,
  PaymentMethod,
  PettyCashVoucherEntity,
  ProductCategoryEntity,
  ProductEntity,
  PurchaseOrderEntity,
  ReceivableEntity,
  SalesTransactionRecord,
  StockLedgerEntry,
  SupplierInvoiceEntity,
  SyncOutboxItem,
} from './types';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';

import { idbGetEngineState, idbSaveEngineState } from './indexedDbStorage';

export const ENGINE_STORAGE_KEY = 'karkasia_erp_business_engine_v1';
export const ENGINE_SCHEMA_VERSION = 4;

// ============================================================================
// CORE UTILITIES: UUID, INTEGRITY HASH, INTEGER MATH, MOVING AVERAGE HPP
// ============================================================================

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function computeIntegrityHash(payload: string): string {
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return 'SHA-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatTimeId(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * HPP Moving Average Formula (Zero-Float Integer Rupiah per KG):
 * New Avg Cost/kg = round((Existing Value + Incoming Value) / (Existing Kg + Incoming Kg))
 */
export function calculateMovingAverageHppPerKg(
  existingWeightGram: number,
  existingHppPerKg: number,
  incomingWeightGram: number,
  incomingTotalCostRupiah: number
): number {
  const safeExistingGram = Math.max(0, Math.round(existingWeightGram));
  const safeIncomingGram = Math.max(0, Math.round(incomingWeightGram));
  const totalGram = safeExistingGram + safeIncomingGram;
  if (totalGram <= 0) return Math.max(0, Math.round(existingHppPerKg));

  const existingValue = Math.round((safeExistingGram * existingHppPerKg) / 1000);
  const totalValue = existingValue + Math.max(0, Math.round(incomingTotalCostRupiah));
  return Math.round((totalValue * 1000) / totalGram);
}

/**
 * Helper to compute balanced double-entry Journal Entry automatically behind the scenes
 */
function buildDerivedJournal(params: {
  idempotencyKey: string;
  referenceNo: string;
  category: JournalEntry['category'];
  description: string;
  lines: JournalLine[];
}): JournalEntry {
  const totalDebit = params.lines.reduce((acc, l) => acc + Math.round(l.debit), 0);
  const totalCredit = params.lines.reduce((acc, l) => acc + Math.round(l.credit), 0);
  return {
    uuid: generateUUID(),
    idempotencyKey: params.idempotencyKey,
    timestamp: nowIso(),
    referenceNo: params.referenceNo,
    category: params.category,
    description: params.description,
    lines: params.lines,
    totalDebit,
    totalCredit,
    isBalanced: totalDebit === totalCredit,
  };
}

function buildAuditEntry(params: {
  actorName: string;
  actorRole: AuditTrailEntry['actorRole'];
  action: string;
  humanSummary: string;
  referenceId: string;
}): AuditTrailEntry {
  const timestamp = nowIso();
  return {
    uuid: generateUUID(),
    timestamp,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    humanSummary: params.humanSummary,
    referenceId: params.referenceId,
    integrityHash: computeIntegrityHash(
      `${timestamp}|${params.actorName}|${params.action}|${params.referenceId}|${params.humanSummary}`
    ),
  };
}

function buildSyncItem(params: {
  idempotencyKey: string;
  entityType: SyncOutboxItem['entityType'];
  summary: string;
  payload?: Record<string, unknown>;
}): SyncOutboxItem {
  return {
    uuid: generateUUID(),
    idempotencyKey: params.idempotencyKey,
    entityType: params.entityType,
    createdAt: nowIso(),
    // Rule 8 & 9: Every transaction is saved locally first as PENDING.
    // SYNCED may only be applied after an external BackendAdapter confirms receipt.
    status: 'PENDING',
    summary: params.summary,
    payload: params.payload,
    retryCount: 0,
  };
}

export type MasterDataSyncResource = 'PRODUCT' | 'LOT' | 'CUSTOMER' | 'CATEGORY' | 'SUPPLIER' | 'SUPPLIER_PHONE' | 'BAZAR_PROMO';

/**
 * Appends pending Outbox records for changed master-data rows.
 * Product image/gallery blobs are intentionally excluded until media sync exists.
 */
export function appendMasterDataChanges<T extends { id: string }>(
  state: BusinessEngineState,
  resource: MasterDataSyncResource,
  previousRecords: T[],
  nextRecords: T[]
): BusinessEngineState {
  const toSyncRecord = (record: T): Record<string, unknown> => {
    const raw = record as unknown as Record<string, unknown>;
    if (resource !== 'PRODUCT') return raw;
    const { imageUrl: _imageUrl, gallery: _gallery, ...core } = raw;
    return core;
  };
  const previousById = new Map(previousRecords.map((record) => [record.id, record]));
  const nextById = new Map(nextRecords.map((record) => [record.id, record]));
  const changes: SyncOutboxItem[] = [];

  for (const nextRecord of nextRecords) {
    const previousRecord = previousById.get(nextRecord.id);
    const nextPayload = toSyncRecord(nextRecord);
    if (previousRecord && JSON.stringify(toSyncRecord(previousRecord)) === JSON.stringify(nextPayload)) continue;
    const mutationId = generateUUID();
    changes.push(buildSyncItem({
      idempotencyKey: `MASTER_DATA:${resource}:${nextRecord.id}:${mutationId}`,
      entityType: 'MASTER_DATA',
      summary: `${resource} UPSERT ${nextRecord.id}`,
      payload: { resource, operation: 'UPSERT', record: nextPayload },
    }));
  }

  for (const previousRecord of previousRecords) {
    if (nextById.has(previousRecord.id)) continue;
    const mutationId = generateUUID();
    changes.push(buildSyncItem({
      idempotencyKey: `MASTER_DATA:${resource}:${previousRecord.id}:${mutationId}`,
      entityType: 'MASTER_DATA',
      summary: `${resource} DELETE ${previousRecord.id}`,
      payload: { resource, operation: 'DELETE', recordId: previousRecord.id },
    }));
  }

  return changes.length === 0
    ? state
    : { ...state, syncOutbox: [...state.syncOutbox, ...changes] };
}

// ============================================================================
// PRICING & DISCOUNT ENGINE (MOD-05: TIER, VOLUME BREAK, & BAZAR PROMO)
// ============================================================================

export type BazarPromoInput = BazarPromoEntity;

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeDaysLeftFromExpiry(
  expiryDate: string | undefined,
  referenceDate: Date = new Date(),
  fallbackDaysLeft: number = 0
): number {
  if (!expiryDate || typeof expiryDate !== 'string') return fallbackDaysLeft;
  const trimmed = expiryDate.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  let expMidnightMs = Number.NaN;
  if (m) {
    expMidnightMs = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
  } else {
    const parsed = new Date(trimmed);
    if (Number.isFinite(parsed.getTime())) {
      expMidnightMs = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0).getTime();
    }
  }
  if (!Number.isFinite(expMidnightMs)) return fallbackDaysLeft;
  const refMidnightMs = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  return Math.round((expMidnightMs - refMidnightMs) / 86400000);
}

function nextMonotonicSequence(existingCodes: string[], prefixRegex: RegExp, minStart: number): number {
  let maxSeq = minStart - 1;
  for (const code of existingCodes) {
    if (typeof code !== 'string') continue;
    const match = prefixRegex.exec(code.trim());
    if (match && match[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  return maxSeq + 1;
}

function parsePromoDateBoundary(dateStr: string | undefined, boundary: 'start' | 'end'): number {
  if (!dateStr || typeof dateStr !== 'string') return Number.NaN;
  const trimmed = dateStr.trim();
  if (!trimmed) return Number.NaN;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return boundary === 'start'
      ? new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0).getTime()
      : new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999).getTime();
  }

  const dateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (dateTimeMatch) {
    const [, y, m, d, hh, mm, ss] = dateTimeMatch;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      ss ? Number(ss) : boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 999 : 0
    ).getTime();
  }

  return Date.parse(trimmed);
}

export function getBazarPromoRemainingGram(
  promo: Pick<BazarPromoInput, 'quotaKg' | 'soldKg'>
): number {
  if (
    !Number.isFinite(promo.quotaKg) ||
    !Number.isFinite(promo.soldKg) ||
    promo.quotaKg <= 0 ||
    promo.soldKg < 0
  ) {
    return 0;
  }
  const quotaGram = Math.round(promo.quotaKg * 1000);
  const soldGram = Math.round(promo.soldKg * 1000);
  return Math.max(0, quotaGram - soldGram);
}

export function isBazarPromoEligible(
  promo: BazarPromoInput,
  weightGram: number = 1000,
  referenceDate: Date = new Date()
): boolean {
  if (!promo || promo.isActive !== true) return false;
  if (!Number.isFinite(promo.promoPricePerKg) || promo.promoPricePerKg <= 0) return false;

  const startMs = parsePromoDateBoundary(promo.startDate, 'start');
  const endMs = parsePromoDateBoundary(promo.endDate, 'end');
  const nowMs = referenceDate.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return false;
  }
  if (nowMs < startMs || nowMs > endMs) {
    return false;
  }

  const safeWeight = Number.isFinite(weightGram) ? Math.round(weightGram) : 0;
  if (safeWeight <= 0) return false;

  const remainingGram = getBazarPromoRemainingGram(promo);
  return remainingGram >= safeWeight;
}

export function normalizePricingTier(customerTier: string = 'RETAIL'): string {
  const rawTier = (customerTier || 'RETAIL').toString().trim().toUpperCase();
  if (rawTier === 'RESTO' || rawTier === 'CATERING') {
    return 'HOREKA';
  }
  return rawTier || 'RETAIL';
}

export function calculateProductTierPrice(
  product: Pick<ProductEntity, 'sku' | 'basePricePerKg'> & {
    tierPrices?: Partial<ProductEntity['tierPrices']>;
  },
  customerTier: string = 'RETAIL',
  weightGram: number = 1000,
  bazarPromos: BazarPromoInput[] = [],
  referenceDate: Date = new Date()
) {
  const safeBase = Number.isFinite(product.basePricePerKg) ? Math.max(0, Math.round(product.basePricePerKg)) : 0;
  const safeWeight = Number.isFinite(weightGram) ? Math.max(0, Math.round(weightGram)) : 0;

  const tierPrices = {
    RETAIL: product.tierPrices?.RETAIL ?? safeBase,
    HOREKA: product.tierPrices?.HOREKA ?? Math.round(safeBase * 0.9),
    VIP: product.tierPrices?.VIP ?? Math.round(safeBase * 0.82),
  };

  const normalizedCustomerTier = normalizePricingTier(customerTier);
  let appliedTier = normalizedCustomerTier;
  let isVolumeUpgrade = false;

  if (safeWeight >= 20000) {
    appliedTier = 'VIP';
    if (normalizedCustomerTier !== 'VIP') isVolumeUpgrade = true;
  } else if (safeWeight >= 5000) {
    if (appliedTier === 'RETAIL') {
      appliedTier = 'HOREKA';
      isVolumeUpgrade = true;
    }
  }

  const tierPrice =
    tierPrices[appliedTier as keyof typeof tierPrices] ?? safeBase;

  const activePromo = bazarPromos.find(
    (p) =>
      p.sku === product.sku &&
      isBazarPromoEligible(p, safeWeight, referenceDate) &&
      Math.round(p.promoPricePerKg) < tierPrice
  );
  if (activePromo) {
    return {
      effectivePricePerKg: Math.round(activePromo.promoPricePerKg),
      activeTier: 'PROMO_BAZAR',
      badgeLabel: activePromo.badgeLabel,
      isPromo: true,
      isVolumeUpgrade: false,
      retailPrice: tierPrices.RETAIL,
      savingsPerKg: Math.max(0, tierPrices.RETAIL - Math.round(activePromo.promoPricePerKg)),
      appliedPromoId: activePromo.id,
    };
  }

  return {
    effectivePricePerKg: tierPrice,
    activeTier: appliedTier,
    badgeLabel:
      appliedTier === 'VIP'
        ? 'Tier VIP (Grosir)'
        : appliedTier === 'HOREKA'
        ? 'Tier HOREKA (Resto)'
        : 'Tier Retail (Eceran)',
    isPromo: false,
    isVolumeUpgrade,
    retailPrice: tierPrices.RETAIL,
    savingsPerKg: Math.max(0, tierPrices.RETAIL - tierPrice),
    appliedPromoId: undefined,
  };
}

// ============================================================================
// FEFO ALLOCATION ENGINE
// ============================================================================

function parseExpiryTimestamp(expiryDate: string | undefined): number {
  if (!expiryDate || typeof expiryDate !== 'string') return Number.POSITIVE_INFINITY;
  const trimmed = expiryDate.trim();
  if (!trimmed) return Number.POSITIVE_INFINITY;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999).getTime();
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function isLotExpired(
  lot: Pick<BatchLotEntity, 'expiryDate'>,
  referenceDate: Date = new Date()
): boolean {
  if (!lot.expiryDate || typeof lot.expiryDate !== 'string') return true;
  const trimmed = lot.expiryDate.trim();
  if (!trimmed) return true;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed < formatLocalYmd(referenceDate);
  }

  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) return true;
  return parsedMs < referenceDate.getTime();
}

function lotMatchesProduct(
  lot: BatchLotEntity,
  targetProductId: string,
  targetProductName?: string
): boolean {
  if (typeof lot.productId === 'string' && lot.productId.trim() !== '') {
    return lot.productId === targetProductId;
  }
  if (!targetProductName) return false;
  return lot.product.trim().toLowerCase() === targetProductName.trim().toLowerCase();
}

export function isLotEligibleForSale(
  lot: BatchLotEntity,
  targetProductId: string,
  targetProductName?: string,
  referenceDate: Date = new Date()
): boolean {
  if (lot.isQuarantined) return false;
  if (!Number.isFinite(lot.weightGram) || lot.weightGram <= 0) return false;
  if (isLotExpired(lot, referenceDate)) return false;
  return lotMatchesProduct(lot, targetProductId, targetProductName);
}

export function getProductAvailableStockGram(
  lots: BatchLotEntity[],
  productId: string,
  productName?: string,
  referenceDate: Date = new Date()
): number {
  return lots.reduce((sum, lot) => {
    if (!isLotEligibleForSale(lot, productId, productName, referenceDate)) return sum;
    return sum + Math.round(lot.weightGram);
  }, 0);
}

export function allocateLotsFEFO(
  lots: BatchLotEntity[],
  target: string | { productId: string; productName?: string },
  requestedGram: number,
  _fallbackHppPerKg: number = 0,
  referenceDate: Date = new Date()
): {
  updatedLots: BatchLotEntity[];
  allocations: LotAllocationRecord[];
  shortGram: number;
  totalCogsRupiah: number;
} {
  const targetProductId = typeof target === 'string' ? target : target.productId;
  const targetProductName = typeof target === 'string' ? undefined : target.productName;

  const matchingIndexes = lots
    .map((lot, idx) => ({
      lot,
      idx,
      expiryTs: parseExpiryTimestamp(lot.expiryDate),
    }))
    .filter(({ lot }) => isLotEligibleForSale(lot, targetProductId, targetProductName, referenceDate))
    .sort((a, b) => {
      if (a.expiryTs !== b.expiryTs) return a.expiryTs - b.expiryTs;
      if (a.lot.daysLeft !== b.lot.daysLeft) return a.lot.daysLeft - b.lot.daysLeft;
      const codeCmp = (a.lot.code || '').localeCompare(b.lot.code || '');
      if (codeCmp !== 0) return codeCmp;
      const idCmp = (a.lot.id || '').localeCompare(b.lot.id || '');
      if (idCmp !== 0) return idCmp;
      return a.idx - b.idx;
    });

  let remainingToAllocate = Number.isFinite(requestedGram) ? Math.max(0, Math.round(requestedGram)) : 0;
  const updatedLots = lots.map((l) => ({ ...l }));
  const allocations: LotAllocationRecord[] = [];

  for (const { idx } of matchingIndexes) {
    if (remainingToAllocate <= 0) break;
    const targetLot = updatedLots[idx];
    const takeGram = Math.min(targetLot.weightGram, remainingToAllocate);
    if (takeGram > 0) {
      targetLot.weightGram -= takeGram;
      remainingToAllocate -= takeGram;
      const cogsRupiah = Math.round((takeGram * targetLot.hppKgRupiah) / 1000);
      allocations.push({
        lotId: targetLot.id,
        lotCode: targetLot.code,
        productId: targetLot.productId ?? targetProductId,
        productName: targetProductName ?? targetLot.product,
        weightGram: takeGram,
        hppPerKg: targetLot.hppKgRupiah,
        cogsRupiah,
      });
    }
  }

  const totalCogsRupiah = allocations.reduce((acc, a) => acc + a.cogsRupiah, 0);

  return {
    updatedLots,
    allocations,
    shortGram: remainingToAllocate,
    totalCogsRupiah,
  };
}

// ============================================================================
// INITIAL SEEDING & PERSISTENCE (OFFLINE-FIRST)
// ============================================================================

export interface EngineFallbackDefaults {
  bazarPromos?: BazarPromoEntity[];
  categories?: ProductCategoryEntity[];
  suppliers?: string[];
  supplierPhones?: Record<string, string>;
  preserveOwnerPinHash?: string;
  preserveOwnerPinSalt?: string;
  preserveOwnerPinNeedsChange?: boolean;
}

export function createSeededEngineState(seed: {
  products?: ProductEntity[];
  lots?: BatchLotEntity[];
  customers?: CustomerEntity[];
  receivables?: ReceivableEntity[];
  inboundPOs?: PurchaseOrderEntity[];
  supplierInvoices?: SupplierInvoiceEntity[];
  bazarPromos?: BazarPromoEntity[];
  categories?: ProductCategoryEntity[];
  suppliers?: string[];
  supplierPhones?: Record<string, string>;
}): BusinessEngineState {
  const products = seed.products ?? [];
  const lots = seed.lots ?? [];
  const customers = seed.customers ?? [];
  const receivables = seed.receivables ?? [];
  const inboundPOs = seed.inboundPOs ?? [];
  const supplierInvoices = seed.supplierInvoices ?? [];
  const initialTimestamp = nowIso();
  const initialLedger: StockLedgerEntry[] = lots.map((l) => ({
    uuid: generateUUID(),
    idempotencyKey: `SEED-${l.id}`,
    timestamp: initialTimestamp,
    actorName: 'Sistem Awal',
    type: 'IN_PURCHASE',
    humanLabel: 'Stok Awal Gudang',
    productName: l.product,
    lotId: l.id,
    lotCode: l.code,
    weightGramDelta: l.weightGram,
    unitCostPerKg: l.hppKgRupiah,
    valueRupiahDelta: Math.round((l.weightGram * l.hppKgRupiah) / 1000),
    movingAvgHppAfterKg: l.hppKgRupiah,
    referenceNo: 'OPENING-BAL-01',
    note: `Saldo awal batch ${l.code} di rak ${l.loc}`,
  }));

  const initialAudit: AuditTrailEntry[] = [
    buildAuditEntry({
      actorName: 'Sistem',
      actorRole: 'SYSTEM',
      action: 'INISIALISASI_BUKU_STOK',
      humanSummary: `Inisialisasi data lokal: ${lots.length} batch dan ${customers.length} pelanggan dari saldo awal yang diberikan.`,
      referenceId: 'OPENING-BAL-01',
    }),
  ];

  const totalInventoryVal = lots.reduce(
    (acc, l) => acc + Math.round((l.weightGram * l.hppKgRupiah) / 1000),
    0
  );

  const initialJournal = totalInventoryVal > 0
    ? buildDerivedJournal({
        idempotencyKey: 'SEED-JOURNAL-01',
        referenceNo: 'OPENING-BAL-01',
        category: 'PENYESUAIAN',
        description: 'Saldo awal persediaan berdasarkan data pembukaan yang dimasukkan',
        lines: [
          { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: totalInventoryVal, credit: 0 },
          { accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: totalInventoryVal },
        ],
      })
    : null;

  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    storeName: 'ERP DAGING',
    deviceId: 'DEVICE-LOCAL',
    ownerPinHash: '',
    ownerPinSalt: '',
    ownerPinNeedsChange: false,
    cashInHandRupiah: 0,
    pettyCashSpentTodayRupiah: 0,
    pettyCashBalanceRupiah: 0,
    pettyCashVouchers: [],
    customerReturns: [],
    products: syncProductsStockFromLots(products, lots),
    lots,
    customers,
    receivables,
    inboundPOs,
    supplierInvoices,
    transactions: [],
    stockLedger: initialLedger,
    journals: initialJournal ? [initialJournal] : [],
    auditTrail: initialAudit,
    approvals: [],
    syncOutbox: [],
    processedIdempotencyKeys: [],
    bazarPromos: (seed.bazarPromos ?? []).map((p) => ({ ...p })),
    ...(seed.categories ? { categories: seed.categories.map((c) => ({ ...c })) } : {}),
    ...(seed.suppliers ? { suppliers: [...seed.suppliers] } : {}),
    ...(seed.supplierPhones ? { supplierPhones: { ...seed.supplierPhones } } : {}),
    lastUpdatedAt: initialTimestamp,
  };
}

const LEGACY_SEED_LOT_PRODUCT_MAP: Record<string, string> = {
  LOT_01: 'PROD_01',
  LOT_02: 'PROD_02',
  LOT_03: 'PROD_03',
  LOT_04: 'PROD_04',
  LOT_05: 'PROD_05',
  LOT_06: 'PROD_06',
  LOT_07: 'PROD_07',
};

function syncProductsStockFromLots(
  products: ProductEntity[],
  lots: BatchLotEntity[],
  referenceDate: Date = new Date()
): ProductEntity[] {
  return products.map((p) => {
    const productHasBoundLots = lots.some(
      (l) => (typeof l.productId === 'string' && l.productId === p.id) || (!l.productId && l.product === p.name)
    );
    if (!productHasBoundLots) return p;
    return {
      ...p,
      stockGram: getProductAvailableStockGram(lots, p.id, p.name, referenceDate),
    };
  });
}

function normalizeBazarPromosList(
  rawPromos: unknown,
  fallbackPromos?: BazarPromoEntity[]
): BazarPromoEntity[] | undefined {
  if (Array.isArray(rawPromos)) {
    return rawPromos
      .filter((p): p is BazarPromoEntity => !!p && typeof p === 'object' && typeof (p as BazarPromoEntity).id === 'string')
      .map((p) => ({
        ...p,
        promoPricePerKg: Number.isFinite(p.promoPricePerKg) ? Math.max(0, Math.round(p.promoPricePerKg)) : 0,
        quotaKg: Number.isFinite(p.quotaKg) ? Math.max(0, p.quotaKg) : 0,
        soldKg: Number.isFinite(p.soldKg) ? Math.max(0, Number(p.soldKg.toFixed(3))) : 0,
        isActive: p.isActive === true,
      }));
  }
  return fallbackPromos ? fallbackPromos.map((p) => ({ ...p })) : undefined;
}

function normalizeCategoriesList(
  rawCategories: unknown,
  fallbackCategories?: ProductCategoryEntity[]
): ProductCategoryEntity[] | undefined {
  if (Array.isArray(rawCategories)) {
    return rawCategories
      .filter(
        (c): c is ProductCategoryEntity =>
          !!c &&
          typeof c === 'object' &&
          typeof (c as ProductCategoryEntity).id === 'string' &&
          (c as ProductCategoryEntity).id.trim() !== '' &&
          typeof (c as ProductCategoryEntity).label === 'string'
      )
      .map((c) => ({
        id: c.id.trim().toUpperCase(),
        label: c.label.trim(),
        description: typeof c.description === 'string' ? c.description : undefined,
        color: typeof c.color === 'string' && c.color.trim() ? c.color : 'emerald',
        isCore: c.isCore === true,
      }));
  }
  return fallbackCategories ? fallbackCategories.map((c) => ({ ...c })) : undefined;
}

function normalizeSuppliersList(rawSuppliers: unknown, fallbackSuppliers?: string[]): string[] | undefined {
  if (Array.isArray(rawSuppliers)) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of rawSuppliers) {
      if (typeof s !== 'string') continue;
      const trimmed = s.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(trimmed);
      }
    }
    return result;
  }
  return fallbackSuppliers ? [...fallbackSuppliers] : undefined;
}

function normalizeSupplierPhonesMap(
  rawPhones: unknown,
  fallbackPhones?: Record<string, string>
): Record<string, string> | undefined {
  if (rawPhones && typeof rawPhones === 'object' && !Array.isArray(rawPhones)) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawPhones as Record<string, unknown>)) {
      if (typeof k === 'string' && k.trim() && typeof v === 'string' && v.trim()) {
        clean[k.trim()] = v.trim();
      }
    }
    return clean;
  }
  return fallbackPhones ? { ...fallbackPhones } : undefined;
}

function resolveFallbackDefaults(
  fallbackOrPromos?: BazarPromoEntity[] | EngineFallbackDefaults
): EngineFallbackDefaults {
  if (!fallbackOrPromos) return {};
  if (Array.isArray(fallbackOrPromos)) {
    return { bazarPromos: fallbackOrPromos };
  }
  return fallbackOrPromos;
}

export function normalizePersistedState(
  raw: BusinessEngineState,
  fallbackOrPromos?: BazarPromoEntity[] | EngineFallbackDefaults
): BusinessEngineState {
  const defaults = resolveFallbackDefaults(fallbackOrPromos);
  const safeOutbox: SyncOutboxItem[] = Array.isArray(raw.syncOutbox)
    ? raw.syncOutbox.map((item) => ({
        ...item,
        status:
          item.status === 'SYNCED' || item.status === 'FAILED' || item.status === 'PENDING'
            ? item.status
            : 'PENDING',
        retryCount: typeof item.retryCount === 'number' ? item.retryCount : 0,
      }))
    : [];

  const safeLots: BatchLotEntity[] = Array.isArray(raw.lots)
    ? raw.lots.map((lot) => {
        const nextDaysLeft = computeDaysLeftFromExpiry(lot.expiryDate, new Date(), lot.daysLeft);
        if (typeof lot.productId === 'string' && lot.productId.trim() !== '') {
          return { ...lot, daysLeft: nextDaysLeft };
        }
        const mappedSeedId = LEGACY_SEED_LOT_PRODUCT_MAP[lot.id];
        if (mappedSeedId) {
          return { ...lot, productId: mappedSeedId, daysLeft: nextDaysLeft };
        }
        const exactProdMatches = Array.isArray(raw.products)
          ? raw.products.filter((p) => p.name.trim().toLowerCase() === lot.product.trim().toLowerCase())
          : [];
        if (exactProdMatches.length === 1) {
          return { ...lot, productId: exactProdMatches[0].id, daysLeft: nextDaysLeft };
        }
        return { ...lot, daysLeft: nextDaysLeft };
      })
    : [];

  const safeProducts = Array.isArray(raw.products)
    ? syncProductsStockFromLots(raw.products, safeLots)
    : [];

  const safeTransactions = Array.isArray(raw.transactions) ? raw.transactions : [];
  const safeKeys = Array.isArray(raw.processedIdempotencyKeys) ? raw.processedIdempotencyKeys : [];
  const safePromos = normalizeBazarPromosList(raw.bazarPromos, defaults.bazarPromos);
  const safeCategories = normalizeCategoriesList(raw.categories, defaults.categories);
  const safeSuppliers = normalizeSuppliersList(raw.suppliers, defaults.suppliers);
  const safeSupplierPhones = normalizeSupplierPhonesMap(raw.supplierPhones, defaults.supplierPhones);

  const { ownerPin: legacyOwnerPinRaw, ...rawWithoutLegacyPin } = raw as any;
  const legacyOwnerPin = typeof legacyOwnerPinRaw === 'string' ? legacyOwnerPinRaw.trim() : '';
  let ownerPinSalt =
    typeof raw.ownerPinSalt === 'string' && /^[0-9a-f]{32}$/i.test(raw.ownerPinSalt)
      ? raw.ownerPinSalt.toLowerCase()
      : typeof defaults.preserveOwnerPinSalt === 'string' && /^[0-9a-f]{32}$/i.test(defaults.preserveOwnerPinSalt)
      ? defaults.preserveOwnerPinSalt.toLowerCase()
      : '';
  let ownerPinHash =
    typeof raw.ownerPinHash === 'string' && /^[0-9a-f]{64}$/i.test(raw.ownerPinHash)
      ? raw.ownerPinHash.toLowerCase()
      : typeof defaults.preserveOwnerPinHash === 'string' && /^[0-9a-f]{64}$/i.test(defaults.preserveOwnerPinHash)
      ? defaults.preserveOwnerPinHash.toLowerCase()
      : '';
  let ownerPinNeedsChange = raw.ownerPinNeedsChange === true || defaults.preserveOwnerPinNeedsChange === true;
  if ((!ownerPinHash || !ownerPinSalt) && legacyOwnerPin) {
    ownerPinSalt = bytesToHex(randomBytes(16));
    ownerPinHash = deriveOwnerPinHash(legacyOwnerPin, ownerPinSalt);
    ownerPinNeedsChange = legacyOwnerPin === '123456';
  }
  if (!ownerPinHash || !ownerPinSalt) {
    ownerPinHash = '';
    ownerPinSalt = '';
    ownerPinNeedsChange = false;
  }

  return {
    ...rawWithoutLegacyPin,
    schemaVersion: ENGINE_SCHEMA_VERSION,
    ownerPinHash,
    ownerPinSalt,
    ownerPinNeedsChange,
    pettyCashBalanceRupiah: Number.isSafeInteger(raw.pettyCashBalanceRupiah) && raw.pettyCashBalanceRupiah >= 0 ? raw.pettyCashBalanceRupiah : 0,
    pettyCashVouchers: Array.isArray(raw.pettyCashVouchers) ? raw.pettyCashVouchers.filter((v: any) => v && typeof v.id === 'string' && typeof v.voucherNo === 'string' && Number.isSafeInteger(v.amountRupiah) && v.amountRupiah > 0) : [],
    customerReturns: Array.isArray(raw.customerReturns) ? raw.customerReturns.filter((r: any) => r && typeof r.id === 'string' && typeof r.invoiceNo === 'string' && Number.isSafeInteger(r.weightGram) && r.weightGram > 0 && typeof r.proofPhotoUrl === 'string') : [],
    customers: Array.isArray(raw.customers) ? raw.customers : [],
    receivables: Array.isArray(raw.receivables) ? raw.receivables : [],
    inboundPOs: Array.isArray(raw.inboundPOs) ? raw.inboundPOs : [],
    supplierInvoices: Array.isArray(raw.supplierInvoices) ? raw.supplierInvoices : [],
    products: safeProducts,
    lots: safeLots,
    transactions: safeTransactions,
    stockLedger: Array.isArray(raw.stockLedger) ? raw.stockLedger : [],
    journals: Array.isArray(raw.journals) ? raw.journals : [],
    auditTrail: Array.isArray(raw.auditTrail) ? raw.auditTrail : [],
    approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
    processedIdempotencyKeys: safeKeys,
    syncOutbox: safeOutbox,
    ...(safePromos !== undefined ? { bazarPromos: safePromos } : {}),
    ...(safeCategories !== undefined ? { categories: safeCategories } : {}),
    ...(safeSuppliers !== undefined ? { suppliers: safeSuppliers } : {}),
    ...(safeSupplierPhones !== undefined ? { supplierPhones: safeSupplierPhones } : {}),
  };
}

function parseValidLocalSnapshot(): BusinessEngineState | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ENGINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BusinessEngineState;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.schemaVersion !== 'number' ||
      parsed.schemaVersion > ENGINE_SCHEMA_VERSION ||
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.lots)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadEngineState(fallbackSeed: Parameters<typeof createSeededEngineState>[0]): BusinessEngineState {
  const parsed = parseValidLocalSnapshot();
  if (!parsed) {
    return createSeededEngineState(fallbackSeed);
  }
  const normalized = normalizePersistedState(parsed, {
    bazarPromos: fallbackSeed.bazarPromos,
    categories: fallbackSeed.categories,
    suppliers: fallbackSeed.suppliers,
    supplierPhones: fallbackSeed.supplierPhones,
  });
  if (parsed.schemaVersion !== ENGINE_SCHEMA_VERSION || Object.prototype.hasOwnProperty.call(parsed, 'ownerPin')) {
    persistEngineState(normalized);
  }
  return normalized;
}

export async function hydrateEngineStateFromIdb(
  currentState: BusinessEngineState,
  fallbackDefaults?: EngineFallbackDefaults
): Promise<{ state: BusinessEngineState; source: 'indexeddb' | 'migrated_local' | 'fallback' }> {
  if (typeof window === 'undefined') {
    return { state: currentState, source: 'fallback' };
  }

  const validLocalParsed = parseValidLocalSnapshot();
  const hasValidLocalSnapshot = validLocalParsed !== null;

  const idbState = await idbGetEngineState();
  const isIdbValid =
    !!idbState &&
    Number.isInteger(idbState.schemaVersion) &&
    idbState.schemaVersion >= 1 &&
    idbState.schemaVersion <= ENGINE_SCHEMA_VERSION &&
    Array.isArray(idbState.products) &&
    Array.isArray(idbState.lots);

  const normalizeDefaults: EngineFallbackDefaults = {
    bazarPromos: fallbackDefaults?.bazarPromos ?? currentState.bazarPromos,
    categories: fallbackDefaults?.categories ?? currentState.categories,
    suppliers: fallbackDefaults?.suppliers ?? currentState.suppliers,
    supplierPhones: fallbackDefaults?.supplierPhones ?? currentState.supplierPhones,
    preserveOwnerPinHash: fallbackDefaults?.preserveOwnerPinHash ?? currentState.ownerPinHash,
    preserveOwnerPinSalt: fallbackDefaults?.preserveOwnerPinSalt ?? currentState.ownerPinSalt,
    preserveOwnerPinNeedsChange: fallbackDefaults?.preserveOwnerPinNeedsChange ?? currentState.ownerPinNeedsChange,
  };

  if (isIdbValid && idbState) {
    const normalizedIdb = normalizePersistedState(idbState, normalizeDefaults);
    const needsIdbMigration =
      idbState.schemaVersion !== ENGINE_SCHEMA_VERSION ||
      Object.prototype.hasOwnProperty.call(idbState, 'ownerPin');

    if (!hasValidLocalSnapshot) {
      // Recover/repair missing or corrupted localStorage snapshot from authoritative IndexedDB state
      try {
        window.localStorage?.setItem(ENGINE_STORAGE_KEY, JSON.stringify(normalizedIdb));
      } catch {
        // Ignore quota limit on localStorage cache; IndexedDB remains authoritative
      }
      if (needsIdbMigration) await idbSaveEngineState(normalizedIdb);
      return { state: normalizedIdb, source: 'indexeddb' };
    }

    const idbTime = Date.parse(normalizedIdb.lastUpdatedAt || '') || 0;
    const localTime = Date.parse(currentState.lastUpdatedAt || '') || 0;
    if (idbTime >= localTime) {
      if (needsIdbMigration) {
        await idbSaveEngineState(normalizedIdb);
        try {
          window.localStorage?.setItem(ENGINE_STORAGE_KEY, JSON.stringify(normalizedIdb));
        } catch {
          // Ignore quota limit; IndexedDB remains authoritative
        }
      }
      return { state: normalizedIdb, source: 'indexeddb' };
    }

    const saved = await idbSaveEngineState(currentState);
    if (!saved) {
      notifyPersistenceError('Gagal menyinkronkan data terbaru ke penyimpanan perangkat (IndexedDB).');
    }
    return { state: currentState, source: 'migrated_local' };
  }

  if (idbState && Number.isInteger(idbState.schemaVersion) && idbState.schemaVersion > ENGINE_SCHEMA_VERSION) {
    notifyPersistenceError('Penyimpanan IndexedDB berasal dari versi aplikasi yang lebih baru. Data tidak ditimpa otomatis.');
    return { state: currentState, source: 'fallback' };
  }

  const saved = await idbSaveEngineState(currentState);
  if (!saved && !hasValidLocalSnapshot) {
    // Both storages failed during initial write if localStorage wasn't populated
  }
  return {
    state: currentState,
    source: hasValidLocalSnapshot ? 'migrated_local' : 'fallback',
  };
}

export type PersistenceErrorListener = (errorMessage: string) => void;
const persistenceErrorListeners = new Set<PersistenceErrorListener>();

export function subscribePersistenceErrors(listener: PersistenceErrorListener): () => void {
  persistenceErrorListeners.add(listener);
  return () => {
    persistenceErrorListeners.delete(listener);
  };
}

function notifyPersistenceError(message: string): void {
  for (const listener of persistenceErrorListeners) {
    try {
      listener(message);
    } catch {
      // Never allow listener failures to break engine persistence flow
    }
  }
}

export interface PersistEngineOptions {
  saveToIdb?: (state: BusinessEngineState) => Promise<boolean>;
}

export function persistEngineState(
  state: BusinessEngineState,
  options?: PersistEngineOptions
): { localStorageOk: boolean; indexedDbPromise: Promise<boolean> } {
  if (typeof window === 'undefined') {
    return { localStorageOk: false, indexedDbPromise: Promise.resolve(false) };
  }

  let localStorageOk = false;
  if (window.localStorage) {
    try {
      window.localStorage.setItem(ENGINE_STORAGE_KEY, JSON.stringify(state));
      localStorageOk = true;
    } catch {
      localStorageOk = false;
    }
  }

  const idbSaver = options?.saveToIdb ?? idbSaveEngineState;
  const indexedDbPromise = Promise.resolve()
    .then(() => idbSaver(state))
    .catch(() => false)
    .then((idbOk) => {
      if (!localStorageOk && !idbOk) {
        notifyPersistenceError(
          'Memori penyimpanan perangkat penuh atau diblokir. Segera unduh file cadangan (.json) di menu Backup agar data transaksi tidak hilang.'
        );
      }
      return idbOk;
    });

  return { localStorageOk, indexedDbPromise };
}

const PIN_GUARD_STORAGE_KEY = 'karkasia_pin_guard_v1';
const PIN_MAX_FAILED_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 30_000;

interface PinGuardRecord {
  failedAttempts: number;
  lockedUntilMs: number;
}

let memoryPinGuard: PinGuardRecord = { failedAttempts: 0, lockedUntilMs: 0 };

function readPinGuardRecord(): PinGuardRecord {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(PIN_GUARD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PinGuardRecord>;
        if (
          parsed &&
          typeof parsed.failedAttempts === 'number' &&
          Number.isFinite(parsed.failedAttempts) &&
          typeof parsed.lockedUntilMs === 'number' &&
          Number.isFinite(parsed.lockedUntilMs)
        ) {
          memoryPinGuard = {
            failedAttempts: Math.max(0, Math.floor(parsed.failedAttempts)),
            lockedUntilMs: Math.max(0, parsed.lockedUntilMs),
          };
          return memoryPinGuard;
        }
      }
    } catch {
      // Fall back to in-memory guard record
    }
  }
  return memoryPinGuard;
}

function writePinGuardRecord(record: PinGuardRecord): void {
  memoryPinGuard = record;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(PIN_GUARD_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Ignore sessionStorage restrictions
    }
  }
}

export function resetPinAttemptGuard(): void {
  writePinGuardRecord({ failedAttempts: 0, lockedUntilMs: 0 });
}

export function checkPinAttemptGuard(nowMs: number = Date.now()): {
  allowed: boolean;
  remainingSeconds: number;
  failedAttempts: number;
} {
  const current = readPinGuardRecord();
  if (current.lockedUntilMs > nowMs) {
    const remainingSeconds = Math.max(1, Math.ceil((current.lockedUntilMs - nowMs) / 1000));
    return { allowed: false, remainingSeconds, failedAttempts: current.failedAttempts };
  }
  if (current.lockedUntilMs > 0 && current.lockedUntilMs <= nowMs) {
    const reset = { failedAttempts: 0, lockedUntilMs: 0 };
    writePinGuardRecord(reset);
    return { allowed: true, remainingSeconds: 0, failedAttempts: 0 };
  }
  return { allowed: true, remainingSeconds: 0, failedAttempts: current.failedAttempts };
}

export function recordPinAttemptOutcome(
  isValid: boolean,
  nowMs: number = Date.now()
): { locked: boolean; remainingSeconds: number; failedAttempts: number } {
  if (isValid) {
    resetPinAttemptGuard();
    return { locked: false, remainingSeconds: 0, failedAttempts: 0 };
  }
  const current = readPinGuardRecord();
  const baseFailures = current.lockedUntilMs > 0 && current.lockedUntilMs <= nowMs ? 0 : current.failedAttempts;
  const nextFailures = baseFailures + 1;
  if (nextFailures >= PIN_MAX_FAILED_ATTEMPTS) {
    const lockedUntilMs = nowMs + PIN_LOCKOUT_DURATION_MS;
    writePinGuardRecord({ failedAttempts: nextFailures, lockedUntilMs });
    return {
      locked: true,
      remainingSeconds: Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000),
      failedAttempts: nextFailures,
    };
  }
  writePinGuardRecord({ failedAttempts: nextFailures, lockedUntilMs: 0 });
  return { locked: false, remainingSeconds: 0, failedAttempts: nextFailures };
}

const OWNER_PIN_PBKDF2_ITERATIONS = 210_000;

function deriveOwnerPinHash(pin: string, saltHex: string): string {
  return bytesToHex(
    pbkdf2(sha256, utf8ToBytes(pin), hexToBytes(saltHex), {
      c: OWNER_PIN_PBKDF2_ITERATIONS,
      dkLen: 32,
    })
  );
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function createOwnerPinVerifier(pin: string): Pick<BusinessEngineState, 'ownerPinHash' | 'ownerPinSalt' | 'ownerPinNeedsChange'> {
  const salt = bytesToHex(randomBytes(16));
  return {
    ownerPinHash: deriveOwnerPinHash(pin, salt),
    ownerPinSalt: salt,
    ownerPinNeedsChange: false,
  };
}

function verifyOwnerPinHash(state: BusinessEngineState, pin: string): boolean {
  if (
    typeof pin !== 'string' ||
    !pin.trim() ||
    !state.ownerPinHash ||
    !state.ownerPinSalt
  ) return false;
  try {
    const candidate = deriveOwnerPinHash(pin.trim(), state.ownerPinSalt);
    return constantTimeHexEqual(candidate, state.ownerPinHash);
  } catch {
    return false;
  }
}

export function verifyOwnerPin(state: BusinessEngineState, pin: string): boolean {
  return state.ownerPinNeedsChange !== true && verifyOwnerPinHash(state, pin);
}

export function updateOwnerPin(
  state: BusinessEngineState,
  currentPin: string,
  newPin: string,
  actorName = 'Pemilik Usaha'
): EngineActionResult {
  const hasConfiguredPin = Boolean(state.ownerPinHash && state.ownerPinSalt);
  const currentPinValid = hasConfiguredPin
    ? verifyOwnerPinHash(state, currentPin)
    : typeof currentPin === 'string' && currentPin.trim() === '';
  if (!currentPinValid) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: hasConfiguredPin ? 'PIN lama tidak sesuai.' : 'PIN awal harus dikosongkan saat membuat PIN Owner pertama kali.',
    };
  }
  const cleanNewPin = newPin.trim();
  if (!/^\d{6}$/.test(cleanNewPin)) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN baru wajib tepat 6 digit angka.',
    };
  }
  if (cleanNewPin === '123456') {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN 123456 terlalu umum dan tidak boleh digunakan.',
    };
  }
  if (verifyOwnerPinHash(state, cleanNewPin)) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN baru harus berbeda dari PIN saat ini.',
    };
  }
  const verifier = createOwnerPinVerifier(cleanNewPin);
  const nextState: BusinessEngineState = {
    ...state,
    ...verifier,
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'OWNER',
        action: 'UBAH_PIN_PEMILIK',
        humanSummary: 'Verifier PIN Owner diperbarui dengan PBKDF2-SHA256 dan salt acak.',
        referenceId: 'SEC-PIN',
      }),
      ...state.auditTrail,
    ],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: 'PIN Owner berhasil diperbarui dengan penyimpanan hash bersalt.',
  };
}


export function addProductWithOpeningLot(
  state: BusinessEngineState,
  input: {
    id: string;
    sku: string;
    name: string;
    category: string;
    basePricePerKg: number;
    stockGram: number;
    safetyStockGram: number;
    tag?: string;
    estimatedHppPerKg?: number;
    openingLotExpiryDate?: string;
    openingLotLocation?: string;
    imageUrl?: string;
  },
  actorName = 'Admin Toko',
  _isOnline = true
): EngineActionResult {
  const cleanName = input.name?.trim() || '';
  const cleanSku = input.sku?.trim().toUpperCase() || '';
  const cleanId = input.id?.trim() || `PROD_${generateUUID().slice(0, 8)}`;
  if (!cleanName || !cleanSku) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Nama produk dan SKU wajib diisi.',
    };
  }
  if (!Number.isFinite(input.basePricePerKg) || input.basePricePerKg <= 0) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Harga jual per KG harus lebih dari Rp 0.',
    };
  }
  const safePricePerKg = Math.round(input.basePricePerKg);
  const safeStockGram = Number.isFinite(input.stockGram) ? Math.max(0, Math.round(input.stockGram)) : 0;
  const safeSafetyGram = Number.isFinite(input.safetyStockGram)
    ? Math.max(0, Math.round(input.safetyStockGram))
    : 0;
  const safeHppPerKg =
    Number.isFinite(input.estimatedHppPerKg) && (input.estimatedHppPerKg ?? 0) > 0
      ? Math.round(input.estimatedHppPerKg!)
      : 0;
  const openingLotExpiryDate = input.openingLotExpiryDate?.trim() || '';
  const openingLotLocation = input.openingLotLocation?.trim() || '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryParts = openingLotExpiryDate.split('-').map(Number);
  const expiryMidnight = expiryParts.length === 3 && expiryParts.every(Number.isFinite)
    ? new Date(expiryParts[0], expiryParts[1] - 1, expiryParts[2])
    : new Date(Number.NaN);
  const expiryDateValid = Number.isFinite(expiryMidnight.getTime()) &&
    expiryMidnight.getFullYear() === expiryParts[0] &&
    expiryMidnight.getMonth() === expiryParts[1] - 1 &&
    expiryMidnight.getDate() === expiryParts[2];

  if (
    state.products.some(
      (p) => p.id === cleanId || p.sku.trim().toUpperCase() === cleanSku
    )
  ) {
    return {
      ok: false,
      state,
      errorCode: 'DUPLICATE',
      message: `Produk dengan SKU ${cleanSku} sudah terdaftar di master katalog.`,
    };
  }

  if (safeStockGram > 0 && safeHppPerKg <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'HPP per KG wajib diisi jika stok awal lebih dari 0.' };
  }
  if (safeStockGram > 0 && (
    !/^\d{4}-\d{2}-\d{2}$/.test(openingLotExpiryDate) ||
    !expiryDateValid ||
    expiryMidnight <= today ||
    !openingLotLocation
  )) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Stok awal membutuhkan tanggal kedaluwarsa aktual (masa depan) dan lokasi freezer/rak yang valid.' };
  }

  const newProduct: ProductEntity = {
    id: cleanId,
    sku: cleanSku,
    name: cleanName,
    basePricePerKg: safePricePerKg,
    movingAvgHppPerKg: safeHppPerKg,
    imageUrl: input.imageUrl?.trim() || undefined,
    tierPrices: {
      RETAIL: safePricePerKg,
      HOREKA: Math.round(safePricePerKg * 0.9),
      VIP: Math.round(safePricePerKg * 0.82),
    },
    category: input.category?.trim() || 'PRIMAL',
    stockGram: 0,
    safetyStockGram: safeSafetyGram,
    tag: input.tag?.trim() || 'Produk Baru',
  };

  let nextLots = [...state.lots];
  let nextLedger = [...state.stockLedger];
  let nextJournals = [...state.journals];
  let nextOutbox = [...state.syncOutbox];
  const idemKey = `NEW-PROD-${cleanId}-${generateUUID().slice(0, 8)}`;

  if (safeStockGram > 0) {
    const seq = nextMonotonicSequence(
      state.lots.map((l) => l.code),
      /^LOT-IN-\d{6}-(\d+)$/,
      1
    );
    const datePart = formatLocalYmd(new Date()).slice(2).replace(/-/g, '');
    const lotCode = `LOT-IN-${datePart}-${String(seq).padStart(2, '0')}`;
    const expiryDate = openingLotExpiryDate;
    const daysLeft = computeDaysLeftFromExpiry(expiryDate, new Date(), 0);
    const openingValue = Math.round((safeStockGram * safeHppPerKg) / 1000);
    const newLot: BatchLotEntity = {
      id: `LOT_${Date.now()}_${generateUUID().slice(0, 4)}`,
      code: lotCode,
      product: cleanName,
      productId: cleanId,
      daysLeft,
      expiryDate,
      weightGram: safeStockGram,
      maxCapacityGram: Math.max(safeStockGram, 1),
      hppKgRupiah: safeHppPerKg,
      loc: openingLotLocation,
      isFefo: true,
      isQuarantined: false,
    };
    nextLots = [newLot, ...nextLots];
    nextLedger = [
      {
        uuid: generateUUID(),
        idempotencyKey: idemKey,
        timestamp: nowIso(),
        actorName,
        type: 'IN_ADJUST',
        humanLabel: 'Stok Awal Produk Baru',
        productName: cleanName,
        lotId: newLot.id,
        lotCode,
        weightGramDelta: safeStockGram,
        unitCostPerKg: safeHppPerKg,
        valueRupiahDelta: openingValue,
        movingAvgHppAfterKg: safeHppPerKg,
        referenceNo: cleanSku,
        note: `Stok awal batch ${lotCode} saat pendaftaran produk ${cleanName}`,
      },
      ...nextLedger,
    ];
    if (openingValue > 0) {
      nextJournals = [
        buildDerivedJournal({
          idempotencyKey: idemKey,
          referenceNo: cleanSku,
          category: 'PENYESUAIAN',
          description: `Stok awal produk baru ${cleanName} (${(safeStockGram / 1000).toFixed(1)} kg)`,
          lines: [
            { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: openingValue, credit: 0 },
            { accountCode: '3101', accountName: 'Penyesuaian Modal Persediaan', debit: 0, credit: openingValue },
          ],
        }),
        ...nextJournals,
      ];
    }
    nextOutbox = [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'OPNAME',
        summary: `Produk baru ${cleanName} (${(safeStockGram / 1000).toFixed(1)} kg)`,
        payload: {
          kind: 'NEW_PRODUCT_OPENING_LOT',
          productId: cleanId,
          sku: cleanSku,
          lotCode,
          stockGram: safeStockGram,
          hppKgRupiah: safeHppPerKg,
        },
      }),
      ...nextOutbox,
    ];
  }

  const nextProducts = syncProductsStockFromLots([newProduct, ...state.products], nextLots);
  const nextStateBase: BusinessEngineState = {
    ...state,
    products: nextProducts,
    lots: nextLots,
    stockLedger: nextLedger,
    journals: nextJournals,
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'ADMIN',
        action: 'TAMBAH_PRODUK_BARU',
        humanSummary: `Menambahkan produk ${cleanName} (${cleanSku}) dengan stok awal ${(safeStockGram / 1000).toFixed(1)} kg.`,
        referenceId: cleanSku,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: nextOutbox,
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: nowIso(),
  };
  const withProductOutbox = appendMasterDataChanges(nextStateBase, 'PRODUCT', state.products, nextProducts);
  const nextState = appendMasterDataChanges(withProductOutbox, 'LOT', state.lots, nextLots);

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `${cleanName} (${cleanSku}) beserta batch stok ${(safeStockGram / 1000).toFixed(1)} kg siap dijual.`,
  };
}

export function addProductCategory(
  state: BusinessEngineState,
  newCategory: ProductCategoryEntity
): EngineActionResult {
  const cleanId = newCategory.id.trim().toUpperCase();
  const cleanLabel = newCategory.label.trim();
  if (!cleanId || !cleanLabel) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Kode dan nama kategori produk wajib diisi.',
    };
  }
  const existing = state.categories ?? [];
  if (existing.some((c) => c.id.toUpperCase() === cleanId)) {
    return {
      ok: false,
      state,
      errorCode: 'DUPLICATE',
      message: `Kategori ${cleanId} sudah terdaftar.`,
    };
  }
  const normalizedCat: ProductCategoryEntity = {
    id: cleanId,
    label: cleanLabel,
    description: newCategory.description?.trim() || undefined,
    color: newCategory.color?.trim() || 'emerald',
    isCore: newCategory.isCore === true,
  };
  const nextState = appendMasterDataChanges({
    ...state,
    categories: [...existing, normalizedCat],
    lastUpdatedAt: nowIso(),
  }, 'CATEGORY', existing, [...existing, normalizedCat]);
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Kategori ${normalizedCat.label} (${normalizedCat.id}) berhasil disimpan.`,
  };
}

export function deleteProductCategory(
  state: BusinessEngineState,
  categoryId: string
): EngineActionResult {
  const existing = state.categories ?? [];
  const target = existing.find((c) => c.id === categoryId);
  if (!target) {
    return {
      ok: false,
      state,
      errorCode: 'NOT_FOUND',
      message: 'Kategori tidak ditemukan.',
    };
  }
  if (target.isCore) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Kategori inti "${target.label}" tidak dapat dihapus.`,
    };
  }
  const nextCategories = existing.filter((c) => c.id !== categoryId);
  const nextState = appendMasterDataChanges({
    ...state,
    categories: nextCategories,
    lastUpdatedAt: nowIso(),
  }, 'CATEGORY', existing, nextCategories);
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Kategori ${categoryId} telah dihapus dari daftar.`,
  };
}

export function addSupplierRecord(
  state: BusinessEngineState,
  supplierName: string,
  contactPhone?: string
): EngineActionResult {
  const trimmedName = supplierName.trim();
  if (!trimmedName) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Nama supplier tidak boleh kosong.',
    };
  }
  const existing = state.suppliers ?? [];
  const alreadyExists = existing.some((s) => s.trim().toLowerCase() === trimmedName.toLowerCase());
  const nextSuppliers = alreadyExists ? existing : [trimmedName, ...existing];
  const nextPhones = { ...(state.supplierPhones ?? {}) };
  if (contactPhone && contactPhone.trim()) {
    nextPhones[trimmedName] = contactPhone.trim();
  }
  const nextStateWithSuppliers = appendMasterDataChanges({
    ...state,
    suppliers: nextSuppliers,
    supplierPhones: nextPhones,
    lastUpdatedAt: nowIso(),
  }, 'SUPPLIER', existing.map((name) => ({ id: name, name })), nextSuppliers.map((name) => ({ id: name, name })));
  const nextState = appendMasterDataChanges(
    nextStateWithSuppliers,
    'SUPPLIER_PHONE',
    Object.entries(state.supplierPhones ?? {}).map(([name, phone]) => ({ id: name, phone })),
    Object.entries(nextPhones).map(([name, phone]) => ({ id: name, phone }))
  );
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Supplier ${trimmedName} berhasil disimpan permanen.`,
  };
}

export function updateSupplierPhoneRecord(
  state: BusinessEngineState,
  supplierName: string,
  phone: string,
  invoiceId?: string
): EngineActionResult {
  const trimmedName = supplierName.trim();
  const trimmedPhone = phone.trim();
  if (!trimmedName || !trimmedPhone) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Nama supplier dan nomor kontak wajib diisi.',
    };
  }
  const existing = state.suppliers ?? [];
  const nextSuppliers = existing.some((s) => s.trim().toLowerCase() === trimmedName.toLowerCase())
    ? existing
    : [trimmedName, ...existing];
  const nextPhones = {
    ...(state.supplierPhones ?? {}),
    [trimmedName]: trimmedPhone,
  };
  const nextInvoices = invoiceId
    ? state.supplierInvoices.map((inv) =>
        inv.id === invoiceId || inv.supplier === trimmedName
          ? { ...inv, supplierPhone: trimmedPhone }
          : inv
      )
    : state.supplierInvoices;

  const nextStateWithSuppliers = appendMasterDataChanges({
    ...state,
    suppliers: nextSuppliers,
    supplierPhones: nextPhones,
    supplierInvoices: nextInvoices,
    lastUpdatedAt: nowIso(),
  }, 'SUPPLIER', existing.map((name) => ({ id: name, name })), nextSuppliers.map((name) => ({ id: name, name })));
  const nextState = appendMasterDataChanges(
    nextStateWithSuppliers,
    'SUPPLIER_PHONE',
    Object.entries(state.supplierPhones ?? {}).map(([name, phone]) => ({ id: name, phone })),
    Object.entries(nextPhones).map(([name, phone]) => ({ id: name, phone }))
  );
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Nomor WhatsApp ${trimmedName} berhasil diperbarui.`,
  };
}

export function toggleBazarPromo(state: BusinessEngineState, promoId: string): EngineActionResult {
  const currentPromos = state.bazarPromos ?? [];
  const target = currentPromos.find((p) => p.id === promoId);
  if (!target) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Promo bazar tidak ditemukan.' };
  }
  const nextPromos = currentPromos.map((p) => (p.id === promoId ? { ...p, isActive: !p.isActive } : p));
  const nextState = appendMasterDataChanges({
    ...state,
    bazarPromos: nextPromos,
    lastUpdatedAt: nowIso(),
  }, 'BAZAR_PROMO', currentPromos, nextPromos);
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    updatedBazarPromos: nextPromos,
    message: `Promo "${target.badgeLabel || target.id}" ${!target.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
  };
}

export function createBazarPromo(state: BusinessEngineState, newPromo: BazarPromoEntity): EngineActionResult {
  const currentPromos = state.bazarPromos ?? [];
  const nextPromos = [{ ...newPromo }, ...currentPromos.filter((p) => p.id !== newPromo.id)];
  const nextState = appendMasterDataChanges({
    ...state,
    bazarPromos: nextPromos,
    lastUpdatedAt: nowIso(),
  }, 'BAZAR_PROMO', currentPromos, nextPromos);
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    updatedBazarPromos: nextPromos,
    message: `Promo bazar "${newPromo.title || newPromo.badgeLabel}" disimpan.`,
  };
}

// ============================================================================
// CORE BUSINESS OPERATIONS (PURE STATE TRANSITIONS)
// ============================================================================

export function commitSaleTransaction(
  state: BusinessEngineState,
  input: {
    idempotencyKey: string;
    customerId: string;
    paymentMethod: PaymentMethod;
    isFreeShipping: boolean;
    shippingFee: number;
    discountRupiah?: number;
    cashTendered: number;
    paidAmountRupiah?: number;
    items: Array<{
      product: ProductEntity;
      weightGram: number;
      effectivePricePerKg: number;
      appliedPromoId?: string;
    }>;
    bazarPromos?: BazarPromoInput[];
    now?: Date;
    ownerApprovedOverride?: boolean;
    isOnline: boolean;
    actorName?: string;
  }
): EngineActionResult {
  const referenceDate = input.now ?? new Date();
  // 1. Duplicate Prevention (Idempotency)
  if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string' || !input.idempotencyKey.trim()) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Kunci transaksi (idempotencyKey) tidak valid.',
    };
  }
  if (
    state.processedIdempotencyKeys.includes(input.idempotencyKey) ||
    state.transactions.some((t) => t.idempotencyKey === input.idempotencyKey)
  ) {
    return {
      ok: false,
      state,
      errorCode: 'DUPLICATE',
      message: 'Transaksi ini sudah tercatat sebelumnya. Sistem otomatis mencegah pencatatan ganda.',
    };
  }

  // 2. Strict Input Validation (Before ANY calculation or mutation)
  if (!input.items || input.items.length === 0) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Keranjang masih kosong. Tambahkan minimal 1 produk daging sebelum membayar.',
    };
  }

  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'TRANSFER' && input.paymentMethod !== 'TEMPO') {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Metode pembayaran tidak valid.',
    };
  }

  for (const item of input.items) {
    if (!item.product || typeof item.product.id !== 'string' || !item.product.id.trim()) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: 'Identitas produk pada keranjang tidak valid.',
      };
    }
    if (!Number.isFinite(item.weightGram) || !Number.isInteger(item.weightGram) || item.weightGram <= 0) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: `Berat produk ${item.product.name} harus berupa bilangan bulat gram lebih dari 0.`,
      };
    }
    if (
      !Number.isFinite(item.effectivePricePerKg) ||
      !Number.isInteger(item.effectivePricePerKg) ||
      item.effectivePricePerKg <= 0
    ) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: `Harga per KG produk ${item.product.name} harus berupa integer Rupiah lebih dari Rp 0.`,
      };
    }
    const masterProd = state.products.find((p) => p.id === item.product.id);
    if (!masterProd) {
      return {
        ok: false,
        state,
        errorCode: 'NOT_FOUND',
        message: `Produk ${item.product.name} (${item.product.id}) tidak ditemukan di master katalog.`,
      };
    }
  }

  const customer = state.customers.find((c) => c.id === input.customerId);
  if (!customer) {
    return {
      ok: false,
      state,
      errorCode: 'NOT_FOUND',
      message: 'Data pelanggan tidak ditemukan.',
    };
  }

  if (!Number.isFinite(input.shippingFee) || !Number.isInteger(input.shippingFee) || input.shippingFee < 0) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Biaya ongkos kirim tidak valid.',
    };
  }

  const rawDiscount = input.discountRupiah ?? 0;
  if (!Number.isFinite(rawDiscount) || !Number.isInteger(rawDiscount) || rawDiscount < 0) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Nominal diskon harus berupa bilangan bulat Rupiah >= 0.',
    };
  }

  // 2b. Validate & simulate Bazar Promo status, date period, and remaining quota (applied only if commit succeeds)
  const sourcePromos = input.bazarPromos ?? state.bazarPromos;
  const workingPromos = sourcePromos ? sourcePromos.map((p) => ({ ...p })) : undefined;
  const resolvedPromoIds: Array<string | undefined> = input.items.map(() => undefined);
  let hasPromoUsage = false;

  if (workingPromos || input.items.some((i) => i.appliedPromoId)) {
    for (let idx = 0; idx < input.items.length; idx++) {
      const item = input.items[idx];
      const prodRef = state.products.find((p) => p.id === item.product.id)!;
      const normalTierPricing = calculateProductTierPrice(
        prodRef,
        customer.tier,
        item.weightGram,
        [],
        referenceDate
      );

      if (item.appliedPromoId) {
        const promo = workingPromos?.find((p) => p.id === item.appliedPromoId);
        if (!promo || promo.sku !== prodRef.sku) {
          return {
            ok: false,
            state,
            errorCode: 'VALIDATION',
            message: `Promo bazar untuk ${prodRef.name} tidak ditemukan.`,
          };
        }
        if (!isBazarPromoEligible(promo, item.weightGram, referenceDate)) {
          return {
            ok: false,
            state,
            errorCode: 'VALIDATION',
            message: `Promo bazar "${promo.badgeLabel || promo.id}" tidak aktif, di luar periode, atau sisa kuota tidak mencukupi.`,
          };
        }
        const nextSoldGram = Math.round(promo.soldKg * 1000) + item.weightGram;
        promo.soldKg = Number((nextSoldGram / 1000).toFixed(3));
        resolvedPromoIds[idx] = promo.id;
        hasPromoUsage = true;
      } else if (workingPromos) {
        const eligiblePromo = workingPromos.find(
          (p) =>
            p.sku === prodRef.sku &&
            Math.round(p.promoPricePerKg) === item.effectivePricePerKg &&
            Math.round(p.promoPricePerKg) < normalTierPricing.effectivePricePerKg &&
            isBazarPromoEligible(p, item.weightGram, referenceDate)
        );
        if (eligiblePromo) {
          const nextSoldGram = Math.round(eligiblePromo.soldKg * 1000) + item.weightGram;
          eligiblePromo.soldKg = Number((nextSoldGram / 1000).toFixed(3));
          resolvedPromoIds[idx] = eligiblePromo.id;
          hasPromoUsage = true;
        } else {
          const matchingPromoAttempt = workingPromos.find(
            (p) =>
              p.sku === prodRef.sku &&
              Math.round(p.promoPricePerKg) === item.effectivePricePerKg &&
              Math.round(p.promoPricePerKg) < normalTierPricing.effectivePricePerKg
          );
          if (matchingPromoAttempt) {
            return {
              ok: false,
              state,
              errorCode: 'VALIDATION',
              message: `Promo bazar "${matchingPromoAttempt.badgeLabel || matchingPromoAttempt.id}" tidak aktif, di luar periode, atau sisa kuota tidak mencukupi.`,
            };
          }
        }
      }
    }
  }

  // 3. Deterministic Sales Calculation (Zero-Float Integer Math)
  const lineCalculations = input.items.map((item, idx) => {
    const prodRef = state.products.find((p) => p.id === item.product.id)!;
    const lineTotalRupiah = Math.round((item.weightGram * item.effectivePricePerKg) / 1000);
    return {
      prodRef,
      weightGram: item.weightGram,
      effectivePricePerKg: item.effectivePricePerKg,
      lineTotalRupiah,
      appliedPromoId: resolvedPromoIds[idx],
    };
  });

  const totalWeightGram = lineCalculations.reduce((acc, i) => acc + i.weightGram, 0);
  const subtotalRupiah = lineCalculations.reduce((acc, i) => acc + i.lineTotalRupiah, 0);

  if (rawDiscount > subtotalRupiah) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Diskon (Rp ${rawDiscount.toLocaleString('id-ID')}) tidak boleh melebihi subtotal transaksi (Rp ${subtotalRupiah.toLocaleString('id-ID')}).`,
    };
  }

  const effectiveShipping = input.isFreeShipping ? 0 : input.shippingFee;
  const grandTotalRupiah = subtotalRupiah - rawDiscount + effectiveShipping;

  // 4. Payment & Remaining Balance Validation
  let paidAmountRupiah = 0;
  let cashTendered = 0;
  let changeRupiah = 0;
  let balanceDueRupiah = 0;

  if (input.paymentMethod === 'CASH') {
    if (!Number.isFinite(input.cashTendered) || !Number.isInteger(input.cashTendered) || input.cashTendered < 0) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: 'Nominal uang tunai tidak valid.',
      };
    }
    if (input.cashTendered < grandTotalRupiah) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: `Uang tunai kurang Rp ${(grandTotalRupiah - input.cashTendered).toLocaleString('id-ID')}.`,
      };
    }
    cashTendered = input.cashTendered;
    changeRupiah = cashTendered - grandTotalRupiah;
    paidAmountRupiah = grandTotalRupiah;
    balanceDueRupiah = 0;
  } else if (input.paymentMethod === 'TRANSFER') {
    if (
      input.paidAmountRupiah !== undefined &&
      (!Number.isFinite(input.paidAmountRupiah) ||
        !Number.isInteger(input.paidAmountRupiah) ||
        input.paidAmountRupiah !== grandTotalRupiah)
    ) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: 'Pembayaran transfer harus lunas sesuai total tagihan.',
      };
    }
    paidAmountRupiah = grandTotalRupiah;
    cashTendered = 0;
    changeRupiah = 0;
    balanceDueRupiah = 0;
  } else {
    // TEMPO (optional DP via paidAmountRupiah, default 0)
    const dp = input.paidAmountRupiah ?? 0;
    if (!Number.isFinite(dp) || !Number.isInteger(dp) || dp < 0 || dp > grandTotalRupiah) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: 'Nominal uang muka (DP) tempo tidak valid.',
      };
    }
    paidAmountRupiah = dp;
    cashTendered = dp;
    changeRupiah = 0;
    balanceDueRupiah = grandTotalRupiah - dp;
  }

  // 5. Pre-Mutation FEFO Stock Availability Validation (No silent virtual lots!)
  let workingLots = state.lots.map((l) => ({ ...l }));
  const allAllocations: LotAllocationRecord[] = [];
  let totalCogsRupiah = 0;
  const itemAllocationsList: Array<{
    prodRef: ProductEntity;
    weightGram: number;
    allocations: LotAllocationRecord[];
  }> = [];

  for (const line of lineCalculations) {
    const fefoRes = allocateLotsFEFO(
      workingLots,
      { productId: line.prodRef.id, productName: line.prodRef.name },
      line.weightGram,
      line.prodRef.movingAvgHppPerKg,
      referenceDate
    );

    if (fefoRes.shortGram > 0) {
      const availableGram = line.weightGram - fefoRes.shortGram;
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: `Stok lot layak jual untuk ${line.prodRef.name} tidak mencukupi (diminta ${(line.weightGram / 1000).toFixed(2)} kg, tersedia ${(availableGram / 1000).toFixed(2)} kg).`,
      };
    }

    workingLots = fefoRes.updatedLots;
    allAllocations.push(...fefoRes.allocations);
    totalCogsRupiah += fefoRes.totalCogsRupiah;
    itemAllocationsList.push({
      prodRef: line.prodRef,
      weightGram: line.weightGram,
      allocations: fefoRes.allocations,
    });
  }

  // 6. Credit limit is warning-only by business decision. It must never block checkout.
  const projectedReceivable = customer.currentReceivable + balanceDueRupiah;
  const exceedsCredit =
    input.paymentMethod === 'TEMPO' &&
    balanceDueRupiah > 0 &&
    (customer.creditLimit === 0 || projectedReceivable > customer.creditLimit);

  // 7. Build Immutable Stock Ledger Entries (Strict 1-to-1 per Lot Allocation)
  const nextInvSeq = nextMonotonicSequence(
    state.transactions.map((t) => t.invoiceNumber),
    /^INV-\d{6}-(\d+)$/,
    101
  );
  const seq = String(nextInvSeq).padStart(4, '0');
  const datePart = formatLocalYmd(referenceDate).slice(2).replace(/-/g, '');
  const invoiceNumber = `INV-${datePart}-${seq}`;
  const actor = input.actorName || 'Kasir Toko';
  const txTimestamp = nowIso();

  const newLedgerEntries: StockLedgerEntry[] = [];
  for (const entry of itemAllocationsList) {
    const avgHpp = entry.prodRef.movingAvgHppPerKg || Math.round(entry.prodRef.basePricePerKg * 0.75);
    for (const alloc of entry.allocations) {
      newLedgerEntries.push({
        uuid: generateUUID(),
        idempotencyKey: input.idempotencyKey,
        timestamp: txTimestamp,
        actorName: actor,
        type: 'OUT_SALE',
        humanLabel: 'Penjualan Kasir',
        productName: entry.prodRef.name,
        lotId: alloc.lotId,
        lotCode: alloc.lotCode,
        weightGramDelta: -alloc.weightGram,
        unitCostPerKg: alloc.hppPerKg,
        valueRupiahDelta: -alloc.cogsRupiah,
        movingAvgHppAfterKg: avgHpp,
        referenceNo: invoiceNumber,
        note: `Terjual ke ${customer.name} (${(alloc.weightGram / 1000).toFixed(2)} kg)`,
      });
    }
  }

  const updatedProducts = syncProductsStockFromLots(state.products, workingLots, referenceDate);

  // 8. Build Sales Transaction Record
  const txUuid = generateUUID();
  const txRecord: SalesTransactionRecord = {
    uuid: txUuid,
    idempotencyKey: input.idempotencyKey,
    invoiceNumber,
    timestamp: txTimestamp,
    customerId: customer.id,
    customerName: customer.name,
    customerTier: customer.tier,
    paymentMethod: input.paymentMethod,
    tempoDays: input.paymentMethod === 'TEMPO' ? customer.termDays || 7 : 0,
    totalWeightGram,
    subtotalRupiah,
    discountRupiah: rawDiscount,
    shippingFee: effectiveShipping,
    isFreeShipping: input.isFreeShipping,
    grandTotalRupiah,
    paidAmountRupiah,
    cashTendered,
    changeRupiah,
    balanceDueRupiah,
    totalCogsRupiah,
    grossProfitRupiah: grandTotalRupiah - totalCogsRupiah,
    status: 'COMPLETED',
    items: lineCalculations.map((l) => ({
      productId: l.prodRef.id,
      productName: l.prodRef.name,
      weightGram: l.weightGram,
      effectivePricePerKg: l.effectivePricePerKg,
      lineTotalRupiah: l.lineTotalRupiah,
      movingAvgHppPerKg: l.prodRef.movingAvgHppPerKg || Math.round(l.prodRef.basePricePerKg * 0.75),
      ...(l.appliedPromoId ? { appliedPromoId: l.appliedPromoId } : {}),
    })),
    lotAllocations: allAllocations,
  };

  // 9. Update Cash or Receivables + Customer balance
  const cashDelta =
    input.paymentMethod === 'CASH'
      ? paidAmountRupiah
      : input.paymentMethod === 'TEMPO'
      ? paidAmountRupiah
      : 0;
  const nextCashInHand = state.cashInHandRupiah + cashDelta;

  const updatedCustomers = state.customers.map((c) => {
    if (c.id === customer.id && balanceDueRupiah > 0) {
      return { ...c, currentReceivable: c.currentReceivable + balanceDueRupiah };
    }
    return c;
  });

  const nextReceivables = [...state.receivables];
  if (input.paymentMethod === 'TEMPO' && balanceDueRupiah > 0) {
    const dueDays = customer.termDays || 7;
    const dueObj = new Date(Date.now() + dueDays * 86400000);
    const dueLabel =
      dueObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ` (${dueDays} hari lagi)`;
    nextReceivables.unshift({
      id: `REC_${Date.now()}`,
      customerId: customer.id,
      customer: customer.name,
      tier: customer.tier,
      amount: balanceDueRupiah,
      limit: customer.creditLimit,
      dueDate: dueLabel,
      category: dueDays <= 7 ? 'AKAN_DATANG' : 'LEBIH_7_HARI',
      daysDiff: dueDays,
      invoice: invoiceNumber,
      itemsSummary: lineCalculations
        .map((i) => `${(i.weightGram / 1000).toFixed(1)} KG ${i.prodRef.name.split('(')[0].trim()}`)
        .join(', '),
      phone: customer.phone,
      status: 'BELUM_LUNAS',
    });
  }

  // 10. Derived Accounting Journal (Double-Entry, balanced automatically!)
  const journalPaymentLines: JournalLine[] = [];
  if (input.paymentMethod === 'CASH') {
    journalPaymentLines.push({ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: grandTotalRupiah, credit: 0 });
  } else if (input.paymentMethod === 'TRANSFER') {
    journalPaymentLines.push({ accountCode: '1102', accountName: 'Rekening Bank BCA Usaha', debit: grandTotalRupiah, credit: 0 });
  } else {
    if (paidAmountRupiah > 0) {
      journalPaymentLines.push({ accountCode: '1101', accountName: 'Kas Tunai Toko (DP)', debit: paidAmountRupiah, credit: 0 });
    }
    if (balanceDueRupiah > 0) {
      journalPaymentLines.push({ accountCode: '1201', accountName: 'Piutang Pelanggan (Tempo)', debit: balanceDueRupiah, credit: 0 });
    }
  }

  const derivedJournal = buildDerivedJournal({
    idempotencyKey: input.idempotencyKey,
    referenceNo: invoiceNumber,
    category: 'PENJUALAN',
    description: `Penjualan ${input.paymentMethod === 'CASH' ? 'Tunai' : input.paymentMethod === 'TRANSFER' ? 'Transfer' : 'Tempo'} ke ${customer.name} (${(totalWeightGram / 1000).toFixed(1)} kg)`,
    lines: [
      ...journalPaymentLines,
      ...(rawDiscount > 0
        ? [{ accountCode: '4103', accountName: 'Potongan Penjualan', debit: rawDiscount, credit: 0 }]
        : []),
      { accountCode: '4101', accountName: 'Pendapatan Penjualan Daging', debit: 0, credit: subtotalRupiah },
      ...(effectiveShipping > 0
        ? [{ accountCode: '4102', accountName: 'Pendapatan Jasa Pengiriman', debit: 0, credit: effectiveShipping }]
        : []),
      { accountCode: '5101', accountName: 'Harga Pokok Penjualan (HPP)', debit: totalCogsRupiah, credit: 0 },
      { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: 0, credit: totalCogsRupiah },
    ],
  });

  // 11. Audit Trail & Sync Outbox
  const auditEntry = buildAuditEntry({
    actorName: actor,
    actorRole: 'SALES',
    action: 'TRANSAKSI_PENJUALAN',
    humanSummary: `Faktur ${invoiceNumber} untuk ${customer.name} senilai Rp ${grandTotalRupiah.toLocaleString('id-ID')} (${(totalWeightGram / 1000).toFixed(2)} kg)${input.ownerApprovedOverride ? ' [Dengan Izin Pemilik]' : ''}.`,
    referenceId: invoiceNumber,
  });

  const syncItem = buildSyncItem({
    idempotencyKey: input.idempotencyKey,
    entityType: 'SALE',
    summary: `${invoiceNumber} • ${customer.name} • Rp ${grandTotalRupiah.toLocaleString('id-ID')}`,
    payload: {
      transactionUuid: txRecord.uuid,
      invoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      paymentMethod: input.paymentMethod,
      totalWeightGram,
      subtotalRupiah,
      discountRupiah: rawDiscount,
      grandTotalRupiah,
      paidAmountRupiah,
      balanceDueRupiah,
      totalCogsRupiah,
      items: txRecord.items,
      lotAllocations: txRecord.lotAllocations,
    },
  });

  const nextPersistedPromos = hasPromoUsage && workingPromos ? workingPromos : state.bazarPromos;

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: nextCashInHand,
    products: updatedProducts,
    lots: workingLots,
    customers: updatedCustomers,
    receivables: nextReceivables,
    transactions: [txRecord, ...state.transactions],
    stockLedger: [...newLedgerEntries, ...state.stockLedger],
    journals: [derivedJournal, ...state.journals],
    auditTrail: [auditEntry, ...state.auditTrail],
    syncOutbox: [syncItem, ...state.syncOutbox],
    processedIdempotencyKeys: [input.idempotencyKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    ...(nextPersistedPromos !== undefined ? { bazarPromos: nextPersistedPromos } : {}),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);

  return {
    ok: true,
    state: nextState,
    createdInvoice: txRecord,
    updatedBazarPromos: hasPromoUsage ? workingPromos : (input.bazarPromos ?? state.bazarPromos),
    message: exceedsCredit
      ? `Transaksi ${invoiceNumber} berhasil dicatat. PERINGATAN: plafon kredit pelanggan terlampaui; tindak lanjuti piutang.`
      : `Transaksi ${invoiceNumber} berhasil dicatat. Stok dan laporan otomatis diperbarui.`,
  };
}

/**
 * No Silent Modification: Void creates full reversal entries instead of deleting records
 */
export function voidSaleTransaction(
  state: BusinessEngineState,
  txUuid: string,
  reason: string,
  actorName = 'Pemilik Toko',
  _isOnline = true,
  bazarPromos?: BazarPromoInput[],
  options?: { ownerPin?: string }
): EngineActionResult {
  if (!options?.ownerPin || !verifyOwnerPin(state, options.ownerPin)) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN Pemilik wajib diisi dan harus benar. Pembatalan transaksi dibatalkan demi keamanan.',
    };
  }
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (!cleanReason) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Alasan pembatalan transaksi wajib diisi.',
    };
  }
  const tx = state.transactions.find((t) => t.uuid === txUuid);
  if (!tx) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Transaksi tidak ditemukan.' };
  }
  const voidIdemKey = `VOID-${tx.uuid}`;
  if (tx.status === 'VOIDED' || state.processedIdempotencyKeys.includes(voidIdemKey)) {
    return { ok: false, state, errorCode: 'ALREADY_VOIDED', message: 'Transaksi ini sudah dibatalkan sebelumnya.' };
  }

  // Restore Bazar Promo quota accurately in integer grams for every item using a promo
  const sourcePromos = bazarPromos ?? state.bazarPromos;
  let restoredPromos: BazarPromoInput[] | undefined = sourcePromos
    ? sourcePromos.map((p) => ({ ...p }))
    : undefined;
  let restoredAnyPromo = false;

  if (restoredPromos) {
    for (const item of tx.items) {
      if (!item.appliedPromoId) continue;
      const targetPromo = restoredPromos.find((p) => p.id === item.appliedPromoId);
      if (targetPromo) {
        const nextSoldGram = Math.max(
          0,
          Math.round(targetPromo.soldKg * 1000) - Math.round(item.weightGram)
        );
        targetPromo.soldKg = Number((nextSoldGram / 1000).toFixed(3));
        restoredAnyPromo = true;
      }
    }
  }

  // Restore lots from exact lot allocations
  const updatedLots = state.lots.map((lot) => {
    const restored = tx.lotAllocations
      .filter((a) => a.lotId === lot.id)
      .reduce((acc, a) => acc + a.weightGram, 0);
    return restored > 0 ? { ...lot, weightGram: lot.weightGram + restored } : lot;
  });

  const updatedProducts = syncProductsStockFromLots(state.products, updatedLots);

  const reversedReceivable =
    tx.paymentMethod === 'TEMPO' ? (tx.balanceDueRupiah ?? tx.grandTotalRupiah) : 0;
  const reversedCash =
    tx.paymentMethod === 'CASH'
      ? (tx.paidAmountRupiah ?? tx.grandTotalRupiah)
      : tx.paymentMethod === 'TEMPO'
      ? (tx.paidAmountRupiah ?? 0)
      : 0;

  const nextCash = Math.max(0, state.cashInHandRupiah - reversedCash);

  const updatedCustomers = state.customers.map((c) => {
    if (c.id === tx.customerId && reversedReceivable > 0) {
      return { ...c, currentReceivable: Math.max(0, c.currentReceivable - reversedReceivable) };
    }
    return c;
  });

  const updatedReceivables = state.receivables.map((r) =>
    r.invoice === tx.invoiceNumber ? { ...r, status: 'LUNAS' as const, dueDate: 'Dibatalkan (Void)' } : r
  );

  const voidTimestamp = nowIso();
  // Exact 1-to-1 reversal stock ledger per lot allocation
  const reversalLedger: StockLedgerEntry[] =
    tx.lotAllocations.length > 0
      ? tx.lotAllocations.map((alloc) => {
          const matchedLot = state.lots.find((l) => l.id === alloc.lotId);
          const matchedProd =
            state.products.find((p) => p.id === alloc.productId || p.id === matchedLot?.productId) ||
            tx.items[0];
          const prodName =
            alloc.productName ||
            (matchedProd && 'name' in matchedProd
              ? matchedProd.name
              : matchedProd && 'productName' in matchedProd
              ? matchedProd.productName
              : undefined) ||
            matchedLot?.product ||
            'Produk Daging';
          return {
            uuid: generateUUID(),
            idempotencyKey: voidIdemKey,
            timestamp: voidTimestamp,
            actorName,
            type: 'IN_VOID_REVERSAL',
            humanLabel: 'Pembatalan Penjualan',
            productName: prodName,
            lotId: alloc.lotId,
            lotCode: alloc.lotCode,
            weightGramDelta: alloc.weightGram,
            unitCostPerKg: alloc.hppPerKg,
            valueRupiahDelta: alloc.cogsRupiah,
            movingAvgHppAfterKg:
              matchedProd && 'movingAvgHppPerKg' in matchedProd ? matchedProd.movingAvgHppPerKg : alloc.hppPerKg,
            referenceNo: `VOID-${tx.invoiceNumber}`,
            note: `Pembalikan stok lot ${alloc.lotCode} karena pembatalan: ${cleanReason}`,
          };
        })
      : tx.items.map((item) => ({
          uuid: generateUUID(),
          idempotencyKey: voidIdemKey,
          timestamp: voidTimestamp,
          actorName,
          type: 'IN_VOID_REVERSAL',
          humanLabel: 'Pembatalan Penjualan',
          productName: item.productName,
          lotId: 'REVERSAL',
          lotCode: 'VOID',
          weightGramDelta: item.weightGram,
          unitCostPerKg: item.movingAvgHppPerKg,
          valueRupiahDelta: Math.round((item.weightGram * item.movingAvgHppPerKg) / 1000),
          movingAvgHppAfterKg: item.movingAvgHppPerKg,
          referenceNo: `VOID-${tx.invoiceNumber}`,
          note: `Pembalikan stok karena pembatalan: ${cleanReason}`,
        }));

  const reversalPaymentLines: JournalLine[] = [];
  if (tx.paymentMethod === 'CASH') {
    reversalPaymentLines.push({ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: 0, credit: tx.grandTotalRupiah });
  } else if (tx.paymentMethod === 'TRANSFER') {
    reversalPaymentLines.push({ accountCode: '1102', accountName: 'Rekening Bank BCA Usaha', debit: 0, credit: tx.grandTotalRupiah });
  } else {
    if (reversedCash > 0) {
      reversalPaymentLines.push({ accountCode: '1101', accountName: 'Kas Tunai Toko (DP)', debit: 0, credit: reversedCash });
    }
    if (reversedReceivable > 0) {
      reversalPaymentLines.push({ accountCode: '1201', accountName: 'Piutang Pelanggan (Tempo)', debit: 0, credit: reversedReceivable });
    }
    if (reversalPaymentLines.length === 0 && tx.grandTotalRupiah > 0) {
      reversalPaymentLines.push({ accountCode: '1201', accountName: 'Piutang Pelanggan (Tempo)', debit: 0, credit: tx.grandTotalRupiah });
    }
  }

  const reversalJournal = buildDerivedJournal({
    idempotencyKey: voidIdemKey,
    referenceNo: `VOID-${tx.invoiceNumber}`,
    category: 'PEMBATALAN',
    description: `Pembatalan faktur ${tx.invoiceNumber} (${tx.customerName}): ${cleanReason}`,
    lines: [
      { accountCode: '4101', accountName: 'Retur & Pembatalan Penjualan', debit: tx.grandTotalRupiah, credit: 0 },
      ...reversalPaymentLines,
      { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: tx.totalCogsRupiah, credit: 0 },
      { accountCode: '5101', accountName: 'Harga Pokok Penjualan (HPP)', debit: 0, credit: tx.totalCogsRupiah },
    ],
  });

  const nextPromosState = restoredAnyPromo ? restoredPromos : state.bazarPromos;

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: nextCash,
    products: updatedProducts,
    lots: updatedLots,
    customers: updatedCustomers,
    receivables: updatedReceivables,
    transactions: state.transactions.map((t) =>
      t.uuid === txUuid ? { ...t, status: 'VOIDED', voidReason: cleanReason } : t
    ),
    stockLedger: [...reversalLedger, ...state.stockLedger],
    journals: [reversalJournal, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'OWNER',
        action: 'PEMBATALAN_TRANSAKSI',
        humanSummary: `Faktur ${tx.invoiceNumber} senilai Rp ${tx.grandTotalRupiah.toLocaleString('id-ID')} dibatalkan dengan jejak pembalikan penuh. Alasan: ${cleanReason}.`,
        referenceId: tx.invoiceNumber,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: voidIdemKey,
        entityType: 'VOID',
        summary: `Batal ${tx.invoiceNumber} • Stok & saldo dikembalikan`,
        payload: {
          transactionUuid: tx.uuid,
          invoiceNumber: tx.invoiceNumber,
          reason: cleanReason,
          reversedGrandTotalRupiah: tx.grandTotalRupiah,
          reversedCogsRupiah: tx.totalCogsRupiah,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [voidIdemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    ...(nextPromosState !== undefined ? { bazarPromos: nextPromosState } : {}),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    updatedBazarPromos: restoredAnyPromo ? restoredPromos : sourcePromos,
    message: `Transaksi ${tx.invoiceNumber} dibatalkan secara resmi. Stok dan catatan keuangan otomatis dikembalikan.`,
  };
}

/**
 * Inbound Goods Receipt with Moving Average HPP recalculation
 */
function matchInboundPurchaseProductIndex(
  products: ProductEntity[],
  po: PurchaseOrderEntity
): number {
  if (products.length === 0) return -1;
  const searchRaw = `${po.productCut ?? ''} ${po.items ?? ''}`.trim().toLowerCase();
  // An empty product description is not a match. Never guess the first catalog item.
  if (!searchRaw) return -1;

  // 1. SKU exact/substring match
  const skuIdx = products.findIndex((p) => p.sku && searchRaw.includes(p.sku.toLowerCase()));
  if (skuIdx >= 0) return skuIdx;

  // 2. Full name or base name (before parentheses) match
  const baseIdx = products.findIndex((p) => {
    const fullName = p.name.trim().toLowerCase();
    const baseName = fullName.split('(')[0].trim();
    return searchRaw.includes(fullName) || (baseName.length >= 4 && searchRaw.includes(baseName));
  });
  if (baseIdx >= 0) return baseIdx;

  // 3. Specific non-country word token match (length >= 4, avoids false hits like "US" inside "Australia")
  const ignoredTokens = new Set(['beef', 'meat', 'sapi', 'impor', 'import', 'australia', 'primal', 'slice', 'super', 'karkasia']);
  let bestIdx = -1;
  let bestScore = 0;
  products.forEach((p, idx) => {
    const tokens = p.name
      .toLowerCase()
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !ignoredTokens.has(t));
    const score = tokens.reduce((acc, tok) => (searchRaw.includes(tok) ? acc + tok.length : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });
  // Unmatched PO lines must be rejected by receiveInboundPurchase.
  return bestIdx;
}

export function receiveInboundPurchase(
  state: BusinessEngineState,
  poId: string,
  actualWeightGram: number,
  extraCostRupiah: number,
  actorName = 'Kepala Gudang',
  isOnline = true
): EngineActionResult {
  const po = state.inboundPOs.find((p) => p.id === poId);
  if (!po) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Pesanan pembelian tidak ditemukan.' };
  }
  const idemKey = `GR-${po.id}`;
  if (po.status === 'SELESAI_BONGKAR' || state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Kontainer ini sudah dibongkar dan masuk stok.' };
  }
  if (!Number.isFinite(actualWeightGram) || actualWeightGram <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Berat barang masuk harus lebih dari 0 gram.' };
  }
  if (!Number.isFinite(extraCostRupiah) || extraCostRupiah < 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Biaya tambahan bongkar tidak boleh negatif.' };
  }

  const safeWeightGram = Math.round(actualWeightGram);
  const safeExtraCost = Math.round(extraCostRupiah);
  const totalLandedCost = po.totalRupiah + safeExtraCost;
  const incomingHppPerKg = Math.round((totalLandedCost * 1000) / safeWeightGram);

  const targetProdIdx = matchInboundPurchaseProductIndex(state.products, po);
  if (targetProdIdx < 0) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Master produk kosong; tidak ada target stok produk.' };
  }
  const targetProd = state.products[targetProdIdx];

  const newMovingAvgHpp = calculateMovingAverageHppPerKg(
    targetProd.stockGram,
    targetProd.movingAvgHppPerKg,
    safeWeightGram,
    totalLandedCost
  );

  const lotSeq = nextMonotonicSequence(
    state.lots.map((l) => l.code),
    /^LOT-IN-\d{6}-(\d+)$/,
    1
  );
  const newLotCode = `LOT-IN-${formatLocalYmd(new Date()).slice(2).replace(/-/g, '')}-${String(lotSeq).padStart(2, '0')}`;
  const expiryDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const newLot: BatchLotEntity = {
    id: `LOT_${Date.now()}_${generateUUID().slice(0, 4)}`,
    code: newLotCode,
    product: targetProd.name,
    productId: targetProd.id,
    daysLeft: 90,
    expiryDate,
    weightGram: safeWeightGram,
    maxCapacityGram: Math.max(safeWeightGram, 100000),
    hppKgRupiah: incomingHppPerKg,
    loc: 'FREEZER-A-01',
    isFefo: false,
    isQuarantined: false,
  };

  const nextLots = [newLot, ...state.lots];
  const updatedProducts = syncProductsStockFromLots(
    state.products.map((p, idx) =>
      idx === targetProdIdx
        ? {
            ...p,
            movingAvgHppPerKg: newMovingAvgHpp,
          }
        : p
    ),
    nextLots
  );

  const updatedPOs = state.inboundPOs.map((p) =>
    p.id === po.id ? { ...p, status: 'SELESAI_BONGKAR', eta: 'Sudah Diterima & Masuk Freezer' } : p
  );

  const ledgerEntry: StockLedgerEntry = {
    uuid: generateUUID(),
    idempotencyKey: idemKey,
    timestamp: nowIso(),
    actorName,
    type: 'IN_PURCHASE',
    humanLabel: 'Barang Masuk Pembelian',
    productName: targetProd.name,
    lotId: newLot.id,
    lotCode: newLotCode,
    weightGramDelta: safeWeightGram,
    unitCostPerKg: incomingHppPerKg,
    valueRupiahDelta: totalLandedCost,
    movingAvgHppAfterKg: newMovingAvgHpp,
    referenceNo: po.poNumber,
    note: `Bongkar muatan ${po.container} dari ${po.supplier}`,
  };

  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: po.poNumber,
    category: 'PEMBELIAN',
    description: `Penerimaan stok ${po.poNumber} (${(safeWeightGram / 1000).toFixed(1)} kg) & penyesuaian modal rata-rata`,
    lines: [
      { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: totalLandedCost, credit: 0 },
      { accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: po.totalRupiah },
      ...(safeExtraCost > 0
        ? [{ accountCode: '1101', accountName: 'Kas Ongkos Bongkar & Bea', debit: 0, credit: safeExtraCost }]
        : []),
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    products: updatedProducts,
    lots: nextLots,
    inboundPOs: updatedPOs,
    stockLedger: [ledgerEntry, ...state.stockLedger],
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'ADMIN',
        action: 'TERIMA_BARANG_MASUK',
        humanSummary: `Pesanan ${po.poNumber} diterima (${(safeWeightGram / 1000).toFixed(1)} kg). Harga modal rata-rata ${targetProd.name} otomatis diperbarui menjadi Rp ${newMovingAvgHpp.toLocaleString('id-ID')}/kg.`,
        referenceId: po.poNumber,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PURCHASE',
        summary: `Terima ${po.poNumber} (${(safeWeightGram / 1000).toFixed(1)} kg)`,
        payload: {
          poId: po.id,
          poNumber: po.poNumber,
          supplier: po.supplier,
          lotCode: newLotCode,
          actualWeightGram: safeWeightGram,
          totalLandedCost,
          newMovingAvgHppPerKg: newMovingAvgHpp,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Barang dari ${po.poNumber} (${(safeWeightGram / 1000).toFixed(1)} kg) berhasil masuk stok. Harga modal rata-rata diperbarui otomatis.`,
  };
}

/**
 * Primal Cutting & Tetelan Conversion (Redistributes Moving Average Cost accurately)
 */
export function executeTrimmingConversion(
  state: BusinessEngineState,
  params: {
    idempotencyKey?: string;
    sourceLotId: string;
    inputGram: number;
    primaryGram: number;
    secondaryGram: number;
    actorName?: string;
    isOnline?: boolean;
  }
): EngineActionResult {
  if (params.idempotencyKey && state.processedIdempotencyKeys.includes(params.idempotencyKey)) {
    return {
      ok: false,
      state,
      errorCode: 'DUPLICATE',
      message: 'Pemotongan daging ini sudah tercatat sebelumnya.',
    };
  }

  const sourceLot = state.lots.find((l) => l.id === params.sourceLotId);
  if (!sourceLot) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Batch daging sumber tidak ditemukan.' };
  }
  if (sourceLot.isQuarantined) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Batch ${sourceLot.code} sedang dikarantina dan tidak boleh dipotong menjadi stok jual.`,
    };
  }
  if (
    !Number.isFinite(params.inputGram) ||
    !Number.isFinite(params.primaryGram) ||
    !Number.isFinite(params.secondaryGram) ||
    !Number.isInteger(params.inputGram) ||
    !Number.isInteger(params.primaryGram) ||
    !Number.isInteger(params.secondaryGram) ||
    params.inputGram <= 0 ||
    params.primaryGram < 0 ||
    params.secondaryGram < 0 ||
    params.primaryGram + params.secondaryGram > params.inputGram
  ) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Berat input dan hasil potongan tidak valid.',
    };
  }
  if (params.inputGram > sourceLot.weightGram) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Berat yang dipotong melebihi sisa stok batch (${(sourceLot.weightGram / 1000).toFixed(1)} kg).`,
    };
  }

  const lossGram = params.inputGram - params.primaryGram - params.secondaryGram;
  const usableOutputGram = params.primaryGram + params.secondaryGram;
  const totalRawCost = Math.round((params.inputGram * sourceLot.hppKgRupiah) / 1000);
  const tetelanValue = Math.round((params.secondaryGram * 65000) / 1000);
  const primaryNetCost = params.primaryGram > 0 ? Math.max(0, totalRawCost - tetelanValue) : 0;
  const effectiveSteakHpp =
    params.primaryGram > 0 ? Math.round((primaryNetCost * 1000) / params.primaryGram) : sourceLot.hppKgRupiah;

  const idemKey = params.idempotencyKey?.trim() || `CONV-${generateUUID()}`;
  const potSeq = nextMonotonicSequence(
    state.stockLedger.map((e) => e.referenceNo),
    /^POT-(\d+)$/,
    1
  );
  const refNo = `POT-${String(potSeq).padStart(4, '0')}`;
  const actor = params.actorName || 'Staf Potong Daging';
  const convTimestamp = nowIso();

  const existingTetelanLot = state.lots.find(
    (l) => !l.isQuarantined && (l.id === 'LOT_03' || l.productId === 'PROD_03')
  );
  const tetelanProd = state.products.find((p) => p.id === 'PROD_03');
  const targetTetelanLotId = existingTetelanLot?.id ?? 'LOT_03';
  const targetTetelanLotCode = existingTetelanLot?.code ?? 'LOT-TET-261030-01';
  const targetTetelanProductName = existingTetelanLot?.product ?? tetelanProd?.name ?? 'Tetelan Rawon Super KARKASIA';

  let updatedLots = state.lots.map((l) => {
    if (l.id === sourceLot.id) {
      return { ...l, weightGram: l.weightGram - params.inputGram };
    }
    if (params.secondaryGram > 0 && existingTetelanLot && l.id === existingTetelanLot.id) {
      return { ...l, weightGram: l.weightGram + params.secondaryGram };
    }
    return l;
  });

  if (params.secondaryGram > 0 && !existingTetelanLot) {
    updatedLots = [
      ...updatedLots,
      {
        id: targetTetelanLotId,
        code: targetTetelanLotCode,
        product: targetTetelanProductName,
        productId: 'PROD_03',
        daysLeft: sourceLot.daysLeft,
        expiryDate: sourceLot.expiryDate,
        weightGram: params.secondaryGram,
        maxCapacityGram: Math.max(params.secondaryGram, 60000),
        hppKgRupiah: 65000,
        loc: 'FREEZER-B-01',
        isFefo: false,
        isQuarantined: false,
      },
    ];
  }

  let primaryCutLot: BatchLotEntity | null = null;
  if (params.primaryGram > 0) {
    primaryCutLot = {
      id: `LOT_CUT_${generateUUID().slice(0, 8)}`,
      code: `LOT-CUT-${refNo}`,
      product: sourceLot.product,
      productId: sourceLot.productId,
      daysLeft: sourceLot.daysLeft,
      expiryDate: sourceLot.expiryDate,
      weightGram: params.primaryGram,
      maxCapacityGram: Math.max(params.primaryGram, 30000),
      hppKgRupiah: effectiveSteakHpp,
      loc: sourceLot.loc,
      isFefo: sourceLot.isFefo,
      isQuarantined: false,
    };
    updatedLots = [...updatedLots, primaryCutLot];
  }

  // Sync stockGram from updatedLots and update Tetelan Moving Average HPP
  const updatedProducts = syncProductsStockFromLots(
    state.products.map((p) => {
      if (p.id === 'PROD_03' && params.secondaryGram > 0) {
        return {
          ...p,
          movingAvgHppPerKg: calculateMovingAverageHppPerKg(
            p.stockGram,
            p.movingAvgHppPerKg,
            params.secondaryGram,
            tetelanValue
          ),
        };
      }
      return p;
    }),
    updatedLots
  );

  const ledgerEntries: StockLedgerEntry[] = [];
  if (usableOutputGram > 0) {
    ledgerEntries.push({
      uuid: generateUUID(),
      idempotencyKey: idemKey,
      timestamp: convTimestamp,
      actorName: actor,
      type: 'OUT_CONVERSION',
      humanLabel: 'Pemotongan Daging Utuh',
      productName: sourceLot.product,
      lotId: sourceLot.id,
      lotCode: sourceLot.code,
      weightGramDelta: -usableOutputGram,
      unitCostPerKg: sourceLot.hppKgRupiah,
      valueRupiahDelta: -(primaryNetCost + tetelanValue),
      movingAvgHppAfterKg: effectiveSteakHpp,
      referenceNo: refNo,
      note: `Dipotong jadi ${(params.primaryGram / 1000).toFixed(1)} kg steak & ${(params.secondaryGram / 1000).toFixed(1)} kg tetelan`,
    });
  }

  if (primaryCutLot && params.primaryGram > 0) {
    ledgerEntries.push({
      uuid: generateUUID(),
      idempotencyKey: idemKey,
      timestamp: convTimestamp,
      actorName: actor,
      type: 'IN_CONVERSION',
      humanLabel: 'Hasil Potongan Utama (Steak)',
      productName: primaryCutLot.product,
      lotId: primaryCutLot.id,
      lotCode: primaryCutLot.code,
      weightGramDelta: params.primaryGram,
      unitCostPerKg: effectiveSteakHpp,
      valueRupiahDelta: primaryNetCost,
      movingAvgHppAfterKg: effectiveSteakHpp,
      referenceNo: refNo,
      note: `Hasil potongan siap jual dari ${sourceLot.code}`,
    });
  }

  if (params.secondaryGram > 0) {
    ledgerEntries.push({
      uuid: generateUUID(),
      idempotencyKey: idemKey,
      timestamp: convTimestamp,
      actorName: actor,
      type: 'IN_CONVERSION',
      humanLabel: 'Hasil Tetelan / Potongan',
      productName: targetTetelanProductName,
      lotId: targetTetelanLotId,
      lotCode: targetTetelanLotCode,
      weightGramDelta: params.secondaryGram,
      unitCostPerKg: 65000,
      valueRupiahDelta: tetelanValue,
      movingAvgHppAfterKg: 65000,
      referenceNo: refNo,
      note: `Hasil potongan samping dari ${sourceLot.code}`,
    });
  }

  if (lossGram > 0) {
    ledgerEntries.push({
      uuid: generateUUID(),
      idempotencyKey: idemKey,
      timestamp: convTimestamp,
      actorName: actor,
      type: 'OUT_LOSS',
      humanLabel: 'Susut Pemotongan',
      productName: sourceLot.product,
      lotId: sourceLot.id,
      lotCode: sourceLot.code,
      weightGramDelta: -lossGram,
      unitCostPerKg: 0,
      valueRupiahDelta: usableOutputGram === 0 ? -totalRawCost : 0,
      movingAvgHppAfterKg: effectiveSteakHpp,
      referenceNo: refNo,
      note: `Susut lemak/es diserap ke harga modal potongan utama (Rp ${effectiveSteakHpp.toLocaleString('id-ID')}/kg)`,
    });
  }

  const journalLines: JournalLine[] =
    usableOutputGram === 0
      ? [
          { accountCode: '5201', accountName: 'Beban Susut & Pemotongan', debit: totalRawCost, credit: 0 },
          { accountCode: '1301', accountName: 'Persediaan Daging Utuh', debit: 0, credit: totalRawCost },
        ]
      : [
          ...(primaryNetCost > 0
            ? [{ accountCode: '1302', accountName: 'Persediaan Daging Steak Siap Jual', debit: primaryNetCost, credit: 0 }]
            : []),
          ...(tetelanValue > 0
            ? [{ accountCode: '1303', accountName: 'Persediaan Tetelan Hasil Potong', debit: tetelanValue, credit: 0 }]
            : []),
          { accountCode: '1301', accountName: 'Persediaan Daging Utuh', debit: 0, credit: primaryNetCost + tetelanValue },
        ];

  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: refNo,
    category: 'PENGOLAHAN',
    description: `Pengolahan ${sourceLot.product} (${(params.inputGram / 1000).toFixed(1)} kg) menjadi steak & tetelan`,
    lines: journalLines,
  });

  const nextState: BusinessEngineState = {
    ...state,
    products: updatedProducts,
    lots: updatedLots,
    stockLedger: [...ledgerEntries, ...state.stockLedger],
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName: actor,
        actorRole: 'ADMIN',
        action: 'OLAH_POTONG_DAGING',
        humanSummary: `${(params.inputGram / 1000).toFixed(1)} kg ${sourceLot.product} diolah menjadi ${(params.primaryGram / 1000).toFixed(1)} kg steak & ${(params.secondaryGram / 1000).toFixed(1)} kg tetelan (susut ${(lossGram / 1000).toFixed(2)} kg).`,
        referenceId: refNo,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'CONVERSION',
        summary: `Olah ${sourceLot.code} -> ${(params.primaryGram / 1000).toFixed(1)} kg steak & ${(params.secondaryGram / 1000).toFixed(1)} kg tetelan`,
        payload: {
          referenceNo: refNo,
          sourceLotId: sourceLot.id,
          sourceLotCode: sourceLot.code,
          primaryCutLotId: primaryCutLot?.id,
          inputGram: params.inputGram,
          primaryGram: params.primaryGram,
          secondaryGram: params.secondaryGram,
          lossGram,
          effectiveSteakHpp,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: convTimestamp,
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Pemotongan selesai! Harga modal efektif steak kini Rp ${effectiveSteakHpp.toLocaleString('id-ID')}/kg.`,
  };
}

/**
 * Physical Stock Opname Adjustment (Records exact difference & value adjustment)
 */
export function executeStockOpname(
  state: BusinessEngineState,
  params: {
    idempotencyKey?: string;
    lotId: string;
    physicalWeightGram: number;
    reason: string;
    ownerPin?: string;
    actorName?: string;
    isOnline?: boolean;
  }
): EngineActionResult {
  if (params.idempotencyKey && state.processedIdempotencyKeys.includes(params.idempotencyKey)) {
    return {
      ok: false,
      state,
      errorCode: 'DUPLICATE',
      message: 'Hasil cek fisik ini sudah tersimpan sebelumnya.',
    };
  }
  const lot = state.lots.find((l) => l.id === params.lotId);
  if (!lot) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Batch stok tidak ditemukan.' };
  }
  if (!Number.isFinite(params.physicalWeightGram) || !Number.isInteger(params.physicalWeightGram) || params.physicalWeightGram < 0) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Berat fisik hasil cek opname harus berupa bilangan bulat gram >= 0.',
    };
  }
  if (!params.reason || !params.reason.trim()) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Alasan penyesuaian cek fisik stok wajib diisi.',
    };
  }
  const safePhysical = params.physicalWeightGram;
  const diffGram = safePhysical - lot.weightGram;
  const absoluteDiffGram = Math.abs(diffGram);
  const diffPercent = lot.weightGram > 0 ? absoluteDiffGram / lot.weightGram : absoluteDiffGram > 0 ? Number.POSITIVE_INFINITY : 0;
  const requiresOwnerApproval = absoluteDiffGram > 5000 || diffPercent > 0.02;
  if (requiresOwnerApproval && (!params.ownerPin || !verifyOwnerPin(state, params.ownerPin))) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Selisih opname melebihi 2% berat lot atau 5 kg. PIN Owner wajib diverifikasi sebelum penyesuaian disimpan.',
    };
  }
  const valueDiff = Math.round((diffGram * lot.hppKgRupiah) / 1000);
  const idemKey = params.idempotencyKey?.trim() || `OPN-${lot.id}-${generateUUID()}`;
  const opnSeq = nextMonotonicSequence(
    state.stockLedger.map((e) => e.referenceNo),
    /^OPN-(\d+)$/,
    1
  );
  const refNo = `OPN-${String(opnSeq).padStart(4, '0')}`;
  const actor = params.actorName || 'Staf Gudang';
  const opnameTimestamp = nowIso();

  const updatedLots = state.lots.map((l) => (l.id === lot.id ? { ...l, weightGram: safePhysical } : l));
  const updatedProducts = syncProductsStockFromLots(state.products, updatedLots);

  const ledgerEntry: StockLedgerEntry = {
    uuid: generateUUID(),
    idempotencyKey: idemKey,
    timestamp: opnameTimestamp,
    actorName: actor,
    type: diffGram >= 0 ? 'IN_ADJUST' : 'OUT_ADJUST',
    humanLabel: 'Penyesuaian Cek Fisik',
    productName: lot.product,
    lotId: lot.id,
    lotCode: lot.code,
    weightGramDelta: diffGram,
    unitCostPerKg: lot.hppKgRupiah,
    valueRupiahDelta: valueDiff,
    movingAvgHppAfterKg: lot.hppKgRupiah,
    referenceNo: refNo,
    note: params.reason,
  };

  const absVal = Math.abs(valueDiff);
  const journalEntry =
    absVal > 0
      ? buildDerivedJournal({
          idempotencyKey: idemKey,
          referenceNo: refNo,
          category: 'PENYESUAIAN',
          description: `Selisih cek fisik ${lot.code} (${(diffGram / 1000).toFixed(2)} kg): ${params.reason}`,
          lines:
            diffGram < 0
              ? [
                  { accountCode: '5201', accountName: 'Beban Susut & Selisih Stok', debit: absVal, credit: 0 },
                  { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: 0, credit: absVal },
                ]
              : [
                  { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: absVal, credit: 0 },
                  { accountCode: '4201', accountName: 'Penyesuaian Lebih Stok Fisik', debit: 0, credit: absVal },
                ],
        })
      : null;

  const nextState: BusinessEngineState = {
    ...state,
    products: updatedProducts,
    lots: updatedLots,
    stockLedger: [ledgerEntry, ...state.stockLedger],
    journals: journalEntry ? [journalEntry, ...state.journals] : state.journals,
    auditTrail: [
      buildAuditEntry({
        actorName: actor,
        actorRole: 'ADMIN',
        action: 'CEK_FISIK_STOK',
        humanSummary: `Cek fisik batch ${lot.code}: selisih ${diffGram >= 0 ? '+' : ''}${(diffGram / 1000).toFixed(2)} kg (${params.reason}).`,
        referenceId: refNo,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'OPNAME',
        summary: `Cek Fisik ${lot.code}: ${(safePhysical / 1000).toFixed(1)} kg`,
        payload: {
          referenceNo: refNo,
          lotId: lot.id,
          lotCode: lot.code,
          physicalWeightGram: safePhysical,
          diffGram,
          reason: params.reason,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: opnameTimestamp,
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Hasil cek fisik ${lot.code} (${(safePhysical / 1000).toFixed(1)} kg) tersimpan rapi di buku stok.`,
  };
}

/**
 * Customer Return & Quarantine Isolation
 */
export function executeCustomerReturn(
  state: BusinessEngineState,
  params: {
    idempotencyKey?: string;
    customerName: string;
    invoiceNo: string;
    productId?: string;
    productName: string;
    weightGram: number;
    reason: string;
    resolution: 'CREDIT_NOTE' | 'TUKAR_BARANG' | 'REFUND_KAS';
    proofPhotoUrl: string;
    ownerPin?: string;
    actorName?: string;
    isOnline?: boolean;
  }
): EngineActionResult {
  if (params.idempotencyKey && state.processedIdempotencyKeys.includes(params.idempotencyKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Pengajuan retur ini sudah dicatat sebelumnya.' };
  }
  if (!Number.isSafeInteger(params.weightGram) || params.weightGram <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Berat barang retur harus berupa bilangan bulat gram lebih dari 0.' };
  }
  if (!params.invoiceNo?.trim() || !params.customerName?.trim() || !params.productName?.trim() || !params.reason?.trim()) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nomor faktur, pelanggan, produk, dan alasan retur wajib diisi.' };
  }
  if (typeof params.proofPhotoUrl !== 'string' || !params.proofPhotoUrl.trim() || params.proofPhotoUrl.length > 1_000_000) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Foto bukti retur wajib dilampirkan dan ukurannya harus di bawah 1 MB.' };
  }

  const invoice = state.transactions.find(
    (tx) => tx.invoiceNumber === params.invoiceNo.trim() && tx.status === 'COMPLETED'
  );
  if (!invoice) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Faktur selesai tidak ditemukan. Retur harus mengacu pada faktur penjualan yang valid.' };
  }

  const invoiceTimestamp = new Date(invoice.timestamp).getTime();
  const nowMs = Date.now();
  const ageMs = nowMs - invoiceTimestamp;
  if (!Number.isFinite(invoiceTimestamp) || ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Retur hanya dapat diproses maksimal 1×24 jam sejak faktur diterbitkan.' };
  }

  if (invoice.customerName.trim().toLowerCase() !== params.customerName.trim().toLowerCase()) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nama pelanggan tidak sesuai dengan faktur penjualan.' };
  }

  const invoiceItem = invoice.items.find((item) =>
    params.productId ? item.productId === params.productId : item.productName.trim().toLowerCase() === params.productName.trim().toLowerCase()
  );
  if (!invoiceItem) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Produk tidak tercatat pada faktur yang dipilih.' };
  }
  const matchedProd = state.products.find((product) => product.id === invoiceItem.productId);
  const matchedCustomer = state.customers.find((customer) => customer.id === invoice.customerId);
  if (!matchedProd || !matchedCustomer) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Master produk atau pelanggan dari faktur tidak ditemukan.' };
  }

  const alreadyReturnedGram = state.customerReturns
    .filter((record) => record.invoiceNo === invoice.invoiceNumber && record.productId === invoiceItem.productId)
    .reduce((total, record) => total + record.weightGram, 0);
  const remainingReturnableGram = Math.max(0, invoiceItem.weightGram - alreadyReturnedGram);
  if (params.weightGram > remainingReturnableGram) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Berat retur melebihi sisa barang pada faktur. Maksimal ${remainingReturnableGram.toLocaleString('id-ID')} gram.`,
    };
  }

  const safeGram = params.weightGram;
  const estimatedRefundValue = Math.round((safeGram * invoiceItem.effectivePricePerKg) / 1000);
  if (estimatedRefundValue > 500000 && (!params.ownerPin || !verifyOwnerPin(state, params.ownerPin))) {
    return {
      ok: false,
      state,
      errorCode: 'APPROVAL_REQUIRED',
      message: 'Nilai retur melebihi Rp500.000. Persetujuan PIN Owner wajib sebelum retur diproses.',
    };
  }
  if (params.resolution === 'CREDIT_NOTE') {
    const invoiceReceivable = state.receivables
      .filter((receivable) => receivable.invoice === invoice.invoiceNumber && receivable.status !== 'LUNAS')
      .reduce((total, receivable) => total + receivable.amount, 0);
    if (invoiceReceivable < estimatedRefundValue) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Sisa piutang pada faktur tidak cukup untuk menampung nilai credit note retur.' };
    }
  }
  if (params.resolution === 'REFUND_KAS' && state.cashInHandRupiah < estimatedRefundValue) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Kas tunai tidak mencukupi untuk membayar refund retur.' };
  }

  // Tukar barang wajib memakai stok pengganti layak jual dengan alokasi FEFO.
  let postReplacementLots = state.lots;
  let replacementAllocs: LotAllocationRecord[] = [];
  let replacementCogs = 0;
  if (params.resolution === 'TUKAR_BARANG') {
    const fefoReplacement = allocateLotsFEFO(
      state.lots,
      { productId: matchedProd.id, productName: matchedProd.name },
      safeGram,
      matchedProd.movingAvgHppPerKg
    );
    if (fefoReplacement.shortGram > 0) {
      const availableGram = safeGram - fefoReplacement.shortGram;
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: `Stok pengganti layak jual untuk ${matchedProd.name} tidak mencukupi (tersedia ${(availableGram / 1000).toFixed(2)} kg).`,
      };
    }
    postReplacementLots = fefoReplacement.updatedLots;
    replacementAllocs = fefoReplacement.allocations;
    replacementCogs = fefoReplacement.totalCogsRupiah;
  }

  const returnSuffix = generateUUID().slice(0, 6).toUpperCase();
  const returnNumber = `RET-${returnSuffix}`;
  const idemKey = params.idempotencyKey?.trim() || `RET-${returnNumber}`;
  const actor = params.actorName || 'Admin Toko';
  const returnTimestamp = nowIso();

  const quarantineLot: BatchLotEntity = {
    id: `LOT_QR_${generateUUID().slice(0, 8)}`,
    code: returnNumber,
    product: `${invoiceItem.productName} (Karantina Retur)`,
    productId: invoiceItem.productId,
    daysLeft: 0,
    expiryDate: new Date().toISOString().split('T')[0],
    weightGram: safeGram,
    maxCapacityGram: Math.max(30000, safeGram),
    hppKgRupiah: invoiceItem.movingAvgHppPerKg,
    loc: 'CHILLER-ISOLASI-01',
    isFefo: false,
    isQuarantined: true,
  };

  const nextLots = [quarantineLot, ...postReplacementLots];
  const updatedProducts = syncProductsStockFromLots(state.products, nextLots);
  const quarantineLedgerEntry: StockLedgerEntry = {
    uuid: generateUUID(),
    idempotencyKey: idemKey,
    timestamp: returnTimestamp,
    actorName: actor,
    type: 'OUT_QUARANTINE',
    humanLabel: 'Karantina Retur Pelanggan',
    productName: invoiceItem.productName,
    lotId: quarantineLot.id,
    lotCode: returnNumber,
    weightGramDelta: safeGram,
    unitCostPerKg: invoiceItem.movingAvgHppPerKg,
    valueRupiahDelta: 0,
    movingAvgHppAfterKg: matchedProd.movingAvgHppPerKg,
    referenceNo: returnNumber,
    note: `Retur faktur ${invoice.invoiceNumber} dari ${invoice.customerName} (${params.reason.trim()})`,
  };

  const replacementLedgerEntries: StockLedgerEntry[] = replacementAllocs.map((alloc) => ({
    uuid: generateUUID(),
    idempotencyKey: idemKey,
    timestamp: returnTimestamp,
    actorName: actor,
    type: 'OUT_ADJUST',
    humanLabel: 'Pengeluaran Stok Tukar Barang',
    productName: matchedProd.name,
    lotId: alloc.lotId,
    lotCode: alloc.lotCode,
    weightGramDelta: -alloc.weightGram,
    unitCostPerKg: alloc.hppPerKg,
    valueRupiahDelta: -alloc.cogsRupiah,
    movingAvgHppAfterKg: matchedProd.movingAvgHppPerKg,
    referenceNo: returnNumber,
    note: `Stok pengganti retur faktur ${invoice.invoiceNumber} untuk ${invoice.customerName}`,
  }));

  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: returnNumber,
    category: 'PENYESUAIAN',
    description: `Retur faktur ${invoice.invoiceNumber} - ${invoice.customerName} (${(safeGram / 1000).toFixed(1)} kg ${invoiceItem.productName})`,
    lines:
      params.resolution === 'TUKAR_BARANG'
        ? [
            { accountCode: '5201', accountName: 'Beban Retur & Penggantian Barang', debit: replacementCogs, credit: 0 },
            { accountCode: '1301', accountName: 'Persediaan Daging Cold Storage', debit: 0, credit: replacementCogs },
          ]
        : [
            { accountCode: '4103', accountName: 'Potongan & Retur Penjualan', debit: estimatedRefundValue, credit: 0 },
            {
              accountCode: params.resolution === 'REFUND_KAS' ? '1101' : '1201',
              accountName: params.resolution === 'REFUND_KAS' ? 'Kas Tunai Toko' : 'Piutang Pelanggan (Pengurang Tagihan)',
              debit: 0,
              credit: estimatedRefundValue,
            },
          ],
  });

  const updatedCustomers = params.resolution === 'CREDIT_NOTE'
    ? state.customers.map((customer) => customer.id === invoice.customerId
        ? { ...customer, currentReceivable: Math.max(0, customer.currentReceivable - estimatedRefundValue) }
        : customer)
    : state.customers;
  let remainingCredit = estimatedRefundValue;
  const updatedReceivables = params.resolution === 'CREDIT_NOTE'
    ? state.receivables.map((receivable) => {
        if (remainingCredit <= 0 || receivable.status === 'LUNAS' || receivable.invoice !== invoice.invoiceNumber) return receivable;
        const applied = Math.min(receivable.amount, remainingCredit);
        remainingCredit -= applied;
        const nextAmount = Math.max(0, receivable.amount - applied);
        return { ...receivable, amount: nextAmount, status: nextAmount === 0 ? ('LUNAS' as const) : receivable.status };
      })
    : state.receivables;

  const returnRecord: CustomerReturnEntity = {
    id: idemKey,
    returnNumber,
    invoiceNo: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    productId: invoiceItem.productId,
    productName: invoiceItem.productName,
    weightGram: safeGram,
    reason: params.reason.trim(),
    resolution: params.resolution,
    refundValueRupiah: estimatedRefundValue,
    timestamp: returnTimestamp,
    proofPhotoUrl: params.proofPhotoUrl,
  };

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: params.resolution === 'REFUND_KAS' ? state.cashInHandRupiah - estimatedRefundValue : state.cashInHandRupiah,
    products: updatedProducts,
    lots: nextLots,
    customers: updatedCustomers,
    receivables: updatedReceivables,
    customerReturns: [returnRecord, ...state.customerReturns],
    stockLedger: [...replacementLedgerEntries, quarantineLedgerEntry, ...state.stockLedger],
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName: actor,
        actorRole: 'ADMIN',
        action: 'RETUR_KARANTINA',
        humanSummary: `Retur ${(safeGram / 1000).toFixed(1)} kg ${invoiceItem.productName} dari ${invoice.customerName} dipisahkan ke ruang karantina (${params.resolution}).`,
        referenceId: returnNumber,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'RETURN',
        summary: `Retur ${returnNumber} (${(safeGram / 1000).toFixed(1)} kg)`,
        payload: {
          returnNumber,
          invoiceNo: invoice.invoiceNumber,
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          productId: invoiceItem.productId,
          productName: invoiceItem.productName,
          weightGram: safeGram,
          resolution: params.resolution,
          estimatedRefundValue,
          proofPhotoAttached: true,
          replacementAllocs,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: returnTimestamp,
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Retur ${returnNumber} dicatat, bukti tersimpan, dan barang otomatis dikarantina agar tidak terjual kembali.`,
  };
}

/**
 * Record Customer Receivable Collection
 */
export function recordCustomerReceivablePayment(
  state: BusinessEngineState,
  recId: string,
  actorName = 'Kasir Toko',
  isOnline = true,
  idempotencyKey?: string
): EngineActionResult {
  if (idempotencyKey && state.processedIdempotencyKeys.includes(idempotencyKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Pembayaran tagihan ini sudah dicatat.' };
  }
  const target = state.receivables.find((r) => r.id === recId);
  if (!target || target.status === 'LUNAS') {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Tagihan tidak ditemukan atau sudah lunas.' };
  }
  const idemKey = idempotencyKey?.trim() || `PAY-REC-${recId}-${generateUUID().slice(0, 8)}`;

  const updatedReceivables = state.receivables.map((r) =>
    r.id === recId ? { ...r, status: 'LUNAS' as const } : r
  );

  const updatedCustomers = state.customers.map((c) => {
    if (c.name === target.customer || c.id === target.customerId) {
      return { ...c, currentReceivable: Math.max(0, c.currentReceivable - target.amount) };
    }
    return c;
  });

  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: target.invoice,
    category: 'PEMBAYARAN',
    description: `Pelunasan tagihan dari ${target.customer} (${target.invoice})`,
    lines: [
      { accountCode: '1102', accountName: 'Rekening Bank / Kas Masuk', debit: target.amount, credit: 0 },
      { accountCode: '1201', accountName: 'Piutang Pelanggan', debit: 0, credit: target.amount },
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: state.cashInHandRupiah + target.amount,
    receivables: updatedReceivables,
    customers: updatedCustomers,
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'SALES',
        action: 'TERIMA_PEMBAYARAN_TAGIHAN',
        humanSummary: `Tagihan ${target.invoice} dari ${target.customer} sebesar Rp ${target.amount.toLocaleString('id-ID')} ditandai lunas.`,
        referenceId: target.invoice,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Lunas ${target.invoice} • Rp ${target.amount.toLocaleString('id-ID')}`,
        payload: {
          kind: 'RECEIVABLE_PAYMENT',
          recId,
          invoice: target.invoice,
          customer: target.customer,
          amountRupiah: target.amount,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Pembayaran dari ${target.customer} (Rp ${target.amount.toLocaleString('id-ID')}) berhasil dicatat.`,
  };
}

/**
 * Safely revert a customer receivable settlement (blocks reverting voided invoices)
 */
export function revertCustomerReceivablePayment(
  state: BusinessEngineState,
  recId: string,
  actorName = 'Kasir Toko'
): EngineActionResult {
  const target = state.receivables.find((r) => r.id === recId);
  if (!target || target.status !== 'LUNAS') {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Tagihan tidak ditemukan atau belum berstatus lunas.' };
  }
  const linkedTx = state.transactions.find((t) => t.invoiceNumber === target.invoice);
  if (linkedTx?.status === 'VOIDED' || target.dueDate.toLowerCase().includes('dibatalkan')) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Faktur ${target.invoice} sudah dibatalkan resmi (void) dan tidak bisa dibuka kembali sebagai piutang aktif.`,
    };
  }

  const idemKey = `REV-PAY-REC-${recId}-${generateUUID().slice(0, 8)}`;
  const updatedReceivables = state.receivables.map((r) =>
    r.id === recId ? { ...r, status: 'BELUM_LUNAS' as const } : r
  );
  const updatedCustomers = state.customers.map((c) => {
    if (c.name === target.customer || c.id === target.customerId) {
      return { ...c, currentReceivable: c.currentReceivable + target.amount };
    }
    return c;
  });
  const reversalJournal = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: target.invoice,
    category: 'PEMBAYARAN',
    description: `Pembatalan status lunas tagihan ${target.customer} (${target.invoice})`,
    lines: [
      { accountCode: '1201', accountName: 'Piutang Pelanggan', debit: target.amount, credit: 0 },
      { accountCode: '1102', accountName: 'Rekening Bank / Kas Masuk', debit: 0, credit: target.amount },
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: Math.max(0, state.cashInHandRupiah - target.amount),
    receivables: updatedReceivables,
    customers: updatedCustomers,
    journals: [reversalJournal, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'ADMIN',
        action: 'BATAL_LUNAS_TAGIHAN',
        humanSummary: `Status lunas faktur ${target.invoice} (${target.customer}) dibatalkan; piutang Rp ${target.amount.toLocaleString('id-ID')} aktif kembali.`,
        referenceId: target.invoice,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Batal lunas ${target.invoice} • Rp ${target.amount.toLocaleString('id-ID')}`,
        payload: {
          kind: 'RECEIVABLE_PAYMENT_REVERT',
          recId,
          invoice: target.invoice,
          customer: target.customer,
          amountRupiah: target.amount,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Faktur ${target.invoice} dikembalikan ke status belum lunas dengan pembalikan kas & piutang.`,
  };
}

/**
 * Record Supplier Payable Payment
 */
export function recordSupplierPayablePayment(
  state: BusinessEngineState,
  invoiceId: string,
  amountPaid: number,
  actorName = 'Admin Keuangan',
  isOnline = true,
  idempotencyKey?: string
): EngineActionResult {
  if (idempotencyKey && state.processedIdempotencyKeys.includes(idempotencyKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Pembayaran ke supplier ini sudah dicatat.' };
  }
  const inv = state.supplierInvoices.find((i) => i.id === invoiceId);
  if (!inv) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Faktur supplier tidak ditemukan.' };
  }
  if (!Number.isSafeInteger(amountPaid) || amountPaid <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal pembayaran harus berupa bilangan bulat Rupiah lebih dari Rp 0.' };
  }
  if (amountPaid > inv.remainingAmountRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal pembayaran melebihi sisa utang supplier.' };
  }
  const safePaid = amountPaid;
  const idemKey = idempotencyKey?.trim() || `PAY-SUP-${invoiceId}-${generateUUID().slice(0, 8)}`;

  const updatedInvoices = state.supplierInvoices.map((i) => {
    if (i.id !== invoiceId) return i;
    const paid = i.paidAmountRupiah + safePaid;
    const remaining = Math.max(0, i.totalAmountRupiah - paid);
    return {
      ...i,
      paidAmountRupiah: paid,
      remainingAmountRupiah: remaining,
      status: remaining === 0 ? ('LUNAS' as const) : ('CICILAN' as const),
    };
  });

  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: inv.invoiceNumber,
    category: 'PEMBAYARAN',
    description: `Pembayaran tagihan ke ${inv.supplier} (${inv.invoiceNumber})`,
    lines: [
      { accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: safePaid, credit: 0 },
      { accountCode: '1102', accountName: 'Rekening Bank BCA Usaha', debit: 0, credit: safePaid },
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    supplierInvoices: updatedInvoices,
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'OWNER',
        action: 'BAYAR_TAGIHAN_SUPPLIER',
        humanSummary: `Dibayarkan Rp ${safePaid.toLocaleString('id-ID')} ke ${inv.supplier} untuk faktur ${inv.invoiceNumber}.`,
        referenceId: inv.invoiceNumber,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Bayar supplier ${inv.supplier} Rp ${safePaid.toLocaleString('id-ID')}`,
        payload: {
          kind: 'SUPPLIER_PAYMENT',
          invoiceId,
          invoiceNumber: inv.invoiceNumber,
          supplier: inv.supplier,
          amountPaidRupiah: safePaid,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Pembayaran ke ${inv.supplier} sebesar Rp ${safePaid.toLocaleString('id-ID')} tercatat rapi.`,
  };
}

/**
 * Record Petty Cash / Operational Store Expense
 */
export function recordPettyCashTopUp(
  state: BusinessEngineState,
  amountRupiah: number,
  source: 'KAS_UTAMA' | 'BANK_BCA',
  actorName = 'Admin',
  isOnline = true,
  idempotencyKey?: string
): EngineActionResult {
  if (!Number.isSafeInteger(amountRupiah) || amountRupiah <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal isi kas kecil harus berupa bilangan bulat Rupiah lebih dari Rp 0.' };
  }
  const idemKey = idempotencyKey?.trim() || `PETTY-CASH-TOPUP-${generateUUID()}`;
  if (state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Isi saldo kas kecil ini sudah dicatat.' };
  }
  if (source === 'KAS_UTAMA' && amountRupiah > state.cashInHandRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Kas utama tidak mencukupi untuk isi saldo kas kecil.' };
  }

  const sourceAccountCode = source === 'KAS_UTAMA' ? '1101' : '1120';
  const sourceAccountName = source === 'KAS_UTAMA' ? 'Kas Utama' : 'Bank BCA';
  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: idemKey,
    category: 'PEMBAYARAN',
    description: `Transfer isi saldo kas kecil dari ${sourceAccountName}`,
    lines: [
      { accountCode: '1103', accountName: 'Kas Kecil Toko', debit: amountRupiah, credit: 0 },
      { accountCode: sourceAccountCode, accountName: sourceAccountName, debit: 0, credit: amountRupiah },
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: source === 'KAS_UTAMA' ? state.cashInHandRupiah - amountRupiah : state.cashInHandRupiah,
    pettyCashBalanceRupiah: state.pettyCashBalanceRupiah + amountRupiah,
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'ADMIN',
        action: 'ISI_SALDO_KAS_KECIL',
        humanSummary: `Isi saldo kas kecil Rp ${amountRupiah.toLocaleString('id-ID')} dari ${sourceAccountName}.`,
        referenceId: idemKey,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Isi kas kecil Rp ${amountRupiah.toLocaleString('id-ID')}`,
        payload: { kind: 'PETTY_CASH_TOP_UP', source, amountRupiah },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return { ok: true, state: nextState, message: `Saldo kas kecil berhasil ditambah Rp ${amountRupiah.toLocaleString('id-ID')}.` };
}

export function recordPettyCashOpex(
  state: BusinessEngineState,
  voucher: {
    voucherNo: string;
    category: PettyCashVoucherEntity['category'];
    categoryLabel: string;
    desc: string;
    amountRupiah: number;
    recipient: string;
    receiptPhotoUrl?: string;
  },
  actorName = 'Kasir Toko',
  isOnline = true,
  idempotencyKey?: string
): EngineActionResult {
  if (idempotencyKey && state.processedIdempotencyKeys.includes(idempotencyKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Biaya operasional ini sudah dicatat.' };
  }
  if (voucher && state.pettyCashVouchers.some((existing) => existing.voucherNo === voucher.voucherNo)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Nomor voucher biaya ini sudah digunakan.' };
  }
  if (!voucher || !voucher.voucherNo?.trim() || !voucher.categoryLabel?.trim() || !voucher.desc?.trim() || !voucher.recipient?.trim()) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nomor bukti, kategori, penerima, dan keterangan biaya wajib diisi.' };
  }
  if (!Number.isSafeInteger(voucher.amountRupiah) || voucher.amountRupiah <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal biaya harus berupa bilangan bulat Rupiah lebih dari Rp 0.' };
  }
  if (voucher.amountRupiah > state.pettyCashBalanceRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo kas kecil tidak mencukupi. Isi saldo terlebih dahulu.' };
  }
  const idemKey = idempotencyKey?.trim() || `OPEX-${voucher.voucherNo}-${generateUUID().slice(0, 8)}`;
  const timestamp = nowIso();
  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: voucher.voucherNo,
    category: 'BIAYA',
    description: `Biaya toko (${voucher.categoryLabel}): ${voucher.desc}`,
    lines: [
      { accountCode: '6101', accountName: `Biaya ${voucher.categoryLabel}`, debit: voucher.amountRupiah, credit: 0 },
      { accountCode: '1103', accountName: 'Kas Kecil Toko', debit: 0, credit: voucher.amountRupiah },
    ],
  });
  const voucherRecord: PettyCashVoucherEntity = {
    id: idemKey,
    voucherNo: voucher.voucherNo,
    category: voucher.category,
    categoryLabel: voucher.categoryLabel,
    amountRupiah: voucher.amountRupiah,
    recipient: voucher.recipient.trim(),
    description: voucher.desc.trim(),
    timestamp,
    ...(voucher.receiptPhotoUrl ? { receiptPhotoUrl: voucher.receiptPhotoUrl } : {}),
    paidBy: actorName,
    journalRef: journalEntry.uuid,
  };

  const nextState: BusinessEngineState = {
    ...state,
    pettyCashBalanceRupiah: state.pettyCashBalanceRupiah - voucher.amountRupiah,
    pettyCashSpentTodayRupiah: state.pettyCashSpentTodayRupiah + voucher.amountRupiah,
    pettyCashVouchers: [voucherRecord, ...state.pettyCashVouchers],
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'ADMIN',
        action: 'CATAT_BIAYA_TOKO',
        humanSummary: `Biaya ${voucher.categoryLabel} Rp ${voucher.amountRupiah.toLocaleString('id-ID')} (${voucher.desc}) untuk ${voucher.recipient}.`,
        referenceId: voucher.voucherNo,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Biaya ${voucher.categoryLabel} Rp ${voucher.amountRupiah.toLocaleString('id-ID')}`,
        payload: {
          kind: 'PETTY_CASH_OPEX',
          voucherNo: voucher.voucherNo,
          category: voucher.category,
          categoryLabel: voucher.categoryLabel,
          recipient: voucher.recipient.trim(),
          desc: voucher.desc.trim(),
          amountRupiah: voucher.amountRupiah,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys].slice(0, 2000),
    lastUpdatedAt: timestamp,
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Biaya ${voucher.categoryLabel} sebesar Rp ${voucher.amountRupiah.toLocaleString('id-ID')} berhasil dicatat.`,
  };
}

/**
 * Owner Approval Resolution (with PIN verification inside engine)
 */
export function resolveApprovalRequest(
  state: BusinessEngineState,
  approvalUuid: string,
  decision: 'APPROVED' | 'REJECTED',
  pin: string,
  actorName = 'Pemilik Usaha',
  isOnline = true
): EngineActionResult {
  if (!verifyOwnerPin(state, pin)) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN Pemilik tidak sesuai. Periksa kembali 6 digit PIN Anda.',
    };
  }
  const req = state.approvals.find((a) => a.uuid === approvalUuid);
  if (!req) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Permintaan persetujuan tidak ditemukan.' };
  }
  if (req.status !== 'PENDING') {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Permintaan ini sudah diputuskan sebelumnya (${req.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}).`,
    };
  }

  const idemKey = `APR-${approvalUuid}-${decision}`;
  const updatedApprovals = state.approvals.map((a) =>
    a.uuid === approvalUuid
      ? { ...a, status: decision, resolvedBy: actorName, resolvedAt: nowIso() }
      : a
  );

  const nextState: BusinessEngineState = {
    ...state,
    approvals: updatedApprovals,
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'OWNER',
        action: decision === 'APPROVED' ? 'SETUJUI_PERMINTAAN' : 'TOLAK_PERMINTAAN',
        humanSummary: `${decision === 'APPROVED' ? 'Menyetujui' : 'Menolak'}: ${req.title} (Rp ${req.amountRupiah.toLocaleString('id-ID')}).`,
        referenceId: req.uuid,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'APPROVAL',
        summary: `${decision === 'APPROVED' ? 'Disetujui' : 'Ditolak'}: ${req.title}`,
        payload: {
          approvalUuid,
          decision,
          resolvedBy: actorName,
          amountRupiah: req.amountRupiah,
        },
      }),
      ...state.syncOutbox,
    ],
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Permintaan "${req.title}" telah ${decision === 'APPROVED' ? 'disetujui' : 'ditolak'}.`,
  };
}

/**
 * Reconcile Outbox items strictly against server-confirmed ACKs.
 * Rule 9: SYNCED status may ONLY be granted after the backend confirms receipt.
 */
export function applyOutboxSyncResults(
  state: BusinessEngineState,
  params: {
    acknowledgedIds: string[];
    serverSeqs?: Record<string, number>;
    failedItems?: Array<{ uuid: string; error: string }>;
    backendType: string;
    adapterDisplayName: string;
  }
): BusinessEngineState {
  const ackSet = new Set(params.acknowledgedIds);
  const failMap = new Map((params.failedItems ?? []).map((f) => [f.uuid, f.error]));

  if (ackSet.size === 0 && failMap.size === 0) {
    return state;
  }

  const syncedTimestamp = nowIso();
  const nextOutbox: SyncOutboxItem[] = state.syncOutbox.map((item) => {
    if (ackSet.has(item.uuid)) {
      return {
        ...item,
        status: 'SYNCED',
        syncedAt: syncedTimestamp,
        serverSeq: params.serverSeqs?.[item.uuid] ?? item.serverSeq,
        backendType: params.backendType,
        lastError: undefined,
      };
    }
    const failErr = failMap.get(item.uuid);
    if (failErr !== undefined) {
      return {
        ...item,
        status: 'FAILED',
        retryCount: (item.retryCount ?? 0) + 1,
        lastError: failErr,
        backendType: params.backendType,
      };
    }
    return item;
  });

  const nextAudit =
    ackSet.size > 0
      ? [
          buildAuditEntry({
            actorName: 'Sistem Sinkronisasi',
            actorRole: 'SYSTEM',
            action: 'SINKRONISASI_BACKEND',
            humanSummary: `${ackSet.size} catatan dikonfirmasi diterima oleh ${params.adapterDisplayName}.`,
            referenceId: 'SYNC-' + Date.now(),
          }),
          ...state.auditTrail,
        ]
      : state.auditTrail;

  const nextState: BusinessEngineState = {
    ...state,
    syncOutbox: nextOutbox,
    auditTrail: nextAudit,
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return nextState;
}

/**
 * Backup & Restore (JSON Package with Integrity Checksum)
 */
export function exportEngineBackupJson(state: BusinessEngineState): { filename: string; content: string } {
  const { ownerPinHash: _redactedHash, ownerPinSalt: _redactedSalt, ownerPinNeedsChange: _redactedNeedsChange, ...exportSafeState } = state;
  const payloadStr = JSON.stringify(exportSafeState);
  const checksum = computeIntegrityHash(payloadStr);
  const envelope = {
    app: 'KARKASIA-ERP',
    exportedAt: nowIso(),
    schemaVersion: ENGINE_SCHEMA_VERSION,
    ownerPinRedacted: true,
    checksum,
    state: exportSafeState,
  };
  const dateStr = new Date().toISOString().slice(0, 10);
  return {
    filename: `BACKUP_KARKASIA_${dateStr}.json`,
    content: JSON.stringify(envelope, null, 2),
  };
}

export function parseAndValidateBackupJson(
  rawText: string,
  fallbackDefaults?: EngineFallbackDefaults,
  options?: { persist?: boolean }
): { ok: true; state: BusinessEngineState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText);
    const isEnvelope = parsed && typeof parsed === 'object' && parsed.app === 'KARKASIA-ERP';
    const candidateState = parsed?.state ?? parsed;
    if (
      !candidateState ||
      typeof candidateState !== 'object' ||
      !Array.isArray(candidateState.products) ||
      !Array.isArray(candidateState.lots) ||
      !Array.isArray(candidateState.stockLedger)
    ) {
      return { ok: false, error: 'Format file cadangan tidak dikenali atau tidak lengkap.' };
    }
    if (
      (candidateState.customers !== undefined && !Array.isArray(candidateState.customers)) ||
      (candidateState.transactions !== undefined && !Array.isArray(candidateState.transactions)) ||
      (candidateState.journals !== undefined && !Array.isArray(candidateState.journals)) ||
      (candidateState.receivables !== undefined && !Array.isArray(candidateState.receivables))
    ) {
      return { ok: false, error: 'Struktur data pelanggan, transaksi, atau jurnal pada file cadangan tidak valid.' };
    }
    if (
      candidateState.cashInHandRupiah !== undefined &&
      (typeof candidateState.cashInHandRupiah !== 'number' ||
        !Number.isFinite(candidateState.cashInHandRupiah) ||
        candidateState.cashInHandRupiah < 0)
    ) {
      return { ok: false, error: 'Nilai kas pada file cadangan tidak valid atau korup.' };
    }
    if (
      candidateState.ownerPinHash !== undefined &&
      (typeof candidateState.ownerPinHash !== 'string' || !/^[0-9a-f]{64}$/i.test(candidateState.ownerPinHash))
    ) {
      return { ok: false, error: 'Data verifier PIN pada file cadangan tidak valid.' };
    }
    const invalidProd = candidateState.products.some(
      (p: any) =>
        !p ||
        typeof p !== 'object' ||
        typeof p.id !== 'string' ||
        !p.id.trim() ||
        typeof p.name !== 'string' ||
        !Number.isFinite(p.basePricePerKg) ||
        p.basePricePerKg < 0 ||
        !Number.isFinite(p.stockGram) ||
        p.stockGram < 0
    );
    if (invalidProd) {
      return { ok: false, error: 'Data produk pada file cadangan korup atau memiliki stok/harga negatif.' };
    }
    const invalidLot = candidateState.lots.some(
      (l: any) =>
        !l ||
        typeof l !== 'object' ||
        typeof l.id !== 'string' ||
        !l.id.trim() ||
        typeof l.product !== 'string' ||
        !Number.isFinite(l.weightGram) ||
        l.weightGram < 0 ||
        !Number.isFinite(l.hppKgRupiah) ||
        l.hppKgRupiah < 0
    );
    if (invalidLot) {
      return { ok: false, error: 'Data batch stok (lot) pada file cadangan korup atau bernilai negatif.' };
    }
    if (isEnvelope && (typeof parsed.checksum !== 'string' || !parsed.checksum.trim())) {
      return { ok: false, error: 'Pemeriksaan integritas gagal: kode verifikasi file cadangan tidak ditemukan.' };
    }
    if (parsed?.checksum !== undefined) {
      const expected = computeIntegrityHash(JSON.stringify(candidateState));
      if (expected !== parsed.checksum) {
        return { ok: false, error: 'Pemeriksaan integritas gagal: file cadangan mungkin telah berubah atau rusak.' };
      }
    }
    const normalized = normalizePersistedState(candidateState, fallbackDefaults);
    if (options?.persist !== false) {
      persistEngineState(normalized);
    }
    return { ok: true, state: normalized };
  } catch {
    return { ok: false, error: 'File tidak dapat dibaca. Pastikan Anda memilih file cadangan .json yang benar.' };
  }
}

/**
 * Single Source of Truth Selector for Dashboard, Laporan, & Pajak
 */
export function selectOperationalSummary(state: BusinessEngineState) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;
  const dayOfWeek = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();

  const completedTransactions = state.transactions.filter((t) => t.status === 'COMPLETED');
  const todayTransactions = completedTransactions.filter((t) => {
    const timestamp = new Date(t.timestamp).getTime();
    return Number.isFinite(timestamp) && timestamp >= startOfToday && timestamp < startOfTomorrow;
  });
  const weeklyTransactions = completedTransactions.filter((t) => {
    const timestamp = new Date(t.timestamp).getTime();
    return Number.isFinite(timestamp) && timestamp >= startOfWeek && timestamp < startOfTomorrow;
  });

  const sum = (transactions: SalesTransactionRecord[], selector: (tx: SalesTransactionRecord) => number) =>
    transactions.reduce((total, tx) => total + selector(tx), 0);

  const todaySalesRupiah = sum(todayTransactions, (tx) => tx.grandTotalRupiah);
  const todayWeightGram = sum(todayTransactions, (tx) => tx.totalWeightGram);
  const todayCogsRupiah = sum(todayTransactions, (tx) => tx.totalCogsRupiah);
  const weeklyRevenue = sum(weeklyTransactions, (tx) => tx.grandTotalRupiah);
  const weeklyCogs = sum(weeklyTransactions, (tx) => tx.totalCogsRupiah);

  const totalInventoryValueRupiah = state.lots
    .filter((l) => !l.isQuarantined)
    .reduce((acc, l) => acc + Math.round((l.weightGram * l.hppKgRupiah) / 1000), 0);

  const totalInventoryWeightGram = state.lots
    .filter((l) => !l.isQuarantined)
    .reduce((acc, l) => acc + l.weightGram, 0);

  const unpaidReceivables = state.receivables.filter((r) => r.status !== 'LUNAS');
  const totalReceivablesRupiah = unpaidReceivables.reduce((acc, r) => acc + r.amount, 0);

  const totalSupplierDebtRupiah = state.supplierInvoices.reduce(
    (acc, i) => acc + i.remainingAmountRupiah,
    0
  );

  const pendingSyncCount = state.syncOutbox.filter((s) => s.status === 'PENDING' || s.status === 'FAILED').length;
  const failedSyncCount = state.syncOutbox.filter((s) => s.status === 'FAILED').length;
  const syncedCount = state.syncOutbox.filter((s) => s.status === 'SYNCED').length;
  const pendingApprovalCount = state.approvals.filter((a) => a.status === 'PENDING').length;
  const criticalFefoCount = state.lots.filter(
    (l) => !l.isQuarantined && l.daysLeft <= 7 && l.weightGram > 0
  ).length;

  const weeklyOpex = state.journals
    .filter((entry) => {
      const timestamp = new Date(entry.timestamp).getTime();
      return entry.category === 'BIAYA' && Number.isFinite(timestamp) && timestamp >= startOfWeek && timestamp < startOfTomorrow;
    })
    .reduce(
      (total, entry) => total + entry.lines.reduce((debitTotal, line) => debitTotal + (line.accountCode === '6101' ? line.debit : 0), 0),
      0
    );
  const weeklyGrossProfit = weeklyRevenue - weeklyCogs;
  const netOperatingProfit = weeklyGrossProfit - weeklyOpex;
  const estimatedUmkmTax = Math.round(weeklyRevenue * 0.005);
  const netProfitAfterTax = netOperatingProfit - estimatedUmkmTax;

  return {
    todaySalesRupiah,
    todayWeightGram,
    todayCogsRupiah,
    totalInventoryValueRupiah,
    totalInventoryWeightGram,
    totalReceivablesRupiah,
    unpaidReceivablesCount: unpaidReceivables.length,
    totalSupplierDebtRupiah,
    pendingSyncCount,
    failedSyncCount,
    syncedCount,
    pendingApprovalCount,
    criticalFefoCount,
    weeklyRevenue,
    weeklyCogs,
    weeklyGrossProfit,
    weeklyOpex,
    netOperatingProfit,
    estimatedUmkmTax,
    netProfitAfterTax,
  };
}
