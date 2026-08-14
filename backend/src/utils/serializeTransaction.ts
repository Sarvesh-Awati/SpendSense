import { Transaction } from '@prisma/client';

/**
 * Response shape for transaction endpoints.
 *
 * Prisma serialises `Decimal` columns to JSON *strings*, so transaction
 * endpoints were returning `amount: "250.75"` while the dashboard, budget and
 * goal services returned real numbers. Clients that did arithmetic on a
 * transaction amount concatenated instead of adding.
 *
 * This is the single place transaction records are converted for the wire.
 */
export interface SerializedTransaction extends Omit<
  Transaction,
  'amount' | 'exchangeRate' | 'convertedAmount'
> {
  /** The ORIGINAL transaction amount, in `currency`. Never the reporting value. */
  amount: number;
  /** 1 unit of `currency` = `exchangeRate` units of `baseCurrency`, at transaction time. */
  exchangeRate: number | null;
  /** Historical value in `baseCurrency`. Used for all reporting; never overwrites `amount`. */
  convertedAmount: number | null;
}

/** Decimal | null -> number | null, without introducing NaN. */
const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Converts a transaction's Decimal fields to numbers.
 * Any extra relations already loaded (e.g. `category`) are preserved untouched.
 */
export function serializeTransaction<T extends Transaction>(
  transaction: T
): SerializedTransaction & Omit<T, 'amount' | 'exchangeRate' | 'convertedAmount'> {
  const { amount, exchangeRate, convertedAmount, ...rest } = transaction;

  return {
    ...(rest as Omit<T, 'amount' | 'exchangeRate' | 'convertedAmount'>),
    // `amount` is non-nullable in the schema, so a null here would be a data
    // fault; fall back to 0 rather than emitting null to the client.
    amount: toNumberOrNull(amount) ?? 0,
    exchangeRate: toNumberOrNull(exchangeRate),
    convertedAmount: toNumberOrNull(convertedAmount),
  } as SerializedTransaction & Omit<T, 'amount' | 'exchangeRate' | 'convertedAmount'>;
}

export function serializeTransactions<T extends Transaction>(transactions: T[]) {
  return transactions.map(serializeTransaction);
}

export default serializeTransaction;
