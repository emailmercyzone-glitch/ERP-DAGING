import type { BatchLotEntity } from '../../engine/types';

type LotValuation = Pick<BatchLotEntity, 'weightGram' | 'hppKgRupiah' | 'carryingValueRupiah'>;

function assertSafeNonNegative(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} harus berupa integer aman non-negatif.`);
  }
}

function roundProductRatio(left: number, right: number, denominator: number): number {\n  assertSafeNonNegative(left, 'Nilai kiri');\n  assertSafeNonNegative(right, 'Nilai kanan');\n  if (!Number.isSafeInteger(denominator) || denominator <= 0) throw new RangeError('Pembagi rasio lot tidak valid.');\n  const numerator = BigInt(left) * BigInt(right);\n  const divisor = BigInt(denominator);\n  const result = Number((numerator + divisor / 2n) / divisor);\n  if (!Number.isSafeInteger(result)) throw new RangeError('Hasil rasio lot melewati batas integer aman.');\n  return result;\n}\n\nfunction roundRatio(total: number, part: number, whole: number): number {
  assertSafeNonNegative(total, 'Nilai lot');
  assertSafeNonNegative(part, 'Kuantitas alokasi');
  if (!Number.isSafeInteger(whole) || whole <= 0 || part > whole) {
    throw new RangeError('Rasio alokasi lot tidak valid.');
  }
  const numerator = BigInt(total) * BigInt(part);
  const denominator = BigInt(whole);
  const rounded = (numerator + denominator / 2n) / denominator;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError('Nilai alokasi lot melewati batas integer aman.');
  return result;
}

/** Exact current lot value; legacy lots are valued from integer HPP/kg once. */
export function getLotCarryingValueRupiah(lot: LotValuation): number {
  if (lot.carryingValueRupiah !== undefined) {
    assertSafeNonNegative(lot.carryingValueRupiah, 'Nilai tercatat lot');
    return lot.carryingValueRupiah;
  }
  assertSafeNonNegative(lot.weightGram, 'Berat lot');
  assertSafeNonNegative(lot.hppKgRupiah, 'HPP lot');
  return roundProductRatio(lot.hppKgRupiah, lot.weightGram, 1000);
}

/** Consume stock and allocate its exact remaining carrying value proportionally. */
export function consumeLotStock<T extends LotValuation>(
  lot: T,
  grams: number
): { lot: T & { carryingValueRupiah: number }; cogsRupiah: number } {
  if (!Number.isSafeInteger(grams) || grams <= 0 || grams > lot.weightGram) {
    throw new RangeError('Pengurangan stok lot harus berupa integer Gram positif dan tidak melebihi stok.');
  }
  const currentValue = getLotCarryingValueRupiah(lot);
  const cogsRupiah = grams === lot.weightGram
    ? currentValue
    : roundRatio(currentValue, grams, lot.weightGram);
  const remainingValue = currentValue - cogsRupiah;
  const remainingWeight = lot.weightGram - grams;
  return {
    lot: {
      ...lot,
      weightGram: remainingWeight,
      carryingValueRupiah: remainingWeight === 0 ? 0 : remainingValue,
    },
    cogsRupiah,
  };
}

/** Restore a previously consumed allocation, preserving the exact original cost. */
export function restoreLotStock<T extends LotValuation>(
  lot: T,
  grams: number,
  carryingValueRupiah: number
): T & { carryingValueRupiah: number } {
  if (!Number.isSafeInteger(grams) || grams <= 0) {
    throw new RangeError('Berat pemulihan lot harus berupa integer Gram positif.');
  }
  assertSafeNonNegative(carryingValueRupiah, 'Nilai pemulihan lot');
  const nextWeight = lot.weightGram + grams;
  const nextValue = getLotCarryingValueRupiah(lot) + carryingValueRupiah;
  if (!Number.isSafeInteger(nextWeight) || !Number.isSafeInteger(nextValue)) {
    throw new RangeError('Pemulihan lot melewati batas integer aman.');
  }
  return { ...lot, weightGram: nextWeight, carryingValueRupiah: nextValue };
}

/** Apply physical stock opname; reductions consume exact carrying value, additions use current HPP/kg. */
export function adjustLotStockToPhysical<T extends LotValuation>(
  lot: T,
  physicalWeightGram: number
): { lot: T & { carryingValueRupiah: number }; valueDeltaRupiah: number } {
  if (!Number.isSafeInteger(physicalWeightGram) || physicalWeightGram < 0) {
    throw new RangeError('Berat fisik lot harus berupa integer Gram non-negatif.');
  }
  const currentValue = getLotCarryingValueRupiah(lot);
  const diffGram = physicalWeightGram - lot.weightGram;
  if (diffGram === 0) {
    return { lot: { ...lot, carryingValueRupiah: currentValue }, valueDeltaRupiah: 0 };
  }
  if (diffGram < 0) {
    const removedGram = -diffGram;
    const removedValue = removedGram === lot.weightGram
      ? currentValue
      : roundRatio(currentValue, removedGram, lot.weightGram);
    return {
      lot: {
        ...lot,
        weightGram: physicalWeightGram,
        carryingValueRupiah: currentValue - removedValue,
      },
      valueDeltaRupiah: -removedValue,
    };
  }
  const addedValue = roundProductRatio(lot.hppKgRupiah, diffGram, 1000);
  const nextValue = currentValue + addedValue;
  if (!Number.isSafeInteger(nextValue)) throw new RangeError('Nilai lot setelah opname melewati batas integer aman.');
  return {
    lot: { ...lot, weightGram: physicalWeightGram, carryingValueRupiah: nextValue },
    valueDeltaRupiah: addedValue,
  };
}

/** Add a separately valued output lot into an existing lot without losing value precision. */
export function addLotStock<T extends LotValuation>(
  lot: T,
  addedGram: number,
  addedValueRupiah: number
): T & { carryingValueRupiah: number } {
  if (!Number.isSafeInteger(addedGram) || addedGram <= 0) {
    throw new RangeError('Berat tambahan lot harus berupa integer Gram positif.');
  }
  assertSafeNonNegative(addedValueRupiah, 'Nilai stok tambahan');
  const nextWeight = lot.weightGram + addedGram;
  const nextValue = getLotCarryingValueRupiah(lot) + addedValueRupiah;
  if (!Number.isSafeInteger(nextWeight) || !Number.isSafeInteger(nextValue)) {
    throw new RangeError('Penambahan lot melewati batas integer aman.');
  }
  const hppKgRupiah = nextWeight > 0 ? roundProductRatio(nextValue, 1000, nextWeight) : lot.hppKgRupiah;
  return { ...lot, weightGram: nextWeight, hppKgRupiah, carryingValueRupiah: nextValue };
}
