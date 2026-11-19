/**
 * Local calendar date helpers. These intentionally use the device's local calendar
 * because expiry dates are date-only business values in the Indonesian store workflow.
 */
export function formatLocalYmd(date: Date): string {
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