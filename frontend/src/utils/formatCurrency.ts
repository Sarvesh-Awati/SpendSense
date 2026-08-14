/**
 * Currency formatting — the single choke point for every monetary value shown
 * in SpendSense.
 *
 * This function is deliberately defensive. It previously passed its argument
 * straight to Intl.NumberFormat, so `undefined` rendered as "₹NaN" and
 * `Infinity` as "₹∞" on screen. API payloads legitimately contain values this
 * function must survive: Prisma serialises Decimal columns as *strings*, and
 * optional fields can arrive undefined. Guarding here fixes every call site at
 * once rather than patching each one.
 */

const FALLBACK_CURRENCY = 'INR';

/**
 * Coerces an unknown value to a finite number, or 0.
 * Handles the string amounts Prisma returns for Decimal columns.
 */
export const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const formatCurrency = (
  amount: number | string | null | undefined,
  currencyCode: string = FALLBACK_CURRENCY
): string => {
  const safeAmount = toFiniteNumber(amount);
  const safeCode =
    typeof currencyCode === 'string' && /^[A-Za-z]{3}$/.test(currencyCode)
      ? currencyCode.toUpperCase()
      : FALLBACK_CURRENCY;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    // An unrecognised currency code makes Intl throw a RangeError. Never let a
    // formatting failure blank out the surrounding component.
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: FALLBACK_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  }
};

/**
 * Percentage change, or null when there is no meaningful figure to show.
 *
 * Returns null — not NaN, not 0 — for undefined/null/NaN/Infinity inputs, and
 * when `previous` is zero, because a change from nothing has no percentage.
 * (The API reports 100 in that case, which reads as a real +100% to users.)
 * Call sites must render this with a `!== null` check.
 */
export const safePercentChange = (
  change: unknown,
  previous?: unknown
): number | null => {
  if (typeof change !== 'number' || !Number.isFinite(change)) return null;
  if (previous !== undefined && toFiniteNumber(previous) <= 0) return null;
  return change;
};

/** Formats a percentage that has already passed `safePercentChange`. */
export const formatPercent = (value: number): string =>
  `${Math.abs(value).toFixed(1)}%`;

export default formatCurrency;
