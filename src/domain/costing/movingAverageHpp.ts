/**
 * Pure inventory costing helper. Amounts are integer Rupiah and weights are integer Gram.
 * Inputs are rejected rather than silently rounded or coerced.
 */
export function calculateMovingAverageHppPerKg(
  existingWeightGram: number,
  existingHppPerKg: number,
  incomingWeightGram: number,
  incomingTotalCostRupiah: number
): number {
  const inputs = [existingWeightGram, existingHppPerKg, incomingWeightGram, incomingTotalCostRupiah];
  if (inputs.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('HPP moving average requires safe non-negative integer Rupiah and Gram inputs.');
  }
  const totalGram = existingWeightGram + incomingWeightGram;
  if (!Number.isSafeInteger(totalGram)) {
    throw new RangeError('Total berat untuk HPP melewati batas integer aman.');
  }
  if (totalGram <= 0) return existingHppPerKg;

  const existingValueProduct = existingWeightGram * existingHppPerKg;
  if (!Number.isSafeInteger(existingValueProduct)) {
    throw new RangeError('Nilai persediaan existing melewati batas integer aman.');
  }
  const existingValue = Math.round(existingValueProduct / 1000);
  const totalValue = existingValue + incomingTotalCostRupiah;
  const totalValueProduct = totalValue * 1000;
  if (!Number.isSafeInteger(totalValue) || !Number.isSafeInteger(totalValueProduct)) {
    throw new RangeError('Total nilai persediaan untuk HPP melewati batas integer aman.');
  }
  return Math.round(totalValueProduct / totalGram);
}
