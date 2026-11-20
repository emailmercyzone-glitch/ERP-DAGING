import CryptoJS from 'crypto-js';
import { validateSalePayload } from '../domain/sales/saleIntegrity';
import { canonicalizeJournalLines, getChartAccount, normalizeJournalAccountNames } from '../domain/accounting/chartOfAccounts';
import { groupInventoryCostsByAccount } from '../domain/accounting/inventoryAccounts';
import { calculateAffiliateCommission } from '../domain/accounting/affiliateCommission';
import { previewOpeningBalanceCsv } from '../domain/accounting/openingBalanceCsv';
import type { OpeningBalanceCsvKind, OpeningBalanceCsvPreview, OpeningLotBalanceRow, OpeningReceivableBalanceRow, OpeningPayableBalanceRow } from '../domain/accounting/openingBalanceCsv';
import { calculateMovingAverageHppPerKg } from '../domain/costing/movingAverageHpp';
import { computeDaysLeftFromExpiry, formatLocalYmd } from '../domain/shared/localDate';
import { allocateLotsFEFO, getProductAvailableStockGram, isLotEligibleForSale, isLotExpired } from '../domain/inventory/fefo';
import { addLotStock, adjustLotStockToPhysical, consumeLotStock, getLotCarryingValueRupiah, restoreLotStock } from '../domain/inventory/lotValuation';
import type {
  ApprovalRequest,
  AuditTrailEntry,
  BatchLotEntity,
  BazarPromoEntity,
  BusinessEngineState,
  CartLineInput,
  CustomerEntity,
  CustomerReturnRecord,
  ReceivablePaymentRecord,
  EngineActionResult,
  JournalEntry,
  JournalLine,
  LotAllocationRecord,
  LandedCostComponentEntity,
  LandedCostComponentInput,
  ConsignmentPayableRecord,
  AffiliateCommissionRecord,
  PaymentMethod,
  PettyCashVoucherEntity,
  SalePaymentBreakdown,
  ProductCategoryEntity,
  ProductEntity,
  PurchaseOrderEntity,
  ReceivableEntity,
  SalesTransactionRecord,
  StockLedgerEntry,
  SupplierInvoiceEntity,
  SyncOutboxItem,
} from './types';
import { idbGetEngineState, idbSaveEngineState } from './indexedDbStorage';

export { calculateMovingAverageHppPerKg, computeDaysLeftFromExpiry, allocateLotsFEFO, getProductAvailableStockGram, isLotEligibleForSale, isLotExpired };

export const ENGINE_STORAGE_KEY = 'karkasia_erp_business_engine_v1';
export const ENGINE_SCHEMA_VERSION = 1;

export interface IntegerIntegrityViolation {
  path: string;
  value: number;
  reason: string;
}

export interface IntegerIntegrityAudit {
  ok: boolean;
  violations: IntegerIntegrityViolation[];
  legacyKilogramFields: string[];
}

/**
 * Read-only audit for the zero-float ledger contract.
 * It never rounds or mutates historical data; legacy KG fields are reported
 * separately because conversion needs a reviewed migration, not coercion.
 */
const REMOTE_INTEGER_MONEY_KEYS = new Set([
  'basePricePerKg', 'movingAvgHppPerKg', 'effectivePricePerKg', 'unitCostPerKg',
  'movingAvgHppAfterKg', 'hppPerKg', 'totalDebit', 'totalCredit', 'debit', 'credit',
  'creditLimit', 'currentReceivable', 'amount', 'limit', 'cashTendered',
  'totalRawCost', 'primaryNetCost', 'tetelanValue', 'effectiveSteakHpp', 'secondaryHpp',
  'promoPricePerKg',
]);

/** Return invalid Rupiah/Gram values without coercion or rounding. */
function findInvalidRemoteIntegerFields(value: unknown): string[] {
  const invalid: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (current: unknown, path: string, key: string, parentPath: string) => {
    const mustBeInteger = /(?:Rupiah|Gram)$/.test(key) ||
      REMOTE_INTEGER_MONEY_KEYS.has(key) || parentPath.endsWith('.tierPrices');
    if (mustBeInteger && current !== undefined && current !== null &&
        (typeof current !== 'number' || !Number.isSafeInteger(current))) {
      invalid.push(path);
      return;
    }
    if (!current || typeof current !== 'object') return;
    if (seen.has(current as object)) return;
    seen.add(current as object);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, String(index), path));
      return;
    }
    Object.entries(current as Record<string, unknown>).forEach(([childKey, child]) => {
      visit(child, path ? `${path}.${childKey}` : childKey, childKey, path);
    });
  };
  visit(value, 'payload', '', '');
  return invalid;
}

export function auditIntegerLedgerIntegrity(state: BusinessEngineState): IntegerIntegrityAudit {
  const violations: IntegerIntegrityViolation[] = [];
  const legacyKilogramFields: string[] = [];
  const monetaryKeys = new Set([
    'basePricePerKg', 'movingAvgHppPerKg', 'effectivePricePerKg', 'unitCostPerKg',
    'movingAvgHppAfterKg', 'hppPerKg', 'totalDebit', 'totalCredit', 'debit', 'credit',
    'creditLimit', 'currentReceivable', 'amount', 'limit', 'cashTendered',
    'totalRawCost', 'primaryNetCost', 'tetelanValue', 'effectiveSteakHpp', 'secondaryHpp',
  ]);
  const kilogramKeys = new Set(['orderWeightKg', 'quotaKg', 'soldKg', 'weightKg', 'inputKg', 'primaryKg', 'secondaryKg']);
  const seen = new WeakSet<object>();
  const visit = (value: unknown, path: string, key: string, parentPath: string) => {
    if (typeof value === 'number') {
      const mustBeInteger = /(?:Rupiah|Gram)$/.test(key) || monetaryKeys.has(key) || parentPath.endsWith('.tierPrices');
      if (mustBeInteger && !Number.isSafeInteger(value)) {
        violations.push({ path, value, reason: 'Harus berupa integer aman; pecahan atau overflow tidak boleh dibulatkan otomatis.' });
      }
      if (kilogramKeys.has(key) && Number.isFinite(value)) legacyKilogramFields.push(path);
      if (mustBeInteger && !Number.isFinite(value)) {
        violations.push({ path, value, reason: 'Nilai numerik tidak finite.' });
      }
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, String(index), path));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => {
      visit(child, path ? `${path}.${childKey}` : childKey, childKey, path);
    });
  };
  visit(state, 'state', '', '');
  return { ok: violations.length === 0, violations, legacyKilogramFields };
}


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

function resolveSalePaymentBreakdown(
  tx: Pick<SalesTransactionRecord, 'paymentMethod' | 'paymentBreakdown' | 'paidAmountRupiah' | 'balanceDueRupiah' | 'grandTotalRupiah'>
): SalePaymentBreakdown | null {
  if (tx.paymentMethod === 'MIX' && !tx.paymentBreakdown) return null;
  const breakdown: SalePaymentBreakdown = tx.paymentBreakdown ?? (
    tx.paymentMethod === 'CASH'
      ? { cashPaidRupiah: tx.paidAmountRupiah ?? tx.grandTotalRupiah, transferPaidRupiah: 0, receivableRupiah: 0 }
      : tx.paymentMethod === 'TRANSFER'
      ? { cashPaidRupiah: 0, transferPaidRupiah: tx.paidAmountRupiah ?? tx.grandTotalRupiah, receivableRupiah: 0 }
      : { cashPaidRupiah: tx.paidAmountRupiah ?? 0, transferPaidRupiah: 0, receivableRupiah: tx.balanceDueRupiah ?? tx.grandTotalRupiah }
  );
  if (
    !Number.isSafeInteger(breakdown.cashPaidRupiah) || breakdown.cashPaidRupiah < 0 ||
    !Number.isSafeInteger(breakdown.transferPaidRupiah) || breakdown.transferPaidRupiah < 0 ||
    !Number.isSafeInteger(breakdown.receivableRupiah) || breakdown.receivableRupiah < 0 ||
    breakdown.cashPaidRupiah + breakdown.transferPaidRupiah + breakdown.receivableRupiah !== tx.grandTotalRupiah ||
    (tx.paymentMethod === 'MIX' && (
      breakdown.transferPaidRupiah <= 0 ||
      [breakdown.cashPaidRupiah, breakdown.transferPaidRupiah, breakdown.receivableRupiah].filter((amount) => amount > 0).length < 2
    ))
  ) return null;
  return breakdown;
}

export function formatTimeId(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}


export interface JournalLinesIntegrity {
  ok: boolean;
  totalDebit: number;
  totalCredit: number;
  reason?: string;
}

/**
 * Validate the automatic double-entry contract without coercing, rounding, or mutating amounts.
 */
export function validateJournalLinesIntegrity(lines: JournalLine[]): JournalLinesIntegrity {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, totalDebit: 0, totalCredit: 0, reason: 'Jurnal wajib memiliki minimal satu baris.' };
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || typeof line.accountCode !== 'string' || !line.accountCode.trim() ||
        !getChartAccount(line.accountCode) || typeof line.accountName !== 'string' || !line.accountName.trim()) {
      return { ok: false, totalDebit, totalCredit, reason: `Identitas akun pada baris ${index + 1} tidak valid.` };
    }
    if (!Number.isSafeInteger(line.debit) || !Number.isSafeInteger(line.credit) ||
        line.debit < 0 || line.credit < 0) {
      return { ok: false, totalDebit, totalCredit, reason: `Debit/kredit baris ${index + 1} wajib integer Rupiah aman non-negatif.` };
    }
    if (line.debit > 0 && line.credit > 0) {
      return { ok: false, totalDebit, totalCredit, reason: `Baris ${index + 1} tidak boleh memiliki debit dan kredit sekaligus.` };
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
    if (!Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
      return { ok: false, totalDebit, totalCredit, reason: 'Total debit/kredit melewati batas integer aman.' };
    }
  }
  if (totalDebit !== totalCredit) {
    return { ok: false, totalDebit, totalCredit, reason: `Jurnal tidak balance: debit ${totalDebit}, kredit ${totalCredit}.` };
  }
  return { ok: true, totalDebit, totalCredit };
}

export interface JournalLedgerIntegrityAudit {
  ok: boolean;
  violations: Array<{ journalId: string; reason: string }>;
}

/**
 * Read-only audit for journals already persisted before the strict builder invariant.
 */
export function auditJournalLedgerIntegrity(journals: JournalEntry[]): JournalLedgerIntegrityAudit {
  const violations: JournalLedgerIntegrityAudit['violations'] = [];
  for (const journal of journals) {
    const integrity = validateJournalLinesIntegrity(journal.lines);
    if (!integrity.ok) {
      violations.push({ journalId: journal.uuid, reason: integrity.reason ?? 'Baris jurnal tidak valid.' });
      continue;
    }
    if (!Number.isSafeInteger(journal.totalDebit) || !Number.isSafeInteger(journal.totalCredit) ||
        journal.totalDebit !== integrity.totalDebit || journal.totalCredit !== integrity.totalCredit ||
        journal.totalDebit !== journal.totalCredit || journal.isBalanced !== true) {
      violations.push({ journalId: journal.uuid, reason: 'Header jurnal tidak sama dengan total baris debit/kredit atau status balance.' });
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Helper to compute balanced double-entry Journal Entry automatically behind the scenes.
 * Invalid entries throw before the caller can persist a transaction or advance a pull reducer.
 */
function buildInventoryJournalLines(
  allocations: Array<{ lotId: string; cogsRupiah: number }>,
  lots: BatchLotEntity[],
  side: 'DEBIT' | 'CREDIT'
): JournalLine[] {
  const totals = groupInventoryCostsByAccount(allocations, lots);
  return Object.entries(totals).flatMap(([accountCode, amount]) => {
    if (amount <= 0) return [];
    const account = getChartAccount(accountCode);
    if (!account) throw new Error(`Akun persediaan ${accountCode} tidak terdaftar.`);
    return [{
      accountCode, accountName: account.name,
      debit: side === 'DEBIT' ? amount : 0,
      credit: side === 'CREDIT' ? amount : 0,
    }];
  });
}
function buildDerivedJournal(params: {
  idempotencyKey: string;
  referenceNo: string;
  category: JournalEntry['category'];
  description: string;
  lines: JournalLine[];
}): JournalEntry {
  const normalizedLines = canonicalizeJournalLines(params.lines);
  const integrity = validateJournalLinesIntegrity(normalizedLines);
  if (!integrity.ok) {
    throw new Error(`JOURNAL_INVARIANT: ${integrity.reason ?? 'Jurnal tidak valid.'}`);
  }
  const totalDebit = integrity.totalDebit;
  const totalCredit = integrity.totalCredit;
  return {
    uuid: generateUUID(),
    idempotencyKey: params.idempotencyKey,
    timestamp: nowIso(),
    referenceNo: params.referenceNo,
    category: params.category,
    description: params.description,
    lines: normalizedLines,
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

// ============================================================================
// PRICING & DISCOUNT ENGINE (MOD-05: TIER, VOLUME BREAK, & BAZAR PROMO)
// ============================================================================

export type BazarPromoInput = BazarPromoEntity;

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

// ============================================================================
// INITIAL SEEDING & PERSISTENCE (OFFLINE-FIRST)
// ============================================================================

export interface EngineFallbackDefaults {
  bazarPromos?: BazarPromoEntity[];
  categories?: ProductCategoryEntity[];
  suppliers?: string[];
  supplierPhones?: Record<string, string>;
  preserveOwnerPin?: string;
  preserveOwnerPinHash?: string;
  preserveOwnerPinSalt?: string;
  preserveOwnerPinNeedsChange?: boolean;
  preserveDeviceId?: string;
}

const DEVICE_ID_STORAGE_KEY = 'erp_daging_device_id';
function getPersistentDeviceId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim();
      const generated = `DEV-${generateUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
      window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
      return generated;
    } catch { /* continue with an ephemeral ID when storage is blocked */ }
  }
  return `DEV-${generateUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export function createSeededEngineState(seed: {
  products: ProductEntity[];
  lots: BatchLotEntity[];
  customers: CustomerEntity[];
  receivables: ReceivableEntity[];
  inboundPOs: PurchaseOrderEntity[];
  supplierInvoices: SupplierInvoiceEntity[];
  bazarPromos?: BazarPromoEntity[];
  categories?: ProductCategoryEntity[];
  suppliers?: string[];
  supplierPhones?: Record<string, string>;
  deviceId?: string;
}): BusinessEngineState {
  const initialTimestamp = nowIso();
  const initialLedger: StockLedgerEntry[] = seed.lots.map((l) => ({
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
    valueRupiahDelta: Number.isSafeInteger(l.weightGram) && l.weightGram >= 0 && Number.isSafeInteger(l.hppKgRupiah) && l.hppKgRupiah >= 0
      ? getLotCarryingValueRupiah(l)
      : 0,
    movingAvgHppAfterKg: l.hppKgRupiah,
    referenceNo: 'OPENING-BAL-01',
    note: `Saldo awal batch ${l.code} di rak ${l.loc}`,
  }));

  const initialAudit: AuditTrailEntry[] = [
    buildAuditEntry({
      actorName: 'Sistem',
      actorRole: 'SYSTEM',
      action: 'INISIALISASI_BUKU_STOK',
      humanSummary: `Saldo awal ${seed.lots.length} batch daging & ${seed.customers.length} pelanggan aktif dicatat aman.`,
      referenceId: 'OPENING-BAL-01',
    }),
  ];

  const openingInventoryAllocations = seed.lots.flatMap((lot) => {
    if (!Number.isSafeInteger(lot.weightGram) || lot.weightGram <= 0 ||
        !Number.isSafeInteger(lot.hppKgRupiah) || lot.hppKgRupiah < 0) return [];
    const valueRupiah = getLotCarryingValueRupiah(lot);
    return Number.isSafeInteger(valueRupiah) && valueRupiah >= 0
      ? [{ lotId: lot.id, cogsRupiah: valueRupiah }]
      : [];
  });
  const totalInventoryVal = openingInventoryAllocations.reduce((sum, allocation) => sum + allocation.cogsRupiah, 0);
  if (!Number.isSafeInteger(totalInventoryVal)) throw new RangeError('Total nilai persediaan awal melewati batas integer Rupiah aman.');

  const openingReceivables = seed.receivables.filter((item) => item.status !== 'LUNAS');
  const totalOpeningReceivables = openingReceivables.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.amount) || item.amount < 0) {
      throw new RangeError(`Saldo piutang awal ${item.id} harus berupa integer Rupiah aman non-negatif.`);
    }
    const next = sum + item.amount;
    if (!Number.isSafeInteger(next)) throw new RangeError('Total piutang awal melewati batas integer Rupiah aman.');
    return next;
  }, 0);

  const openingSupplierPayables = seed.supplierInvoices.filter((item) => item.status !== 'LUNAS');
  const totalOpeningSupplierPayables = openingSupplierPayables.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.remainingAmountRupiah) || item.remainingAmountRupiah < 0) {
      throw new RangeError(`Saldo utang supplier awal ${item.id} harus berupa integer Rupiah aman non-negatif.`);
    }
    const next = sum + item.remainingAmountRupiah;
    if (!Number.isSafeInteger(next)) throw new RangeError('Total utang supplier awal melewati batas integer Rupiah aman.');
    return next;
  }, 0);

  const openingNetEquity = totalInventoryVal + totalOpeningReceivables - totalOpeningSupplierPayables;
  if (!Number.isSafeInteger(openingNetEquity)) throw new RangeError('Nilai modal pembukaan melewati batas integer Rupiah aman.');
  const openingBalanceLines: JournalLine[] = [
    ...buildInventoryJournalLines(openingInventoryAllocations, seed.lots, 'DEBIT'),
    ...(totalOpeningReceivables > 0
      ? [{ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: totalOpeningReceivables, credit: 0 }]
      : []),
    ...(totalOpeningSupplierPayables > 0
      ? [{ accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: totalOpeningSupplierPayables }]
      : []),
    ...(openingNetEquity > 0
      ? [{ accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: openingNetEquity }]
      : openingNetEquity < 0
        ? [{ accountCode: '3101', accountName: 'Modal Awal Usaha', debit: -openingNetEquity, credit: 0 }]
        : []),
  ];
  const hasOpeningBalances = totalInventoryVal > 0 || totalOpeningReceivables > 0 || totalOpeningSupplierPayables > 0;
  const initialJournal = hasOpeningBalances ? buildDerivedJournal({
    idempotencyKey: 'SEED-JOURNAL-01',
    referenceNo: 'OPENING-BAL-01',
    category: 'PENYESUAIAN',
    description: 'Saldo awal persediaan, piutang pelanggan, dan utang supplier',
    lines: openingBalanceLines,
  }) : null;

  return {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    storeName: 'ERP DAGING',
    deviceId: seed.deviceId || getPersistentDeviceId(),
    ownerPinHash: '',
    ownerPinSalt: '',
    ownerPinNeedsChange: false,
    cashInHandRupiah: 0,
    bankBalanceInitialized: false,
    pettyCashSpentTodayRupiah: 0,
    pettyCashBalanceRupiah: 0,
    pettyCashVouchers: [],
    products: syncProductsStockFromLots(seed.products, seed.lots),
    lots: seed.lots,
    customers: seed.customers,
    receivables: seed.receivables,
    inboundPOs: seed.inboundPOs,
    supplierInvoices: seed.supplierInvoices,
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
  const existingCustomers = Array.isArray(raw.customers) ? raw.customers : [];
  const hasSharedUmum = existingCustomers.some((customer) => isSharedUmumCustomer(customer));
  const safeCustomers = hasSharedUmum ? existingCustomers : [{
    id: 'CUST_UMUM', code: 'UMUM', name: 'UMUM', tier: 'RETAIL',
    creditLimit: 0, currentReceivable: 0, termDays: 0, phone: '', address: '',
  }, ...existingCustomers];
  const safeKeys = Array.isArray(raw.processedIdempotencyKeys) ? raw.processedIdempotencyKeys : [];
  const safePromos = normalizeBazarPromosList(raw.bazarPromos, defaults.bazarPromos);
  const safeCategories = normalizeCategoriesList(raw.categories, defaults.categories);
  const safeSuppliers = normalizeSuppliersList(raw.suppliers, defaults.suppliers);
  const safeSupplierPhones = normalizeSupplierPhonesMap(raw.supplierPhones, defaults.supplierPhones);
  const safeJournals = Array.isArray(raw.journals) ? raw.journals.map((journal) => ({
    ...journal,
    lines: Array.isArray(journal.lines) ? normalizeJournalAccountNames(journal.lines) : [],
  })) : [];

  const safeInboundPOs = Array.isArray(raw.inboundPOs) ? raw.inboundPOs : [];
  const safeSupplierInvoices = (Array.isArray(raw.supplierInvoices) ? raw.supplierInvoices : []).filter((invoice) => {
    const linkedPO = safeInboundPOs.find((po) => po.poNumber === invoice.poNumber);
    if (!linkedPO) return true;
    const hasGoodsReceipt = linkedPO.status === 'SELESAI_BONGKAR' ||
      (Array.isArray(raw.stockLedger) && raw.stockLedger.some((entry) =>
        entry.referenceNo === linkedPO.poNumber && entry.type === 'IN_PURCHASE'
      ));
    if (hasGoodsReceipt) return true;
    // Keep any pre-receipt payment backed by a real AP payment journal for explicit reconciliation.
    // Remove only old PO-time invoice rows with neither payment evidence nor Goods Receipt evidence.
    return safeJournals.some((journal) =>
      journal.referenceNo === invoice.invoiceNumber &&
      journal.category === 'PEMBAYARAN' &&
      journal.lines.some((line) => line.accountCode === '2101' && line.debit > 0)
    );
  });

  const legacyPin = typeof raw.ownerPin === 'string' && /^\d{6}$/.test(raw.ownerPin.trim()) ? raw.ownerPin.trim() : undefined;
  const preservedHash = typeof (defaults as any).preserveOwnerPinHash === 'string' ? (defaults as any).preserveOwnerPinHash : undefined;
  const preservedSalt = typeof (defaults as any).preserveOwnerPinSalt === 'string' ? (defaults as any).preserveOwnerPinSalt : undefined;
  let ownerPinSalt = typeof raw.ownerPinSalt === 'string' && raw.ownerPinSalt ? raw.ownerPinSalt : preservedSalt || '';
  let ownerPinHash = typeof raw.ownerPinHash === 'string' && raw.ownerPinHash
    ? raw.ownerPinHash
    : preservedHash || '';
  let ownerPinNeedsChange = defaults.preserveOwnerPinNeedsChange ?? (raw.ownerPinNeedsChange === true);
  if ((!ownerPinHash || !ownerPinSalt) && legacyPin) {
    ownerPinSalt = generateUUID();
    ownerPinHash = hashOwnerPin(legacyPin, ownerPinSalt);
    ownerPinNeedsChange = legacyPin === '123456';
  }
  if (!ownerPinHash || !ownerPinSalt) {
    ownerPinHash = '';
    ownerPinSalt = '';
    ownerPinNeedsChange = false;
  }
  const rawDeviceId = typeof raw.deviceId === 'string' ? raw.deviceId.trim() : '';
  const deviceId = (defaults as any).preserveDeviceId || (rawDeviceId && rawDeviceId !== 'KASIR-UTAMA' ? rawDeviceId : getPersistentDeviceId());

  return {
    ...raw,
    ownerPin: undefined,
    ownerPinHash,
    ownerPinSalt,
    ownerPinNeedsChange,
    bankBalanceInitialized: raw.bankBalanceInitialized === true,
    pettyCashBalanceRupiah: Number.isSafeInteger(raw.pettyCashBalanceRupiah) && raw.pettyCashBalanceRupiah >= 0 ? raw.pettyCashBalanceRupiah : 0,
    pettyCashVouchers: Array.isArray(raw.pettyCashVouchers) ? raw.pettyCashVouchers.filter((v) => v && typeof v.id === 'string' && typeof v.voucherNo === 'string' && Number.isSafeInteger(v.amountRupiah) && v.amountRupiah > 0) : [],
    deviceId,
    customers: safeCustomers,
    receivables: Array.isArray(raw.receivables) ? raw.receivables : [],
    inboundPOs: safeInboundPOs,
    supplierInvoices: safeSupplierInvoices,
    products: safeProducts,
    lots: safeLots,
    transactions: safeTransactions,
    stockLedger: Array.isArray(raw.stockLedger) ? raw.stockLedger : [],
    journals: safeJournals,
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
      parsed.schemaVersion !== ENGINE_SCHEMA_VERSION ||
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
  return normalizePersistedState(parsed, {
    bazarPromos: fallbackSeed.bazarPromos,
    categories: fallbackSeed.categories,
    suppliers: fallbackSeed.suppliers,
    supplierPhones: fallbackSeed.supplierPhones,
  });
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

  const idbState = await (enginePersistenceTestAdapter?.load ?? idbGetEngineState)();
  const isIdbValid =
    !!idbState &&
    idbState.schemaVersion === ENGINE_SCHEMA_VERSION &&
    Array.isArray(idbState.products) &&
    Array.isArray(idbState.lots);

  const normalizeDefaults: EngineFallbackDefaults = {
    bazarPromos: fallbackDefaults?.bazarPromos ?? currentState.bazarPromos,
    categories: fallbackDefaults?.categories ?? currentState.categories,
    suppliers: fallbackDefaults?.suppliers ?? currentState.suppliers,
    supplierPhones: fallbackDefaults?.supplierPhones ?? currentState.supplierPhones,
  };

  if (isIdbValid && idbState) {
    const normalizedIdb = normalizePersistedState(idbState, normalizeDefaults);
    if (!hasValidLocalSnapshot) {
      // Recover/repair missing or corrupted localStorage snapshot from authoritative IndexedDB state
      try {
        window.localStorage?.setItem(ENGINE_STORAGE_KEY, JSON.stringify(normalizedIdb));
      } catch {
        // Ignore quota limit on localStorage cache; IndexedDB remains authoritative
      }
      return { state: normalizedIdb, source: 'indexeddb' };
    }

    const idbTime = Date.parse(normalizedIdb.lastUpdatedAt || '') || 0;
    const localTime = Date.parse(currentState.lastUpdatedAt || '') || 0;
    if (idbTime >= localTime) {
      return { state: normalizedIdb, source: 'indexeddb' };
    }

    const saved = await (enginePersistenceTestAdapter?.save ?? idbSaveEngineState)(currentState);
    if (!saved) {
      notifyPersistenceError('Gagal menyinkronkan data terbaru ke penyimpanan perangkat (IndexedDB).');
    }
    return { state: currentState, source: 'migrated_local' };
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

type EnginePersistenceTestAdapter = {
  save: (state: BusinessEngineState) => Promise<boolean>;
  load: () => Promise<BusinessEngineState | null>;
};
let enginePersistenceTestAdapter: EnginePersistenceTestAdapter | null = null;
let engineAutoPersistenceSuppressionDepth = 0;

/**
 * Run a synchronous domain reducer without its legacy fire-and-forget save.
 * The caller must persist the returned state through the durable mutation queue.
 * Outside the queue, direct reducer usage keeps its existing persistence behavior.
 */
export function runWithoutEngineAutoPersistence<T>(operation: () => T): T {
  engineAutoPersistenceSuppressionDepth += 1;
  try {
    return operation();
  } finally {
    engineAutoPersistenceSuppressionDepth -= 1;
  }
}

/** Test-only adapter for Node tests that exercise restart behavior without a browser IndexedDB implementation. */
export function setEnginePersistenceAdapterForTests(adapter: EnginePersistenceTestAdapter | null): void {
  enginePersistenceTestAdapter = adapter;
}

export function persistEngineState(
  state: BusinessEngineState,
  options?: PersistEngineOptions
): { localStorageOk: boolean; indexedDbPromise: Promise<boolean> } {
  if (engineAutoPersistenceSuppressionDepth > 0) {
    // The enclosing durable mutation queue owns the one authoritative write.
    return { localStorageOk: false, indexedDbPromise: Promise.resolve(true) };
  }
  if (typeof window === 'undefined') {
    return { localStorageOk: false, indexedDbPromise: Promise.resolve(false) };
  }

  // IndexedDB is authoritative. Never advance the localStorage recovery mirror
  // until the durable IndexedDB write has succeeded.
  let localStorageOk = false;
  const idbSaver = options?.saveToIdb ?? enginePersistenceTestAdapter?.save ?? idbSaveEngineState;
  const indexedDbPromise = Promise.resolve()
    .then(() => idbSaver(state))
    .catch(() => false)
    .then((idbOk) => {
      if (idbOk) {
        try {
          window.localStorage?.setItem(ENGINE_STORAGE_KEY, JSON.stringify(state));
          localStorageOk = true;
        } catch {
          // localStorage is only a convenience/recovery mirror; IndexedDB is authoritative.
          localStorageOk = false;
        }
        return true;
      }
      notifyPersistenceError(
        'Penyimpanan utama IndexedDB gagal menyimpan transaksi. Perubahan belum dianggap tersimpan; hentikan input baru dan periksa ruang serta izin penyimpanan browser.'
      );
      return false;
    });

  return {
    get localStorageOk() { return localStorageOk; },
    indexedDbPromise,
  };
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

function hashOwnerPin(pin: string, salt: string): string {
  return CryptoJS.PBKDF2(pin, salt, { keySize: 256 / 32, iterations: 100000, hasher: CryptoJS.algo.SHA256 }).toString(CryptoJS.enc.Hex);
}

export function verifyOwnerPin(state: BusinessEngineState, pin: string): boolean {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) return false;
  if (!state.ownerPinHash || !state.ownerPinSalt) return false;
  const candidate = hashOwnerPin(pin.trim(), state.ownerPinSalt);
  if (candidate.length !== state.ownerPinHash.length) return false;
  let difference = 0;
  for (let i = 0; i < candidate.length; i++) difference |= candidate.charCodeAt(i) ^ state.ownerPinHash.charCodeAt(i);
  return difference === 0;
}

export function updateOwnerPin(
  state: BusinessEngineState,
  currentPin: string,
  newPin: string,
  actorName = 'Pemilik Usaha'
): EngineActionResult {
  const hasExistingPin = Boolean(state.ownerPinHash && state.ownerPinSalt);
  if (hasExistingPin && !verifyOwnerPin(state, currentPin)) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN lama tidak sesuai.',
    };
  }
  if (!hasExistingPin && currentPin.trim() !== '') {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN Owner belum dibuat. Kolom PIN lama harus kosong.',
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
  if (hasExistingPin && verifyOwnerPin(state, cleanNewPin)) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'PIN baru harus berbeda dari PIN saat ini.',
    };
  }
  const newSalt = generateUUID();
  const nextState: BusinessEngineState = {
    ...state,
    ownerPin: undefined,
    ownerPinHash: hashOwnerPin(cleanNewPin, newSalt),
    ownerPinSalt: newSalt,
    ownerPinNeedsChange: false,
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'OWNER',
        action: hasExistingPin ? 'UBAH_PIN_PEMILIK' : 'BUAT_PIN_PEMILIK',
        humanSummary: hasExistingPin ? 'PIN otorisasi pemilik diperbarui untuk keamanan toko.' : 'PIN otorisasi pemilik pertama kali dibuat untuk keamanan toko.',
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
    message: hasExistingPin ? 'PIN Pemilik berhasil diperbarui.' : 'PIN Pemilik berhasil dibuat.',
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
    imageUrl?: string;
    supplyType?: 'OWN' | 'CONSIGNMENT' | 'AFFILIATE';
    affiliatePartner?: string;
    affiliateCommissionType?: 'PERSEN' | 'NOMINAL_PER_KG' | 'NOMINAL_PER_PCS';
    affiliateCommissionValue?: number;
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
  const supplyType = input.supplyType ?? 'OWN';
  const safeHppPerKg = supplyType !== 'OWN'
    ? 0
    : Number.isFinite(input.estimatedHppPerKg) && (input.estimatedHppPerKg ?? 0) > 0
      ? Math.round(input.estimatedHppPerKg!)
      : Math.round(safePricePerKg * 0.72);
  if (supplyType !== 'OWN' && safeStockGram > 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Produk Konsinyasi/Affiliate tidak boleh dibuat dengan stok milik toko. Terima stok konsinyasi melalui lot titipan; Affiliate tidak memiliki stok fisik.' };
  }
  if (supplyType === 'AFFILIATE' && (
    !input.affiliatePartner?.trim() ||
    !input.affiliateCommissionType ||
    !Number.isSafeInteger(input.affiliateCommissionValue) ||
    Number(input.affiliateCommissionValue) <= 0 ||
    (input.affiliateCommissionType === 'PERSEN' && Number(input.affiliateCommissionValue) > 10000)
  )) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Produk Affiliate wajib memiliki partner dan konfigurasi komisi valid. Nilai PERSEN menggunakan basis points (1000 = 10%).' };
  }

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
    supplyType,
    ...(supplyType === 'AFFILIATE' ? {
      affiliatePartner: input.affiliatePartner?.trim(),
      affiliateCommissionType: input.affiliateCommissionType,
      affiliateCommissionValue: input.affiliateCommissionValue,
    } : {}),
    stockGram: 0,
    safetyStockGram: safeSafetyGram,
    tag: input.tag?.trim() || 'Produk Baru',
    alternativeId: 'PROD_02',
    alternativeName: 'Sirloin Choice USA (Primal)',
    alternativeReason: 'Pilihan potongan daging alternatif',
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
    const expiryDateObj = new Date(Date.now() + 60 * 86400000);
    const expiryDate = formatLocalYmd(expiryDateObj);
    const openingValue = Math.round((safeStockGram * safeHppPerKg) / 1000);
    const newLot: BatchLotEntity = {
      id: `LOT_${Date.now()}_${generateUUID().slice(0, 4)}`,
      code: lotCode,
      product: cleanName,
      productId: cleanId,
      daysLeft: 60,
      expiryDate,
      weightGram: safeStockGram,
      maxCapacityGram: Math.max(safeStockGram, 50000),
      hppKgRupiah: safeHppPerKg,
      carryingValueRupiah: openingValue,
      loc: 'FREEZER-A-01',
      isFefo: false,
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
            ...buildInventoryJournalLines([{ lotId: newLot.id, cogsRupiah: openingValue }], [newLot], 'DEBIT'),
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
          product: newProduct,
          lot: newLot,
          lotCode,
          stockGram: safeStockGram,
          hppKgRupiah: safeHppPerKg,
          openingValue,
          referenceNo: cleanSku,
        },
      }),
      ...nextOutbox,
    ];
  }

  const nextProducts = syncProductsStockFromLots([newProduct, ...state.products], nextLots);
  const nextState: BusinessEngineState = {
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
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };

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
  return updateMasterData(
    state,
    { categories: [...existing, normalizedCat] },
    `Kategori ${normalizedCat.label} (${normalizedCat.id}) ditambahkan dan disinkronkan ke perangkat lain.`
  );
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
  if (target.deletedAt) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Kategori sudah diarsipkan.' };
  }
  if (state.products.some((product) => product.category === categoryId)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Pindahkan produk ke kategori lain sebelum mengarsipkan kategori ini.' };
  }
  return updateMasterData(
    state,
    { categories: existing.map((category) => category.id === categoryId ? { ...category, deletedAt: nowIso() } : category) },
    `Kategori ${target.label} diarsipkan dan disinkronkan ke perangkat lain.`
  );
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
  const nextState: BusinessEngineState = {
    ...state,
    suppliers: nextSuppliers,
    supplierPhones: nextPhones,
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Supplier ${trimmedName} berhasil disimpan permanen.`,
  };
}

export function updateMasterData(
  state: BusinessEngineState,
  changes: Partial<Pick<BusinessEngineState, 'products' | 'lots' | 'customers' | 'inboundPOs' | 'supplierInvoices' | 'categories'>>,
  summary: string,
  actorName = 'Admin Toko'
): EngineActionResult {
  const allowedKeys = new Set(['products', 'lots', 'customers', 'inboundPOs', 'supplierInvoices', 'categories']);
  if (!Object.keys(changes).length || Object.keys(changes).some((key) => !allowedKeys.has(key))) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Perubahan master data tidak valid.' };
  }
  if (changes.categories) {
    const ids = new Set<string>();
    for (const category of changes.categories) {
      if (!category.id.trim() || !category.label.trim() ||
          (category.deletedAt !== undefined && category.deletedAt !== null && !Number.isFinite(Date.parse(category.deletedAt)))) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Master kategori memiliki kode, nama, atau timestamp arsip yang tidak valid.' };
      }
      if (ids.has(category.id)) return { ok: false, state, errorCode: 'DUPLICATE', message: 'ID kategori duplikat.' };
      ids.add(category.id);
    }
  }
  if (changes.products) {
    const ids = new Set<string>();
    for (const product of changes.products) {
      if (!product.id || !product.sku.trim() || !product.name.trim() || !Number.isSafeInteger(product.basePricePerKg) || product.basePricePerKg <= 0 || !Number.isSafeInteger(product.stockGram) || product.stockGram < 0) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Master produk memiliki SKU, nama, harga, atau stok yang tidak valid.' };
      }
      if (ids.has(product.id)) return { ok: false, state, errorCode: 'DUPLICATE', message: 'ID produk duplikat.' };
      ids.add(product.id);
      const existing = state.products.find((item) => item.id === product.id);
      if (existing && (product.stockGram !== existing.stockGram || product.movingAvgHppPerKg !== existing.movingAvgHppPerKg)) return { ok: false, state, errorCode: 'VALIDATION', message: 'Stok dan HPP produk wajib melalui transaksi stok/lot, bukan edit master produk.' };
    }
  }
  if (changes.lots) {
    for (const lot of changes.lots) {
      const existing = state.lots.find((item) => item.id === lot.id);
      if (!existing || lot.weightGram !== existing.weightGram || lot.hppKgRupiah !== existing.hppKgRupiah || lot.isQuarantined !== existing.isQuarantined) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Edit lot hanya boleh mengubah lokasi. Berat, HPP, dan status karantina harus melalui mutator stok.' };
      }
    }
  }
  if (changes.inboundPOs) {
    for (const po of changes.inboundPOs) {
      const existing = state.inboundPOs.find((item) => item.id === po.id);
      if (!po.id || !po.poNumber.trim() || !po.supplier.trim() || !Number.isSafeInteger(po.totalRupiah) || po.totalRupiah <= 0 || !Number.isFinite(po.orderWeightKg) || po.orderWeightKg <= 0) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Purchase Order memiliki nomor, supplier, berat, atau nilai yang tidak valid.' };
      }
      if (existing && (po.totalRupiah !== existing.totalRupiah || po.status !== existing.status || po.orderWeightKg !== existing.orderWeightKg)) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Nilai, status, dan berat PO hanya boleh berubah melalui proses pembelian/penerimaan.' };
      }
    }
  }
  if (changes.supplierInvoices) {
    for (const invoice of changes.supplierInvoices) {
      const existing = state.supplierInvoices.find((item) => item.id === invoice.id);
      if (!invoice.id || !invoice.invoiceNumber.trim() || !Number.isSafeInteger(invoice.totalAmountRupiah) || invoice.totalAmountRupiah <= 0 || !Number.isSafeInteger(invoice.paidAmountRupiah) || invoice.paidAmountRupiah < 0 || !Number.isSafeInteger(invoice.remainingAmountRupiah) || invoice.remainingAmountRupiah < 0 || invoice.paidAmountRupiah + invoice.remainingAmountRupiah !== invoice.totalAmountRupiah) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Tagihan supplier memiliki nominal pembayaran atau sisa yang tidak valid.' };
      }
      if (existing && (invoice.paidAmountRupiah !== existing.paidAmountRupiah || invoice.remainingAmountRupiah !== existing.remainingAmountRupiah || invoice.status !== existing.status)) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Status dan pembayaran utang supplier hanya boleh berubah melalui mutator pembayaran.' };
      }
    }
  }
  if (changes.customers) {
    const ids = new Set<string>();
    for (const customer of changes.customers) {
      if (!customer.id || !customer.name.trim() || !Number.isSafeInteger(customer.creditLimit) || customer.creditLimit < 0) {
        return { ok: false, state, errorCode: 'VALIDATION', message: 'Master pelanggan memiliki nama atau plafon yang tidak valid.' };
      }
      if (ids.has(customer.id)) return { ok: false, state, errorCode: 'DUPLICATE', message: 'ID pelanggan duplikat.' };
      ids.add(customer.id);
    }
  }
  const safeChanges: Record<string, unknown> = {};
  if (changes.products) {
    safeChanges.products = changes.products.map((p) => ({
      ...p,
      imageUrl: p.imageUrl?.startsWith('data:') ? undefined : p.imageUrl,
      gallery: p.gallery?.filter((g) => !g.url.startsWith('data:')),
    }));
  }
  if (changes.lots) safeChanges.lots = changes.lots;
  if (changes.customers) safeChanges.customers = changes.customers.map((c) => {
    const existing = state.customers.find((item) => item.id === c.id);
    return existing ? { ...c, currentReceivable: existing.currentReceivable } : c;
  });
  if (changes.inboundPOs) safeChanges.inboundPOs = changes.inboundPOs;
  if (changes.supplierInvoices) safeChanges.supplierInvoices = changes.supplierInvoices;
  if (changes.categories) safeChanges.categories = changes.categories;
  const idemKey = `MASTER-${generateUUID()}`;
  const syncItem = buildSyncItem({
    idempotencyKey: idemKey,
    entityType: 'MASTER_DATA',
    summary,
    payload: { kind: 'MASTER_DATA_PATCH', changes: safeChanges },
  });
  const nextState: BusinessEngineState = {
    ...state,
    ...changes,
    products: changes.products ? changes.products.map((p) => { const existing = state.products.find((item) => item.id === p.id); return existing ? { ...p, stockGram: existing.stockGram, movingAvgHppPerKg: existing.movingAvgHppPerKg } : p; }) : state.products,
    supplierInvoices: changes.supplierInvoices ? changes.supplierInvoices.map((invoice) => { const existing = state.supplierInvoices.find((item) => item.id === invoice.id); return existing ? { ...invoice, paidAmountRupiah: existing.paidAmountRupiah, remainingAmountRupiah: existing.remainingAmountRupiah, status: existing.status } : invoice; }) : state.supplierInvoices,
    inboundPOs: changes.inboundPOs ? changes.inboundPOs.map((po) => { const existing = state.inboundPOs.find((item) => item.id === po.id); return existing ? { ...po, status: existing.status, totalRupiah: existing.totalRupiah, orderWeightKg: existing.orderWeightKg } : po; }) : state.inboundPOs,
    customers: changes.customers
      ? changes.customers.map((c) => {
          const existing = state.customers.find((item) => item.id === c.id);
          return existing ? { ...c, currentReceivable: existing.currentReceivable } : c;
        })
      : state.customers,
    syncOutbox: [syncItem, ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    auditTrail: [buildAuditEntry({ actorName, actorRole: 'ADMIN', action: 'UBAH_MASTER_DATA', humanSummary: summary, referenceId: idemKey }), ...state.auditTrail],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: summary };
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

  const nextState: BusinessEngineState = {
    ...state,
    suppliers: nextSuppliers,
    supplierPhones: nextPhones,
    supplierInvoices: nextInvoices,
    lastUpdatedAt: nowIso(),
  };
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
  const idemKey = `PROMO-${generateUUID()}`;
  const syncItem = buildSyncItem({
    idempotencyKey: idemKey,
    entityType: 'MASTER_DATA',
    summary: `Pembaruan promo ${target.badgeLabel || target.id}`,
    payload: { kind: 'MASTER_DATA_PATCH', changes: { bazarPromos: [nextPromos.find((promo) => promo.id === promoId)!] } },
  });
  const nextState: BusinessEngineState = {
    ...state,
    bazarPromos: nextPromos,
    syncOutbox: [syncItem, ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
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
  const idemKey = `PROMO-${generateUUID()}`;
  const syncItem = buildSyncItem({
    idempotencyKey: idemKey,
    entityType: 'MASTER_DATA',
    summary: `Simpan promo ${newPromo.badgeLabel || newPromo.id}`,
    payload: { kind: 'MASTER_DATA_PATCH', changes: { bazarPromos: [newPromo] } },
  });
  const nextState: BusinessEngineState = {
    ...state,
    bazarPromos: nextPromos,
    syncOutbox: [syncItem, ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
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

function isSharedUmumCustomer(customer: Pick<CustomerEntity, 'id' | 'code' | 'name'>): boolean {
  const normalizedName = customer.name.trim().toLocaleUpperCase('id-ID');
  const normalizedCode = customer.code.trim().toLocaleUpperCase('id-ID');
  const normalizedId = customer.id.trim().toLocaleUpperCase('id-ID');
  return normalizedName === 'UMUM' || normalizedCode === 'UMUM' || normalizedId === 'CUST_UMUM';
}

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
    paymentBreakdown?: SalePaymentBreakdown;
    items: Array<{
      product: ProductEntity;
      weightGram: number;
      effectivePricePerKg: number;
      appliedPromoId?: string;
    }>;
    now?: Date;
    ownerPin?: string;
    isOnline: boolean;
    actorName?: string;
    /** Authenticated Sales identity; sourced from ERP session by the caller. */
    salesId?: string;
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

  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'TRANSFER' && input.paymentMethod !== 'TEMPO' && input.paymentMethod !== 'MIX') {
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
  if (input.salesId !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(input.salesId)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Identitas Sales transaksi tidak valid.' };
  }
  if (input.salesId && !isSharedUmumCustomer(customer) && customer?.assignedSalesId !== input.salesId) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Pelanggan belum ditugaskan kepada Sales ini atau ditugaskan kepada Sales lain.' };
  }
  if (customer && input.salesId && isSharedUmumCustomer(customer) &&
      input.paymentMethod !== 'CASH' && input.paymentMethod !== 'TRANSFER') {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Pelanggan UMUM hanya dapat digunakan Sales untuk pembayaran CASH atau TRANSFER langsung; TEMPO dan pembayaran campuran tidak diizinkan.' };
  }
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
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal diskon harus berupa bilangan bulat Rupiah >= 0.' };
  }
  if (rawDiscount > 0 && (state.ownerPinNeedsChange || !input.ownerPin || !verifyOwnerPin(state, input.ownerPin))) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Diskon manual wajib disetujui Owner dengan PIN aktif yang benar.' };
  }

  // 2b. Validate & simulate Bazar Promo status, date period, and remaining quota (applied only if commit succeeds)
  const sourcePromos = state.bazarPromos ?? [];
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
          return { ok: false, state, errorCode: 'VALIDATION', message: `Promo bazar untuk ${prodRef.name} tidak ditemukan.` };
        }
        if (!isBazarPromoEligible(promo, item.weightGram, referenceDate)) {
          return { ok: false, state, errorCode: 'VALIDATION', message: `Promo bazar "${promo.badgeLabel || promo.id}" tidak aktif, di luar periode, atau sisa kuota tidak mencukupi.` };
        }
        if (Math.round(promo.promoPricePerKg) >= normalTierPricing.effectivePricePerKg || item.effectivePricePerKg !== Math.round(promo.promoPricePerKg)) {
          return { ok: false, state, errorCode: 'VALIDATION', message: `Harga promo ${prodRef.name} tidak sesuai dengan harga promo aktif.` };
        }
        const nextSoldGram = Math.round(promo.soldKg * 1000) + item.weightGram;
        promo.soldKg = Number((nextSoldGram / 1000).toFixed(3));
        resolvedPromoIds[idx] = promo.id;
        hasPromoUsage = true;
      } else {
        const eligiblePromo = workingPromos?.find(
          (p) => p.sku === prodRef.sku &&
            Math.round(p.promoPricePerKg) < normalTierPricing.effectivePricePerKg &&
            isBazarPromoEligible(p, item.weightGram, referenceDate)
        );
        if (eligiblePromo) {
          if (item.effectivePricePerKg !== Math.round(eligiblePromo.promoPricePerKg)) {
            return { ok: false, state, errorCode: 'VALIDATION', message: `Promo aktif "${eligiblePromo.badgeLabel || eligiblePromo.id}" wajib diterapkan; harga tidak boleh diubah dari UI.` };
          }
          const nextSoldGram = Math.round(eligiblePromo.soldKg * 1000) + item.weightGram;
          eligiblePromo.soldKg = Number((nextSoldGram / 1000).toFixed(3));
          resolvedPromoIds[idx] = eligiblePromo.id;
          hasPromoUsage = true;
        } else if (item.effectivePricePerKg !== normalTierPricing.effectivePricePerKg) {
          return { ok: false, state, errorCode: 'VALIDATION', message: `Harga ${prodRef.name} tidak sesuai dengan harga tier yang dihitung Business Engine.` };
        }
      }
    }
  }

  // Enforce price priority in the engine; UI-supplied prices are never trusted.
  for (let idx = 0; idx < input.items.length; idx++) {
    const item = input.items[idx];
    const prodRef = state.products.find((p) => p.id === item.product.id)!;
    const expectedPricing = calculateProductTierPrice(prodRef, customer.tier, item.weightGram, sourcePromos ?? [], referenceDate);
    if (
      item.effectivePricePerKg !== expectedPricing.effectivePricePerKg ||
      resolvedPromoIds[idx] !== expectedPricing.appliedPromoId
    ) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: `Harga ${prodRef.name} tidak sesuai prioritas harga Business Engine (promo aktif → tier pelanggan).`,
      };
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
  let paymentBreakdown: SalePaymentBreakdown;

  if (input.paymentMethod === 'CASH') {
    if (!Number.isSafeInteger(input.cashTendered) || input.cashTendered < grandTotalRupiah) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal uang tunai harus berupa Rupiah bulat dan cukup untuk melunasi transaksi.' };
    }
    cashTendered = input.cashTendered;
    changeRupiah = cashTendered - grandTotalRupiah;
    paidAmountRupiah = grandTotalRupiah;
    balanceDueRupiah = 0;
    paymentBreakdown = { cashPaidRupiah: grandTotalRupiah, transferPaidRupiah: 0, receivableRupiah: 0 };
  } else if (input.paymentMethod === 'TRANSFER') {
    if (input.paidAmountRupiah !== undefined && (!Number.isSafeInteger(input.paidAmountRupiah) || input.paidAmountRupiah !== grandTotalRupiah)) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Pembayaran transfer harus lunas sesuai total tagihan.' };
    }
    paidAmountRupiah = grandTotalRupiah;
    cashTendered = 0;
    changeRupiah = 0;
    balanceDueRupiah = 0;
    paymentBreakdown = { cashPaidRupiah: 0, transferPaidRupiah: grandTotalRupiah, receivableRupiah: 0 };
  } else if (input.paymentMethod === 'TEMPO') {
    // TEMPO keeps the existing cash DP + receivable behavior.
    const dp = input.paidAmountRupiah ?? 0;
    if (!Number.isSafeInteger(dp) || dp < 0 || dp > grandTotalRupiah) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal uang muka (DP) tempo tidak valid.' };
    }
    paidAmountRupiah = dp;
    cashTendered = dp;
    changeRupiah = 0;
    balanceDueRupiah = grandTotalRupiah - dp;
    paymentBreakdown = { cashPaidRupiah: dp, transferPaidRupiah: 0, receivableRupiah: balanceDueRupiah };
  } else {
    const breakdown = input.paymentBreakdown;
    if (
      !breakdown ||
      !Number.isSafeInteger(breakdown.cashPaidRupiah) || breakdown.cashPaidRupiah < 0 ||
      !Number.isSafeInteger(breakdown.transferPaidRupiah) || breakdown.transferPaidRupiah < 0 ||
      !Number.isSafeInteger(breakdown.receivableRupiah) || breakdown.receivableRupiah < 0 ||
      breakdown.transferPaidRupiah <= 0 ||
      breakdown.cashPaidRupiah + breakdown.transferPaidRupiah + breakdown.receivableRupiah !== grandTotalRupiah ||
      [breakdown.cashPaidRupiah, breakdown.transferPaidRupiah, breakdown.receivableRupiah].filter((amount) => amount > 0).length < 2
    ) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Pembayaran campuran wajib memiliki minimal dua sumber dana yang valid dan totalnya harus sama persis dengan tagihan.' };
    }
    paymentBreakdown = { ...breakdown };
    paidAmountRupiah = breakdown.cashPaidRupiah + breakdown.transferPaidRupiah;
    cashTendered = breakdown.cashPaidRupiah;
    changeRupiah = 0;
    balanceDueRupiah = breakdown.receivableRupiah;
  }

  // 5. Pre-Mutation FEFO Stock Availability Validation (No silent virtual lots!)
  let workingLots = state.lots.map((l) => ({ ...l }));
  const allAllocations: LotAllocationRecord[] = [];
  let ownedCogsRupiah = 0;
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
    ownedCogsRupiah += fefoRes.totalCogsRupiah;
    itemAllocationsList.push({
      prodRef: line.prodRef,
      weightGram: line.weightGram,
      allocations: fefoRes.allocations,
    });
  }

  const totalConsignmentPayableRupiah = allAllocations.reduce(
    (sum, allocation) => sum + (allocation.consignmentPayableRupiah ?? 0), 0
  );
  const totalCogsRupiah = ownedCogsRupiah + totalConsignmentPayableRupiah;
  if (!Number.isSafeInteger(totalCogsRupiah) || !Number.isSafeInteger(totalConsignmentPayableRupiah)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Total HPP dan kewajiban konsinyasi melewati batas integer Rupiah aman.' };
  }

  // 6. Credit limit is warning-only: never block checkout or require Owner approval.
  const projectedReceivable = customer.currentReceivable + balanceDueRupiah;
  const exceedsCredit =
    balanceDueRupiah > 0 &&
    (customer.creditLimit === 0 || projectedReceivable > customer.creditLimit);

  // 7. Build Immutable Stock Ledger Entries (Strict 1-to-1 per Lot Allocation)
  const nextInvSeq = nextMonotonicSequence(
    state.transactions.map((t) => t.invoiceNumber),
    /^INV-(?:[A-Z0-9-]+-)?\d{6}-(\d+)$/,
    101
  );
  const seq = String(nextInvSeq).padStart(4, '0');
  const datePart = formatLocalYmd(referenceDate).slice(2).replace(/-/g, '');
  const devicePart = state.deviceId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-10) || 'DEVICE';
  const invoiceNumber = `INV-${devicePart}-${datePart}-${seq}`;
  const consignmentPayables: ConsignmentPayableRecord[] = allAllocations
    .filter((allocation) => allocation.ownershipType === 'CONSIGNMENT' && (allocation.consignmentPayableRupiah ?? 0) > 0)
    .map((allocation) => {
      const lot = state.lots.find((item) => item.id === allocation.lotId);
      const amountRupiah = allocation.consignmentPayableRupiah ?? 0;
      return {
        id: `CONSIGN-${invoiceNumber}-${allocation.lotId}`,
        idempotencyKey: input.idempotencyKey,
        invoiceNo: invoiceNumber,
        lotId: allocation.lotId, lotCode: allocation.lotCode,
        ownerName: lot?.consignmentOwnerName || 'Pemilik Barang Konsinyasi',
        supplierCode: lot?.supplierCode,
        weightGram: allocation.weightGram,
        setorPerKgRupiah: allocation.consignmentSetorPerKgRupiah ?? 0,
        amountRupiah, paidAmountRupiah: 0, remainingAmountRupiah: amountRupiah,
        status: 'UNPAID' as const, createdAt: nowIso(),
      };
    });
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
    ...(input.salesId ? { salesId: input.salesId } : {}),
    customerName: customer.name,
    customerTier: customer.tier,
    paymentMethod: input.paymentMethod,
    tempoDays: balanceDueRupiah > 0 ? customer.termDays || 7 : 0,
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
    paymentBreakdown,
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
  const cashDelta = paymentBreakdown.cashPaidRupiah;
  const nextCashInHand = state.cashInHandRupiah + cashDelta;
  const bankDelta = paymentBreakdown.transferPaidRupiah;
  const nextBankBalance = (state.bankBalanceRupiah ?? 0) + bankDelta;

  const updatedCustomers = state.customers.map((c) => {
    if (c.id === customer.id && balanceDueRupiah > 0) {
      return { ...c, currentReceivable: c.currentReceivable + balanceDueRupiah };
    }
    return c;
  });

  const nextReceivables = [...state.receivables];
  if (balanceDueRupiah > 0) {
    const dueDays = customer.termDays || 7;
    const dueObj = new Date(Date.now() + dueDays * 86400000);
    const dueLabel =
      dueObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ` (${dueDays} hari lagi)`;
    nextReceivables.unshift({
      id: `REC_${invoiceNumber}`,
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
  if (paymentBreakdown.cashPaidRupiah > 0) {
    journalPaymentLines.push({ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: paymentBreakdown.cashPaidRupiah, credit: 0 });
  }
  if (paymentBreakdown.transferPaidRupiah > 0) {
    journalPaymentLines.push({ accountCode: '1102', accountName: 'Rekening Bank BCA Usaha', debit: paymentBreakdown.transferPaidRupiah, credit: 0 });
  }
  if (paymentBreakdown.receivableRupiah > 0) {
    journalPaymentLines.push({ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: paymentBreakdown.receivableRupiah, credit: 0 });
  }

  const derivedJournal = buildDerivedJournal({
    idempotencyKey: input.idempotencyKey,
    referenceNo: invoiceNumber,
    category: 'PENJUALAN',
    description: `Penjualan ${input.paymentMethod === 'CASH' ? 'Tunai' : input.paymentMethod === 'TRANSFER' ? 'Transfer' : input.paymentMethod === 'MIX' ? 'Campuran' : 'Tempo'} ke ${customer.name} (${(totalWeightGram / 1000).toFixed(1)} kg)`,
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
      ...buildInventoryJournalLines(txRecord.lotAllocations.map((allocation) => ({ lotId: allocation.lotId, cogsRupiah: allocation.cogsRupiah })), state.lots, 'CREDIT'),
      ...(totalConsignmentPayableRupiah > 0
        ? [{ accountCode: '2102', accountName: 'Utang Konsinyasi', debit: 0, credit: totalConsignmentPayableRupiah }]
        : []),
    ],
  });

  // 11. Audit Trail & Sync Outbox
  const auditEntry = buildAuditEntry({
    actorName: actor,
    actorRole: 'SALES',
    action: 'TRANSAKSI_PENJUALAN',
    humanSummary: `Faktur ${invoiceNumber} untuk ${customer.name} senilai Rp ${grandTotalRupiah.toLocaleString('id-ID')} (${(totalWeightGram / 1000).toFixed(2)} kg)${rawDiscount > 0 ? ' [Diskon Owner]' : ''}.`,
    referenceId: invoiceNumber,
  });

  const syncItem = buildSyncItem({
    idempotencyKey: input.idempotencyKey,
    entityType: 'SALE',
    summary: `${invoiceNumber} • ${customer.name} • Rp ${grandTotalRupiah.toLocaleString('id-ID')}`,
    payload: {
      transactionUuid: txRecord.uuid,
      ...(input.salesId ? { salesId: input.salesId } : {}),
      invoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      paymentMethod: input.paymentMethod,
      paymentBreakdown,
      totalWeightGram,
      subtotalRupiah,
      discountRupiah: rawDiscount,
      shippingFee: effectiveShipping,
      isFreeShipping: input.isFreeShipping,
      grandTotalRupiah,
      paidAmountRupiah,
      balanceDueRupiah,
      tempoDays: txRecord.tempoDays,
      totalCogsRupiah,
      receivable: nextReceivables.find((r) => r.invoice === invoiceNumber),
      items: txRecord.items,
      lotAllocations: txRecord.lotAllocations,
    },
  });

  const nextPersistedPromos = hasPromoUsage && workingPromos ? workingPromos : state.bazarPromos;

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: nextCashInHand,
    bankBalanceRupiah: nextBankBalance,
    products: updatedProducts,
    lots: workingLots,
    customers: updatedCustomers,
    receivables: nextReceivables,
    consignmentPayables: [...(state.consignmentPayables ?? []), ...consignmentPayables],
    transactions: [txRecord, ...state.transactions],
    stockLedger: [...newLedgerEntries, ...state.stockLedger],
    journals: [derivedJournal, ...state.journals],
    auditTrail: [auditEntry, ...state.auditTrail],
    syncOutbox: [syncItem, ...state.syncOutbox],
    processedIdempotencyKeys: [input.idempotencyKey, ...state.processedIdempotencyKeys],
    ...(nextPersistedPromos !== undefined ? { bazarPromos: nextPersistedPromos } : {}),
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);

  return {
    ok: true,
    state: nextState,
    createdInvoice: txRecord,
    updatedBazarPromos: hasPromoUsage ? workingPromos : (state.bazarPromos ?? []),
    message: `Transaksi ${invoiceNumber} berhasil dicatat. Stok dan laporan otomatis diperbarui.${exceedsCredit ? ' PERHATIAN: plafon piutang pelanggan terlampaui (warning saja).' : ''}`,
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
  const tx = state.transactions.find((t) => t.uuid === txUuid);
  if (!tx) return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Transaksi tidak ditemukan.' };
  const stockAllocationsToRestore = tx.remoteStockAppliedAllocations ?? tx.lotAllocations;
  const voidIdemKey = `VOID-${tx.uuid}`;
  if (tx.status === 'VOIDED' || state.processedIdempotencyKeys.includes(voidIdemKey)) {
    return { ok: false, state, errorCode: 'ALREADY_VOIDED', message: 'Transaksi ini sudah dibatalkan sebelumnya.' };
  }
  if (state.ownerPinNeedsChange) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN bawaan wajib diganti sebelum Owner dapat membatalkan transaksi.' };
  }
  if (!options?.ownerPin || !verifyOwnerPin(state, options.ownerPin)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN Pemilik wajib diisi dan harus benar. Pembatalan transaksi dibatalkan demi keamanan.' };
  }
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (!cleanReason) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Alasan pembatalan transaksi wajib diisi.' };
  }

  const txPaymentBreakdown = resolveSalePaymentBreakdown(tx);
  if (!txPaymentBreakdown) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Rincian sumber dana faktur tidak valid atau tidak tersedia. VOID ditahan untuk rekonsiliasi manual.' };
  }
  const reversedCash = txPaymentBreakdown.cashPaidRupiah;
  const reversedBank = txPaymentBreakdown.transferPaidRupiah;
  const reversedReceivable = txPaymentBreakdown.receivableRupiah;

  const txConsignmentPayables = (state.consignmentPayables ?? []).filter((payable) => payable.invoiceNo === tx.invoiceNumber && payable.status !== 'VOIDED');
  if (txConsignmentPayables.some((payable) => payable.paidAmountRupiah > 0)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Utang konsinyasi untuk faktur ini sudah dibayar sebagian/penuh. Reversal settlement konsinyasi harus diselesaikan lebih dulu sebelum VOID.' };
  }
  if ((state.receivablePayments ?? []).some((payment) => payment.invoice === tx.invoiceNumber && !payment.reversedAt)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Faktur sudah menerima pembayaran piutang. Batalkan/reversal pembayaran piutang terlebih dahulu sebelum membatalkan faktur.' };
  }
  if (state.cashInHandRupiah < reversedCash) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo kas tidak mencukupi untuk mengembalikan pembayaran tunai. Rekonsiliasi dan catat refund terlebih dahulu; faktur belum dibatalkan.' };
  }
  if (reversedBank > 0 && (state.bankBalanceInitialized !== true || (state.bankBalanceRupiah ?? 0) < reversedBank)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo bank tidak mencukupi untuk mengembalikan pembayaran transfer. Rekonsiliasi dan catat refund terlebih dahulu; faktur belum dibatalkan.' };
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
  const updatedLots = state.lots.map((lot) =>
    stockAllocationsToRestore
      .filter((allocation) => allocation.lotId === lot.id)
      .reduce((currentLot, allocation) => restoreLotStock(
        currentLot,
        allocation.weightGram,
        allocation.carryingValueRupiah ?? allocation.cogsRupiah
      ), lot)
  );

  const updatedProducts = syncProductsStockFromLots(state.products, updatedLots);

  const nextCash = state.cashInHandRupiah - reversedCash;
  const nextBank = (state.bankBalanceRupiah ?? 0) - reversedBank;

  const updatedCustomers = state.customers.map((c) => {
    if (c.id === tx.customerId && reversedReceivable > 0) {
      return { ...c, currentReceivable: Math.max(0, c.currentReceivable - reversedReceivable) };
    }
    return c;
  });

  const updatedReceivables = state.receivables.map((r) =>
    r.invoice === tx.invoiceNumber ? { ...r, amount: 0, status: 'LUNAS' as const, dueDate: 'Dibatalkan (Void)' } : r
  );

  const voidTimestamp = nowIso();
  // Exact 1-to-1 reversal stock ledger per lot allocation
  const reversalLedger: StockLedgerEntry[] =
    stockAllocationsToRestore.length > 0
      ? stockAllocationsToRestore.map((alloc) => {
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

  const reversalSubtotal = tx.subtotalRupiah;
  const reversalDiscount = tx.discountRupiah;
  const reversalShipping = tx.shippingFee;
  if (!Number.isSafeInteger(reversalSubtotal) || reversalSubtotal < 0 ||
      !Number.isSafeInteger(reversalDiscount) || reversalDiscount < 0 ||
      !Number.isSafeInteger(reversalShipping) || reversalShipping < 0 ||
      reversalDiscount > reversalSubtotal ||
      reversalSubtotal - reversalDiscount + reversalShipping !== tx.grandTotalRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Rincian subtotal, diskon, dan ongkir faktur tidak valid. VOID ditahan untuk rekonsiliasi.' };
  }

  const reversalPaymentLines: JournalLine[] = [];
  if (reversedCash > 0) reversalPaymentLines.push({ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: 0, credit: reversedCash });
  if (reversedBank > 0) reversalPaymentLines.push({ accountCode: '1102', accountName: 'Rekening Bank BCA Usaha', debit: 0, credit: reversedBank });
  if (reversedReceivable > 0) reversalPaymentLines.push({ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: 0, credit: reversedReceivable });

  const reversalJournal = buildDerivedJournal({
    idempotencyKey: voidIdemKey,
    referenceNo: `VOID-${tx.invoiceNumber}`,
    category: 'PEMBATALAN',
    description: `Pembatalan faktur ${tx.invoiceNumber} (${tx.customerName}): ${cleanReason}`,
    lines: [
      { accountCode: '4101', accountName: 'Penjualan Daging', debit: reversalSubtotal, credit: 0 },
      ...(reversalShipping > 0 ? [{ accountCode: '4102', accountName: 'Pendapatan Jasa Pengiriman', debit: reversalShipping, credit: 0 }] : []),
      ...(reversalDiscount > 0 ? [{ accountCode: '4103', accountName: 'Potongan & Retur Penjualan', debit: 0, credit: reversalDiscount }] : []),
      ...reversalPaymentLines,
      ...buildInventoryJournalLines(stockAllocationsToRestore.map((allocation) => ({ lotId: allocation.lotId, cogsRupiah: allocation.cogsRupiah })), state.lots, 'DEBIT'),
      ...(txConsignmentPayables.reduce((sum, payable) => sum + payable.amountRupiah, 0) > 0
        ? [{ accountCode: '2102', accountName: 'Utang Konsinyasi', debit: txConsignmentPayables.reduce((sum, payable) => sum + payable.amountRupiah, 0), credit: 0 }]
        : []),
      { accountCode: '5101', accountName: 'Harga Pokok Penjualan (HPP)', debit: 0, credit: tx.totalCogsRupiah },
    ],
  });

  const nextPromosState = restoredAnyPromo ? restoredPromos : state.bazarPromos;

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: nextCash,
    bankBalanceRupiah: nextBank,
    products: updatedProducts,
    lots: updatedLots,
    consignmentPayables: (state.consignmentPayables ?? []).map((payable) =>
      payable.invoiceNo === tx.invoiceNumber && payable.status !== 'VOIDED'
        ? { ...payable, remainingAmountRupiah: 0, status: 'VOIDED', voidedAt: nowIso(), voidReason: cleanReason }
        : payable
    ),
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
    processedIdempotencyKeys: [voidIdemKey, ...state.processedIdempotencyKeys],
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
  if (!searchRaw) return 0;

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
  return bestIdx >= 0 ? bestIdx : 0;
}

function getPurchaseGoodsCostRupiah(po: PurchaseOrderEntity): number {
  if (Number.isSafeInteger(po.goodsCostRupiah) && Number(po.goodsCostRupiah) >= 0) {
    return Number(po.goodsCostRupiah);
  }
  // Legacy POs stored estimated freight/duty inside totalRupiah; separate it
  // from the goods invoice so actual component invoices are not capitalized twice.
  const estimatedLanded = Number.isSafeInteger(po.landedCostRupiah) && Number(po.landedCostRupiah) >= 0
    ? Number(po.landedCostRupiah)
    : 0;
  const goodsCost = po.totalRupiah - estimatedLanded;
  return Number.isSafeInteger(goodsCost) && goodsCost >= 0 ? goodsCost : po.totalRupiah;
}

function buildSupplierInvoiceForPurchaseReceipt(
  state: BusinessEngineState,
  po: PurchaseOrderEntity,
  receivedAtIso = nowIso(),
  incoming?: Partial<SupplierInvoiceEntity>
): SupplierInvoiceEntity {
  const goodsCostRupiah = getPurchaseGoodsCostRupiah(po);
  const existing = state.supplierInvoices.find((invoice) => invoice.poNumber === po.poNumber);
  const invoiceNumber = existing?.invoiceNumber || incoming?.invoiceNumber || `INV-SUP-${po.poNumber.slice(3)}`;
  const recordedPaid = state.journals
    .filter((journal) => journal.referenceNo === invoiceNumber && journal.category === 'PEMBAYARAN')
    .reduce((sum, journal) => sum + journal.lines
      .filter((line) => line.accountCode === '2101' && line.debit > 0)
      .reduce((lineSum, line) => lineSum + line.debit, 0), 0);
  const safeRecordedPaid = Number.isSafeInteger(recordedPaid) && recordedPaid >= 0 && recordedPaid <= goodsCostRupiah
    ? recordedPaid
    : 0;
  const receivedAt = new Date(receivedAtIso);
  const validReceivedAt = Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt;
  const jakartaDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(validReceivedAt);
  const datePart = (type: string) => Number(jakartaDateParts.find((part) => part.type === type)?.value);
  // Anchor at 12:00 UTC so date-only calculations remain on the same Jakarta calendar day.
  const dueAt = new Date(Date.UTC(datePart('year'), datePart('month') - 1, datePart('day'), 12));
  if (po.paymentTerm === 'TEMPO_30') dueAt.setUTCDate(dueAt.getUTCDate() + 30);
  const formatDueDate = (date: Date) => new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
  const dueDate = po.paymentTerm === 'CASH'
    ? formatDueDate(dueAt)
    : po.paymentTerm === 'TEMPO_30'
      ? formatDueDate(dueAt)
      : existing?.dueDate || incoming?.dueDate || po.invoiceDueDate || formatDueDate(dueAt);
  const remaining = goodsCostRupiah - safeRecordedPaid;
  return {
    id: existing?.id || incoming?.id || `SUP_INV_${po.id}`,
    invoiceKind: 'GOODS',
    invoiceNumber,
    poNumber: po.poNumber,
    supplier: po.supplier,
    supplierPhone: po.supplierPhone || existing?.supplierPhone || incoming?.supplierPhone || '',
    originCountry: existing?.originCountry || incoming?.originCountry ||
      (po.supplier.includes('Australia') ? 'Australia' : po.supplier.includes('USA') ? 'USA' : 'Impor'),
    totalAmountRupiah: goodsCostRupiah,
    paidAmountRupiah: safeRecordedPaid,
    remainingAmountRupiah: remaining,
    dueDate,
    daysDiff: po.paymentTerm === 'CASH' ? 0 : po.paymentTerm === 'TEMPO_30' ? 30 : existing?.daysDiff ?? incoming?.daysDiff ?? 30,
    status: remaining === 0 ? 'LUNAS' : safeRecordedPaid > 0 ? 'CICILAN' : 'BELUM_LUNAS',
  };
}

export function receiveConsignmentStock(
  state: BusinessEngineState,
  input: {
    productId: string;
    lotCode: string;
    expiryDate: string;
    weightGram: number;
    ownerName: string;
    supplierCode?: string;
    setorPerKgRupiah: number;
    loc?: string;
    actorName?: string;
    idempotencyKey?: string;
  }
): EngineActionResult {
  const idemKey = input.idempotencyKey?.trim() || `CONSIGNMENT-RECEIPT-${input.lotCode}`;
  if (state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Penerimaan stok konsinyasi ini sudah pernah dicatat.' };
  }
  const product = state.products.find((item) => item.id === input.productId);
  const ownerName = input.ownerName?.trim() || '';
  const lotCode = input.lotCode?.trim() || '';
  if (!product || product.supplyType === 'AFFILIATE') {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Produk fisik konsinyasi tidak ditemukan atau bertipe Affiliate.' };
  }
  if (!ownerName || !lotCode || state.lots.some((lot) => lot.code.toLowerCase() === lotCode.toLowerCase())) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nama pemilik barang wajib diisi dan kode lot konsinyasi harus unik.' };
  }
  if (!Number.isSafeInteger(input.weightGram) || input.weightGram <= 0 ||
      !Number.isSafeInteger(input.setorPerKgRupiah) || input.setorPerKgRupiah <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.expiryDate) ||
      !Number.isFinite(Date.parse(input.expiryDate + 'T00:00:00'))) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Berat, tarif setor/kg, atau tanggal kedaluwarsa konsinyasi tidak valid.' };
  }
  const lot: BatchLotEntity = {
    id: `LOT-CONSIGN-${generateUUID()}`, code: lotCode,
    product: product.name, productId: product.id,
    daysLeft: computeDaysLeftFromExpiry(input.expiryDate),
    expiryDate: input.expiryDate,
    weightGram: input.weightGram, maxCapacityGram: Math.max(input.weightGram, 30000),
    hppKgRupiah: 0, carryingValueRupiah: 0,
    supplierCode: input.supplierCode?.trim() || undefined,
    ownershipType: 'CONSIGNMENT', consignmentOwnerName: ownerName,
    consignmentSetorPerKgRupiah: input.setorPerKgRupiah,
    loc: input.loc?.trim() || 'FREEZER-A-01',
    isFefo: false, isQuarantined: false,
  };
  const ledgerEntry: StockLedgerEntry = {
    uuid: generateUUID(), idempotencyKey: idemKey, timestamp: nowIso(),
    actorName: input.actorName || 'Admin Gudang',
    type: 'IN_ADJUST', humanLabel: 'Barang Masuk Konsinyasi',
    productName: product.name, lotId: lot.id, lotCode: lot.code,
    weightGramDelta: lot.weightGram, unitCostPerKg: 0, valueRupiahDelta: 0,
    movingAvgHppAfterKg: product.movingAvgHppPerKg,
    referenceNo: lot.code,
    note: `Stok titipan milik ${ownerName}; bukan aset persediaan toko. Tarif setor Rp ${input.setorPerKgRupiah.toLocaleString('id-ID')}/kg.`,
  };
  const nextLots = [lot, ...state.lots];
  const nextState: BusinessEngineState = {
    ...state,
    lots: nextLots,
    products: syncProductsStockFromLots(state.products, nextLots),
    stockLedger: [ledgerEntry, ...state.stockLedger],
    syncOutbox: [buildSyncItem({
      idempotencyKey: idemKey, entityType: 'CONSIGNMENT',
      summary: `Terima stok konsinyasi ${lot.code} (${(lot.weightGram / 1000).toFixed(3)} kg)`,
      payload: { kind: 'RECEIPT', lot, referenceNo: lot.code },
    }), ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    auditTrail: [buildAuditEntry({
      actorName: input.actorName || 'Admin Gudang', actorRole: 'ADMIN',
      action: 'CONSIGNMENT_STOCK_RECEIVED',
      humanSummary: `Stok konsinyasi ${lot.code} sebanyak ${(lot.weightGram / 1000).toFixed(3)} kg diterima dari ${ownerName}; nilai aset persediaan Rp 0.`,
      referenceId: lot.code,
    }), ...state.auditTrail],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: `Stok konsinyasi ${lot.code} berhasil diterima tanpa membentuk HPP/aset persediaan.` };
}

export function receiveInboundPurchase(
  state: BusinessEngineState,
  poId: string,
  actualWeightGram: number,
  extraCostRupiah: number,
  actorName = 'Kepala Gudang',
  isOnline = true,
  landedCostInputs: LandedCostComponentInput[] = []
): EngineActionResult {
  const po = state.inboundPOs.find((p) => p.id === poId);
  if (!po) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Pesanan pembelian tidak ditemukan.' };
  }
  const idemKey = `GR-${po.id}`;
  if (po.status === 'SELESAI_BONGKAR' || state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Kontainer ini sudah dibongkar dan masuk stok.' };
  }
  if (!Number.isSafeInteger(actualWeightGram) || actualWeightGram <= 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Berat barang masuk harus berupa integer Gram positif.' };
  }
  if (!Number.isSafeInteger(extraCostRupiah) || extraCostRupiah < 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Biaya tambahan bongkar harus berupa integer Rupiah non-negatif.' };
  }
  if (!Number.isSafeInteger(po.totalRupiah) || po.totalRupiah < 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nilai PO harus berupa integer Rupiah aman non-negatif.' };
  }
  const normalizedComponents: LandedCostComponentEntity[] = [];
  let componentPaidCash = 0;
  let componentPaidBank = 0;
  let componentPayable = 0;
  const seenComponentInvoices = new Set<string>();
  for (const component of landedCostInputs ?? []) {
    const vendor = component.vendor?.trim() || '';
    const invoiceReference = component.invoiceReference?.trim() || '';
    const description = component.description?.trim() || '';
    if (!vendor || !invoiceReference || !description ||
        !['FREIGHT', 'DUTY', 'HANDLING', 'CLEARANCE', 'COLD_STORAGE', 'OTHER'].includes(component.type) ||
        !['IDR', 'USD'].includes(component.currency) ||
        !Number.isSafeInteger(component.amount) || component.amount <= 0 ||
        !['PAID', 'PAYABLE'].includes(component.paymentStatus)) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Komponen landed cost harus memiliki jenis, keterangan, vendor, referensi invoice, mata uang, dan nominal yang valid.' };
    }
    let amountIdr = component.amount;
    let exchangeRateIdrPerUsd: number | undefined;
    if (component.currency === 'USD') {
      if (!Number.isSafeInteger(component.exchangeRateIdrPerUsd) || Number(component.exchangeRateIdrPerUsd) <= 0) {
        return { ok: false, state, errorCode: 'VALIDATION', message: `Kurs manual IDR/USD wajib berupa integer positif untuk invoice ${invoiceReference}.` };
      }
      exchangeRateIdrPerUsd = Number(component.exchangeRateIdrPerUsd);
      amountIdr = component.amount * exchangeRateIdrPerUsd;
    }
    if (!Number.isSafeInteger(amountIdr) || amountIdr <= 0) {
      return { ok: false, state, errorCode: 'VALIDATION', message: `Nilai IDR komponen ${invoiceReference} melewati batas integer aman.` };
    }
    const invoiceKey = `${vendor.toUpperCase()}::${invoiceReference.toUpperCase()}`;
    if (seenComponentInvoices.has(invoiceKey) || state.supplierInvoices.some((invoice) =>
      invoice.supplier.trim().toUpperCase() === vendor.toUpperCase() &&
      invoice.invoiceNumber.trim().toUpperCase() === invoiceReference.toUpperCase()
    )) {
      return { ok: false, state, errorCode: 'DUPLICATE', message: `Invoice landed cost ${invoiceReference} dari ${vendor} sudah pernah dicatat.` };
    }
    seenComponentInvoices.add(invoiceKey);
    if (component.paymentStatus === 'PAID') {
      if (component.paymentMethod !== 'CASH' && component.paymentMethod !== 'TRANSFER') {
        return { ok: false, state, errorCode: 'VALIDATION', message: `Sumber pembayaran invoice ${invoiceReference} harus CASH atau TRANSFER.` };
      }
      if (component.paymentMethod === 'CASH') componentPaidCash += amountIdr;
      else componentPaidBank += amountIdr;
    } else {
      if (!component.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(component.dueDate) ||
          !Number.isFinite(Date.parse(component.dueDate + 'T00:00:00'))) {
        return { ok: false, state, errorCode: 'VALIDATION', message: `Tanggal jatuh tempo wajib valid untuk invoice landed cost ${invoiceReference}.` };
      }
      componentPayable += amountIdr;
    }
    if (!Number.isSafeInteger(componentPaidCash) || !Number.isSafeInteger(componentPaidBank) || !Number.isSafeInteger(componentPayable)) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Total komponen landed cost melewati batas integer Rupiah aman.' };
    }
    normalizedComponents.push({
      id: component.id?.trim() || generateUUID(),
      type: component.type,
      description,
      vendor,
      invoiceReference,
      currency: component.currency,
      amount: component.amount,
      ...(exchangeRateIdrPerUsd ? { exchangeRateIdrPerUsd } : {}),
      amountIdr,
      paymentStatus: component.paymentStatus,
      ...(component.paymentStatus === 'PAID' ? { paymentMethod: component.paymentMethod } : {}),
      ...(component.paymentStatus === 'PAYABLE' ? { supplierInvoiceId: `LC-AP-${component.id}` } : {}),
      ...(component.dueDate ? { dueDate: component.dueDate } : {}),
    });
  }

  const paidCashRupiah = extraCostRupiah + componentPaidCash;
  const paidBankRupiah = componentPaidBank;
  if (paidCashRupiah > 0 && (
    !Number.isSafeInteger(state.cashInHandRupiah) || state.cashInHandRupiah < paidCashRupiah
  )) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Kas utama tidak mencukupi untuk biaya landed cost yang dibayar tunai. Penerimaan stok belum dicatat.' };
  }
  if (paidBankRupiah > 0 && (
    state.bankBalanceInitialized !== true || !Number.isSafeInteger(state.bankBalanceRupiah) ||
    Number(state.bankBalanceRupiah) < paidBankRupiah
  )) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo bank belum direkonsiliasi atau tidak mencukupi untuk biaya landed cost transfer.' };
  }

  const safeWeightGram = actualWeightGram;
  const safeExtraCost = extraCostRupiah;
  const goodsCostRupiah = getPurchaseGoodsCostRupiah(po);
  const componentTotalIdr = normalizedComponents.reduce((sum, component) => sum + component.amountIdr, 0);
  const totalLandedCost = goodsCostRupiah + safeExtraCost + componentTotalIdr;
  const landedCostTimes1000 = totalLandedCost * 1000;
  if (!Number.isSafeInteger(totalLandedCost) || !Number.isSafeInteger(landedCostTimes1000)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Total landed cost melewati batas integer Rupiah aman.' };
  }
  const incomingHppPerKg = Math.round(landedCostTimes1000 / safeWeightGram);
  if (!Number.isSafeInteger(incomingHppPerKg)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'HPP pembelian melewati batas integer aman.' };
  }

  const targetProdIdx = matchInboundPurchaseProductIndex(state.products, po);
  if (targetProdIdx < 0) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Master produk kosong; tidak ada target stok produk.' };
  }
  const targetProd = state.products[targetProdIdx];
  if (targetProd.supplyType === 'CONSIGNMENT' || targetProd.supplyType === 'AFFILIATE') {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Penerimaan PO pembelian hanya untuk stok milik toko. Konsinyasi gunakan penerimaan lot titipan; Affiliate tidak memiliki stok fisik.' };
  }

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
    carryingValueRupiah: totalLandedCost,
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
    p.id === po.id ? { ...p, status: 'SELESAI_BONGKAR', eta: 'Sudah Diterima & Masuk Freezer', landedCostComponents: normalizedComponents } : p
  );
  const supplierInvoice = buildSupplierInvoiceForPurchaseReceipt(state, po);
  const componentInvoices: SupplierInvoiceEntity[] = normalizedComponents
    .filter((component) => component.paymentStatus === 'PAYABLE')
    .map((component) => ({
      id: `LC-AP-${component.id}`,
      invoiceKind: 'LANDED_COST', landedCostComponentId: component.id,
      invoiceNumber: component.invoiceReference,
      poNumber: `LC-${po.poNumber}-${component.id}`,
      supplier: component.vendor,
      supplierPhone: state.supplierPhones?.[component.vendor] || '',
      originCountry: 'Tidak Berlaku',
      totalAmountRupiah: component.amountIdr,
      paidAmountRupiah: 0,
      remainingAmountRupiah: component.amountIdr,
      dueDate: component.dueDate!,
      daysDiff: computeDaysLeftFromExpiry(component.dueDate),
      status: 'BELUM_LUNAS',
    }));

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
      ...buildInventoryJournalLines([{ lotId: newLot.id, cogsRupiah: totalLandedCost }], [newLot], 'DEBIT'),
      { accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: goodsCostRupiah },
      ...(paidCashRupiah > 0
        ? [{ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: 0, credit: paidCashRupiah }]
        : []),
      ...(paidBankRupiah > 0
        ? [{ accountCode: '1102', accountName: 'Rekening Bank', debit: 0, credit: paidBankRupiah }]
        : []),
      ...(componentPayable > 0
        ? [{ accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: componentPayable }]
        : []),
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: state.cashInHandRupiah - paidCashRupiah,
    bankBalanceRupiah: (state.bankBalanceRupiah ?? 0) - paidBankRupiah,
    products: updatedProducts,
    lots: nextLots,
    inboundPOs: updatedPOs,
    suppliers: [...new Set([...(state.suppliers ?? []), ...normalizedComponents.map((component) => component.vendor)])],
    supplierInvoices: [...componentInvoices, supplierInvoice, ...state.supplierInvoices.filter((invoice) => invoice.poNumber !== po.poNumber)],
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
          lotId: newLot.id,
          productId: targetProd.id,
          lotCode: newLotCode,
          expiryDate,
          loc: newLot.loc,
          hppKgRupiah: incomingHppPerKg,
          actualWeightGram: safeWeightGram,
          totalLandedCost,
          goodsCostRupiah,
          extraCostRupiah: safeExtraCost,
          paidCashRupiah,
          paidBankRupiah,
          landedCostComponents: normalizedComponents,
          componentInvoices,
          newMovingAvgHppPerKg: newMovingAvgHpp,
          supplierInvoice,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
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
    evidenceMediaId?: string;
    /** Authenticated Sales identity; source is the ERP session. */
    salesId?: string;
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
    !Number.isSafeInteger(params.inputGram) ||
    !Number.isSafeInteger(params.primaryGram) ||
    !Number.isSafeInteger(params.secondaryGram) ||
    !Number.isSafeInteger(sourceLot.hppKgRupiah) ||
    sourceLot.hppKgRupiah < 0 ||
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
  const consumedSource = consumeLotStock(sourceLot, params.inputGram);
  const totalRawCost = consumedSource.cogsRupiah;
  const targetTetelanHppPerKg = 65000;
  const tetelanValue = Math.min(totalRawCost, Math.round((params.secondaryGram * targetTetelanHppPerKg) / 1000));
  const primaryNetCost = params.primaryGram > 0 ? Math.max(0, totalRawCost - tetelanValue) : 0;
  const cuttingLossValue = Math.max(0, totalRawCost - primaryNetCost - tetelanValue);
  const effectiveSteakHpp =
    params.primaryGram > 0 ? Math.round((primaryNetCost * 1000) / params.primaryGram) : sourceLot.hppKgRupiah;
  const effectiveTetelanHpp =
    params.secondaryGram > 0 ? Math.round((tetelanValue * 1000) / params.secondaryGram) : 0;

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

  let updatedLots = state.lots.map((lot) => {
    if (lot.id === sourceLot.id) return consumedSource.lot;
    if (params.secondaryGram > 0 && existingTetelanLot && lot.id === existingTetelanLot.id) {
      return addLotStock(lot, params.secondaryGram, tetelanValue);
    }
    return lot;
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
        hppKgRupiah: effectiveTetelanHpp,
        carryingValueRupiah: tetelanValue,
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
      carryingValueRupiah: primaryNetCost,
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
      unitCostPerKg: effectiveTetelanHpp,
      valueRupiahDelta: tetelanValue,
      movingAvgHppAfterKg: updatedProducts.find((product) => product.id === 'PROD_03')?.movingAvgHppPerKg ?? effectiveTetelanHpp,
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
      type: 'OUT_CUTTING_LOSS',
      humanLabel: 'Susut Pemotongan',
      productName: sourceLot.product,
      lotId: sourceLot.id,
      lotCode: sourceLot.code,
      weightGramDelta: -lossGram,
      unitCostPerKg: 0,
      valueRupiahDelta: -cuttingLossValue,
      movingAvgHppAfterKg: effectiveSteakHpp,
      referenceNo: refNo,
      note: cuttingLossValue > 0 ? `Nilai susut pemotongan diakui sebagai beban Rp ${cuttingLossValue.toLocaleString('id-ID')}.` : `Nilai susut fisik diserap ke HPP hasil potongan utama.`,
    });
  }

  const journalLines: JournalLine[] =
    usableOutputGram === 0
      ? [
          { accountCode: '5201', accountName: 'Beban Susut & Pemotongan', debit: totalRawCost, credit: 0 },
          ...buildInventoryJournalLines([{ lotId: sourceLot.id, cogsRupiah: totalRawCost }], state.lots, 'CREDIT'),
        ]
      : [
          ...(primaryNetCost > 0
            ? [{ accountCode: '1302', accountName: 'Persediaan Daging Steak Siap Jual', debit: primaryNetCost, credit: 0 }]
            : []),
          ...(tetelanValue > 0
            ? [{ accountCode: '1303', accountName: 'Persediaan Tetelan Hasil Potong', debit: tetelanValue, credit: 0 }]
            : []),
          ...(cuttingLossValue > 0
            ? [{ accountCode: '5201', accountName: 'Beban Susut & Pemotongan', debit: cuttingLossValue, credit: 0 }]
            : []),
          ...buildInventoryJournalLines([{ lotId: sourceLot.id, cogsRupiah: totalRawCost }], state.lots, 'CREDIT'),
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
          primaryCutLotCode: primaryCutLot?.code,
          targetTetelanLotId,
          targetTetelanLotCode,
          targetTetelanProductId: 'PROD_03',
          targetTetelanProductName,
          inputGram: params.inputGram,
          usableOutputGram,
          primaryGram: params.primaryGram,
          secondaryGram: params.secondaryGram,
          lossGram,
          totalRawCost,
          primaryNetCost,
          tetelanValue,
          effectiveSteakHpp,
          secondaryHpp: targetTetelanHppPerKg,
          effectiveTetelanHpp,
          cuttingLossValue,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
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
  const opnameValuation = adjustLotStockToPhysical(lot, safePhysical);
  const valueDiff = opnameValuation.valueDeltaRupiah;
  const idemKey = params.idempotencyKey?.trim() || `OPN-${lot.id}-${generateUUID()}`;
  const opnSeq = nextMonotonicSequence(
    state.stockLedger.map((e) => e.referenceNo),
    /^OPN-(\d+)$/,
    1
  );
  const refNo = `OPN-${String(opnSeq).padStart(4, '0')}`;
  const actor = params.actorName || 'Staf Gudang';
  const opnameTimestamp = nowIso();

  const updatedLots = state.lots.map((item) => item.id === lot.id ? opnameValuation.lot : item);
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
                  ...buildInventoryJournalLines([{ lotId: lot.id, cogsRupiah: absVal }], state.lots, 'CREDIT'),
                ]
              : [
                  ...buildInventoryJournalLines([{ lotId: lot.id, cogsRupiah: absVal }], state.lots, 'DEBIT'),
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
          systemWeightGram: lot.weightGram,
          hppKgRupiah: lot.hppKgRupiah,
          diffGram,
          reason: params.reason,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: opnameTimestamp,
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Hasil cek fisik ${lot.code} (${(safePhysical / 1000).toFixed(1)} kg) tersimpan rapi di buku stok.`,
  };
}

function calculateInvoiceProductReturnCogs(
  invoice: SalesTransactionRecord,
  productId: string,
  returnWeightGram: number,
  priorReturnedGram: number
): number {
  const soldLines = invoice.items.filter((item) => item.productId === productId);
  const soldWeightGram = soldLines.reduce((sum, item) => sum + item.weightGram, 0);
  if (!Number.isSafeInteger(soldWeightGram) || soldWeightGram <= 0 ||
      !Number.isSafeInteger(returnWeightGram) || returnWeightGram < 0) return 0;

  const allocations = invoice.lotAllocations.filter((allocation) => allocation.productId === productId);
  const allocationsHaveCost = allocations.length > 0 && allocations.every((allocation) =>
    Number.isSafeInteger(allocation.cogsRupiah) ||
    (Number.isSafeInteger(allocation.hppPerKg) && allocation.hppPerKg >= 0));
  let originalProductCogs = allocationsHaveCost
    ? allocations.reduce((sum, allocation) => {
        const cost = Number.isSafeInteger(allocation.cogsRupiah)
          ? allocation.cogsRupiah
          : Math.round((allocation.weightGram * allocation.hppPerKg) / 1000);
        return sum + cost;
      }, 0)
    : soldLines.reduce((sum, item) =>
        sum + Math.round((item.weightGram * Math.max(0, item.movingAvgHppPerKg || 0)) / 1000), 0);
  if (!Number.isSafeInteger(originalProductCogs) || originalProductCogs < 0) return 0;

  const beforeGram = Math.max(0, Math.min(soldWeightGram, priorReturnedGram));
  const afterGram = Math.max(beforeGram, Math.min(soldWeightGram, priorReturnedGram + returnWeightGram));
  const beforeCogs = Math.round((originalProductCogs * beforeGram) / soldWeightGram);
  const afterCogs = Math.round((originalProductCogs * afterGram) / soldWeightGram);
  return Math.max(0, afterCogs - beforeCogs);
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
    actorName?: string;
    isOnline?: boolean;
    evidenceMediaId?: string;
    /** Authenticated Sales identity; source is the ERP session. */
    salesId?: string;
  }
): EngineActionResult {
  if (params.idempotencyKey && state.processedIdempotencyKeys.includes(params.idempotencyKey)) {
    return {
      ok: false,
      state,
      errorCode: 'DUPLICATE',
      message: 'Pengajuan retur ini sudah dicatat sebelumnya.',
    };
  }
  if (!Number.isSafeInteger(params.weightGram) || params.weightGram <= 0) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: 'Berat barang retur harus berupa bilangan bulat gram lebih dari 0.',
    };
  }
  const safeGram = params.weightGram;
  const invoice = state.transactions.find((tx) => tx.invoiceNumber === params.invoiceNo && tx.status === 'COMPLETED');
  if (!invoice) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Faktur asal tidak ditemukan atau sudah dibatalkan.' };
  }
  const invoiceTimestamp = Date.parse(invoice.timestamp);
  if (!Number.isFinite(invoiceTimestamp) || Date.now() - invoiceTimestamp > 24 * 60 * 60 * 1000 || invoiceTimestamp > Date.now() + 5 * 60 * 1000) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Retur hanya dapat diproses maksimal 1×24 jam sejak faktur diterbitkan.' };
  }
  if (invoice.customerName.trim().toLowerCase() !== params.customerName.trim().toLowerCase()) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nama pelanggan tidak sesuai dengan faktur asal.' };
  }
  if (params.salesId !== undefined) {
    const assignedCustomer = state.customers.find((customer) => customer.id === invoice.customerId);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(params.salesId) ||
        invoice.salesId !== params.salesId ||
        (!assignedCustomer || (!isSharedUmumCustomer(assignedCustomer) && assignedCustomer.assignedSalesId !== params.salesId))) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Sales hanya dapat memproses retur dari faktur dan pelanggan yang ditugaskan kepadanya.' };
    }
  }
  const normalizedProdQuery = params.productName.trim().toLowerCase();
  const soldLines = invoice.items.filter((item) =>
    params.productId ? item.productId === params.productId : item.productName.trim().toLowerCase() === normalizedProdQuery
  );
  if (soldLines.length === 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Produk tidak tercatat pada faktur asal.' };
  }
  const soldProductId = soldLines[0].productId;
  if (!soldProductId || soldLines.some((item) => item.productId !== soldProductId)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Baris produk pada faktur tidak konsisten; retur perlu diperiksa Admin.' };
  }
  const soldWeightGram = soldLines.reduce((sum, item) => sum + item.weightGram, 0);
  const soldLineTotalRupiah = soldLines.reduce((sum, item) => sum + item.lineTotalRupiah, 0);
  if (!Number.isSafeInteger(soldWeightGram) || soldWeightGram <= 0 || !Number.isSafeInteger(soldLineTotalRupiah) || soldLineTotalRupiah < 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Data berat atau nilai produk pada faktur tidak valid.' };
  }
  const priorReturnedGram = (state.customerReturns ?? [])
    .filter((r) => r.invoiceNo === invoice.invoiceNumber && r.productId === soldProductId)
    .reduce((sum, r) => sum + r.weightGram, 0);
  if (priorReturnedGram + safeGram > soldWeightGram) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Jumlah retur melebihi pembelian. Terjual ${soldWeightGram} gram, sudah diretur ${priorReturnedGram} gram, sisa maksimal ${Math.max(0, soldWeightGram - priorReturnedGram)} gram.`,
    };
  }
  const returnedCogsRupiah = calculateInvoiceProductReturnCogs(invoice, soldProductId, safeGram, priorReturnedGram);
  const returnedHppPerKg = safeGram > 0 ? Math.round((returnedCogsRupiah * 1000) / safeGram) : 0;
  const matchedProd = state.products.find((p) => p.id === soldProductId);

  // If resolution is TUKAR_BARANG, validate & allocate replacement FEFO stock before mutating
  let postReplacementLots = state.lots;
  let replacementAllocs: LotAllocationRecord[] = [];
  let replacementCogs = 0;

  if (params.resolution === 'TUKAR_BARANG') {
    if (!matchedProd) {
      return {
        ok: false,
        state,
        errorCode: 'NOT_FOUND',
        message: `Produk "${params.productName}" tidak ditemukan di master katalog untuk tukar barang.`,
      };
    }
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

  const estimatedRefundValue = Math.round((safeGram * soldLineTotalRupiah) / soldWeightGram);
  if (!Number.isSafeInteger(estimatedRefundValue) || estimatedRefundValue < 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nilai retur tidak valid atau melebihi batas nominal aman.' };
  }

  const matchingReturnCustomers = invoice.customerId
    ? state.customers.filter((customer) => customer.id === invoice.customerId)
    : state.customers.filter((customer) =>
      customer.name.trim().toLowerCase() === params.customerName.trim().toLowerCase()
    );
  const matchedCustomer = matchingReturnCustomers.length === 1 ? matchingReturnCustomers[0] : undefined;

  if (params.resolution === 'CREDIT_NOTE') {
    const invoiceReceivables = state.receivables.filter((r) =>
      r.invoice === invoice.invoiceNumber &&
      (r.customerId ? r.customerId === invoice.customerId : r.customer.trim().toLowerCase() === invoice.customerName.trim().toLowerCase()) &&
      r.status !== 'LUNAS'
    );
    const invoiceOutstanding = invoiceReceivables.reduce((sum, r) => sum + r.amount, 0);
    if (
      !matchedCustomer ||
      !Number.isSafeInteger(matchedCustomer.currentReceivable) ||
      matchedCustomer.currentReceivable < estimatedRefundValue ||
      invoiceReceivables.length === 0 ||
      invoiceReceivables.some((r) => !Number.isSafeInteger(r.amount) || r.amount < 0) ||
      !Number.isSafeInteger(invoiceOutstanding) ||
      invoiceOutstanding < estimatedRefundValue
    ) {
      return {
        ok: false,
        state,
        errorCode: 'VALIDATION',
        message: 'Credit note ditolak: saldo piutang aktif pada faktur ini tidak cukup. Gunakan pengembalian kas jika memang disepakati, atau selesaikan pencatatan kredit pelanggan terlebih dahulu.',
      };
    }
  }

  if (
    params.resolution === 'REFUND_KAS' &&
    (!Number.isSafeInteger(state.cashInHandRupiah) || state.cashInHandRupiah < estimatedRefundValue)
  ) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Kas tunai tidak cukup untuk refund Rp ${estimatedRefundValue.toLocaleString('id-ID')}.`,
    };
  }

  const quarantineLot: BatchLotEntity = {
    id: `LOT_QR_${generateUUID().slice(0, 8)}`,
    code: returnNumber,
    product: `${params.productName} (Karantina Retur)`,
    productId: matchedProd?.id,
    daysLeft: 0,
    expiryDate: new Date().toISOString().split('T')[0],
    weightGram: safeGram,
    maxCapacityGram: Math.max(30000, safeGram),
    hppKgRupiah: returnedHppPerKg,
    carryingValueRupiah: returnedCogsRupiah,
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
    type: 'IN_RETURN',
    humanLabel: 'Retur Masuk Karantina',
    productName: matchedProd?.name ?? params.productName,
    lotId: quarantineLot.id,
    lotCode: returnNumber,
    weightGramDelta: safeGram,
    unitCostPerKg: returnedHppPerKg,
    valueRupiahDelta: returnedCogsRupiah,
    movingAvgHppAfterKg: returnedHppPerKg,
    referenceNo: returnNumber,
    note: `Retur faktur ${params.invoiceNo} dari ${params.customerName} (${params.reason})`,
  };

  const replacementLedgerEntries: StockLedgerEntry[] = replacementAllocs.map((alloc) => ({
    uuid: generateUUID(),
    idempotencyKey: idemKey,
    timestamp: returnTimestamp,
    actorName: actor,
    type: 'OUT_ADJUST',
    humanLabel: 'Pengeluaran Stok Tukar Barang',
    productName: matchedProd!.name,
    lotId: alloc.lotId,
    lotCode: alloc.lotCode,
    weightGramDelta: -alloc.weightGram,
    unitCostPerKg: alloc.hppPerKg,
    valueRupiahDelta: -alloc.cogsRupiah,
    movingAvgHppAfterKg: matchedProd!.movingAvgHppPerKg,
    referenceNo: returnNumber,
    note: `Stok pengganti retur faktur ${params.invoiceNo} untuk ${params.customerName}`,
  }));

  const returnJournalLines: JournalLine[] = [];
  if (params.resolution === 'TUKAR_BARANG') {
    if (returnedCogsRupiah > 0) {
      returnJournalLines.push(
        { accountCode: '1304', accountName: 'Persediaan Karantina Retur', debit: returnedCogsRupiah, credit: 0 },
        { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: returnedCogsRupiah },
      );
    }
    if (replacementCogs > 0) {
      returnJournalLines.push(
        { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: replacementCogs, credit: 0 },
        ...buildInventoryJournalLines(replacementAllocs.map((allocation) => ({ lotId: allocation.lotId, cogsRupiah: allocation.cogsRupiah })), state.lots, 'CREDIT'),
      );
    }
  } else {
    returnJournalLines.push(
      { accountCode: '4103', accountName: 'Potongan & Retur Penjualan', debit: estimatedRefundValue, credit: 0 },
      {
        accountCode: params.resolution === 'REFUND_KAS' ? '1101' : '1201',
        accountName: params.resolution === 'REFUND_KAS' ? 'Kas Tunai Toko' : 'Piutang Pelanggan',
        debit: 0,
        credit: estimatedRefundValue,
      },
    );
    if (returnedCogsRupiah > 0) {
      returnJournalLines.push(
        { accountCode: '1304', accountName: 'Persediaan Karantina Retur', debit: returnedCogsRupiah, credit: 0 },
        { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: returnedCogsRupiah },
      );
    }
  }
  if (returnJournalLines.length === 0) {
    returnJournalLines.push(
      { accountCode: '1304', accountName: 'Persediaan Karantina Retur', debit: 0, credit: 0 },
      { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: 0 },
    );
  }
  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: returnNumber,
    category: 'PENJUALAN',
    description: `Retur pelanggan ${params.customerName} (${(safeGram / 1000).toFixed(1)} kg ${params.productName})`,
    lines: returnJournalLines,
  });

  const nextCash =
    params.resolution === 'REFUND_KAS'
      ? state.cashInHandRupiah - estimatedRefundValue
      : state.cashInHandRupiah;

  let updatedCustomers = state.customers;
  let updatedReceivables = state.receivables;

  if (params.resolution === 'CREDIT_NOTE' && matchedCustomer) {
    updatedCustomers = state.customers.map((c) =>
      c.id === matchedCustomer.id
        ? { ...c, currentReceivable: Math.max(0, c.currentReceivable - estimatedRefundValue) }
        : c
    );

    let remainingCredit = estimatedRefundValue;
    updatedReceivables = state.receivables.map((r) => {
      if (remainingCredit <= 0 || r.status === 'LUNAS') return r;
      const matchesInvoice = r.invoice === params.invoiceNo;
      if (!matchesInvoice) return r;
      const applied = Math.min(r.amount, remainingCredit);
      remainingCredit -= applied;
      const nextAmt = Math.max(0, r.amount - applied);
      return {
        ...r,
        amount: nextAmt,
        status: nextAmt === 0 ? ('LUNAS' as const) : r.status,
      };
    });
  }

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: nextCash,
    products: updatedProducts,
    lots: nextLots,
    customers: updatedCustomers,
    receivables: updatedReceivables,
    customerReturns: [{ id: returnNumber, invoiceNo: invoice.invoiceNumber, customerId: invoice.customerId, productId: soldProductId, weightGram: safeGram, refundValueRupiah: estimatedRefundValue, resolution: params.resolution, createdAt: returnTimestamp, evidenceMediaId: params.evidenceMediaId }, ...(state.customerReturns ?? [])],
    stockLedger: [...replacementLedgerEntries, quarantineLedgerEntry, ...state.stockLedger],
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName: actor,
        actorRole: 'ADMIN',
        action: 'RETUR_KARANTINA',
        humanSummary: `Retur ${(safeGram / 1000).toFixed(1)} kg ${params.productName} dari ${params.customerName} dipisahkan ke ruang karantina (${params.resolution}).`,
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
          ...(params.salesId ? { salesId: params.salesId } : {}),
          invoiceNo: params.invoiceNo,
          customerId: invoice.customerId,
          customerName: params.customerName,
          productId: matchedProd?.id,
          productName: params.productName,
          weightGram: safeGram,
          resolution: params.resolution,
          estimatedRefundValue,
          evidenceMediaId: params.evidenceMediaId,
          replacementAllocs,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: returnTimestamp,
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Retur ${returnNumber} dicatat dan barang otomatis dikarantina agar tidak terjual kembali.`,
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
  idempotencyKey?: string,
  amountRupiah?: number,
  paymentMethod: 'CASH' | 'TRANSFER' = 'CASH',
  salesId?: string
): EngineActionResult {
  if (idempotencyKey && state.processedIdempotencyKeys.includes(idempotencyKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Pembayaran tagihan ini sudah dicatat.' };
  }
  const target = state.receivables.find((r) => r.id === recId);
  if (!target || target.status === 'LUNAS') {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Tagihan tidak ditemukan atau sudah lunas.' };
  }
  const paidAmount = amountRupiah ?? target.amount;
  if (paymentMethod !== 'CASH' && paymentMethod !== 'TRANSFER') return { ok: false, state, errorCode: 'VALIDATION', message: 'Metode pembayaran harus Tunai atau Transfer.' };
  if (!Number.isSafeInteger(paidAmount) || paidAmount <= 0 || paidAmount > target.amount) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal pembayaran harus bilangan rupiah positif dan tidak boleh melebihi sisa tagihan.' };
  }
  const matchingCustomers = state.customers.filter((customer) => target.customerId
    ? customer.id === target.customerId
    : customer.name.trim().toLowerCase() === target.customer.trim().toLowerCase());
  const matchedCustomer = matchingCustomers.length === 1 ? matchingCustomers[0] : undefined;
  if (salesId !== undefined && (!/^[a-zA-Z0-9_-]{1,100}$/.test(salesId) || matchedCustomer?.assignedSalesId !== salesId)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Sales hanya dapat menerima pembayaran dari pelanggan yang ditugaskan kepadanya.' };
  }
  if (!matchedCustomer || !Number.isSafeInteger(matchedCustomer.currentReceivable) || matchedCustomer.currentReceivable < paidAmount) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo piutang pelanggan tidak cukup atau tidak valid untuk menerima pembayaran ini. Periksa saldo piutang sebelum melanjutkan.' };
  }
  const idemKey = idempotencyKey?.trim() || `PAY-REC-${recId}-${generateUUID().slice(0, 8)}`;
  const remainingAmount = target.amount - paidAmount;
  const updatedReceivables = state.receivables.map((r) =>
    r.id === recId ? { ...r, amount: remainingAmount, status: remainingAmount === 0 ? 'LUNAS' as const : 'BELUM_LUNAS' as const } : r
  );

  const updatedCustomers = state.customers.map((customer) =>
    customer.id === matchedCustomer.id
      ? { ...customer, currentReceivable: customer.currentReceivable - paidAmount }
      : customer
  );

  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: target.invoice,
    category: 'PEMBAYARAN',
    description: `Pembayaran tagihan dari ${target.customer} (${target.invoice}) via ${paymentMethod}`,
    lines: [
      { accountCode: paymentMethod === 'CASH' ? '1101' : '1102', accountName: paymentMethod === 'CASH' ? 'Kas Tunai' : 'Rekening Bank', debit: paidAmount, credit: 0 },
      { accountCode: '1201', accountName: 'Piutang Pelanggan', debit: 0, credit: paidAmount },
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: state.cashInHandRupiah + (paymentMethod === 'CASH' ? paidAmount : 0),
    bankBalanceRupiah: (state.bankBalanceRupiah ?? 0) + (paymentMethod === 'TRANSFER' ? paidAmount : 0),
    receivables: updatedReceivables,
    receivablePayments: [{ id: idemKey, recId, invoice: target.invoice, customerId: target.customerId, amountRupiah: paidAmount, paymentMethod, createdAt: nowIso(), actorName }, ...(state.receivablePayments ?? [])],
    customers: updatedCustomers,
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'SALES',
        action: 'TERIMA_PEMBAYARAN_TAGIHAN',
        humanSummary: `Pembayaran ${target.invoice} dari ${target.customer} sebesar Rp ${paidAmount.toLocaleString('id-ID')} via ${paymentMethod}; sisa Rp ${remainingAmount.toLocaleString('id-ID')}.`,
        referenceId: target.invoice,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Bayar ${target.invoice} • Rp ${paidAmount.toLocaleString('id-ID')}`,
        payload: {
          kind: 'RECEIVABLE_PAYMENT',
          ...(salesId ? { salesId } : {}),
          recId,
          invoice: target.invoice,
          customer: target.customer,
          amountRupiah: paidAmount,
          paymentMethod,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Pembayaran Rp ${paidAmount.toLocaleString('id-ID')} dari ${target.customer} dicatat via ${paymentMethod}. Sisa tagihan Rp ${remainingAmount.toLocaleString('id-ID')}.`,
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
  if (!target) return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Tagihan tidak ditemukan.' };
  const linkedTx = state.transactions.find((t) => t.invoiceNumber === target.invoice);
  if (linkedTx?.status === 'VOIDED' || target.dueDate.toLowerCase().includes('dibatalkan')) {
    return {
      ok: false,
      state,
      errorCode: 'VALIDATION',
      message: `Faktur ${target.invoice} sudah dibatalkan resmi (void) dan tidak bisa dibuka kembali sebagai piutang aktif.`,
    };
  }
  const activePayments = (state.receivablePayments ?? []).filter((p) => p.recId === recId && !p.reversedAt);
  const isLegacyFullPayment = activePayments.length === 0 && target.status === 'LUNAS' && target.amount > 0;
  if (activePayments.length === 0 && !isLegacyFullPayment) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Riwayat pembayaran aktif tidak ditemukan untuk tagihan ini.' };
  }
  const paymentsToReverse = isLegacyFullPayment ? [{ amountRupiah: target.amount, paymentMethod: 'CASH' as const }] : activePayments;
  if (paymentsToReverse.some((p) => !Number.isSafeInteger(p.amountRupiah) || p.amountRupiah <= 0 || (p.paymentMethod !== 'CASH' && p.paymentMethod !== 'TRANSFER'))) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Riwayat metode atau nominal pembayaran tidak valid untuk dibalik.' };
  }
  const reversalCustomer = state.customers.find((c) => c.id === target.customerId || c.name === target.customer);
  if (!reversalCustomer || !Number.isSafeInteger(reversalCustomer.currentReceivable) ||
      !Number.isSafeInteger(reversalCustomer.currentReceivable + paymentsToReverse.reduce((sum, p) => sum + p.amountRupiah, 0)) ||
      !Number.isSafeInteger(target.amount + paymentsToReverse.reduce((sum, p) => sum + p.amountRupiah, 0))) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo piutang pelanggan atau nilai pemulihan faktur tidak valid untuk pembalikan.' };
  }
  const idemKey = `REV-PAY-REC-${recId}-${generateUUID().slice(0, 8)}`;
  const totalPaid = paymentsToReverse.reduce((sum, p) => sum + p.amountRupiah, 0);
  const cashPaid = paymentsToReverse.filter((p) => p.paymentMethod === 'CASH').reduce((sum, p) => sum + p.amountRupiah, 0);
  const transferPaid = totalPaid - cashPaid;

  // Never silently clamp a reversal: the reversal journal must match the actual cash/bank movement.
  if (!Number.isSafeInteger(totalPaid) || totalPaid <= 0 ||
      !Number.isSafeInteger(cashPaid) || !Number.isSafeInteger(transferPaid)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Riwayat pembayaran tidak valid untuk dibalik.' };
  }
  if (state.cashInHandRupiah < cashPaid) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo kas tidak mencukupi untuk membalik pembayaran tunai. Lakukan koreksi kas terlebih dahulu.' };
  }
  if (transferPaid > 0 && (state.bankBalanceInitialized !== true || (state.bankBalanceRupiah ?? 0) < transferPaid)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo bank tidak mencukupi untuk membalik pembayaran transfer. Lakukan rekonsiliasi bank terlebih dahulu.' };
  }

  const restoredReceivableAmount = isLegacyFullPayment ? target.amount : target.amount + totalPaid;
  const updatedReceivables = state.receivables.map((r) =>
    r.id === recId ? { ...r, amount: restoredReceivableAmount, status: 'BELUM_LUNAS' as const } : r
  );
  const updatedCustomers = state.customers.map((c) => {
    if (c.name === target.customer || c.id === target.customerId) {
      return { ...c, currentReceivable: c.currentReceivable + totalPaid };
    }
    return c;
  });
  const reversalJournal = buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo: target.invoice,
    category: 'PEMBAYARAN',
    description: `Pembalikan pembayaran tagihan ${target.customer} (${target.invoice})`,
    lines: [
      { accountCode: '1201', accountName: 'Piutang Pelanggan', debit: totalPaid, credit: 0 },
      { accountCode: '1101', accountName: 'Kas Tunai', debit: 0, credit: cashPaid },
      { accountCode: '1102', accountName: 'Rekening Bank', debit: 0, credit: transferPaid },
    ],
  });

  const nextState: BusinessEngineState = {
    ...state,
    cashInHandRupiah: state.cashInHandRupiah - cashPaid,
    bankBalanceRupiah: (state.bankBalanceRupiah ?? 0) - transferPaid,
    receivables: updatedReceivables,
    receivablePayments: (state.receivablePayments ?? []).map((p) => activePayments.some((active) => active.id === p.id) ? { ...p, reversedAt: nowIso() } : p),
    customers: updatedCustomers,
    journals: [reversalJournal, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole: 'ADMIN',
        action: 'BATAL_LUNAS_TAGIHAN',
        humanSummary: `Pembayaran faktur ${target.invoice} (${target.customer}) sebesar Rp ${totalPaid.toLocaleString('id-ID')} dibalik; piutang aktif kembali.`,
        referenceId: target.invoice,
      }),
      ...state.auditTrail,
    ],
    syncOutbox: [
      buildSyncItem({
        idempotencyKey: idemKey,
        entityType: 'PAYMENT',
        summary: `Pembalikan bayar ${target.invoice} • Rp ${totalPaid.toLocaleString('id-ID')}`,
        payload: {
          kind: 'RECEIVABLE_PAYMENT_REVERT',
          recId,
          invoice: target.invoice,
          customer: target.customer,
          amountRupiah: totalPaid,
          cashAmountRupiah: cashPaid,
          transferAmountRupiah: transferPaid,
        },
      }),
      ...state.syncOutbox,
    ],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };

  persistEngineState(nextState);
  return {
    ok: true,
    state: nextState,
    message: `Faktur ${target.invoice} dikembalikan ke status belum lunas dengan pembalikan kas & piutang.`,
  };
}

function hasUnreconciledBankActivity(state: BusinessEngineState): boolean {
  const provisionalBalanceExists = state.bankBalanceRupiah !== undefined &&
    (!Number.isSafeInteger(state.bankBalanceRupiah) || state.bankBalanceRupiah !== 0);
  const bankJournalExists = state.journals.some((journal) =>
    journal.lines.some((line) => line.accountCode === '1102' && (line.debit > 0 || line.credit > 0))
  );
  return provisionalBalanceExists || bankJournalExists;
}

/**
 * Initialize the opening bank balance exactly once before supplier transfers are recorded.
 */
export function setOpeningBankBalance(
  state: BusinessEngineState,
  amountRupiah: number,
  actorName = 'Pemilik Usaha',
  referenceNo = 'OPENING-BANK-01',
  isOnline = true,
  idempotencyKey?: string,
  ownerPin?: string
): EngineActionResult {
  if (state.bankBalanceInitialized === true) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo awal bank sudah ditetapkan. Koreksi harus melalui rekonsiliasi, bukan menimpa saldo awal.' };
  }
  if (hasUnreconciledBankActivity(state)) {
    return {
      ok: false, state, errorCode: 'VALIDATION',
      message: 'Sudah ada pergerakan bank sebelum saldo awal direkonsiliasi. Sistem menolak menimpa saldo sementara; lakukan rekonsiliasi cut-over terlebih dahulu.',
    };
  }
  if (!state.ownerPinHash || !state.ownerPinSalt) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN Owner belum dibuat. Buat PIN Owner terlebih dahulu sebelum mencatat saldo awal bank.' };
  }
  if (state.ownerPinNeedsChange) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN bawaan Owner harus diganti terlebih dahulu sebelum saldo awal bank dapat dicatat.' };
  }
  if (!ownerPin || !verifyOwnerPin(state, ownerPin)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN Owner tidak sesuai. Saldo awal bank belum dicatat.' };
  }
  if (!Number.isSafeInteger(amountRupiah) || amountRupiah < 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo awal bank harus berupa Rupiah bulat dan tidak boleh negatif.' };
  }
  const idemKey = idempotencyKey?.trim() || `OPENING-BANK-${referenceNo}-${generateUUID().slice(0, 8)}`;
  if (state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Saldo awal bank dengan kunci ini sudah dicatat.' };
  }
  const journal = amountRupiah > 0 ? buildDerivedJournal({
    idempotencyKey: idemKey,
    referenceNo,
    category: 'PENYESUAIAN',
    description: 'Pencatatan saldo awal rekening bank',
    lines: [
      { accountCode: '1102', accountName: 'Rekening Bank', debit: amountRupiah, credit: 0 },
      { accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: amountRupiah },
    ],
  }) : null;
  const nextState: BusinessEngineState = {
    ...state,
    bankBalanceRupiah: amountRupiah,
    bankBalanceInitialized: true,
    ...(journal ? { journals: [journal, ...state.journals] } : {}),
    auditTrail: [buildAuditEntry({
      actorName, actorRole: 'OWNER', action: 'CATAT_SALDO_AWAL_BANK',
      humanSummary: `Saldo awal rekening bank ditetapkan Rp ${amountRupiah.toLocaleString('id-ID')} (Ref: ${referenceNo}).`,
      referenceId: referenceNo,
    }), ...state.auditTrail],
    syncOutbox: [buildSyncItem({
      idempotencyKey: idemKey,
      entityType: 'OPNAME',
      summary: `Saldo awal bank Rp ${amountRupiah.toLocaleString('id-ID')}`,
      payload: { kind: 'OPENING_BANK_BALANCE', openingBalanceRupiah: amountRupiah, referenceNo },
    }), ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: 'Saldo awal rekening bank berhasil dicatat.' };
}


export interface OpeningBalanceImportInput {
  lotsCsv?: string;
  receivablesCsv?: string;
  payablesCsv?: string;
  cashBalanceRupiah: number;
  bankBalanceRupiah: number;
  pettyCashBalanceRupiah: number;
  referenceNo: string;
  ownerPin: string;
  actorName?: string;
  idempotencyKey?: string;
}

/**
 * One-time cut-over import. All three CSV subledgers and opening cash/bank
 * balances are validated and posted as one local state mutation.
 */
export function commitOpeningBalanceImport(
  state: BusinessEngineState,
  input: OpeningBalanceImportInput
): EngineActionResult {
  const referenceNo = input.referenceNo?.trim();
  const actorName = input.actorName?.trim() || 'Pemilik Usaha';
  if (state.openingBalanceCommittedAt || state.openingBalanceIdempotencyKey) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Opening Balance sudah dikunci. Koreksi saldo awal hanya boleh melalui transaksi penyesuaian yang tercatat.' };
  }
  if (state.transactions.length > 0 || state.syncOutbox.length > 0 ||
      state.processedIdempotencyKeys.length > 0 ||
      state.stockLedger.some((entry) => !entry.idempotencyKey.startsWith('SEED-')) ||
      state.journals.some((journal) => journal.idempotencyKey !== 'SEED-JOURNAL-01' && journal.referenceNo !== 'OPENING-BAL-01') ||
      state.cashInHandRupiah !== 0 || state.bankBalanceInitialized === true ||
      state.pettyCashBalanceRupiah !== 0) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Go-Live Lock hanya dapat dijalankan pada data pra-operasional yang bersih. Sudah ada aktivitas atau saldo yang harus direkonsiliasi terlebih dahulu.' };
  }
  if (!referenceNo) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nomor referensi Opening Balance wajib diisi.' };
  }
  if (!state.ownerPinHash || !state.ownerPinSalt || state.ownerPinNeedsChange ||
      !input.ownerPin || !verifyOwnerPin(state, input.ownerPin)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN Owner aktif dan benar wajib diisi untuk mengunci Opening Balance.' };
  }
  for (const [label, value] of [
    ['Kas utama', input.cashBalanceRupiah],
    ['Saldo bank', input.bankBalanceRupiah],
    ['Kas kecil', input.pettyCashBalanceRupiah],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      return { ok: false, state, errorCode: 'VALIDATION', message: `${label} harus berupa Rupiah bulat aman non-negatif.` };
    }
  }

  const emptyPreview = (kind: OpeningBalanceCsvKind): OpeningBalanceCsvPreview => ({
    kind, ok: true, rows: [], issues: [], rowCount: 0,
    totals: { stockGram: 0, stockPcs: 0, inventoryCostRupiah: 0, receivablesRupiah: 0, payablesRupiah: 0 },
  });
  const catalog = {
    skuCodes: state.products.map((product) => product.sku),
    customerCodes: state.customers.map((customer) => customer.code),
    supplierCodes: state.suppliers ?? [],
  };
  const lotsPreview = input.lotsCsv?.trim()
    ? previewOpeningBalanceCsv('LOTS', input.lotsCsv, catalog)
    : emptyPreview('LOTS');
  const receivablesPreview = input.receivablesCsv?.trim()
    ? previewOpeningBalanceCsv('RECEIVABLES', input.receivablesCsv, catalog)
    : emptyPreview('RECEIVABLES');
  const payablesPreview = input.payablesCsv?.trim()
    ? previewOpeningBalanceCsv('PAYABLES', input.payablesCsv, catalog)
    : emptyPreview('PAYABLES');
  const previews = [lotsPreview, receivablesPreview, payablesPreview];
  const issues = previews.flatMap((preview) => preview.issues);
  if (issues.length > 0 || previews.some((preview) => !preview.ok)) {
    return {
      ok: false, state, errorCode: 'VALIDATION',
      message: `CSV Opening Balance ditolak: ${issues.slice(0, 3).map((issue) => `baris ${issue.row}: ${issue.message}`).join(' ')}`,
    };
  }

  const lotRows = lotsPreview.rows as OpeningLotBalanceRow[];
  if (lotRows.some((row) => row.totalPcs > 0)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Import stok awal Pcs ditahan: mesin stok aktif saat ini mengendalikan Gram, belum decrement Pcs per lot secara end-to-end. Gunakan total_pcs = 0 sampai dual-unit inventory selesai.' };
  }
  const productBySku = new Map(state.products.map((product) => [product.sku.trim().toUpperCase(), product]));
  const lots: BatchLotEntity[] = [];
  for (const row of lotRows) {
    const product = productBySku.get(row.sku.trim().toUpperCase());
    if (!product || row.totalGram <= 0) {
      return { ok: false, state, errorCode: 'VALIDATION', message: `Produk/SKU ${row.sku} tidak ditemukan atau berat stok awal harus lebih dari 0 Gram.` };
    }
    const hppKgRupiah = Math.round((row.costTotalRupiah * 1000) / row.totalGram);
    if (!Number.isSafeInteger(hppKgRupiah)) {
      return { ok: false, state, errorCode: 'VALIDATION', message: `HPP turunan lot ${row.lotCode} melewati batas integer aman.` };
    }
    lots.push({
      id: `LOT-OPENING-${generateUUID()}`,
      code: row.lotCode,
      product: product.name,
      productId: product.id,
      daysLeft: computeDaysLeftFromExpiry(row.expiryDate),
      expiryDate: row.expiryDate,
      weightGram: row.totalGram,
      maxCapacityGram: Math.max(row.totalGram, 30000),
      hppKgRupiah,
      carryingValueRupiah: row.costTotalRupiah,
      supplierCode: row.supplierCode || undefined,
      loc: 'FREEZER-A-01',
      isFefo: false,
      isQuarantined: false,
    });
  }

  const customerByCode = new Map(state.customers.map((customer) => [customer.code.trim().toUpperCase(), customer]));
  const receivableRows = receivablesPreview.rows as OpeningReceivableBalanceRow[];
  const receivables: ReceivableEntity[] = [];
  const receivableByCustomer = new Map<string, number>();
  const today = new Date(formatLocalYmd(new Date()) + 'T00:00:00');
  for (const row of receivableRows) {
    const customer = customerByCode.get(row.customerCode.trim().toUpperCase());
    if (!customer) return { ok: false, state, errorCode: 'VALIDATION', message: `Customer code ${row.customerCode} tidak ditemukan.` };
    const dueDate = new Date(row.dueDate + 'T00:00:00');
    const daysDiff = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    const category: ReceivableEntity['category'] = daysDiff < 0 ? 'TERLAMBAT' : daysDiff === 0 ? 'HARI_INI' : daysDiff <= 7 ? 'AKAN_DATANG' : 'LEBIH_7_HARI';
    receivables.push({
      id: `REC-OPENING-${generateUUID()}`, customer: customer.name, customerId: customer.id,
      tier: customer.tier, amount: row.amountDueRupiah, limit: customer.creditLimit,
      dueDate: row.dueDate, category, daysDiff, invoice: row.invoiceNo,
      itemsSummary: 'Saldo awal piutang', phone: customer.phone, status: 'BELUM_LUNAS',
    });
    const nextAmount = (receivableByCustomer.get(customer.id) ?? 0) + row.amountDueRupiah;
    if (!Number.isSafeInteger(nextAmount)) return { ok: false, state, errorCode: 'VALIDATION', message: `Total piutang ${customer.name} melewati batas integer aman.` };
    receivableByCustomer.set(customer.id, nextAmount);
  }

  const supplierByCode = new Map((state.suppliers ?? []).map((supplier) => [supplier.trim().toUpperCase(), supplier]));
  const payableRows = payablesPreview.rows as OpeningPayableBalanceRow[];
  const supplierInvoices: SupplierInvoiceEntity[] = payableRows.map((row) => {
    const supplier = supplierByCode.get(row.supplierCode.trim().toUpperCase())!;
    const dueDate = new Date(row.dueDate + 'T00:00:00');
    const daysDiff = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    return {
      id: `AP-OPENING-${generateUUID()}`, invoiceNumber: row.referenceNo,
      poNumber: `OPENING-${row.supplierCode}-${row.referenceNo}`,
      supplier, supplierPhone: state.supplierPhones?.[supplier], originCountry: 'Saldo Awal',
      totalAmountRupiah: row.amountDueRupiah, paidAmountRupiah: 0,
      remainingAmountRupiah: row.amountDueRupiah, dueDate: row.dueDate, daysDiff,
      status: 'BELUM_LUNAS',
    };
  });

  const totalInventory = lots.reduce((sum, lot) => sum + getLotCarryingValueRupiah(lot), 0);
  const totalReceivables = receivables.reduce((sum, row) => sum + row.amount, 0);
  const totalPayables = supplierInvoices.reduce((sum, row) => sum + row.remainingAmountRupiah, 0);
  const totalAssets = totalInventory + totalReceivables + input.cashBalanceRupiah + input.bankBalanceRupiah + input.pettyCashBalanceRupiah;
  if (![totalInventory, totalReceivables, totalPayables, totalAssets].every(Number.isSafeInteger)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Total saldo awal melewati batas integer Rupiah aman.' };
  }
  const openingEquity = totalAssets - totalPayables;
  if (!Number.isSafeInteger(openingEquity)) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nilai modal pembukaan melewati batas integer Rupiah aman.' };
  }

  const idempotencyKey = input.idempotencyKey?.trim() || `OPENING-IMPORT-${referenceNo}`;
  const stockLedger: StockLedgerEntry[] = lots.map((lot) => ({
    uuid: generateUUID(), idempotencyKey, timestamp: nowIso(), actorName,
    type: 'IN_ADJUST', humanLabel: 'Saldo Awal Go-Live', productName: lot.product,
    lotId: lot.id, lotCode: lot.code, weightGramDelta: lot.weightGram,
    unitCostPerKg: lot.hppKgRupiah, valueRupiahDelta: getLotCarryingValueRupiah(lot),
    movingAvgHppAfterKg: lot.hppKgRupiah, referenceNo,
    note: 'Import saldo stok awal yang telah divalidasi Owner.',
  }));
  const journalLines: JournalLine[] = [
    ...buildInventoryJournalLines(lots.map((lot) => ({ lotId: lot.id, cogsRupiah: getLotCarryingValueRupiah(lot) })), lots, 'DEBIT'),
    ...(totalReceivables > 0 ? [{ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: totalReceivables, credit: 0 }] : []),
    ...(input.cashBalanceRupiah > 0 ? [{ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: input.cashBalanceRupiah, credit: 0 }] : []),
    ...(input.bankBalanceRupiah > 0 ? [{ accountCode: '1102', accountName: 'Rekening Bank', debit: input.bankBalanceRupiah, credit: 0 }] : []),
    ...(input.pettyCashBalanceRupiah > 0 ? [{ accountCode: '1103', accountName: 'Kas Kecil', debit: input.pettyCashBalanceRupiah, credit: 0 }] : []),
    ...(totalPayables > 0 ? [{ accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: totalPayables }] : []),
    ...(openingEquity > 0
      ? [{ accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: openingEquity }]
      : openingEquity < 0
        ? [{ accountCode: '3101', accountName: 'Modal Awal Usaha', debit: -openingEquity, credit: 0 }]
        : []),
  ];
  const journal = journalLines.length > 0 ? buildDerivedJournal({
    idempotencyKey, referenceNo, category: 'PENYESUAIAN',
    description: 'Jurnal pembukaan saldo awal Go-Live ERP DAGING',
    lines: journalLines,
  }) : undefined;
  const nextCustomers = state.customers.map((customer) => ({
    ...customer, currentReceivable: receivableByCustomer.get(customer.id) ?? 0,
  }));
  const nextLots = lots;
  const nextProducts = syncProductsStockFromLots(state.products, nextLots);
  const committedAt = nowIso();
  const syncItem = buildSyncItem({
    idempotencyKey, entityType: 'OPNAME',
    summary: `Opening Balance Go-Live ${referenceNo}`,
    payload: {
      kind: 'OPENING_BALANCE_IMPORT', referenceNo, committedAt,
      lots: nextLots, receivables, supplierInvoices,
      cashBalanceRupiah: input.cashBalanceRupiah,
      bankBalanceRupiah: input.bankBalanceRupiah,
      pettyCashBalanceRupiah: input.pettyCashBalanceRupiah,
      stockLedger, journal,
    },
  });
  const nextState: BusinessEngineState = {
    ...state,
    lots: nextLots, products: nextProducts, customers: nextCustomers,
    receivables, supplierInvoices,
    cashInHandRupiah: input.cashBalanceRupiah,
    bankBalanceRupiah: input.bankBalanceRupiah,
    bankBalanceInitialized: true,
    pettyCashBalanceRupiah: input.pettyCashBalanceRupiah,
    stockLedger, journals: journal ? [journal] : [],
    openingBalanceCommittedAt: committedAt,
    openingBalanceReferenceNo: referenceNo,
    openingBalanceIdempotencyKey: idempotencyKey,
    syncOutbox: [syncItem],
    processedIdempotencyKeys: [idempotencyKey],
    auditTrail: [buildAuditEntry({
      actorName, actorRole: 'OWNER', action: 'OPENING_BALANCE_COMMITTED',
      humanSummary: `Saldo awal persediaan Rp ${totalInventory.toLocaleString('id-ID')}, piutang Rp ${totalReceivables.toLocaleString('id-ID')}, utang Rp ${totalPayables.toLocaleString('id-ID')} dikunci untuk Go-Live.`,
      referenceId: referenceNo,
    }), ...state.auditTrail],
    lastUpdatedAt: committedAt,
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: 'Opening Balance berhasil diposting atomik dan Go-Live Lock telah aktif.' };
}

export function recordAffiliateCommission(
  state: BusinessEngineState,
  input: {
    productId: string;
    referenceNo: string;
    grossReferenceRupiah?: number;
    weightGram?: number;
    pcs?: number;
    actorName?: string;
    idempotencyKey?: string;
  }
): EngineActionResult {
  const referenceNo = input.referenceNo?.trim() || '';
  const idemKey = input.idempotencyKey?.trim() || `AFFILIATE-${referenceNo}`;
  if (state.processedIdempotencyKeys.includes(idemKey) ||
      (state.affiliateCommissions ?? []).some((item) => item.referenceNo.toUpperCase() === referenceNo.toUpperCase())) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Referensi komisi Affiliate ini sudah pernah dicatat.' };
  }
  const product = state.products.find((item) => item.id === input.productId);
  if (!product || !referenceNo) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Produk Affiliate dan nomor referensi konversi wajib diisi.' };
  }
  const calculation = calculateAffiliateCommission(product, input);
  if (!calculation.ok) {
    return { ok: false, state, errorCode: 'VALIDATION', message: calculation.message };
  }
  const record: AffiliateCommissionRecord = {
    id: `AFF-COM-${generateUUID()}`, idempotencyKey: idemKey, referenceNo,
    productId: product.id, productName: product.name, partner: product.affiliatePartner || '',
    commissionType: calculation.commissionType, commissionValue: calculation.commissionValue,
    grossReferenceRupiah: calculation.grossReferenceRupiah,
    weightGram: calculation.weightGram, pcs: calculation.pcs,
    commissionRupiah: calculation.commissionRupiah,
    paidAmountRupiah: 0, remainingAmountRupiah: calculation.commissionRupiah,
    status: 'UNPAID', createdAt: nowIso(),
  };
  const journal = buildDerivedJournal({
    idempotencyKey: idemKey, referenceNo, category: 'PENYESUAIAN',
    description: `Pendapatan komisi Affiliate ${product.name} dari ${record.partner}`,
    lines: [
      { accountCode: '1210', accountName: 'Piutang Komisi Affiliate', debit: record.commissionRupiah, credit: 0 },
      { accountCode: '4202', accountName: 'Pendapatan Komisi Affiliate', debit: 0, credit: record.commissionRupiah },
    ],
  });
  const nextState: BusinessEngineState = {
    ...state,
    affiliateCommissions: [record, ...(state.affiliateCommissions ?? [])],
    journals: [journal, ...state.journals],
    auditTrail: [buildAuditEntry({
      actorName: input.actorName || 'Admin', actorRole: 'ADMIN',
      action: 'AFFILIATE_COMMISSION_RECORDED',
      humanSummary: `Komisi Affiliate ${record.partner} sebesar Rp ${record.commissionRupiah.toLocaleString('id-ID')} dicatat dari referensi ${referenceNo}.`,
      referenceId: referenceNo,
    }), ...state.auditTrail],
    syncOutbox: [buildSyncItem({
      idempotencyKey: idemKey, entityType: 'AFFILIATE',
      summary: `Komisi Affiliate ${record.partner} Rp ${record.commissionRupiah.toLocaleString('id-ID')}`,
      payload: { kind: 'COMMISSION_RECORDED', record },
    }), ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: `Komisi Affiliate Rp ${record.commissionRupiah.toLocaleString('id-ID')} berhasil dicatat sebagai pendapatan dan piutang komisi.` };
}

export function recordAffiliateCommissionSettlement(
  state: BusinessEngineState,
  commissionId: string,
  amountReceived: number,
  paymentMethod: 'CASH' | 'TRANSFER',
  actorName = 'Admin Keuangan',
  paymentReference = '',
  idempotencyKey?: string
): EngineActionResult {
  const idemKey = idempotencyKey?.trim() || `AFFILIATE-SETTLE-${commissionId}-${generateUUID().slice(0, 8)}`;
  if (state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Penerimaan komisi Affiliate ini sudah pernah dicatat.' };
  }
  const commission = (state.affiliateCommissions ?? []).find((item) => item.id === commissionId);
  if (!commission || commission.status === 'VOIDED') {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Piutang komisi Affiliate tidak ditemukan atau sudah dibatalkan.' };
  }
  if (!Number.isSafeInteger(amountReceived) || amountReceived <= 0 || amountReceived > commission.remainingAmountRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal penerimaan harus integer Rupiah positif dan tidak melebihi sisa piutang komisi.' };
  }
  if (paymentMethod === 'TRANSFER' && state.bankBalanceInitialized !== true) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo awal bank belum diverifikasi. Penerimaan transfer komisi ditahan.' };
  }
  const paid = commission.paidAmountRupiah + amountReceived;
  const remaining = commission.commissionRupiah - paid;
  const updated = (state.affiliateCommissions ?? []).map((item) => item.id === commissionId
    ? { ...item, paidAmountRupiah: paid, remainingAmountRupiah: remaining, status: remaining === 0 ? 'PAID' as const : 'PARTIAL' as const }
    : item);
  const accountCode = paymentMethod === 'CASH' ? '1101' : '1102';
  const accountName = paymentMethod === 'CASH' ? 'Kas Tunai Toko' : 'Rekening Bank';
  const journal = buildDerivedJournal({
    idempotencyKey: idemKey, referenceNo: commission.referenceNo, category: 'PEMBAYARAN',
    description: `Penerimaan pembayaran komisi Affiliate ${commission.partner}`,
    lines: [
      { accountCode, accountName, debit: amountReceived, credit: 0 },
      { accountCode: '1210', accountName: 'Piutang Komisi Affiliate', debit: 0, credit: amountReceived },
    ],
  });
  const nextState: BusinessEngineState = {
    ...state,
    ...(paymentMethod === 'CASH'
      ? { cashInHandRupiah: state.cashInHandRupiah + amountReceived }
      : { bankBalanceRupiah: (state.bankBalanceRupiah ?? 0) + amountReceived, bankBalanceInitialized: true }),
    affiliateCommissions: updated,
    journals: [journal, ...state.journals],
    auditTrail: [buildAuditEntry({
      actorName, actorRole: 'ADMIN', action: 'AFFILIATE_COMMISSION_SETTLED',
      humanSummary: `Diterima Rp ${amountReceived.toLocaleString('id-ID')} dari ${commission.partner} untuk referensi ${commission.referenceNo}.${paymentReference.trim() ? ` Ref: ${paymentReference.trim()}.` : ''}`,
      referenceId: commission.referenceNo,
    }), ...state.auditTrail],
    syncOutbox: [buildSyncItem({
      idempotencyKey: idemKey, entityType: 'AFFILIATE',
      summary: `Terima komisi Affiliate Rp ${amountReceived.toLocaleString('id-ID')}`,
      payload: { kind: 'SETTLEMENT', commissionId, amountReceivedRupiah: amountReceived, paymentMethod, paymentReference: paymentReference.trim() },
    }), ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: `Penerimaan komisi Affiliate Rp ${amountReceived.toLocaleString('id-ID')} berhasil dicatat.` };
}

export function recordConsignmentPayablePayment(
  state: BusinessEngineState,
  payableId: string,
  amountPaid: number,
  actorName = 'Admin Keuangan',
  paymentMethod: 'CASH' | 'TRANSFER' = 'TRANSFER',
  paymentReference = '',
  idempotencyKey?: string
): EngineActionResult {
  const idemKey = idempotencyKey?.trim() || `PAY-CONSIGN-${payableId}-${generateUUID().slice(0, 8)}`;
  if (state.processedIdempotencyKeys.includes(idemKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Pembayaran konsinyasi ini sudah pernah dicatat.' };
  }
  const payable = (state.consignmentPayables ?? []).find((item) => item.id === payableId);
  if (!payable || payable.status === 'VOIDED') {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Utang konsinyasi tidak ditemukan atau sudah dibatalkan.' };
  }
  if (!Number.isSafeInteger(amountPaid) || amountPaid <= 0 || amountPaid > payable.remainingAmountRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal pembayaran harus integer Rupiah positif dan tidak boleh melebihi sisa utang konsinyasi.' };
  }
  if (paymentMethod === 'TRANSFER') {
    if (state.bankBalanceInitialized !== true || !Number.isSafeInteger(state.bankBalanceRupiah) ||
        Number(state.bankBalanceRupiah) < amountPaid) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo bank belum direkonsiliasi atau tidak mencukupi untuk membayar pemilik barang konsinyasi.' };
    }
  } else if (!Number.isSafeInteger(state.cashInHandRupiah) || state.cashInHandRupiah < amountPaid) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo kas utama tidak mencukupi untuk membayar pemilik barang konsinyasi.' };
  }
  const updatedPayables = (state.consignmentPayables ?? []).map((item) => {
    if (item.id !== payableId) return item;
    const paid = item.paidAmountRupiah + amountPaid;
    const remaining = item.amountRupiah - paid;
    return { ...item, paidAmountRupiah: paid, remainingAmountRupiah: remaining, status: remaining === 0 ? 'PAID' as const : 'PARTIAL' as const };
  });
  const accountCode = paymentMethod === 'CASH' ? '1101' : '1102';
  const accountName = paymentMethod === 'CASH' ? 'Kas Tunai Toko' : 'Rekening Bank';
  const journal = buildDerivedJournal({
    idempotencyKey: idemKey, referenceNo: payable.invoiceNo, category: 'PEMBAYARAN',
    description: `Pembayaran utang konsinyasi kepada ${payable.ownerName} (${payable.invoiceNo})`,
    lines: [
      { accountCode: '2102', accountName: 'Utang Konsinyasi', debit: amountPaid, credit: 0 },
      { accountCode, accountName, debit: 0, credit: amountPaid },
    ],
  });
  const nextState: BusinessEngineState = {
    ...state,
    ...(paymentMethod === 'CASH'
      ? { cashInHandRupiah: state.cashInHandRupiah - amountPaid }
      : { bankBalanceRupiah: (state.bankBalanceRupiah ?? 0) - amountPaid }),
    consignmentPayables: updatedPayables,
    journals: [journal, ...state.journals],
    auditTrail: [buildAuditEntry({
      actorName, actorRole: 'ADMIN', action: 'PAY_CONSIGNMENT_OWNER',
      humanSummary: `Dibayarkan Rp ${amountPaid.toLocaleString('id-ID')} kepada ${payable.ownerName} dari ${paymentMethod === 'CASH' ? 'kas' : 'bank'} untuk faktur ${payable.invoiceNo}.${paymentReference.trim() ? ` Ref: ${paymentReference.trim()}.` : ''}`,
      referenceId: payable.invoiceNo,
    }), ...state.auditTrail],
    syncOutbox: [buildSyncItem({
      idempotencyKey: idemKey, entityType: 'CONSIGNMENT',
      summary: `Bayar konsinyasi ${payable.ownerName} Rp ${amountPaid.toLocaleString('id-ID')}`,
      payload: { kind: 'PAYMENT', payableId, amountPaidRupiah: amountPaid, paymentMethod, paymentReference: paymentReference.trim() },
    }), ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: `Pembayaran konsinyasi Rp ${amountPaid.toLocaleString('id-ID')} berhasil dicatat.` };
}

/**
 * Record Supplier Payable Payment from the selected real source of funds.
 */
export function recordSupplierPayablePayment(
  state: BusinessEngineState,
  invoiceId: string,
  amountPaid: number,
  actorName = 'Admin Keuangan',
  isOnline = true,
  idempotencyKey?: string,
  paymentMethod: 'CASH' | 'TRANSFER' = 'TRANSFER',
  paymentReference = '',
  paymentNotes = ''
): EngineActionResult {
  if (idempotencyKey && state.processedIdempotencyKeys.includes(idempotencyKey)) {
    return { ok: false, state, errorCode: 'DUPLICATE', message: 'Pembayaran ke supplier ini sudah dicatat.' };
  }
  const inv = state.supplierInvoices.find((i) => i.id === invoiceId);
  if (!inv) {
    return { ok: false, state, errorCode: 'NOT_FOUND', message: 'Faktur supplier tidak ditemukan.' };
  }
  if (!Number.isSafeInteger(amountPaid) || amountPaid <= 0 || amountPaid > inv.remainingAmountRupiah) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Nominal pembayaran harus berupa Rupiah bulat positif dan tidak boleh melebihi sisa utang.' };
  }
  const safePaid = amountPaid;
  if (paymentMethod === 'TRANSFER') {
    if (state.bankBalanceInitialized !== true || state.bankBalanceRupiah === undefined) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo awal rekening bank belum dicatat. Catat saldo awal atau pilih sumber dana yang benar sebelum membayar supplier.' };
    }
    if (state.bankBalanceRupiah < safePaid) {
      return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo bank tidak mencukupi. Pembayaran supplier belum dicatat.' };
    }
  } else if (state.cashInHandRupiah < safePaid) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo kas utama tidak mencukupi. Pembayaran supplier belum dicatat.' };
  }
  const idemKey = idempotencyKey?.trim() || `PAY-SUP-${invoiceId}-${generateUUID().slice(0, 8)}`;
  const updatedInvoices = state.supplierInvoices.map((i) => {
    if (i.id !== invoiceId) return i;
    const paid = i.paidAmountRupiah + safePaid;
    const remaining = Math.max(0, i.totalAmountRupiah - paid);
    return { ...i, paidAmountRupiah: paid, remainingAmountRupiah: remaining, status: remaining === 0 ? ('LUNAS' as const) : ('CICILAN' as const) };
  });
  const accountCode = paymentMethod === 'CASH' ? '1101' : '1102';
  const accountName = paymentMethod === 'CASH' ? 'Kas Tunai Toko' : 'Rekening Bank BCA Usaha';
  const journalEntry = buildDerivedJournal({
    idempotencyKey: idemKey, referenceNo: inv.invoiceNumber, category: 'PEMBAYARAN',
    description: `Pembayaran tagihan ke ${inv.supplier} (${inv.invoiceNumber})`,
    lines: [
      { accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: safePaid, credit: 0 },
      { accountCode, accountName, debit: 0, credit: safePaid },
    ],
  });
  const nextState: BusinessEngineState = {
    ...state,
    ...(paymentMethod === 'CASH'
      ? { cashInHandRupiah: state.cashInHandRupiah - safePaid }
      : { bankBalanceRupiah: (state.bankBalanceRupiah ?? 0) - safePaid }),
    supplierInvoices: updatedInvoices,
    journals: [journalEntry, ...state.journals],
    auditTrail: [buildAuditEntry({
      actorName, actorRole: 'OWNER', action: 'BAYAR_TAGIHAN_SUPPLIER',
      humanSummary: `Dibayarkan Rp ${safePaid.toLocaleString('id-ID')} ke ${inv.supplier} dari ${paymentMethod === 'CASH' ? 'kas utama' : 'rekening bank'} untuk faktur ${inv.invoiceNumber}.${paymentReference.trim() ? ` Ref: ${paymentReference.trim()}.` : ''}${paymentNotes.trim() ? ` Catatan: ${paymentNotes.trim()}.` : ''}`,
      referenceId: inv.invoiceNumber,
    }), ...state.auditTrail],
    syncOutbox: [buildSyncItem({
      idempotencyKey: idemKey, entityType: 'PAYMENT',
      summary: `Bayar supplier ${inv.supplier} Rp ${safePaid.toLocaleString('id-ID')}`,
      payload: {
        kind: 'SUPPLIER_PAYMENT', invoiceId, invoiceNumber: inv.invoiceNumber,
        supplier: inv.supplier, amountPaidRupiah: safePaid, paymentMethod, paymentReference: paymentReference.trim(), notes: paymentNotes.trim(),
      },
    }), ...state.syncOutbox],
    processedIdempotencyKeys: [idemKey, ...state.processedIdempotencyKeys],
    lastUpdatedAt: nowIso(),
  };
  persistEngineState(nextState);
  return { ok: true, state: nextState, message: `Pembayaran ke ${inv.supplier} sebesar Rp ${safePaid.toLocaleString('id-ID')} tercatat rapi.` };
}

/**
 * Record Petty Cash / Operational Store Expense
 */
export function recordPettyCashTopUp(
  state: BusinessEngineState,
  amountRupiah: number,
  source: 'KAS_UTAMA' | 'BANK',
  actorName = 'Admin',
  isOnline = true,
  idempotencyKey?: string,
  actorRole: 'OWNER' | 'ADMIN' = 'ADMIN'
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
  if (source === 'BANK' && (!state.bankBalanceInitialized || amountRupiah > (state.bankBalanceRupiah ?? 0))) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'Saldo rekening bank belum direkonsiliasi atau tidak mencukupi.' };
  }

  const sourceAccountCode = source === 'KAS_UTAMA' ? '1101' : '1102';
  const sourceAccountName = source === 'KAS_UTAMA' ? 'Kas Utama' : 'Bank Usaha';
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
    bankBalanceRupiah: source === 'BANK' ? (state.bankBalanceRupiah ?? 0) - amountRupiah : state.bankBalanceRupiah,
    pettyCashBalanceRupiah: state.pettyCashBalanceRupiah + amountRupiah,
    journals: [journalEntry, ...state.journals],
    auditTrail: [
      buildAuditEntry({
        actorName,
        actorRole,
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
  idempotencyKey?: string,
  actorRole: 'OWNER' | 'ADMIN' = 'ADMIN'
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
        actorRole,
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
  if (state.ownerPinNeedsChange) {
    return { ok: false, state, errorCode: 'VALIDATION', message: 'PIN bawaan wajib diganti sebelum Owner memproses persetujuan.' };
  }
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
          approval: req,
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
  // A UUID alone is not sufficient proof of receipt: every ACK must map to
  // an item in the current Outbox and carry a positive safe server sequence.
  const currentIds = new Set(state.syncOutbox.map((item) => item.uuid));
  const ackSet = new Set(params.acknowledgedIds.filter((uuid) =>
    currentIds.has(uuid) && Number.isSafeInteger(params.serverSeqs?.[uuid]) && (params.serverSeqs?.[uuid] ?? 0) > 0
  ));
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
        serverSeq: params.serverSeqs![item.uuid],
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
 * Apply ordered events received from the shared server event log.
 * Idempotency keys prevent replay; stock shortfalls are recorded as conflicts.
 */
export function applyPulledSyncRecords(state: BusinessEngineState, records: Array<Record<string, unknown>>, lastServerSeq?: number): BusinessEngineState {
  let next: BusinessEngineState = { ...state };
  const ordered = [...records].sort((a, b) => Number(a.serverSeq ?? a.server_seq ?? 0) - Number(b.serverSeq ?? b.server_seq ?? 0));
  const seen = new Set(next.processedIdempotencyKeys);
  const remoteEvents = [...(next.remoteSyncEvents ?? [])];
  const conflicts = [...(next.remoteSyncConflicts ?? [])];
  const seenSequences = new Set<number>();
  for (const raw of ordered) {
    const event = raw as any;
    const key = typeof event.idempotencyKey === 'string' ? event.idempotencyKey.trim() : '';
    const rawSeq = event.serverSeq ?? event.server_seq;
    const seq = Number(rawSeq);
    const validSequence = Number.isSafeInteger(rawSeq) && seq > 0;
    const stableFallbackId = validSequence
      ? `SEQ-${seq}`
      : `HASH-${computeIntegrityHash(JSON.stringify(raw) || String(raw))}`;
    const eventId = String(event.uuid || event.queue_id || key || stableFallbackId);
    if (!validSequence) {
      const malformedSequenceKey = `MALFORMED_REMOTE_SEQUENCE:${eventId}`;
      if (!seen.has(malformedSequenceKey)) {
        const malformedAt = nowIso();
        conflicts.push({ eventId, reason: 'Event remote tidak memiliki serverSeq integer positif; event tidak diterapkan dan cursor tidak dimajukan.', createdAt: malformedAt });
        remoteEvents.unshift({ ...event, appliedAt: malformedAt, processingError: 'INVALID_SERVER_SEQUENCE' });
        seen.add(malformedSequenceKey);
      }
      continue;
    }
    if (!key) {
      const malformedKey = `MALFORMED_REMOTE_EVENT:${eventId}`;
      if (!seen.has(malformedKey)) {
        const malformedAt = nowIso();
        conflicts.push({
          eventId,
          reason: 'Event remote tidak memiliki idempotencyKey; event tidak diterapkan dan perlu pemeriksaan backend.',
          createdAt: malformedAt,
        });
        remoteEvents.unshift({ ...event, appliedAt: malformedAt, processingError: 'MISSING_IDEMPOTENCY_KEY' });
        seen.add(malformedKey);
      }
      if (Number.isSafeInteger(seq) && seq > (next.lastServerSeq ?? 0)) next.lastServerSeq = seq;
      seenSequences.add(seq);
      continue;
    }
    if (seen.has(key)) {
      if (Number.isSafeInteger(seq) && seq > (next.lastServerSeq ?? 0)) next.lastServerSeq = seq;
      continue;
    }

    if (seq <= (state.lastServerSeq ?? 0)) {
      const staleKey = `STALE_REMOTE_EVENT:${eventId}`;
      if (!seen.has(staleKey)) {
        conflicts.push({ eventId, reason: 'Event remote berada di belakang cursor lokal; event tidak diterapkan ulang.', createdAt: nowIso() });
        seen.add(staleKey);
      }
      continue;
    }
    if (seenSequences.has(seq)) {
      const duplicateSequenceKey = `DUPLICATE_REMOTE_SEQUENCE:${eventId}`;
      if (!seen.has(duplicateSequenceKey)) {
        conflicts.push({ eventId, reason: 'Dua event remote memakai serverSeq yang sama; event kedua tidak diterapkan.', createdAt: nowIso() });
        seen.add(duplicateSequenceKey);
      }
      continue;
    }
    seenSequences.add(seq);
    const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload : {};
    const invalidIntegerFields = findInvalidRemoteIntegerFields(payload);
    if (invalidIntegerFields.length > 0) {
      const invalidAt = nowIso();
      const reason = `Event remote ditolak karena field Rupiah/Gram bukan integer aman: ${invalidIntegerFields.slice(0, 5).join(', ')}${invalidIntegerFields.length > 5 ? ', …' : ''}. Event dikarantina; nilai tidak dikonversi atau dibulatkan.`;
      conflicts.push({ eventId, reason, createdAt: invalidAt });
      remoteEvents.unshift({ ...event, appliedAt: invalidAt, processingError: 'INVALID_INTEGER_LEDGER_FIELD' });
      seen.add(key);
      continue;
    }
    const type = String(event.entityType || event.entity_type || '').toUpperCase();
    const now = nowIso();
    if (type === 'SALES_SNAPSHOT') {
      const snapshotId = String(payload.snapshotId || '');
      const snapshotSalesId = String(payload.salesId || '');
      const collection = String(payload.collection || '');
      const part = Number(payload.part), totalParts = Number(payload.totalParts);
      const allowedCollections = ['products', 'lots', 'customers', 'categories', 'bazarPromos'];
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      if (!snapshotId || !snapshotSalesId || (next.salesProjectionSalesId && next.salesProjectionSalesId !== snapshotSalesId) || !allowedCollections.includes(collection) ||
          !Number.isSafeInteger(part) || !Number.isSafeInteger(totalParts) ||
          totalParts < 1 || totalParts > 1000 || part < 0 || part >= totalParts ||
          rows.some((row: any) => !row || typeof row.id !== 'string' || !row.id)) {
        conflicts.push({ eventId, reason: 'Chunk bootstrap Sales tidak valid; snapshot tidak diterapkan.', createdAt: now });
      } else {
        const collections = ['products', 'lots', 'customers', 'categories', 'bazarPromos'] as const;
        const emptyParts = () => ({ products: [] as number[], lots: [] as number[], customers: [] as number[], categories: [] as number[], bazarPromos: [] as number[] });
        const emptyTotals = () => ({ products: 0, lots: 0, customers: 0, categories: 0, bazarPromos: 0 });
        const prior = next.salesProjectionBuild?.snapshotId === snapshotId ? next.salesProjectionBuild : undefined;
        const build = prior ? {
          ...prior,
          receivedParts: { ...prior.receivedParts },
          totalParts: { ...prior.totalParts },
        } : {
          snapshotId,
          products: [] as ProductEntity[],
          lots: [] as BatchLotEntity[],
          customers: [] as CustomerEntity[],
          categories: [] as ProductCategoryEntity[],
          bazarPromos: [] as BazarPromoEntity[],
          receivedParts: emptyParts(),
          totalParts: emptyTotals(),
        };
        const keyName = collection as typeof collections[number];
        if (build.totalParts[keyName] !== 0 && build.totalParts[keyName] !== totalParts) {
          conflicts.push({ eventId, reason: 'Jumlah chunk bootstrap Sales berubah di tengah snapshot.', createdAt: now });
        } else {
          build.totalParts[keyName] = totalParts;
          const currentRows = build[keyName] as Array<{ id: string }>;
          const byId = new Map(currentRows.map((row) => [row.id, row]));
          for (const row of rows as Array<Record<string, unknown>>) {
            const safeRow = { ...row };
            if (keyName === 'products') (safeRow as any).movingAvgHppPerKg = 0;
            if (keyName === 'lots') (safeRow as any).hppKgRupiah = 0;
            byId.set(String(row.id), safeRow as any);
          }
          (build as any)[keyName] = [...byId.values()];
          if (!build.receivedParts[keyName].includes(part)) build.receivedParts[keyName] = [...build.receivedParts[keyName], part];
          const complete = collections.every((name) => build.totalParts[name] > 0 && build.receivedParts[name].length === build.totalParts[name]);
          if (complete) {
            next = {
              ...next,
              products: syncProductsStockFromLots(build.products, build.lots),
              lots: build.lots,
              customers: build.customers,
              categories: build.categories,
              bazarPromos: build.bazarPromos,
              salesProjectionReady: true,
              salesProjectionSalesId: snapshotSalesId,
              salesProjectionBuild: undefined,
            };
          } else {
            next = { ...next, salesProjectionReady: false, salesProjectionSalesId: snapshotSalesId, salesProjectionBuild: build };
          }
        }
      }
    } else if (type === 'SALE') {
      const invoiceNumber = String(payload.invoiceNumber || '');
      if (!invoiceNumber || next.transactions.some((tx) => tx.invoiceNumber === invoiceNumber)) {
        conflicts.push({ eventId, reason: 'Faktur remote kosong atau sudah ada; event tidak diterapkan ulang.', createdAt: now });
      } else {
        const method = (['CASH', 'TRANSFER', 'TEMPO', 'MIX'].includes(String(payload.paymentMethod)) ? payload.paymentMethod : 'CASH') as PaymentMethod;
        const invalidSale = validateSalePayload(payload);
        if (invalidSale) {
          conflicts.push({ eventId, reason: invalidSale, createdAt: now });
          seen.add(key);
          remoteEvents.unshift({ ...event, appliedAt: now, processingError: 'INVALID_SALE_PAYLOAD' });
          if (Number.isSafeInteger(seq) && seq > (next.lastServerSeq ?? 0)) next.lastServerSeq = seq;
          continue;
        }
        const rawBreakdown = payload.paymentBreakdown as SalePaymentBreakdown;
        const allocations = Array.isArray(payload.lotAllocations) ? payload.lotAllocations : [];
        const deficits: string[] = allocations.filter((allocation: any) => !next.lots.some((lot) => lot.id === allocation.lotId)).map((allocation: any) => `Lot ${allocation.lotCode || allocation.lotId} tidak ditemukan`);
        const missingProducts = (Array.isArray(payload.items) ? payload.items : []).filter((item: any) => !next.products.some((product) => product.id === item.productId));
        // Keep the sale intact, but deduct only stock physically available on this receiving device.
        // Cost is recalculated from the receiving device's exact carrying value, never remote HPP.
        let lots = [...next.lots];
        const appliedAllocations = allocations.flatMap((allocation: any) => {
          const lotId = String(allocation.lotId || '');
          const requestedGram = Number(allocation.weightGram);
          const lotIndex = lots.findIndex((item) => item.id === lotId);
          if (!lotId || !Number.isSafeInteger(requestedGram) || requestedGram <= 0 || lotIndex < 0) return [];
          const currentLot = lots[lotIndex];
          const appliedGram = Math.min(currentLot.weightGram, requestedGram);
          if (appliedGram < requestedGram) deficits.push(`${currentLot.code}: kurang ${requestedGram - appliedGram} gram`);
          if (appliedGram <= 0) return [];
          const consumed = consumeLotStock(currentLot, appliedGram);
          lots[lotIndex] = consumed.lot;
          return [{
            ...allocation,
            weightGram: appliedGram,
            hppPerKg: currentLot.hppKgRupiah,
            cogsRupiah: consumed.cogsRupiah,
            carryingValueRupiah: consumed.cogsRupiah,
            ownershipType: currentLot.ownershipType ?? 'OWN',
            ...(currentLot.ownershipType === 'CONSIGNMENT' ? {
              consignmentSetorPerKgRupiah: currentLot.consignmentSetorPerKgRupiah,
              consignmentPayableRupiah: Math.round((appliedGram * Number(currentLot.consignmentSetorPerKgRupiah)) / 1000),
            } : {}),
          }];
        });
        const saleConsignmentPayableRupiah = appliedAllocations.reduce((sum: number, allocation: any) => sum + (allocation.consignmentPayableRupiah ?? 0), 0);
        const saleCogsRupiah = appliedAllocations.reduce((sum: number, allocation: any) => sum + allocation.cogsRupiah, 0) + saleConsignmentPayableRupiah;
        const items = Array.isArray(payload.items) ? payload.items : [];
        const total = Math.max(0, Number(payload.grandTotalRupiah) || 0);
        const paymentBreakdown: SalePaymentBreakdown = rawBreakdown ?? (
          method === 'CASH'
            ? { cashPaidRupiah: total, transferPaidRupiah: 0, receivableRupiah: 0 }
            : method === 'TRANSFER'
            ? { cashPaidRupiah: 0, transferPaidRupiah: total, receivableRupiah: 0 }
            : { cashPaidRupiah: Math.max(0, Number(payload.paidAmountRupiah) || 0), transferPaidRupiah: 0, receivableRupiah: Math.max(0, Number(payload.balanceDueRupiah) || 0) }
        );
        const paid = method === 'MIX' ? paymentBreakdown.cashPaidRupiah + paymentBreakdown.transferPaidRupiah : Math.max(0, Number(payload.paidAmountRupiah) || 0);
        const due = method === 'MIX' ? paymentBreakdown.receivableRupiah : Math.max(0, Number(payload.balanceDueRupiah) || 0);
        const tx = {
          uuid: String(payload.transactionUuid || eventId), idempotencyKey: key, invoiceNumber, timestamp: String(event.createdAt || now),
          customerId: String(payload.customerId || ''), customerName: String(payload.customerName || 'Pelanggan Remote'), customerTier: 'REMOTE',
          paymentMethod: method, paymentBreakdown, tempoDays: due > 0 ? Math.max(0, Number(payload.tempoDays) || 7) : 0, totalWeightGram: Math.max(0, Number(payload.totalWeightGram) || 0),
          subtotalRupiah: Math.max(0, Number(payload.subtotalRupiah) || total), discountRupiah: Math.max(0, Number(payload.discountRupiah) || 0),
          shippingFee: Math.max(0, Number(payload.shippingFee) || 0), isFreeShipping: payload.isFreeShipping === true, grandTotalRupiah: total, paidAmountRupiah: paid, balanceDueRupiah: due,
          totalCogsRupiah: saleCogsRupiah,
          grossProfitRupiah: total - saleCogsRupiah, status: 'COMPLETED' as const,
          items: items.map((item: any) => ({
            ...item,
            movingAvgHppPerKg: next.products.find((product) => product.id === item.productId)?.movingAvgHppPerKg ?? 0,
          })),
          lotAllocations: appliedAllocations,
          remoteStockAppliedAllocations: appliedAllocations,
        };
        const customerExists = next.customers.some((c) => c.id === tx.customerId);
        const paidCash = paymentBreakdown.cashPaidRupiah;
        const paidBank = paymentBreakdown.transferPaidRupiah;
        const cogs = tx.totalCogsRupiah;
        const saleJournalLines = [
          ...(paidCash > 0 ? [{ accountCode: '1101', accountName: 'Kas Tunai', debit: paidCash, credit: 0 }] : []),
          ...(paidBank > 0 ? [{ accountCode: '1102', accountName: 'Rekening Bank', debit: paidBank, credit: 0 }] : []),
          ...(due > 0 ? [{ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: due, credit: 0 }] : []),
          { accountCode: '4101', accountName: 'Penjualan Daging', debit: 0, credit: tx.subtotalRupiah },
          ...(tx.discountRupiah > 0 ? [{ accountCode: '4103', accountName: 'Potongan & Retur Penjualan', debit: tx.discountRupiah, credit: 0 }] : []),
          ...(tx.shippingFee > 0 ? [{ accountCode: '4102', accountName: 'Pendapatan Jasa Pengiriman', debit: 0, credit: tx.shippingFee }] : []),
          ...(cogs > 0 ? [{ accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: cogs, credit: 0 }] : []),
          ...buildInventoryJournalLines(appliedAllocations.map((allocation: any) => ({ lotId: String(allocation.lotId), cogsRupiah: Number(allocation.cogsRupiah) })), next.lots, 'CREDIT'),
          ...(saleConsignmentPayableRupiah > 0 ? [{ accountCode: '2102', accountName: 'Utang Konsinyasi', debit: 0, credit: saleConsignmentPayableRupiah }] : []),
        ];
        const remoteSaleJournal = buildDerivedJournal({
          idempotencyKey: key, referenceNo: invoiceNumber, category: 'PENJUALAN',
          description: `Penjualan remote ${invoiceNumber} dari perangkat lain`, lines: saleJournalLines,
        });
        const remoteSaleLedger: StockLedgerEntry[] = appliedAllocations.map((allocation: any) => ({
          uuid: generateUUID(), idempotencyKey: key, timestamp: String(event.createdAt || now), actorName: 'Perangkat lain',
          type: 'OUT_SALE', humanLabel: 'Penjualan perangkat lain',
          productName: String(allocation.productName || 'Produk'), lotId: String(allocation.lotId || ''),
          lotCode: String(allocation.lotCode || ''), weightGramDelta: -Math.max(0, Number(allocation.weightGram) || 0),
          unitCostPerKg: Math.max(0, Number(allocation.hppPerKg) || 0),
          valueRupiahDelta: -Math.max(0, Number(allocation.cogsRupiah) || 0),
          movingAvgHppAfterKg: Math.max(0, Number(allocation.hppPerKg) || 0), referenceNo: invoiceNumber,
          note: 'Diterapkan dari event sinkronisasi perangkat lain',
        }));
        next = {
          ...next, lots, products: syncProductsStockFromLots(next.products, lots),
          consignmentPayables: [
            ...(next.consignmentPayables ?? []),
            ...appliedAllocations.filter((allocation: any) => allocation.ownershipType === 'CONSIGNMENT' && (allocation.consignmentPayableRupiah ?? 0) > 0).map((allocation: any) => {
              const lot = next.lots.find((item) => item.id === allocation.lotId);
              const amountRupiah = allocation.consignmentPayableRupiah;
              return {
                id: `CONSIGN-${tx.invoiceNumber}-${allocation.lotId}`,
                idempotencyKey: key, invoiceNo: tx.invoiceNumber,
                lotId: allocation.lotId, lotCode: allocation.lotCode,
                ownerName: lot?.consignmentOwnerName || 'Pemilik Barang Konsinyasi',
                supplierCode: lot?.supplierCode, weightGram: allocation.weightGram,
                setorPerKgRupiah: allocation.consignmentSetorPerKgRupiah ?? 0,
                amountRupiah, paidAmountRupiah: 0, remainingAmountRupiah: amountRupiah,
                status: 'UNPAID' as const, createdAt: now,
              };
            }),
          ],
          transactions: [tx, ...next.transactions],
          customers: next.customers.map((c) => c.id === tx.customerId ? { ...c, currentReceivable: c.currentReceivable + due } : c),
          receivables: due > 0 ? [{ ...(payload.receivable || {
            id: `REC_${invoiceNumber}`, customerId: tx.customerId, customer: tx.customerName, tier: 'REMOTE',
            amount: due, limit: 0, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            category: 'AKAN_DATANG', daysDiff: 7, invoice: invoiceNumber,
            itemsSummary: items.map((item: any) => item.productName || item.productId).join(', '),
            phone: '', status: 'BELUM_LUNAS',
          }) }, ...next.receivables.filter((r) => r.invoice !== invoiceNumber)] : next.receivables,
          cashInHandRupiah: next.cashInHandRupiah + paidCash,
          bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) + paidBank,
          stockLedger: [...remoteSaleLedger, ...next.stockLedger],
          journals: [remoteSaleJournal, ...next.journals],
          auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_SALE_REMOTE', humanSummary: `Penjualan ${invoiceNumber} diterapkan dari perangkat lain.`, referenceId: invoiceNumber }), ...next.auditTrail],
        };
        if (!customerExists && due > 0) conflicts.push({ eventId, reason: `Pelanggan ${tx.customerId} tidak ditemukan; piutang remote perlu rekonsiliasi.`, createdAt: now });
        if (deficits.length) conflicts.push({ eventId, reason: `Stok lot lokal tidak cukup/tidak ditemukan: ${deficits.join('; ')}. Stok dibatasi nol dan perlu opname/rekonsiliasi.`, createdAt: now });
        if (missingProducts.length) conflicts.push({ eventId, reason: `Master produk belum tersedia: ${missingProducts.map((item: any) => item.productId).join(', ')}.`, createdAt: now });
      }
    } else if (type === 'PAYMENT' && payload.kind === 'RECEIVABLE_PAYMENT') {
      const recId = String(payload.recId || ''), amount = Math.max(0, Number(payload.amountRupiah) || 0);
      const method = payload.paymentMethod === 'TRANSFER' ? 'TRANSFER' : 'CASH';
      const rec = next.receivables.find((r) => r.id === recId);
      if (!rec || amount <= 0 || amount > rec.amount) conflicts.push({ eventId, reason: 'Pembayaran remote tidak cocok dengan sisa piutang lokal.', createdAt: now });
      else {
        const remaining = rec.amount - amount;
        const paymentJournal = buildDerivedJournal({
          idempotencyKey: key, referenceNo: rec.invoice, category: 'PEMBAYARAN',
          description: `Pembayaran piutang remote ${rec.invoice}`,
          lines: [
            { accountCode: method === 'CASH' ? '1101' : '1102', accountName: method === 'CASH' ? 'Kas Tunai' : 'Rekening Bank', debit: amount, credit: 0 },
            { accountCode: '1201', accountName: 'Piutang Pelanggan', debit: 0, credit: amount },
          ],
        });
        next = {
          ...next,
          receivables: next.receivables.map((r) => r.id === recId ? { ...r, amount: remaining, status: remaining === 0 ? 'LUNAS' : 'BELUM_LUNAS' } : r),
          customers: next.customers.map((c) => c.id === rec.customerId ? { ...c, currentReceivable: Math.max(0, c.currentReceivable - amount) } : c),
          cashInHandRupiah: next.cashInHandRupiah + (method === 'CASH' ? amount : 0),
          bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) + (method === 'TRANSFER' ? amount : 0),
          receivablePayments: [{ id: key, recId, invoice: rec.invoice, customerId: rec.customerId, amountRupiah: amount, paymentMethod: method, createdAt: String(event.createdAt || now), actorName: 'Perangkat lain' }, ...(next.receivablePayments ?? [])],
          journals: [paymentJournal, ...next.journals],
          auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_RECEIVABLE_PAYMENT', humanSummary: `Pembayaran piutang ${rec.invoice} Rp ${amount.toLocaleString('id-ID')} diterapkan dari perangkat lain.`, referenceId: rec.invoice }), ...next.auditTrail],
        };
      }
    } else if (type === 'MASTER_DATA' && payload.kind === 'MASTER_DATA_PATCH') {
      const changes = payload.changes && typeof payload.changes === 'object' ? payload.changes as Record<string, any> : {};
      const mergeById = <T extends { id: string }>(current: T[], incoming: unknown, preserve?: (existing: T, incomingItem: T) => T): T[] => {
        if (!Array.isArray(incoming)) return current;
        const map = new Map(current.map((item) => [item.id, item]));
        for (const item of incoming) {
          if (!item || typeof item.id !== 'string') continue;
          const existing = map.get(item.id);
          map.set(item.id, existing && preserve ? preserve(existing, item as T) : item as T);
        }
        return [...map.values()];
      };
      const removeCustomerIds = new Set(
        Array.isArray(payload.removeCustomerIds)
          ? payload.removeCustomerIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
          : []
      );
      const mergedCustomers = mergeById(
        next.customers,
        changes.customers,
        (existing: any, incoming: any) => ({ ...existing, ...incoming, currentReceivable: existing.currentReceivable })
      ).filter((customer) => !removeCustomerIds.has(customer.id));
      next = {
        ...next,
        products: mergeById(next.products, changes.products, (existing: any, incoming: any) => ({ ...existing, ...incoming, stockGram: existing.stockGram, movingAvgHppPerKg: existing.movingAvgHppPerKg })),
        lots: mergeById(next.lots, changes.lots, (existing: any, incoming: any) => ({ ...existing, ...incoming, weightGram: existing.weightGram, hppKgRupiah: existing.hppKgRupiah, carryingValueRupiah: existing.carryingValueRupiah, isQuarantined: existing.isQuarantined })),
        customers: mergedCustomers,
        inboundPOs: mergeById(next.inboundPOs, changes.inboundPOs, (existing: any, incoming: any) => ({ ...existing, ...incoming, status: existing.status, totalRupiah: existing.totalRupiah, orderWeightKg: existing.orderWeightKg })),
        supplierInvoices: mergeById(next.supplierInvoices, changes.supplierInvoices, (existing: any, incoming: any) => ({ ...existing, ...incoming, paidAmountRupiah: existing.paidAmountRupiah, remainingAmountRupiah: existing.remainingAmountRupiah, status: existing.status })),
        categories: mergeById(next.categories ?? [], changes.categories, (existing: any, incoming: any) => ({ ...existing, ...incoming, deletedAt: existing.deletedAt || incoming.deletedAt })),
        bazarPromos: mergeById(next.bazarPromos ?? [], changes.bazarPromos, (existing: any, incoming: any) => ({ ...existing, ...incoming, soldKg: existing.soldKg })),
      };
      next = { ...next, products: syncProductsStockFromLots(next.products, next.lots) };
    } else if (type === 'APPROVAL') {
      const approval = payload.approval as ApprovalRequest | undefined;
      const approvalUuid = String(payload.approvalUuid || approval?.uuid || '');
      if (!approvalUuid || !['APPROVED', 'REJECTED'].includes(String(payload.decision))) {
        conflicts.push({ eventId, reason: 'Keputusan approval remote tidak lengkap.', createdAt: now });
      } else {
        const decision: ApprovalRequest['status'] = payload.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        const existing = next.approvals.find((item) => item.uuid === approvalUuid);
        const merged: ApprovalRequest | undefined = approval ? { ...approval, status: decision } : existing ? { ...existing, status: decision } : undefined;
        if (!merged) conflicts.push({ eventId, reason: `Approval ${approvalUuid} tidak ditemukan di perangkat ini.`, createdAt: now });
        else next = { ...next, approvals: [merged, ...next.approvals.filter((item) => item.uuid !== approvalUuid)], auditTrail: [buildAuditEntry({ actorName: String(payload.resolvedBy || 'Perangkat lain'), actorRole: 'SYSTEM', action: 'SYNC_APPROVAL_REMOTE', humanSummary: `Keputusan approval ${approvalUuid} diterapkan dari perangkat lain: ${decision}.`, referenceId: approvalUuid }), ...next.auditTrail] };
      }
    } else if (type === 'AFFILIATE') {
      if (payload.kind === 'COMMISSION_RECORDED') {
        const record = payload.record as AffiliateCommissionRecord | undefined;
        const product = record && next.products.find((item) => item.id === record.productId);
        const calculation = product && record ? calculateAffiliateCommission(product, {
          grossReferenceRupiah: record.grossReferenceRupiah,
          weightGram: record.weightGram,
          pcs: record.pcs,
        }) : null;
        const duplicate = record && (next.affiliateCommissions ?? []).some((item) =>
          item.id === record.id || item.referenceNo.toUpperCase() === record.referenceNo.toUpperCase()
        );
        if (!record || !product || !calculation?.ok || duplicate ||
            calculation.commissionRupiah !== record.commissionRupiah ||
            record.partner !== product.affiliatePartner ||
            record.status !== 'UNPAID' || record.paidAmountRupiah !== 0 ||
            record.remainingAmountRupiah !== record.commissionRupiah) {
          conflicts.push({ eventId, reason: 'Pencatatan komisi Affiliate remote tidak valid atau referensi sudah terdaftar.', createdAt: now });
        } else {
          const journal = buildDerivedJournal({
            idempotencyKey: key, referenceNo: record.referenceNo, category: 'PENYESUAIAN',
            description: `Pendapatan komisi Affiliate remote ${record.productName}`,
            lines: [
              { accountCode: '1210', accountName: 'Piutang Komisi Affiliate', debit: record.commissionRupiah, credit: 0 },
              { accountCode: '4202', accountName: 'Pendapatan Komisi Affiliate', debit: 0, credit: record.commissionRupiah },
            ],
          });
          next = {
            ...next,
            affiliateCommissions: [record, ...(next.affiliateCommissions ?? [])],
            journals: [journal, ...next.journals],
            auditTrail: [buildAuditEntry({
              actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_AFFILIATE_COMMISSION',
              humanSummary: `Komisi Affiliate ${record.partner} Rp ${record.commissionRupiah.toLocaleString('id-ID')} diterapkan dari perangkat lain.`,
              referenceId: record.referenceNo,
            }), ...next.auditTrail],
          };
        }
      } else if (payload.kind === 'SETTLEMENT') {
        const commissionId = String(payload.commissionId || '');
        const amount = Number(payload.amountReceivedRupiah);
        const method = payload.paymentMethod === 'CASH' ? 'CASH' : payload.paymentMethod === 'TRANSFER' ? 'TRANSFER' : '';
        const commission = (next.affiliateCommissions ?? []).find((item) => item.id === commissionId);
        if (!commission || commission.status === 'VOIDED' || !Number.isSafeInteger(amount) || amount <= 0 ||
            amount > commission.remainingAmountRupiah || !method) {
          conflicts.push({ eventId, reason: 'Settlement komisi Affiliate remote tidak valid atau melebihi piutang tersisa.', createdAt: now });
        } else {
          const paid = commission.paidAmountRupiah + amount;
          const remaining = commission.commissionRupiah - paid;
          const accountCode = method === 'CASH' ? '1101' : '1102';
          const accountName = method === 'CASH' ? 'Kas Tunai Toko' : 'Rekening Bank';
          const journal = buildDerivedJournal({
            idempotencyKey: key, referenceNo: commission.referenceNo, category: 'PEMBAYARAN',
            description: `Penerimaan komisi Affiliate remote ${commission.partner}`,
            lines: [
              { accountCode, accountName, debit: amount, credit: 0 },
              { accountCode: '1210', accountName: 'Piutang Komisi Affiliate', debit: 0, credit: amount },
            ],
          });
          next = {
            ...next,
            ...(method === 'CASH'
              ? { cashInHandRupiah: next.cashInHandRupiah + amount }
              : { bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) + amount, bankBalanceInitialized: true }),
            affiliateCommissions: (next.affiliateCommissions ?? []).map((item) => item.id === commissionId
              ? { ...item, paidAmountRupiah: paid, remainingAmountRupiah: remaining, status: remaining === 0 ? 'PAID' : 'PARTIAL' }
              : item),
            journals: [journal, ...next.journals],
            auditTrail: [buildAuditEntry({
              actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_AFFILIATE_SETTLEMENT',
              humanSummary: `Penerimaan komisi Affiliate Rp ${amount.toLocaleString('id-ID')} diterapkan dari perangkat lain.`,
              referenceId: commission.referenceNo,
            }), ...next.auditTrail],
          };
        }
      } else {
        conflicts.push({ eventId, reason: `Jenis event Affiliate ${String(payload.kind || 'UNKNOWN')} belum didukung.`, createdAt: now });
      }
    } else if (type === 'CONSIGNMENT') {
      if (payload.kind === 'RECEIPT') {
        const lot = payload.lot as BatchLotEntity | undefined;
        const product = lot && next.products.find((item) => item.id === lot.productId);
        const duplicate = lot && (next.lots.some((item) => item.id === lot.id) || next.lots.some((item) => item.code.toLowerCase() === lot.code.toLowerCase()));
        if (!lot || !product || duplicate || lot.ownershipType !== 'CONSIGNMENT' ||
            !lot.consignmentOwnerName?.trim() || !Number.isSafeInteger(lot.weightGram) || lot.weightGram <= 0 ||
            !Number.isSafeInteger(lot.consignmentSetorPerKgRupiah) || Number(lot.consignmentSetorPerKgRupiah) <= 0 ||
            lot.hppKgRupiah !== 0 || lot.carryingValueRupiah !== 0) {
          conflicts.push({ eventId, reason: 'Penerimaan stok konsinyasi remote tidak valid atau lot sudah terdaftar.', createdAt: now });
        } else {
          const ledgerEntry: StockLedgerEntry = {
            uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain',
            type: 'IN_ADJUST', humanLabel: 'Barang Masuk Konsinyasi (Remote)',
            productName: product.name, lotId: lot.id, lotCode: lot.code,
            weightGramDelta: lot.weightGram, unitCostPerKg: 0, valueRupiahDelta: 0,
            movingAvgHppAfterKg: product.movingAvgHppPerKg, referenceNo: lot.code,
            note: `Stok titipan milik ${lot.consignmentOwnerName}; bukan aset persediaan toko.`,
          };
          next = {
            ...next, lots: [lot, ...next.lots],
            products: syncProductsStockFromLots(next.products, [lot, ...next.lots]),
            stockLedger: [ledgerEntry, ...next.stockLedger],
            auditTrail: [buildAuditEntry({
              actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_CONSIGNMENT_RECEIPT',
              humanSummary: `Stok konsinyasi ${lot.code} diterima dari ${lot.consignmentOwnerName}.`,
              referenceId: lot.code,
            }), ...next.auditTrail],
          };
        }
      } else if (payload.kind === 'PAYMENT') {
        const payableId = String(payload.payableId || '');
        const amount = Number(payload.amountPaidRupiah);
        const paymentMethod = payload.paymentMethod === 'CASH' ? 'CASH' : payload.paymentMethod === 'TRANSFER' ? 'TRANSFER' : '';
        const payable = (next.consignmentPayables ?? []).find((item) => item.id === payableId);
        const fundsAvailable = paymentMethod === 'CASH'
          ? Number.isSafeInteger(next.cashInHandRupiah) && next.cashInHandRupiah >= amount
          : paymentMethod === 'TRANSFER' && next.bankBalanceInitialized === true &&
            Number.isSafeInteger(next.bankBalanceRupiah) && Number(next.bankBalanceRupiah) >= amount;
        if (!payable || payable.status === 'VOIDED' || !Number.isSafeInteger(amount) || amount <= 0 ||
            amount > payable.remainingAmountRupiah || !paymentMethod || !fundsAvailable) {
          conflicts.push({ eventId, reason: 'Pembayaran utang konsinyasi remote tidak valid atau saldo kas/bank perangkat penerima tidak mencukupi.', createdAt: now });
        } else {
          const paid = payable.paidAmountRupiah + amount;
          const remaining = payable.amountRupiah - paid;
          const accountCode = paymentMethod === 'CASH' ? '1101' : '1102';
          const accountName = paymentMethod === 'CASH' ? 'Kas Tunai Toko' : 'Rekening Bank';
          const journal = buildDerivedJournal({
            idempotencyKey: key, referenceNo: payable.invoiceNo, category: 'PEMBAYARAN',
            description: `Pembayaran utang konsinyasi remote kepada ${payable.ownerName}`,
            lines: [
              { accountCode: '2102', accountName: 'Utang Konsinyasi', debit: amount, credit: 0 },
              { accountCode, accountName, debit: 0, credit: amount },
            ],
          });
          next = {
            ...next,
            ...(paymentMethod === 'CASH' ? { cashInHandRupiah: next.cashInHandRupiah - amount } : { bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) - amount }),
            consignmentPayables: (next.consignmentPayables ?? []).map((item) => item.id === payableId
              ? { ...item, paidAmountRupiah: paid, remainingAmountRupiah: remaining, status: remaining === 0 ? 'PAID' : 'PARTIAL' }
              : item),
            journals: [journal, ...next.journals],
            auditTrail: [buildAuditEntry({
              actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_CONSIGNMENT_PAYMENT',
              humanSummary: `Pembayaran konsinyasi Rp ${amount.toLocaleString('id-ID')} kepada ${payable.ownerName} diterapkan dari perangkat lain.`,
              referenceId: payable.invoiceNo,
            }), ...next.auditTrail],
          };
        }
      } else {
        conflicts.push({ eventId, reason: `Jenis event konsinyasi ${String(payload.kind || 'UNKNOWN')} belum didukung.`, createdAt: now });
      }
    } else if (type === 'OPNAME') {
      if (payload.kind === 'OPENING_BANK_BALANCE') {
        const openingBalance = Number(payload.openingBalanceRupiah);
        const referenceNo = String(payload.referenceNo || eventId);
        if (next.bankBalanceInitialized === true || !Number.isSafeInteger(openingBalance) || openingBalance < 0 || hasUnreconciledBankActivity(next)) {
          const reason = hasUnreconciledBankActivity(next)
            ? 'Saldo awal bank remote ditahan karena sudah ada pergerakan bank sebelum rekonsiliasi cut-over.'
            : 'Saldo awal bank remote sudah pernah ditetapkan atau nominalnya tidak valid.';
          conflicts.push({ eventId, reason, createdAt: now });
        } else {
          const openingJournal = openingBalance > 0 ? buildDerivedJournal({
            idempotencyKey: key, referenceNo, category: 'PENYESUAIAN',
            description: 'Pencatatan saldo awal rekening bank remote',
            lines: [
              { accountCode: '1102', accountName: 'Rekening Bank', debit: openingBalance, credit: 0 },
              { accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: openingBalance },
            ],
          }) : null;
          next = {
            ...next,
            bankBalanceRupiah: openingBalance,
            bankBalanceInitialized: true,
            ...(openingJournal ? { journals: [openingJournal, ...next.journals] } : {}),
            auditTrail: [buildAuditEntry({
              actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_OPENING_BANK_BALANCE',
              humanSummary: `Saldo awal bank Rp ${openingBalance.toLocaleString('id-ID')} diterapkan dari perangkat lain.`,
              referenceId: referenceNo,
            }), ...next.auditTrail],
          };
        }
      } else if (payload.kind === 'OPENING_BALANCE_IMPORT') {
        const referenceNo = String(payload.referenceNo || '');
        const importedLots = Array.isArray(payload.lots) ? payload.lots as BatchLotEntity[] : [];
        const importedReceivables = Array.isArray(payload.receivables) ? payload.receivables as ReceivableEntity[] : [];
        const importedSupplierInvoices = Array.isArray(payload.supplierInvoices) ? payload.supplierInvoices as SupplierInvoiceEntity[] : [];
        const cash = Number(payload.cashBalanceRupiah);
        const bank = Number(payload.bankBalanceRupiah);
        const pettyCash = Number(payload.pettyCashBalanceRupiah);
        const committedAt = typeof payload.committedAt === 'string' && Number.isFinite(Date.parse(payload.committedAt)) ? payload.committedAt : now;
        const hasLocalOperations = next.transactions.length > 0 || next.syncOutbox.length > 0 ||
          next.processedIdempotencyKeys.length > 0 ||
          next.stockLedger.some((entry) => !entry.idempotencyKey.startsWith('SEED-')) ||
          next.journals.some((journal) => journal.idempotencyKey !== 'SEED-JOURNAL-01' && journal.referenceNo !== 'OPENING-BAL-01') ||
          next.cashInHandRupiah !== 0 || next.bankBalanceInitialized === true || next.pettyCashBalanceRupiah !== 0;
        const lotIds = new Set<string>();
        const lotCodes = new Set<string>();
        const invalidLot = importedLots.some((lot) => {
          const productExists = next.products.some((product) => product.id === lot.productId);
          const invalid = !lot.id || !lot.code || !productExists ||
            !Number.isSafeInteger(lot.weightGram) || lot.weightGram <= 0 ||
            !Number.isSafeInteger(lot.hppKgRupiah) || lot.hppKgRupiah < 0 ||
            !Number.isSafeInteger(lot.carryingValueRupiah) || (lot.carryingValueRupiah ?? -1) < 0 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(lot.expiryDate) || lot.isQuarantined === true ||
            lotIds.has(lot.id) || lotCodes.has(lot.code);
          lotIds.add(lot.id); lotCodes.add(lot.code);
          return invalid;
        });
        const invalidReceivable = importedReceivables.some((row) =>
          !row.id || !row.invoice || !next.customers.some((customer) => customer.id === row.customerId) ||
          !Number.isSafeInteger(row.amount) || row.amount <= 0 || row.status !== 'BELUM_LUNAS' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)
        );
        const invalidPayable = importedSupplierInvoices.some((row) =>
          !row.id || !row.invoiceNumber || !row.supplier || !row.poNumber ||
          !Number.isSafeInteger(row.totalAmountRupiah) || row.totalAmountRupiah <= 0 ||
          row.paidAmountRupiah !== 0 || row.remainingAmountRupiah !== row.totalAmountRupiah ||
          row.status !== 'BELUM_LUNAS' || !/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)
        );
        if (next.openingBalanceCommittedAt || hasLocalOperations || !referenceNo ||
            ![cash, bank, pettyCash].every((value) => Number.isSafeInteger(value) && value >= 0) ||
            invalidLot || invalidReceivable || invalidPayable) {
          conflicts.push({ eventId, reason: 'Opening Balance remote ditolak: perangkat sudah memiliki aktivitas, lock sudah aktif, atau payload saldo awal tidak valid.', createdAt: now });
        } else {
          const inventoryTotal = importedLots.reduce((sum, lot) => sum + getLotCarryingValueRupiah(lot), 0);
          const receivableTotal = importedReceivables.reduce((sum, row) => sum + row.amount, 0);
          const payableTotal = importedSupplierInvoices.reduce((sum, row) => sum + row.remainingAmountRupiah, 0);
          const assets = inventoryTotal + receivableTotal + cash + bank + pettyCash;
          const equity = assets - payableTotal;
          if (![inventoryTotal, receivableTotal, payableTotal, assets, equity].every(Number.isSafeInteger)) {
            conflicts.push({ eventId, reason: 'Total Opening Balance remote melewati batas integer Rupiah aman.', createdAt: now });
          } else {
            const openingLines: JournalLine[] = [
              ...buildInventoryJournalLines(importedLots.map((lot) => ({ lotId: lot.id, cogsRupiah: getLotCarryingValueRupiah(lot) })), importedLots, 'DEBIT'),
              ...(receivableTotal > 0 ? [{ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: receivableTotal, credit: 0 }] : []),
              ...(cash > 0 ? [{ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: cash, credit: 0 }] : []),
              ...(bank > 0 ? [{ accountCode: '1102', accountName: 'Rekening Bank', debit: bank, credit: 0 }] : []),
              ...(pettyCash > 0 ? [{ accountCode: '1103', accountName: 'Kas Kecil', debit: pettyCash, credit: 0 }] : []),
              ...(payableTotal > 0 ? [{ accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: payableTotal }] : []),
              ...(equity > 0 ? [{ accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: equity }] : equity < 0 ? [{ accountCode: '3101', accountName: 'Modal Awal Usaha', debit: -equity, credit: 0 }] : []),
            ];
            const openingJournal = openingLines.length > 0 ? buildDerivedJournal({
              idempotencyKey: key, referenceNo, category: 'PENYESUAIAN',
              description: 'Jurnal pembukaan saldo awal Go-Live ERP DAGING (sinkronisasi)',
              lines: openingLines,
            }) : undefined;
            const openingLedger: StockLedgerEntry[] = importedLots.map((lot) => ({
              uuid: generateUUID(), idempotencyKey: key, timestamp: committedAt, actorName: 'Perangkat Owner',
              type: 'IN_ADJUST', humanLabel: 'Saldo Awal Go-Live',
              productName: lot.product, lotId: lot.id, lotCode: lot.code,
              weightGramDelta: lot.weightGram, unitCostPerKg: lot.hppKgRupiah,
              valueRupiahDelta: getLotCarryingValueRupiah(lot), movingAvgHppAfterKg: lot.hppKgRupiah,
              referenceNo, note: 'Import saldo stok awal dari perangkat Owner.',
            }));
            const customerReceivableTotals = new Map<string, number>();
            for (const row of importedReceivables) {
              const id = String(row.customerId);
              customerReceivableTotals.set(id, (customerReceivableTotals.get(id) ?? 0) + row.amount);
            }
            next = {
              ...next,
              lots: importedLots,
              products: syncProductsStockFromLots(next.products, importedLots),
              customers: next.customers.map((customer) => ({ ...customer, currentReceivable: customerReceivableTotals.get(customer.id) ?? 0 })),
              receivables: importedReceivables,
              supplierInvoices: importedSupplierInvoices,
              cashInHandRupiah: cash, bankBalanceRupiah: bank, bankBalanceInitialized: true,
              pettyCashBalanceRupiah: pettyCash,
              stockLedger: openingLedger, journals: openingJournal ? [openingJournal] : [],
              openingBalanceCommittedAt: committedAt,
              openingBalanceReferenceNo: referenceNo,
              openingBalanceIdempotencyKey: key,
              auditTrail: [buildAuditEntry({
                actorName: 'Perangkat Owner', actorRole: 'SYSTEM', action: 'SYNC_OPENING_BALANCE_IMPORT',
                humanSummary: `Opening Balance ${referenceNo} diterapkan dari perangkat Owner.`,
                referenceId: referenceNo,
              }), ...next.auditTrail],
            };
          }
        }
      } else if (payload.kind === 'NEW_PRODUCT_OPENING_LOT') {
        const product = payload.product as ProductEntity | undefined;
        const lot = payload.lot as BatchLotEntity | undefined;
        if (!product?.id || !lot?.id || next.products.some((p) => p.id === product.id) || next.lots.some((l) => l.id === lot.id)) {
          conflicts.push({ eventId, reason: 'Produk/lot saldo awal remote tidak lengkap atau sudah ada.', createdAt: now });
        } else {
          const value = Number.isSafeInteger(payload.openingValue) && Number(payload.openingValue) >= 0
             ? Number(payload.openingValue)
             : getLotCarryingValueRupiah(lot);
          const ledger: StockLedgerEntry = { uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: 'IN_PURCHASE', humanLabel: 'Stok awal produk remote', productName: product.name, lotId: lot.id, lotCode: lot.code, weightGramDelta: lot.weightGram, unitCostPerKg: lot.hppKgRupiah, valueRupiahDelta: value, movingAvgHppAfterKg: lot.hppKgRupiah, referenceNo: String(payload.referenceNo || product.sku), note: 'Produk dan lot awal diterapkan dari perangkat lain.' };
          const journal = buildDerivedJournal({ idempotencyKey: key, referenceNo: String(payload.referenceNo || product.sku), category: 'PENYESUAIAN', description: `Saldo awal produk remote ${product.name}`, lines: [...buildInventoryJournalLines([{ lotId: lot.id, cogsRupiah: value }], [lot], 'DEBIT'), { accountCode: '3101', accountName: 'Modal Awal Usaha', debit: 0, credit: value }] });
          const lots = [lot, ...next.lots];
          next = { ...next, products: syncProductsStockFromLots([product, ...next.products], lots), lots, stockLedger: [ledger, ...next.stockLedger], journals: [journal, ...next.journals], auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_PRODUCT_OPENING_REMOTE', humanSummary: `Produk ${product.name} dan stok awal diterapkan dari perangkat lain.`, referenceId: product.sku }), ...next.auditTrail] };
        }
      } else {
        const lotId = String(payload.lotId || '');
        const physical = Number(payload.physicalWeightGram);
        const lot = next.lots.find((item) => item.id === lotId);
        if (!lot || !Number.isSafeInteger(physical) || physical < 0) conflicts.push({ eventId, reason: 'Opname remote tidak cocok dengan lot lokal atau berat tidak valid.', createdAt: now });
        else {
          const diff = physical - lot.weightGram;
          const opnameValuation = adjustLotStockToPhysical(lot, physical);
          const valueDiff = opnameValuation.valueDeltaRupiah;
          const lots = next.lots.map((item) => item.id === lotId ? opnameValuation.lot : item);
          const ledger: StockLedgerEntry = { uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: diff >= 0 ? 'IN_ADJUST' : 'OUT_ADJUST', humanLabel: 'Penyesuaian cek fisik remote', productName: lot.product, lotId, lotCode: lot.code, weightGramDelta: diff, unitCostPerKg: lot.hppKgRupiah, valueRupiahDelta: valueDiff, movingAvgHppAfterKg: lot.hppKgRupiah, referenceNo: String(payload.referenceNo || lot.code), note: String(payload.reason || 'Opname dari perangkat lain') };
          const absValue = Math.abs(valueDiff);
          const journal = absValue > 0 ? buildDerivedJournal({ idempotencyKey: key, referenceNo: String(payload.referenceNo || lot.code), category: 'PENYESUAIAN', description: `Selisih cek fisik remote ${lot.code}`, lines: diff < 0 ? [{ accountCode: '5201', accountName: 'Beban Susut & Selisih Stok', debit: absValue, credit: 0 }, ...buildInventoryJournalLines([{ lotId: lot.id, cogsRupiah: absValue }], next.lots, 'CREDIT')] : [...buildInventoryJournalLines([{ lotId: lot.id, cogsRupiah: absValue }], next.lots, 'DEBIT'), { accountCode: '4201', accountName: 'Penyesuaian Lebih Stok Fisik', debit: 0, credit: absValue }] }) : undefined;
          next = { ...next, lots, products: syncProductsStockFromLots(next.products, lots), stockLedger: [ledger, ...next.stockLedger], journals: journal ? [journal, ...next.journals] : next.journals, auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_STOCK_OPNAME_REMOTE', humanSummary: `Opname ${lot.code}: selisih ${diff} gram dari perangkat lain.`, referenceId: lot.code }), ...next.auditTrail] };
        }
      }
    } else if (type === 'PURCHASE') {
      const po = next.inboundPOs.find((item) => item.id === String(payload.poId || ''));
      const productIndex = po ? matchInboundPurchaseProductIndex(next.products, po) : -1;
      const product = productIndex >= 0 ? next.products[productIndex] : undefined;
      const weight = Number(payload.actualWeightGram);
      const cost = Number(payload.totalLandedCost);
      const remoteLotId = String(payload.lotId || `LOT_REMOTE_${eventId.slice(0, 12)}`);
      const remoteLotCode = String(payload.lotCode || `REMOTE-${po?.poNumber || eventId}`);
      const lotIdentityExists = next.lots.some((item) => item.id === remoteLotId || item.code === remoteLotCode);
      const landedCostComponents = Array.isArray(payload.landedCostComponents)
        ? payload.landedCostComponents as LandedCostComponentEntity[]
        : [];
      const goodsCostRupiah = po ? getPurchaseGoodsCostRupiah(po) : Number.NaN;
      const legacyExtraCost = Number.isSafeInteger(payload.extraCostRupiah)
        ? Number(payload.extraCostRupiah)
        : landedCostComponents.length === 0 && po && Number.isSafeInteger(cost) && Number.isSafeInteger(goodsCostRupiah)
          ? cost - goodsCostRupiah
          : 0;
      const componentTotal = landedCostComponents.reduce((sum, component) => sum + Number(component.amountIdr || 0), 0);
      const expectedCost = po ? goodsCostRupiah + legacyExtraCost + componentTotal : Number.NaN;
      const expectedPaidCash = legacyExtraCost + landedCostComponents
        .filter((component) => component.paymentStatus === 'PAID' && component.paymentMethod === 'CASH')
        .reduce((sum, component) => sum + component.amountIdr, 0);
      const expectedPaidBank = landedCostComponents
        .filter((component) => component.paymentStatus === 'PAID' && component.paymentMethod === 'TRANSFER')
        .reduce((sum, component) => sum + component.amountIdr, 0);
      const expectedPayable = landedCostComponents
        .filter((component) => component.paymentStatus === 'PAYABLE')
        .reduce((sum, component) => sum + component.amountIdr, 0);
      const paidCash = Number.isSafeInteger(payload.paidCashRupiah) ? Number(payload.paidCashRupiah) : expectedPaidCash;
      const paidBank = Number.isSafeInteger(payload.paidBankRupiah) ? Number(payload.paidBankRupiah) : expectedPaidBank;
      const componentIds = new Set<string>();
      const componentInvoiceKeys = new Set<string>();
      const invalidComponents = landedCostComponents.some((component) => {
        const id = String(component.id || ''), vendor = String(component.vendor || '').trim();
        const invoiceReference = String(component.invoiceReference || '').trim();
        const amount = Number(component.amount), amountIdr = Number(component.amountIdr);
        const validFx = component.currency === 'IDR'
          ? amountIdr === amount
          : component.currency === 'USD' && Number.isSafeInteger(component.exchangeRateIdrPerUsd) &&
            Number(component.exchangeRateIdrPerUsd) > 0 && amount * Number(component.exchangeRateIdrPerUsd) === amountIdr;
        const validStatus = component.paymentStatus === 'PAID'
          ? component.paymentMethod === 'CASH' || component.paymentMethod === 'TRANSFER'
          : component.paymentStatus === 'PAYABLE' && /^\d{4}-\d{2}-\d{2}$/.test(String(component.dueDate || ''));
        const invoiceKey = `${vendor.toUpperCase()}::${invoiceReference.toUpperCase()}`;
        const invalid = !id || !vendor || !invoiceReference || !String(component.description || '').trim() ||
          !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(amountIdr) || amountIdr <= 0 ||
          !validFx || !validStatus || componentIds.has(id) || componentInvoiceKeys.has(invoiceKey);
        componentIds.add(id); componentInvoiceKeys.add(invoiceKey);
        return invalid;
      });
      const incomingHppTimes1000 = cost * 1000;
      const cashCanPayExtraCost = Number.isSafeInteger(paidCash) && paidCash >= 0 &&
        (paidCash === 0 || (Number.isSafeInteger(next.cashInHandRupiah) && next.cashInHandRupiah >= paidCash));
      const bankCanPayLandedCost = Number.isSafeInteger(paidBank) && paidBank >= 0 &&
        (paidBank === 0 || (next.bankBalanceInitialized === true && Number.isSafeInteger(next.bankBalanceRupiah) && Number(next.bankBalanceRupiah) >= paidBank));
      const componentTotalsMatch = Number.isSafeInteger(componentTotal) && Number.isSafeInteger(expectedCost) &&
        expectedCost === cost && paidCash === expectedPaidCash && paidBank === expectedPaidBank &&
        expectedPayable + expectedPaidCash + expectedPaidBank === legacyExtraCost + componentTotal;
      if (!po || !product || product.supplyType === 'CONSIGNMENT' || product.supplyType === 'AFFILIATE' || !Number.isSafeInteger(weight) || weight <= 0 ||
          !Number.isSafeInteger(cost) || cost < 0 || !Number.isSafeInteger(goodsCostRupiah) ||
          goodsCostRupiah < 0 || !Number.isSafeInteger(incomingHppTimes1000) ||
          !componentTotalsMatch || invalidComponents || !cashCanPayExtraCost ||
          !bankCanPayLandedCost || lotIdentityExists) {
        const reason = lotIdentityExists
          ? 'ID/kode lot penerimaan remote sudah dipakai; stok tidak ditambahkan.'
          : !cashCanPayExtraCost || !bankCanPayLandedCost
            ? 'Saldo kas/bank perangkat penerima tidak cukup untuk pembayaran landed cost; penerimaan ditahan untuk rekonsiliasi.'
            : 'Penerimaan pembelian remote tidak cocok dengan PO, komponen landed cost, atau nilai Rupiah/Gram lokal.';
        conflicts.push({ eventId, reason, createdAt: now });
      } else {
        const incomingHppPerKg = Math.round(incomingHppTimes1000 / weight);
        if (!Number.isSafeInteger(incomingHppPerKg)) {
          conflicts.push({ eventId, reason: 'HPP pembelian remote melewati batas integer aman.', createdAt: now });
        } else {
          const newMovingAvgHppPerKg = calculateMovingAverageHppPerKg(
            product.stockGram, product.movingAvgHppPerKg, weight, cost
          );
          const lot: BatchLotEntity = {
            id: remoteLotId, code: remoteLotCode,
            product: product.name, productId: String(payload.productId || product.id), daysLeft: 90,
            expiryDate: String(payload.expiryDate || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)),
            weightGram: weight, maxCapacityGram: Math.max(weight, 30000),
            hppKgRupiah: incomingHppPerKg, carryingValueRupiah: cost, loc: String(payload.loc || 'FREEZER-A-01'), isFefo: false, isQuarantined: false,
          };
          const lots = [lot, ...next.lots];
          const purchaseLedger: StockLedgerEntry = { uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: 'IN_PURCHASE', humanLabel: 'Barang masuk pembelian remote', productName: product.name, lotId: lot.id, lotCode: lot.code, weightGramDelta: weight, unitCostPerKg: lot.hppKgRupiah, valueRupiahDelta: cost, movingAvgHppAfterKg: newMovingAvgHppPerKg, referenceNo: po.poNumber, note: `Penerimaan PO ${po.poNumber} dari perangkat lain.` };
          const componentPayableInvoices: SupplierInvoiceEntity[] = landedCostComponents
            .filter((component) => component.paymentStatus === 'PAYABLE')
            .map((component) => ({
              id: component.supplierInvoiceId || `LC-AP-${component.id}`,
              invoiceKind: 'LANDED_COST',
              landedCostComponentId: component.id,
              invoiceNumber: component.invoiceReference,
              poNumber: `LC-${po.poNumber}-${component.id}`,
              supplier: component.vendor,
              supplierPhone: next.supplierPhones?.[component.vendor] || '',
              originCountry: 'Tidak Berlaku',
              totalAmountRupiah: component.amountIdr,
              paidAmountRupiah: 0,
              remainingAmountRupiah: component.amountIdr,
              dueDate: component.dueDate || '',
              daysDiff: computeDaysLeftFromExpiry(component.dueDate),
              status: 'BELUM_LUNAS',
            }));
          const purchaseJournal = buildDerivedJournal({
            idempotencyKey: key, referenceNo: po.poNumber, category: 'PEMBELIAN',
            description: `Penerimaan stok remote ${po.poNumber} dengan landed cost terurai`,
            lines: [
              ...buildInventoryJournalLines([{ lotId: lot.id, cogsRupiah: cost }], [lot], 'DEBIT'),
              { accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: goodsCostRupiah },
              ...(paidCash > 0 ? [{ accountCode: '1101', accountName: 'Kas Tunai Toko', debit: 0, credit: paidCash }] : []),
              ...(paidBank > 0 ? [{ accountCode: '1102', accountName: 'Rekening Bank', debit: 0, credit: paidBank }] : []),
              ...(expectedPayable > 0 ? [{ accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: 0, credit: expectedPayable }] : []),
            ],
          });
          const supplierInvoice = buildSupplierInvoiceForPurchaseReceipt(
            next,
            po,
            String(event.createdAt || now),
            payload.supplierInvoice && typeof payload.supplierInvoice === 'object'
              ? payload.supplierInvoice as Partial<SupplierInvoiceEntity>
              : undefined
          );
          next = {
            ...next, lots,
            cashInHandRupiah: next.cashInHandRupiah - paidCash,
            bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) - paidBank,
            products: syncProductsStockFromLots(next.products.map((p) => p.id === product.id ? { ...p, movingAvgHppPerKg: newMovingAvgHppPerKg } : p), lots),
            inboundPOs: next.inboundPOs.map((item) => item.id === po.id ? { ...item, status: 'SELESAI_BONGKAR', eta: 'Sudah Diterima & Masuk Freezer', landedCostComponents } : item),
            suppliers: [...new Set([...(next.suppliers ?? []), ...landedCostComponents.map((component) => component.vendor)])],
            supplierInvoices: [...componentPayableInvoices, supplierInvoice, ...next.supplierInvoices.filter((invoice) => invoice.poNumber !== po.poNumber)],
            stockLedger: [purchaseLedger, ...next.stockLedger],
            journals: [purchaseJournal, ...next.journals],
            auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_PURCHASE_RECEIVED_REMOTE', humanSummary: `PO ${po.poNumber} diterima dari perangkat lain.`, referenceId: po.poNumber }), ...next.auditTrail],
          };
        }
      }
    } else if (type === 'CONVERSION') {
      const sourceLotId = String(payload.sourceLotId || '');
      const source = next.lots.find((item) => item.id === sourceLotId);
      const inputGram = Math.max(0, Number(payload.inputGram) || 0);
      const primaryGram = Math.max(0, Number(payload.primaryGram) || 0);
      const secondaryGram = Math.max(0, Number(payload.secondaryGram) || 0);
      const usableGram = primaryGram + secondaryGram;
      const lossGram = inputGram - usableGram;
      const consumedSource = source && inputGram > 0 && inputGram <= source.weightGram
         ? consumeLotStock(source, inputGram)
         : undefined;
       const totalRawCost = consumedSource?.cogsRupiah ?? 0;
      const secondaryHpp = 65000;
      const tetelanValue = Math.min(totalRawCost, Math.round((secondaryGram * secondaryHpp) / 1000));
      const primaryNetCost = primaryGram > 0 ? Math.max(0, totalRawCost - tetelanValue) : 0;
      const cuttingLossValue = Math.max(0, totalRawCost - primaryNetCost - tetelanValue);
      const effectiveSteakHpp = primaryGram > 0 ? Math.round((primaryNetCost * 1000) / primaryGram) : (source?.hppKgRupiah ?? 0);
      const effectiveTetelanHpp = secondaryGram > 0 ? Math.round((tetelanValue * 1000) / secondaryGram) : 0;
      const primaryId = String(payload.primaryCutLotId || `LOT_CUT_REMOTE_${eventId.slice(0, 10)}`);
      const primaryCode = String(payload.primaryCutLotCode || `LOT-CUT-${String(payload.referenceNo || eventId)}`);
      const tetelanProductId = String(payload.targetTetelanProductId || 'PROD_03');
      const tetelanProduct = next.products.find((item) => item.id === tetelanProductId);
      const tetelanLotId = String(payload.targetTetelanLotId || 'LOT_03');
      const tetelanLotCode = String(payload.targetTetelanLotCode || 'LOT-TET-REMOTE');
      const primaryIdentityExists = primaryGram > 0 && next.lots.some((item) => item.id === primaryId || item.code === primaryCode);
      const existingTetelanLot = next.lots.find((item) => item.id === tetelanLotId);
      const tetelanTargetInvalid = secondaryGram > 0 && (
        (!existingTetelanLot && (!tetelanProduct || next.lots.some((item) => item.code === tetelanLotCode))) ||
        (existingTetelanLot && existingTetelanLot.productId !== tetelanProductId)
      );
      if (!source || !Number.isSafeInteger(inputGram) || inputGram <= 0 || !Number.isSafeInteger(primaryGram) || primaryGram < 0 || !Number.isSafeInteger(secondaryGram) || secondaryGram < 0 || !Number.isSafeInteger(source.hppKgRupiah) || source.hppKgRupiah < 0 || inputGram > source.weightGram || primaryGram + secondaryGram > inputGram || usableGram + lossGram !== inputGram || (payload.usableOutputGram !== undefined && Number(payload.usableOutputGram) !== usableGram) || (payload.lossGram !== undefined && Number(payload.lossGram) !== lossGram) || primaryIdentityExists || tetelanTargetInvalid) {
        const reason = primaryIdentityExists
          ? 'ID/kode lot hasil utama konversi remote sudah dipakai; konversi tidak diterapkan.'
          : tetelanTargetInvalid
            ? 'Master produk atau lot tujuan tetelan remote tidak cocok; konversi tidak diterapkan.'
            : 'Konversi remote tidak cocok dengan lot sumber atau berat hasil tidak valid.';
        conflicts.push({ eventId, reason, createdAt: now });
      } else {
        let lots = next.lots.map((item) => item.id === source.id ? consumedSource!.lot : item);
        if (primaryGram > 0 && !lots.some((item) => item.id === primaryId)) lots.push({
          id: primaryId, code: primaryCode, product: source.product, productId: source.productId,
          daysLeft: source.daysLeft, expiryDate: source.expiryDate, weightGram: primaryGram,
          maxCapacityGram: Math.max(primaryGram, 30000), hppKgRupiah: effectiveSteakHpp,
          carryingValueRupiah: primaryNetCost, loc: source.loc, isFefo: source.isFefo, isQuarantined: false,
        });
        if (secondaryGram > 0) {
          const tetelan = lots.find((item) => item.id === tetelanLotId);
          if (tetelan) lots = lots.map((item) => item.id === tetelan.id ? addLotStock(item, secondaryGram, tetelanValue) : item);
          else lots.push({ id: tetelanLotId, code: tetelanLotCode, product: String(payload.targetTetelanProductName || tetelanProduct?.name || 'Tetelan'), productId: tetelanProductId, daysLeft: source.daysLeft, expiryDate: source.expiryDate, weightGram: secondaryGram, maxCapacityGram: Math.max(secondaryGram, 60000), hppKgRupiah: effectiveTetelanHpp, carryingValueRupiah: tetelanValue, loc: 'FREEZER-B-01', isFefo: false, isQuarantined: false });
        }
        const conversionLedger: StockLedgerEntry[] = [
          ...(usableGram > 0 ? [{ uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: 'OUT_CONVERSION' as const, humanLabel: 'Pemotongan remote', productName: source.product, lotId: source.id, lotCode: source.code, weightGramDelta: -usableGram, unitCostPerKg: source.hppKgRupiah, valueRupiahDelta: -(primaryNetCost + tetelanValue), movingAvgHppAfterKg: effectiveSteakHpp, referenceNo: String(payload.referenceNo || eventId), note: 'Bahan baku dipotong dari perangkat lain.' }] : []),
          ...(primaryGram > 0 ? [{ uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: 'IN_CONVERSION' as const, humanLabel: 'Hasil potongan utama remote', productName: source.product, lotId: primaryId, lotCode: primaryCode, weightGramDelta: primaryGram, unitCostPerKg: effectiveSteakHpp, valueRupiahDelta: primaryNetCost, movingAvgHppAfterKg: effectiveSteakHpp, referenceNo: String(payload.referenceNo || eventId), note: 'Lot hasil potongan utama dari perangkat lain.' }] : []),
          ...(secondaryGram > 0 ? [{ uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: 'IN_CONVERSION' as const, humanLabel: 'Hasil tetelan remote', productName: String(payload.targetTetelanProductName || tetelanProduct?.name || 'Tetelan'), lotId: tetelanLotId, lotCode: tetelanLotCode, weightGramDelta: secondaryGram, unitCostPerKg: secondaryHpp, valueRupiahDelta: tetelanValue, movingAvgHppAfterKg: secondaryHpp, referenceNo: String(payload.referenceNo || eventId), note: 'Hasil tetelan dari perangkat lain.' }] : []),
          ...(lossGram > 0 ? [{ uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain', type: 'OUT_CUTTING_LOSS' as const, humanLabel: 'Susut pemotongan remote', productName: source.product, lotId: source.id, lotCode: source.code, weightGramDelta: -lossGram, unitCostPerKg: 0, valueRupiahDelta: -cuttingLossValue, movingAvgHppAfterKg: effectiveSteakHpp, referenceNo: String(payload.referenceNo || eventId), note: 'Susut pemotongan dicatat dari perangkat lain.' }] : []),
        ];
        const conversionLines = usableGram === 0
          ? [{ accountCode: '5201', accountName: 'Beban Susut & Pemotongan', debit: totalRawCost, credit: 0 }, ...buildInventoryJournalLines([{ lotId: source.id, cogsRupiah: totalRawCost }], next.lots, 'CREDIT')]
          : [
              ...(primaryNetCost > 0 ? [{ accountCode: '1302', accountName: 'Persediaan Daging Steak Siap Jual', debit: primaryNetCost, credit: 0 }] : []),
              ...(tetelanValue > 0 ? [{ accountCode: '1303', accountName: 'Persediaan Tetelan Hasil Potong', debit: tetelanValue, credit: 0 }] : []),
              ...(cuttingLossValue > 0 ? [{ accountCode: '5201', accountName: 'Beban Susut & Pemotongan', debit: cuttingLossValue, credit: 0 }] : []),
              ...buildInventoryJournalLines([{ lotId: source.id, cogsRupiah: totalRawCost }], next.lots, 'CREDIT'),
            ];
        const conversionJournal = buildDerivedJournal({ idempotencyKey: key, referenceNo: String(payload.referenceNo || eventId), category: 'PENGOLAHAN', description: `Pengolahan remote ${source.product}`, lines: conversionLines });
        const updatedProducts = syncProductsStockFromLots(next.products.map((p) => p.id === tetelanProductId && secondaryGram > 0 ? { ...p, movingAvgHppPerKg: calculateMovingAverageHppPerKg(p.stockGram, p.movingAvgHppPerKg, secondaryGram, tetelanValue) } : p), lots);
        next = { ...next, lots, products: updatedProducts, stockLedger: [...conversionLedger, ...next.stockLedger], journals: [conversionJournal, ...next.journals], auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_CONVERSION_REMOTE', humanSummary: `Konversi ${source.code} diterapkan dari perangkat lain.`, referenceId: String(payload.referenceNo || eventId) }), ...next.auditTrail] };
      }
    } else if (type === 'SALES_STOCK' && payload.kind === 'CONSIGNMENT_RECEIVED') {
      const row = payload.lot && typeof payload.lot === 'object' ? payload.lot as Record<string, unknown> : null;
      const id = String(row?.id || ''), code = String(row?.code || ''), productId = String(row?.productId || '');
      const duplicate = next.lots.some((lot) => lot.id === id || lot.code.toLowerCase() === code.toLowerCase());
      if (!row || !id || !code || !next.products.some((product) => product.id === productId) ||
          !Number.isSafeInteger(row.weightGram) || Number(row.weightGram) <= 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(String(row.expiryDate || '')) || duplicate) {
        conflicts.push({ eventId, reason: 'Proyeksi stok konsinyasi ke Sales tidak valid atau lot sudah terdaftar.', createdAt: now });
      } else {
        const lot: BatchLotEntity = {
          id, code, product: String(row.product || ''), productId,
          daysLeft: Number(row.daysLeft) || 0, expiryDate: String(row.expiryDate),
          weightGram: Number(row.weightGram), maxCapacityGram: Number(row.maxCapacityGram) || Number(row.weightGram),
          hppKgRupiah: 0, loc: String(row.loc || ''),
          isFefo: row.isFefo === true, isQuarantined: row.isQuarantined === true,
        };
        next = {
          ...next, lots: [lot, ...next.lots],
          products: syncProductsStockFromLots(next.products, [lot, ...next.lots]),
        };
      }
    } else if (type === 'SALES_STOCK' && payload.kind === 'OPENING_BALANCE_IMPORT') {
      const rows = Array.isArray(payload.lots) ? payload.lots as Array<Record<string, unknown>> : [];
      const ids = new Set<string>();
      const codes = new Set<string>();
      const invalid = rows.some((row) => {
        const id = String(row.id || ''), code = String(row.code || ''), productId = String(row.productId || '');
        const invalidRow = !id || !code || !next.products.some((product) => product.id === productId) ||
          !Number.isSafeInteger(row.weightGram) || Number(row.weightGram) <= 0 ||
          !Number.isSafeInteger(row.maxCapacityGram) || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.expiryDate || '')) ||
          ids.has(id) || codes.has(code);
        ids.add(id); codes.add(code);
        return invalidRow;
      });
      const hasPendingLocalSales = next.transactions.length > 0 ||
        next.syncOutbox.some((item) => item.entityType === 'SALE' && item.status !== 'SYNCED');
      if (invalid || hasPendingLocalSales) {
        conflicts.push({ eventId, reason: 'Proyeksi Opening Balance ditolak karena lot tidak valid atau perangkat Sales sudah memiliki transaksi lokal.', createdAt: now });
      } else {
        const lots: BatchLotEntity[] = rows.map((row) => ({
          id: String(row.id), code: String(row.code), product: String(row.product || ''),
          productId: String(row.productId), daysLeft: Number(row.daysLeft) || 0,
          expiryDate: String(row.expiryDate), weightGram: Number(row.weightGram),
          maxCapacityGram: Number(row.maxCapacityGram), hppKgRupiah: 0,
          loc: String(row.loc || ''), isFefo: row.isFefo === true, isQuarantined: row.isQuarantined === true,
        }));
        next = {
          ...next, lots, products: syncProductsStockFromLots(next.products, lots),
          auditTrail: [buildAuditEntry({
            actorName: 'Sistem', actorRole: 'SYSTEM', action: 'SYNC_OPENING_STOCK_SALES',
            humanSummary: 'Saldo stok awal Go-Live diterapkan ke proyeksi perangkat Sales tanpa data biaya.',
            referenceId: String(payload.referenceNo || eventId),
          }), ...next.auditTrail],
        };
      }
    } else if (type === 'SALES_STOCK' && (payload.kind === 'SALE_STOCK_OUT' || payload.kind === 'VOID_STOCK_IN')) {
      const isStockOut = payload.kind === 'SALE_STOCK_OUT';
      const allocations = Array.isArray(payload.lotAllocations) ? payload.lotAllocations : [];
      if (!allocations.length) {
        conflicts.push({ eventId, reason: 'Proyeksi perubahan stok Sales tidak memiliki alokasi lot.', createdAt: now });
      } else {
        let lots = [...next.lots];
        const ledger: StockLedgerEntry[] = [];
        for (const allocation of allocations as Array<Record<string, unknown>>) {
          const lotId = String(allocation.lotId || '');
          const requestedGram = Number(allocation.weightGram);
          const lotIndex = lots.findIndex((item) => item.id === lotId);
          if (!lotId || !Number.isSafeInteger(requestedGram) || requestedGram <= 0 || lotIndex < 0) {
            conflicts.push({ eventId, reason: 'Lot pada proyeksi stok Sales tidak ditemukan atau bobot tidak valid.', createdAt: now });
            continue;
          }
          const lot = lots[lotIndex];
          const appliedGram = isStockOut ? Math.min(lot.weightGram, requestedGram) : requestedGram;
          if (isStockOut && appliedGram < requestedGram) {
            conflicts.push({ eventId, reason: `Stok lot ${lot.code} tidak cukup untuk penjualan perangkat lain; sisa stok diset nol.`, createdAt: now });
          }
          const delta = isStockOut ? -appliedGram : appliedGram;
          lots[lotIndex] = { ...lot, weightGram: Math.max(0, lot.weightGram + delta) };
          ledger.push({
            uuid: generateUUID(), idempotencyKey: key, timestamp: String(event.createdAt || now),
            actorName: 'Sistem', type: isStockOut ? 'OUT_SALE' : 'IN_VOID_REVERSAL',
            humanLabel: isStockOut ? 'Perubahan stok penjualan' : 'Pemulihan stok pembatalan',
            productName: String(allocation.productName || lot.product), lotId, lotCode: String(allocation.lotCode || lot.code),
            weightGramDelta: delta, unitCostPerKg: 0, valueRupiahDelta: 0,
            movingAvgHppAfterKg: 0, referenceNo: '', note: 'Delta stok bersama tanpa detail transaksi Sales lain.',
          });
        }
        next = { ...next, lots, products: syncProductsStockFromLots(next.products, lots), stockLedger: [...ledger, ...next.stockLedger] };
      }
    } else if (type === 'SALES_STOCK' && payload.kind === 'PURCHASE_RECEIVED') {
      const productId = String(payload.productId || '');
      const product = next.products.find((item) => item.id === productId);
      const lotId = String(payload.lotId || '');
      const lotCode = String(payload.lotCode || '');
      const weightGram = Number(payload.weightGram);
      if (!product || !lotId || !lotCode || !Number.isSafeInteger(weightGram) || weightGram <= 0 ||
          next.lots.some((item) => item.id === lotId || item.code === lotCode)) {
        conflicts.push({ eventId, reason: 'Proyeksi stok masuk tidak cocok dengan master produk atau ID lot sudah dipakai.', createdAt: now });
      } else {
        const expiryDate = String(payload.expiryDate || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10));
        const daysLeft = Math.max(0, Math.ceil((Date.parse(expiryDate) - Date.parse(now.slice(0, 10))) / 86400000));
        const lot: BatchLotEntity = {
          id: lotId, code: lotCode, product: product.name, productId,
          daysLeft, expiryDate, weightGram, maxCapacityGram: Math.max(weightGram, 30000),
          hppKgRupiah: 0, loc: String(payload.loc || 'FREEZER-A-01'),
          isFefo: false, isQuarantined: false,
        };
        const lots = [lot, ...next.lots];
        next = {
          ...next,
          lots,
          products: syncProductsStockFromLots(next.products, lots),
          stockLedger: [{
            uuid: generateUUID(), idempotencyKey: key, timestamp: String(event.createdAt || now),
            actorName: 'Sistem', type: 'IN_PURCHASE', humanLabel: 'Stok masuk (proyeksi Sales)',
            productName: product.name, lotId, lotCode, weightGramDelta: weightGram,
            unitCostPerKg: 0, valueRupiahDelta: 0, movingAvgHppAfterKg: 0,
            referenceNo: lotCode, note: 'Proyeksi stok tanpa data biaya.',
          }, ...next.stockLedger],
        };
      }
    } else if (type === 'PAYMENT' && payload.kind === 'SUPPLIER_PAYMENT') {
      const invoiceId = String(payload.invoiceId || '');
      const amount = Number(payload.amountPaidRupiah);
      const invoice = next.supplierInvoices.find((item) => item.id === invoiceId);
      const method = payload.paymentMethod === 'CASH' ? 'CASH' : 'TRANSFER';
      const available = method === 'CASH' ? next.cashInHandRupiah : (next.bankBalanceInitialized === true ? next.bankBalanceRupiah : undefined);
      if (!invoice || !Number.isSafeInteger(amount) || amount <= 0 || amount > invoice.remainingAmountRupiah) {
        conflicts.push({ eventId, reason: 'Pembayaran supplier remote tidak cocok dengan sisa utang lokal.', createdAt: now });
      } else if (available === undefined || available < amount) {
        conflicts.push({ eventId, reason: method === 'CASH'
          ? 'Saldo kas utama tidak mencukupi untuk pembayaran supplier remote; transaksi ditahan untuk rekonsiliasi.'
          : 'Saldo awal/saldo bank tidak tersedia atau tidak mencukupi untuk pembayaran supplier remote; transaksi ditahan untuk rekonsiliasi.', createdAt: now });
      } else {
        const paid = invoice.paidAmountRupiah + amount;
        const remaining = Math.max(0, invoice.totalAmountRupiah - paid);
        const accountCode = method === 'CASH' ? '1101' : '1102';
        const accountName = method === 'CASH' ? 'Kas Tunai Toko' : 'Rekening Bank';
        const supplierJournal = buildDerivedJournal({
          idempotencyKey: key, referenceNo: invoice.invoiceNumber, category: 'PEMBAYARAN',
          description: `Pembayaran utang supplier remote ${invoice.invoiceNumber}`,
          lines: [
            { accountCode: '2101', accountName: 'Utang Pembelian Supplier', debit: amount, credit: 0 },
            { accountCode, accountName, debit: 0, credit: amount },
          ],
        });
        next = {
          ...next,
          supplierInvoices: next.supplierInvoices.map((item) => item.id === invoiceId ? { ...item, paidAmountRupiah: paid, remainingAmountRupiah: remaining, status: remaining === 0 ? 'LUNAS' : 'CICILAN' } : item),
          ...(method === 'CASH'
            ? { cashInHandRupiah: next.cashInHandRupiah - amount }
            : { bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) - amount }),
          journals: [supplierJournal, ...next.journals],
          auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_SUPPLIER_PAYMENT', humanSummary: `Pembayaran supplier ${invoice.invoiceNumber} Rp ${amount.toLocaleString('id-ID')} dari ${method === 'CASH' ? 'kas utama' : 'bank'} diterapkan dari perangkat lain.${payload.paymentReference ? ` Ref: ${String(payload.paymentReference)}.` : ''}${payload.notes ? ` Catatan: ${String(payload.notes)}.` : ''}`, referenceId: invoice.invoiceNumber }), ...next.auditTrail],
        };
      }
    } else if (type === 'PAYMENT' && payload.kind === 'PETTY_CASH_TOP_UP') {
      const amount = Number(payload.amountRupiah);
      const source = payload.source === 'KAS_UTAMA' || payload.source === 'BANK' ? payload.source : '';
      const available = source === 'KAS_UTAMA'
        ? next.cashInHandRupiah
        : source === 'BANK' && next.bankBalanceInitialized === true
          ? next.bankBalanceRupiah
          : undefined;
      if (!Number.isSafeInteger(amount) || amount <= 0 || !source || available === undefined || available < amount) {
        conflicts.push({
          eventId,
          reason: 'Isi kas kecil remote memiliki nominal/sumber dana tidak valid atau saldo sumber tidak tersedia/mencukupi.',
          createdAt: now,
        });
      } else {
        const sourceAccountCode = source === 'KAS_UTAMA' ? '1101' : '1102';
        const sourceAccountName = source === 'KAS_UTAMA' ? 'Kas Utama' : 'Bank Usaha';
        const topUpJournal = buildDerivedJournal({
          idempotencyKey: key,
          referenceNo: key,
          category: 'PEMBAYARAN',
          description: `Transfer isi saldo kas kecil remote dari ${sourceAccountName}`,
          lines: [
            { accountCode: '1103', accountName: 'Kas Kecil Toko', debit: amount, credit: 0 },
            { accountCode: sourceAccountCode, accountName: sourceAccountName, debit: 0, credit: amount },
          ],
        });
        next = {
          ...next,
          cashInHandRupiah: source === 'KAS_UTAMA' ? next.cashInHandRupiah - amount : next.cashInHandRupiah,
          bankBalanceRupiah: source === 'BANK' ? (next.bankBalanceRupiah ?? 0) - amount : next.bankBalanceRupiah,
          pettyCashBalanceRupiah: next.pettyCashBalanceRupiah + amount,
          journals: [topUpJournal, ...next.journals],
          auditTrail: [buildAuditEntry({
            actorName: 'Perangkat lain',
            actorRole: 'SYSTEM',
            action: 'SYNC_PETTY_CASH_TOP_UP',
            humanSummary: `Isi kas kecil remote Rp ${amount.toLocaleString('id-ID')} dari ${sourceAccountName}.`,
            referenceId: key,
          }), ...next.auditTrail],
        };
      }
    } else if (type === 'PAYMENT' && payload.kind === 'PETTY_CASH_OPEX') {
      const amount = Number(payload.amountRupiah);
      const voucherNo = String(payload.voucherNo || '').trim();
      const category = String(payload.category || '');
      const categoryLabel = String(payload.categoryLabel || '').trim();
      const recipient = String(payload.recipient || '').trim();
      const description = String(payload.desc || '').trim();
      const validCategories = ['COLD_CHAIN', 'PACKAGING', 'LOGISTICS', 'OPERATIONAL', 'MAINTENANCE'];
      if (!Number.isSafeInteger(amount) || amount <= 0 || !voucherNo || !categoryLabel || !recipient || !description ||
          !validCategories.includes(category) || next.pettyCashVouchers.some((voucher) => voucher.voucherNo === voucherNo)) {
        conflicts.push({ eventId, reason: 'Biaya kas kecil remote tidak valid atau nomor voucher sudah digunakan.', createdAt: now });
      } else if (amount > next.pettyCashBalanceRupiah) {
        conflicts.push({ eventId, reason: 'Saldo kas kecil lokal tidak mencukupi untuk biaya remote; transaksi ditahan untuk rekonsiliasi.', createdAt: now });
      } else {
        const timestamp = String(event.createdAt || now);
        const opexJournal = buildDerivedJournal({
          idempotencyKey: key,
          referenceNo: voucherNo,
          category: 'BIAYA',
          description: `Biaya toko remote (${categoryLabel}): ${description}`,
          lines: [
            { accountCode: '6101', accountName: `Biaya ${categoryLabel}`, debit: amount, credit: 0 },
            { accountCode: '1103', accountName: 'Kas Kecil Toko', debit: 0, credit: amount },
          ],
        });
        const voucherRecord: PettyCashVoucherEntity = {
          id: key,
          voucherNo,
          category: category as PettyCashVoucherEntity['category'],
          categoryLabel,
          amountRupiah: amount,
          recipient,
          description,
          timestamp,
          paidBy: 'Perangkat lain',
          journalRef: opexJournal.uuid,
        };
        next = {
          ...next,
          pettyCashBalanceRupiah: next.pettyCashBalanceRupiah - amount,
          pettyCashSpentTodayRupiah: next.pettyCashSpentTodayRupiah + amount,
          pettyCashVouchers: [voucherRecord, ...next.pettyCashVouchers],
          journals: [opexJournal, ...next.journals],
          auditTrail: [buildAuditEntry({
            actorName: 'Perangkat lain',
            actorRole: 'SYSTEM',
            action: 'SYNC_PETTY_CASH_OPEX',
            humanSummary: `Biaya kas kecil remote ${categoryLabel} Rp ${amount.toLocaleString('id-ID')} untuk ${recipient}.`,
            referenceId: voucherNo,
          }), ...next.auditTrail],
        };
      }
    } else if (type === 'RETURN') {
      const invoiceNo = String(payload.invoiceNo || ''), productId = String(payload.productId || ''), weightGram = Number(payload.weightGram);
      const invoice = next.transactions.find((tx) => tx.invoiceNumber === invoiceNo && tx.status === 'COMPLETED');
      const soldLine = invoice?.items.find((item) => item.productId === productId);
      const soldWeightGram = invoice?.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + item.weightGram, 0) ?? 0;
      const priorReturned = (next.customerReturns ?? []).filter((r) => r.invoiceNo === invoiceNo && r.productId === productId).reduce((sum, r) => sum + r.weightGram, 0);
      const invoiceReceivables = next.receivables.filter((receivable) =>
        receivable.invoice === invoiceNo && receivable.status !== 'LUNAS'
      );
      const availableInvoiceReceivable = invoiceReceivables.reduce((sum, receivable) => sum + receivable.amount, 0);
      const returnCustomer = invoice?.customerId
        ? next.customers.find((customer) => customer.id === invoice.customerId)
        : undefined;
      const requestedResolution = payload.resolution === 'TUKAR_BARANG' || payload.resolution === 'REFUND_KAS' ? payload.resolution : 'CREDIT_NOTE';
      const requestedRefund = Number(payload.estimatedRefundValue);
      const invalidRefundSource = requestedResolution === 'REFUND_KAS'
        ? !Number.isSafeInteger(requestedRefund) || requestedRefund < 0 ||
          !Number.isSafeInteger(next.cashInHandRupiah) || next.cashInHandRupiah < requestedRefund
        : requestedResolution === 'CREDIT_NOTE'
          ? !Number.isSafeInteger(requestedRefund) || requestedRefund < 0 ||
            invoiceReceivables.some((receivable) => !Number.isSafeInteger(receivable.amount) || receivable.amount < 0) ||
            !Number.isSafeInteger(availableInvoiceReceivable) || availableInvoiceReceivable < requestedRefund ||
            !returnCustomer || !Number.isSafeInteger(returnCustomer.currentReceivable) || returnCustomer.currentReceivable < requestedRefund
          : false;
      if (!invoice || !soldLine || !Number.isSafeInteger(weightGram) || weightGram <= 0 ||
          !Number.isSafeInteger(soldWeightGram) || soldWeightGram <= 0 ||
          !Number.isSafeInteger(priorReturned) || priorReturned < 0 ||
          !Number.isSafeInteger(priorReturned + weightGram) || priorReturned + weightGram > soldWeightGram || invalidRefundSource) {
        conflicts.push({ eventId, reason: 'Retur remote tidak cocok dengan faktur/produk atau melebihi sisa kuantitas faktur.', createdAt: now });
      } else {
        const returnNumber = String(payload.returnNumber || eventId), product = next.products.find((p) => p.id === productId);
        const refund = Number.isSafeInteger(requestedRefund) && requestedRefund >= 0 ? requestedRefund : 0;
        const resolution = requestedResolution;
        const returnedCogsRupiah = calculateInvoiceProductReturnCogs(invoice, productId, weightGram, priorReturned);
        const returnHpp = weightGram > 0 ? Math.round((returnedCogsRupiah * 1000) / weightGram) : 0;
        const quarantineLot: BatchLotEntity = { id: `LOT_QR_REMOTE_${eventId.slice(0, 12)}`, code: returnNumber, product: `${String(payload.productName || product?.name || 'Produk')} (Karantina Retur)`, productId, daysLeft: 0, expiryDate: now.slice(0, 10), weightGram, maxCapacityGram: Math.max(30000, weightGram), hppKgRupiah: returnHpp, carryingValueRupiah: returnedCogsRupiah, loc: 'CHILLER-ISOLASI-01', isFefo: false, isQuarantined: true };
        const returnLedger: StockLedgerEntry = { uuid: generateUUID(), idempotencyKey: key, timestamp: String(event.createdAt || now), actorName: 'Perangkat lain', type: 'IN_RETURN', humanLabel: 'Retur remote masuk karantina', productName: product?.name || String(payload.productName || 'Produk'), lotId: quarantineLot.id, lotCode: returnNumber, weightGramDelta: weightGram, unitCostPerKg: returnHpp, valueRupiahDelta: returnedCogsRupiah, movingAvgHppAfterKg: returnHpp, referenceNo: returnNumber, note: 'Retur diterapkan dari perangkat lain; lot tetap dikarantina.' };
        const replacementAllocs = resolution === 'TUKAR_BARANG' && Array.isArray(payload.replacementAllocs) ? payload.replacementAllocs : [];
        let lots = [quarantineLot, ...next.lots];
        const replacementDeficits: string[] = [];
        const replacementDemand = new Map<string, number>();
        for (const allocation of replacementAllocs) {
          const lotId = String(allocation.lotId || '');
          const grams = Number(allocation.weightGram);
          if (!lotId || !Number.isSafeInteger(grams) || grams <= 0) {
            replacementDeficits.push(String(allocation.lotCode || lotId || 'alokasi lot tidak valid'));
            continue;
          }
          replacementDemand.set(lotId, (replacementDemand.get(lotId) ?? 0) + grams);
        }
        for (const [lotId, grams] of replacementDemand) {
          const replacementLot = lots.find((lot) => lot.id === lotId);
          if (!replacementLot || replacementLot.weightGram < grams) {
            replacementDeficits.push(String(replacementLot?.code || lotId));
          }
        }
        // Pengambilan stok barang pengganti harus atomik: jangan kurangi sebagian lot jika alokasi lain gagal.
        if (resolution === 'TUKAR_BARANG' && replacementAllocs.length === 0) replacementDeficits.push('alokasi barang pengganti tidak tersedia');
        let replacementCogs = 0;
        const replacementCostAllocations: Array<{ lotId: string; cogsRupiah: number; weightGram: number }> = [];
        if (replacementDeficits.length === 0) {
          for (const [lotId, grams] of replacementDemand) {
            const lotIndex = lots.findIndex((lot) => lot.id === lotId);
            if (lotIndex < 0) { replacementDeficits.push(lotId); break; }
            const consumed = consumeLotStock(lots[lotIndex], grams);
            lots[lotIndex] = consumed.lot;
            replacementCogs += consumed.cogsRupiah;
            replacementCostAllocations.push({ lotId, weightGram: grams, cogsRupiah: consumed.cogsRupiah });
          }
        }
        if (!Number.isSafeInteger(replacementCogs)) replacementDeficits.push('nilai HPP pengganti melewati batas integer aman');
        const replacementLedgerEntries: StockLedgerEntry[] = replacementCostAllocations.flatMap((allocation) => {
          const replacementLot = next.lots.find((lot) => lot.id === allocation.lotId);
          if (!replacementLot) return [];
          const grams = replacementDemand.get(allocation.lotId) ?? 0;
          return [{
            uuid: generateUUID(), idempotencyKey: key, timestamp: String(event.createdAt || now),
            actorName: 'Perangkat lain', type: 'OUT_ADJUST', humanLabel: 'Pengeluaran Stok Tukar Barang',
            productName: replacementLot.product, lotId: replacementLot.id, lotCode: replacementLot.code,
            weightGramDelta: -grams, unitCostPerKg: replacementLot.hppKgRupiah,
            valueRupiahDelta: -allocation.cogsRupiah,
            movingAvgHppAfterKg: product?.movingAvgHppPerKg ?? replacementLot.hppKgRupiah,
            referenceNo: returnNumber, note: `Stok pengganti retur faktur ${invoiceNo}`,
          }];
        });
        const returnJournalLines: JournalLine[] = [];
        if (resolution === 'TUKAR_BARANG') {
          if (returnedCogsRupiah > 0) returnJournalLines.push(
            { accountCode: '1304', accountName: 'Persediaan Karantina Retur', debit: returnedCogsRupiah, credit: 0 },
            { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: returnedCogsRupiah },
          );
          if (replacementCogs > 0) returnJournalLines.push(
            { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: replacementCogs, credit: 0 },
            ...buildInventoryJournalLines(replacementCostAllocations, next.lots, 'CREDIT'),
          );
        } else {
          returnJournalLines.push(
            { accountCode: '4103', accountName: 'Potongan & Retur Penjualan', debit: refund, credit: 0 },
            { accountCode: resolution === 'CREDIT_NOTE' ? '1201' : '1101', accountName: resolution === 'CREDIT_NOTE' ? 'Piutang Pelanggan' : 'Kas Tunai', debit: 0, credit: refund },
          );
          if (returnedCogsRupiah > 0) returnJournalLines.push(
            { accountCode: '1304', accountName: 'Persediaan Karantina Retur', debit: returnedCogsRupiah, credit: 0 },
            { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: returnedCogsRupiah },
          );
        }
        if (returnJournalLines.length === 0) returnJournalLines.push(
          { accountCode: '1304', accountName: 'Persediaan Karantina Retur', debit: 0, credit: 0 },
          { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: 0 },
        );
        const returnJournal = buildDerivedJournal({
          idempotencyKey: key, referenceNo: returnNumber, category: 'PENJUALAN',
          description: `Retur remote ${returnNumber} dari ${invoice.customerName}`,
          lines: returnJournalLines,
        });
        let remainingCredit = resolution === 'CREDIT_NOTE' ? refund : 0;
        const updatedReceivables = next.receivables.map((receivable) => {
          if (remainingCredit <= 0 || receivable.status === 'LUNAS' || receivable.invoice !== invoiceNo) return receivable;
          const applied = Math.min(receivable.amount, remainingCredit);
          remainingCredit -= applied;
          const nextAmount = receivable.amount - applied;
          return { ...receivable, amount: nextAmount, status: nextAmount === 0 ? 'LUNAS' as const : receivable.status };
        });
        next = {
          ...next, lots, products: syncProductsStockFromLots(next.products, lots),
          stockLedger: [...replacementLedgerEntries, returnLedger, ...next.stockLedger],
          journals: returnJournal ? [returnJournal, ...next.journals] : next.journals,
          auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_RETURN_REMOTE', humanSummary: `Retur ${returnNumber} diterapkan dan dikarantina dari perangkat lain.`, referenceId: returnNumber }), ...next.auditTrail],
          customerReturns: [{ id: returnNumber, invoiceNo, customerId: invoice.customerId, productId, weightGram, refundValueRupiah: refund, resolution, createdAt: String(event.createdAt || now), evidenceMediaId: typeof payload.evidenceMediaId === 'string' ? payload.evidenceMediaId : undefined }, ...(next.customerReturns ?? [])],
          cashInHandRupiah: next.cashInHandRupiah - (resolution === 'REFUND_KAS' ? refund : 0),
          customers: next.customers.map((c) => c.id === invoice.customerId && resolution === 'CREDIT_NOTE' ? { ...c, currentReceivable: c.currentReceivable - refund } : c),
          receivables: updatedReceivables,
        };
        if (replacementDeficits.length) conflicts.push({ eventId, reason: `Stok barang pengganti tidak cukup: ${replacementDeficits.join(', ')}.`, createdAt: now });
      }
    } else if (type === 'SALES_VOID') {
      const txUuid = String(payload.transactionUuid || '');
      const tx = next.transactions.find((item) => item.uuid === txUuid || item.invoiceNumber === payload.invoiceNumber);
      if (!tx || tx.status === 'VOIDED') {
        conflicts.push({ eventId, reason: 'Status void Sales tidak memiliki transaksi aktif yang cocok.', createdAt: now });
      } else {
        const allocations = tx.remoteStockAppliedAllocations ?? tx.lotAllocations;
        const lots = next.lots.map((lot) => {
          const restored = allocations.filter((item) => item.lotId === lot.id).reduce((sum, item) => sum + item.weightGram, 0);
          return restored > 0 ? { ...lot, weightGram: lot.weightGram + restored } : lot;
        });
        const due = Math.max(0, Number(tx.balanceDueRupiah) || 0);
        next = {
          ...next,
          lots,
          products: syncProductsStockFromLots(next.products, lots),
          transactions: next.transactions.map((item) => item.uuid === tx.uuid ? { ...item, status: 'VOIDED', voidReason: String(payload.reason || 'Void dari Owner') } : item),
          customers: next.customers.map((customer) => customer.id === tx.customerId
            ? { ...customer, currentReceivable: Math.max(0, customer.currentReceivable - due) } : customer),
          receivables: next.receivables.map((receivable) => receivable.invoice === tx.invoiceNumber
            ? { ...receivable, amount: 0, status: 'LUNAS' } : receivable),
          stockLedger: [...allocations.map((allocation) => ({
            uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Sistem',
            type: 'IN_VOID_REVERSAL' as const, humanLabel: 'Pemulihan stok void (proyeksi Sales)',
            productName: allocation.productName || 'Produk', lotId: allocation.lotId, lotCode: allocation.lotCode,
            weightGramDelta: allocation.weightGram, unitCostPerKg: 0, valueRupiahDelta: 0,
            movingAvgHppAfterKg: 0, referenceNo: tx.invoiceNumber, note: 'Stok dipulihkan tanpa data biaya.',
          })), ...next.stockLedger],
        };
      }
    } else if (type === 'VOID') {
      const txUuid = String(payload.transactionUuid || ''), tx = next.transactions.find((item) => item.uuid === txUuid || item.invoiceNumber === payload.invoiceNumber);
      if (!tx || tx.status === 'VOIDED') conflicts.push({ eventId, reason: 'Pembatalan remote tidak memiliki transaksi aktif yang cocok.', createdAt: now });
      else if ((next.consignmentPayables ?? []).some((payable) => payable.invoiceNo === tx.invoiceNumber && payable.paidAmountRupiah > 0 && payable.status !== 'VOIDED')) {
        conflicts.push({ eventId, reason: `Utang konsinyasi faktur ${tx.invoiceNumber} sudah dibayar sebagian/penuh; VOID remote ditahan untuk reversal settlement manual.`, createdAt: now });
      } else if ((next.receivablePayments ?? []).some((payment) => payment.invoice === tx.invoiceNumber && !payment.reversedAt)) {
        conflicts.push({ eventId, reason: `Faktur ${tx.invoiceNumber} sudah menerima pembayaran piutang setelah transaksi; void remote tidak diterapkan otomatis agar kas/bank dan jurnal pembayaran tidak menjadi tidak seimbang. Perlu rekonsiliasi/refund manual.`, createdAt: now });
      } else if (!resolveSalePaymentBreakdown(tx)) {
        conflicts.push({ eventId, reason: `Rincian sumber dana faktur ${tx.invoiceNumber} tidak valid atau tidak tersedia; void remote ditahan untuk rekonsiliasi manual.`, createdAt: now });
      } else if (!Number.isSafeInteger(tx.subtotalRupiah) || tx.subtotalRupiah < 0 ||
          !Number.isSafeInteger(tx.discountRupiah) || tx.discountRupiah < 0 ||
          !Number.isSafeInteger(tx.shippingFee) || tx.shippingFee < 0 ||
          tx.discountRupiah > tx.subtotalRupiah ||
          tx.subtotalRupiah - tx.discountRupiah + tx.shippingFee !== tx.grandTotalRupiah) {
        conflicts.push({ eventId, reason: `Rincian subtotal, diskon, dan ongkir faktur ${tx.invoiceNumber} tidak valid; void remote ditahan untuk rekonsiliasi.`, createdAt: now });
      } else if (
        next.cashInHandRupiah < resolveSalePaymentBreakdown(tx)!.cashPaidRupiah ||
        (resolveSalePaymentBreakdown(tx)!.transferPaidRupiah > 0 && (
          next.bankBalanceInitialized !== true ||
          (next.bankBalanceRupiah ?? 0) < resolveSalePaymentBreakdown(tx)!.transferPaidRupiah
        ))
      ) {
        conflicts.push({ eventId, reason: `Dana penerimaan faktur ${tx.invoiceNumber} sudah tidak mencukupi untuk pembalikan otomatis. Void ditahan agar saldo kas/bank tidak menjadi tidak konsisten; perlu rekonsiliasi dan pencatatan refund manual.`, createdAt: now });
      } else {
        const paymentBreakdown = resolveSalePaymentBreakdown(tx)!;
        const restoreAllocations = tx.remoteStockAppliedAllocations ?? tx.lotAllocations;
        const lots = next.lots.map((lot) =>
          restoreAllocations
            .filter((allocation) => allocation.lotId === lot.id)
            .reduce((currentLot, allocation) => restoreLotStock(
              currentLot,
              allocation.weightGram,
              allocation.carryingValueRupiah ?? allocation.cogsRupiah
            ), lot)
        );
        const paidCash = paymentBreakdown.cashPaidRupiah;
        const paidBank = paymentBreakdown.transferPaidRupiah;
        const due = paymentBreakdown.receivableRupiah;
        const total = tx.grandTotalRupiah ?? paidCash + paidBank + due, cogs = tx.totalCogsRupiah ?? 0;
        const reversalJournal = buildDerivedJournal({
          idempotencyKey: key, referenceNo: tx.invoiceNumber, category: 'PEMBATALAN',
          description: `Pembatalan penjualan remote ${tx.invoiceNumber}`,
          lines: [
            { accountCode: '4101', accountName: 'Penjualan Daging', debit: tx.subtotalRupiah, credit: 0 },
            ...(tx.shippingFee > 0 ? [{ accountCode: '4102', accountName: 'Pendapatan Jasa Pengiriman', debit: tx.shippingFee, credit: 0 }] : []),
            ...(tx.discountRupiah > 0 ? [{ accountCode: '4103', accountName: 'Potongan & Retur Penjualan', debit: 0, credit: tx.discountRupiah }] : []),
            ...(paidCash > 0 ? [{ accountCode: '1101', accountName: 'Kas Tunai', debit: 0, credit: paidCash }] : []),
            ...(paidBank > 0 ? [{ accountCode: '1102', accountName: 'Rekening Bank', debit: 0, credit: paidBank }] : []),
            ...(due > 0 ? [{ accountCode: '1201', accountName: 'Piutang Pelanggan', debit: 0, credit: due }] : []),
            ...(cogs > 0 ? [
              ...buildInventoryJournalLines(restoreAllocations.map((allocation) => ({ lotId: allocation.lotId, cogsRupiah: allocation.cogsRupiah })), next.lots, 'DEBIT'),
              ...((next.consignmentPayables ?? []).filter((payable) => payable.invoiceNo === tx.invoiceNumber && payable.status !== 'VOIDED').reduce((sum, payable) => sum + payable.amountRupiah, 0) > 0
                ? [{ accountCode: '2102', accountName: 'Utang Konsinyasi', debit: (next.consignmentPayables ?? []).filter((payable) => payable.invoiceNo === tx.invoiceNumber && payable.status !== 'VOIDED').reduce((sum, payable) => sum + payable.amountRupiah, 0), credit: 0 }]
                : []),
              { accountCode: '5101', accountName: 'Harga Pokok Penjualan', debit: 0, credit: cogs },
            ] : []),
          ],
        });
        const reversalLedger: StockLedgerEntry[] = restoreAllocations.map((allocation) => ({
          uuid: generateUUID(), idempotencyKey: key, timestamp: now, actorName: 'Perangkat lain',
          type: 'IN_VOID_REVERSAL', humanLabel: 'Pembalikan stok void remote',
          productName: allocation.productName, lotId: allocation.lotId, lotCode: allocation.lotCode,
          weightGramDelta: allocation.weightGram, unitCostPerKg: allocation.hppPerKg,
          valueRupiahDelta: allocation.cogsRupiah, movingAvgHppAfterKg: allocation.hppPerKg,
          referenceNo: tx.invoiceNumber, note: 'Stok dipulihkan dari pembatalan pada perangkat lain.',
        }));
        next = {
          ...next, lots, products: syncProductsStockFromLots(next.products, lots),
          consignmentPayables: (next.consignmentPayables ?? []).map((payable) =>
            payable.invoiceNo === tx.invoiceNumber && payable.status !== 'VOIDED'
              ? { ...payable, remainingAmountRupiah: 0, status: 'VOIDED', voidedAt: now, voidReason: String(payload.reason || 'Void dari perangkat lain') }
              : payable
          ),
          transactions: next.transactions.map((item) => item.uuid === tx.uuid ? { ...item, status: 'VOIDED', voidReason: String(payload.reason || 'Void dari perangkat lain') } : item),
          cashInHandRupiah: Math.max(0, next.cashInHandRupiah - paidCash),
          bankBalanceRupiah: (next.bankBalanceRupiah ?? 0) - paidBank,
          customers: next.customers.map((c) => c.id === tx.customerId ? { ...c, currentReceivable: Math.max(0, c.currentReceivable - due) } : c),
          receivables: next.receivables.map((r) => r.invoice === tx.invoiceNumber ? { ...r, amount: 0, status: 'LUNAS' } : r),
          stockLedger: [...reversalLedger, ...next.stockLedger],
          journals: [reversalJournal, ...next.journals],
          auditTrail: [buildAuditEntry({ actorName: 'Perangkat lain', actorRole: 'SYSTEM', action: 'SYNC_VOID_REMOTE', humanSummary: `Pembatalan ${tx.invoiceNumber} diterapkan dari perangkat lain.`, referenceId: tx.invoiceNumber }), ...next.auditTrail],
        };
      }
    } else {
      conflicts.push({ eventId, reason: `Jenis event ${type || 'UNKNOWN'} belum memiliki reducer lokal; event disimpan untuk rekonsiliasi.`, createdAt: now });
    }
    seen.add(key);
    remoteEvents.unshift({ ...event, appliedAt: now });
    if (seq > (next.lastServerSeq ?? 0)) next.lastServerSeq = seq;
  }
  // Keep event history bounded, but never evict idempotency keys or unresolved conflicts.
  // Eviction could permit an old event to apply twice or hide a conflict from Owner review.
  next = { ...next, remoteSyncEvents: remoteEvents.slice(0, 2000), remoteSyncConflicts: conflicts, processedIdempotencyKeys: [...seen], lastServerSeq: Math.max(next.lastServerSeq ?? 0, Number.isSafeInteger(lastServerSeq) && (lastServerSeq ?? -1) >= 0 ? lastServerSeq! : 0), lastUpdatedAt: nowIso() };
  persistEngineState(next);
  return next;
}

/**
 * Backup & Restore (JSON Package with Integrity Checksum)
 */
export interface EngineBackupMetadata {
  originDeviceId?: string;
  exportedAt?: string;
}

export function assessBackupRestoreSafety(
  current: BusinessEngineState,
  incoming: BusinessEngineState,
  metadata: EngineBackupMetadata
): { ok: true } | { ok: false; reason: string } {
  if (!metadata.originDeviceId) {
    return { ok: false, reason: 'Backup ini belum menyimpan identitas perangkat asal. Buat backup baru dari perangkat sumber sebelum memulihkan.' };
  }
  if (metadata.originDeviceId !== current.deviceId) {
    return { ok: false, reason: 'Backup berasal dari perangkat lain. Restore snapshot penuh lintas perangkat ditolak; pulihkan perangkat pengganti melalui backend sync dan rekonsiliasi event.' };
  }
  const exportedAt = Date.parse(metadata.exportedAt || '');
  const currentUpdatedAt = Date.parse(current.lastUpdatedAt || '');
  if (!Number.isFinite(exportedAt) || !Number.isFinite(currentUpdatedAt)) {
    return { ok: false, reason: 'Waktu backup atau waktu data aktif tidak valid. Pemulihan dibatalkan demi keamanan data.' };
  }
  if (exportedAt < currentUpdatedAt) {
    return { ok: false, reason: 'Backup lebih lama daripada data aktif perangkat ini. Pemulihan dibatalkan agar transaksi yang lebih baru tidak tertimpa.' };
  }
  if ((incoming.lastServerSeq ?? 0) < (current.lastServerSeq ?? 0)) {
    return { ok: false, reason: 'Backup tertinggal dari posisi sinkronisasi server perangkat ini. Sinkronkan data terbaru sebelum mencoba pemulihan.' };
  }

  const missing = (currentItems: unknown[], incomingItems: unknown[], keyOf: (item: any) => string) => {
    const incomingKeys = new Set(incomingItems.map(keyOf).filter(Boolean));
    return currentItems.filter((item) => {
      const key = keyOf(item);
      return !!key && !incomingKeys.has(key);
    }).length;
  };
  const checks: Array<[string, unknown[], unknown[], (item: any) => string]> = [
    ['produk', current.products, incoming.products, (item) => String(item?.id || '')],
    ['lot stok', current.lots, incoming.lots, (item) => String(item?.id || '')],
    ['pelanggan', current.customers, incoming.customers, (item) => String(item?.id || '')],
    ['piutang', current.receivables, incoming.receivables, (item) => String(item?.id || '')],
    ['PO pembelian', current.inboundPOs, incoming.inboundPOs, (item) => String(item?.id || '')],
    ['tagihan supplier', current.supplierInvoices, incoming.supplierInvoices, (item) => String(item?.id || '')],
    ['kategori', current.categories ?? [], incoming.categories ?? [], (item) => String(item?.id || '')],
    ['promo', current.bazarPromos ?? [], incoming.bazarPromos ?? [], (item) => String(item?.id || '')],
    ['transaksi', current.transactions, incoming.transactions, (item) => String(item?.uuid || item?.invoiceNumber || '')],
    ['ledger stok', current.stockLedger, incoming.stockLedger, (item) => String(item?.uuid || '')],
    ['jurnal', current.journals, incoming.journals, (item) => String(item?.uuid || '')],
    ['audit trail', current.auditTrail, incoming.auditTrail, (item) => String(item?.uuid || '')],
    ['approval', current.approvals, incoming.approvals, (item) => String(item?.uuid || '')],
    ['Outbox', current.syncOutbox, incoming.syncOutbox, (item) => String(item?.uuid || item?.idempotencyKey || '')],
    ['event sinkronisasi', current.remoteSyncEvents ?? [], incoming.remoteSyncEvents ?? [], (item) => String(item?.uuid || item?.idempotencyKey || item?.serverSeq || '')],
    ['retur', current.customerReturns ?? [], incoming.customerReturns ?? [], (item) => String(item?.id || '')],
    ['pembayaran piutang', current.receivablePayments ?? [], incoming.receivablePayments ?? [], (item) => String(item?.id || '')],
    ['konflik sinkronisasi', current.remoteSyncConflicts ?? [], incoming.remoteSyncConflicts ?? [], (item) => `${String(item?.eventId || '')}|${String(item?.reason || '')}|${String(item?.createdAt || '')}`],
  ];
  const missingLabels = checks.filter(([, currentItems, incomingItems, keyOf]) =>
    missing(currentItems, incomingItems, keyOf) > 0
  ).map(([label]) => label);
  const incomingProcessedKeys = new Set(incoming.processedIdempotencyKeys ?? []);
  if ((current.processedIdempotencyKeys ?? []).some((key) => !incomingProcessedKeys.has(key))) {
    missingLabels.push('kunci idempotency');
  }
  if (missingLabels.length) {
    return { ok: false, reason: `Backup tidak memuat seluruh catatan aktif (${missingLabels.join(', ')}). Pemulihan dibatalkan agar riwayat tidak hilang.` };
  }
  const incomingSuppliers = new Set(incoming.suppliers ?? []);
  if ((current.suppliers ?? []).some((supplier) => !incomingSuppliers.has(supplier))) {
    return { ok: false, reason: 'Backup tidak memuat seluruh master supplier aktif. Pemulihan dibatalkan agar master data tidak hilang.' };
  }
  const incomingPhoneBook = incoming.supplierPhones ?? {};
  if (Object.entries(current.supplierPhones ?? {}).some(([supplier, phone]) => incomingPhoneBook[supplier] === undefined)) {
    return { ok: false, reason: 'Backup tidak memuat seluruh kontak supplier aktif. Pemulihan dibatalkan agar master data tidak hilang.' };
  }
  return { ok: true };
}

export function exportEngineBackupJson(state: BusinessEngineState): { filename: string; content: string } {
  const { ownerPin: _redactedOwnerPin, ownerPinHash: _redactedHash, ownerPinSalt: _redactedSalt, ownerPinNeedsChange: _redactedPinChange, deviceId: _redactedDeviceId, ...exportSafeState } = state;
  const exportedAt = nowIso();
  const originDeviceId = state.deviceId;
  const checksum = computeIntegrityHash(JSON.stringify({ originDeviceId, exportedAt, state: exportSafeState }));
  const envelope = {
    app: 'KARKASIA-ERP',
    exportedAt,
    originDeviceId,
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
): { ok: true; state: BusinessEngineState; metadata: EngineBackupMetadata } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText);
    const isEnvelope = parsed && typeof parsed === 'object' && parsed.app === 'KARKASIA-ERP';
    const metadata: EngineBackupMetadata = {
      originDeviceId: typeof parsed?.originDeviceId === 'string' && parsed.originDeviceId.trim() ? parsed.originDeviceId.trim() : undefined,
      exportedAt: typeof parsed?.exportedAt === 'string' ? parsed.exportedAt : undefined,
    };
    if (metadata.originDeviceId && !metadata.exportedAt) {
      return { ok: false, error: 'Metadata backup tidak lengkap: waktu ekspor tidak tersedia.' };
    }
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

    const requiredCollections = [
      'customers', 'receivables', 'inboundPOs', 'supplierInvoices',
      'transactions', 'journals', 'auditTrail', 'approvals',
      'processedIdempotencyKeys', 'syncOutbox',
    ];
    const missingCollections = requiredCollections.filter((key) => !Array.isArray(candidateState[key]));
    if (missingCollections.length) {
      return { ok: false, error: `Snapshot tidak lengkap: koleksi ${missingCollections.join(', ')} tidak tersedia.` };
    }
    if (candidateState.schemaVersion !== ENGINE_SCHEMA_VERSION ||
        typeof candidateState.storeName !== 'string' || !candidateState.storeName.trim() ||
        typeof candidateState.lastUpdatedAt !== 'string' || !Number.isFinite(Date.parse(candidateState.lastUpdatedAt))) {
      return { ok: false, error: 'Versi skema, nama toko, atau waktu snapshot tidak valid.' };
    }
    const uniqueCollections: Array<[string, unknown[], (item: any) => string]> = [
      ['produk', candidateState.products, (item) => String(item?.id || '')],
      ['lot', candidateState.lots, (item) => String(item?.id || '')],
      ['pelanggan', candidateState.customers, (item) => String(item?.id || '')],
      ['piutang', candidateState.receivables, (item) => String(item?.id || '')],
      ['transaksi', candidateState.transactions, (item) => String(item?.uuid || '')],
      ['ledger stok', candidateState.stockLedger, (item) => String(item?.uuid || '')],
      ['jurnal', candidateState.journals, (item) => String(item?.uuid || '')],
      ['audit trail', candidateState.auditTrail, (item) => String(item?.uuid || '')],
      ['approval', candidateState.approvals, (item) => String(item?.uuid || '')],
      ['outbox', candidateState.syncOutbox, (item) => String(item?.uuid || '')],
    ];
    for (const [label, collection, keyOf] of uniqueCollections) {
      const keys = collection.map(keyOf);
      if (keys.some((key) => !key) || new Set(keys).size !== keys.length) {
        return { ok: false, error: `Snapshot memiliki ID ${label} kosong atau duplikat.` };
      }
    }
    if (candidateState.processedIdempotencyKeys.some((key: unknown) => typeof key !== 'string' || !key.trim()) ||
        new Set(candidateState.processedIdempotencyKeys).size !== candidateState.processedIdempotencyKeys.length) {
      return { ok: false, error: 'Riwayat idempotency snapshot tidak valid atau memiliki duplikasi.' };
    }
    const invalidTransactions = candidateState.transactions.some((transaction: any) =>
      !transaction || typeof transaction.invoiceNumber !== 'string' || !transaction.invoiceNumber.trim() ||
      typeof transaction.customerId !== 'string' || !transaction.customerId.trim() ||
      !Array.isArray(transaction.items) || !Array.isArray(transaction.lotAllocations) ||
      !Number.isSafeInteger(transaction.totalWeightGram) || transaction.totalWeightGram < 0 ||
      !Number.isSafeInteger(transaction.grandTotalRupiah) || transaction.grandTotalRupiah < 0
    );
    if (invalidTransactions) {
      return { ok: false, error: 'Struktur atau nilai transaksi pada snapshot tidak valid.' };
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
      candidateState.ownerPin !== undefined &&
      (typeof candidateState.ownerPin !== 'string' || !candidateState.ownerPin.trim())
    ) {
      return { ok: false, error: 'Data keamanan PIN pada file cadangan tidak valid.' };
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
      const checksumPayload = metadata.originDeviceId
        ? JSON.stringify({ originDeviceId: metadata.originDeviceId, exportedAt: metadata.exportedAt, state: candidateState })
        : JSON.stringify(candidateState);
      const expected = computeIntegrityHash(checksumPayload);
      if (expected !== parsed.checksum) {
        return { ok: false, error: 'Pemeriksaan integritas gagal: file cadangan mungkin telah berubah atau rusak.' };
      }
    }
    const normalized = normalizePersistedState(candidateState, fallbackDefaults);
    const integrity = auditIntegerLedgerIntegrity(normalized);
    if (!integrity.ok) {
      return { ok: false, error: `Snapshot mengandung ${integrity.violations.length} nilai Rupiah/Gram yang tidak valid. Restore dibatalkan.` };
    }
    if (options?.persist !== false) {
      persistEngineState(normalized);
    }
    return { ok: true, state: normalized, metadata };
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
    .filter((lot) => !lot.isQuarantined)
    .reduce((total, lot) => total + getLotCarryingValueRupiah(lot), 0);

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
