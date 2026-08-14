import { Prisma } from '@prisma/client';

/**
 * Decimal helpers for the financial write path.
 *
 * JavaScript floating point must never touch a value that will be persisted:
 * 0.1 + 0.2 !== 0.3, and those errors accumulate across aggregation. Every
 * monetary computation here goes through Prisma.Decimal (decimal.js).
 */

export const Decimal = Prisma.Decimal;
export type DecimalValue = Prisma.Decimal;

/** Scale of stored monetary amounts — matches Decimal(12,2) in the schema. */
export const MONEY_DP = 2;
/** Scale of stored exchange rates — matches Decimal(10,6) in the schema. */
export const RATE_DP = 6;

/** Largest value Decimal(12,2) can hold. */
const MAX_MONEY = new Prisma.Decimal('9999999999.99');
/** Largest value Decimal(10,6) can hold. */
const MAX_RATE = new Prisma.Decimal('9999.999999');

export function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Rounds a monetary value to the stored scale.
 * ROUND_HALF_UP is the conventional choice for currency and is deterministic,
 * so the same inputs always produce byte-identical stored values.
 */
export function roundMoney(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(MONEY_DP, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Applies an exchange rate: `amount` units of the source currency become
 * `amount × rate` units of the base currency.
 *
 * The rate is NOT rounded here — it is stored at full precision and only the
 * resulting amount is rounded, once, at the end. Rounding the rate first would
 * compound error on large amounts.
 */
export function convertAmount(
  amount: Prisma.Decimal | number | string,
  rate: Prisma.Decimal | number | string
): Prisma.Decimal {
  return roundMoney(toDecimal(amount).mul(toDecimal(rate)));
}

/** True when the value fits the Decimal(12,2) money column. */
export function isStorableMoney(value: Prisma.Decimal): boolean {
  return value.isFinite() && value.abs().lessThanOrEqualTo(MAX_MONEY);
}

/** True when the value is a usable exchange rate and fits Decimal(10,6). */
export function isStorableRate(value: Prisma.Decimal): boolean {
  return value.isFinite() && value.greaterThan(0) && value.lessThanOrEqualTo(MAX_RATE);
}

/** Rate stored for a same-currency conversion. Exactly 1, never fetched. */
export const IDENTITY_RATE = new Prisma.Decimal(1);

/**
 * Decimal | null -> number | null for API responses. Never yields NaN.
 * Display-side only; must not be used before persisting.
 */
export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
