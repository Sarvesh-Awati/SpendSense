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

/**
 * The app-wide fallback when a user has no reporting currency yet. Matches the
 * `User.preferredCurrency` column default. Exported so screens stop hardcoding
 * their own default — six of them defaulted to 'USD', which contradicted every
 * aggregate figure elsewhere in the app.
 */
export const FALLBACK_CURRENCY = 'INR';

/**
 * The currency codes the API accepts, with display labels.
 *
 * This exact <option> list was copy-pasted into four separate forms. It is a
 * presentation list only — the authoritative set lives in the backend
 * validators and the Prisma `Currency` enum, which are unchanged.
 */
export const SUPPORTED_CURRENCIES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'INR', label: 'INR (₹)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'JPY', label: 'JPY (¥)' },
  { code: 'CNY', label: 'CNY (¥)' },
  { code: 'SGD', label: 'SGD (S$)' },
  { code: 'AED', label: 'AED (د.إ)' },
];

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
 * The symbol for a currency code — "₹" for INR, "$" for USD, and so on.
 *
 * Derived from Intl rather than a hardcoded map, so it stays correct for every
 * code the app supports without a lookup table to maintain. Falls back to the
 * code itself (e.g. "AED") when no distinct symbol exists.
 */
export const currencySymbol = (currencyCode: string = FALLBACK_CURRENCY): string => {
  const safeCode =
    typeof currencyCode === 'string' && /^[A-Za-z]{3}$/.test(currencyCode)
      ? currencyCode.toUpperCase()
      : FALLBACK_CURRENCY;

  try {
    // Fixed locale on purpose: the *symbol* should be canonical ("$", "¥"),
    // not disambiguated for the viewer's locale ("US$", "JP¥"). Amount
    // formatting elsewhere still follows the user's locale.
    const part = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCode,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency');

    return part?.value ?? safeCode;
  } catch {
    return safeCode;
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
