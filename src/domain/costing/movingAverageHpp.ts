/**
 * Pure inventory costing helper. Amounts are integer Rupiah and weights are integer Gram.
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
