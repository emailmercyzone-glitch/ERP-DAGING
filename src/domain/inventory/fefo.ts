import type { BatchLotEntity, LotAllocationRecord } from '../../engine/types';
import { formatLocalYmd } from '../shared/localDate';

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
