import { Currency, Prisma } from '@prisma/client';
import env from '../config/env';
import {
  ExchangeRateProvider,
  ExchangeRateHostProvider,
  RateUnavailableError,
} from './providers/exchangeRateProvider';
import { convertAmount, IDENTITY_RATE, isStorableMoney, toDecimal } from '../utils/money';
import { AppError } from '../errors/AppError';

/** Currencies the application accepts. Mirrors the Prisma `Currency` enum. */
export const SUPPORTED_CURRENCIES: Currency[] = [
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'SGD', 'AED',
];

export function isSupportedCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as string[]).includes(value);
}

/**
 * Raised when a conversion is required but no trustworthy rate is available.
 * Surfaces as 503: the request may succeed later, and the client should retry
 * rather than have an incorrect financial record written on its behalf.
 */
export class ConversionUnavailableError extends AppError {
  constructor(message = 'Exchange rate service is temporarily unavailable. Please try again.') {
    super(message, 503);
  }
}

export interface Conversion {
  baseCurrency: Currency;
  exchangeRate: Prisma.Decimal;
  convertedAmount: Prisma.Decimal;
}

interface CacheEntry {
  rate: Prisma.Decimal;
  storedAt: number;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // rates are daily; 12h is ample

/**
 * Currency conversion for the financial write path.
 *
 * Guarantees:
 *  - same currency never touches the network and always yields rate = 1
 *  - a foreign conversion that cannot be priced FAILS CLOSED (503)
 *  - rate = 1 is NEVER substituted for differing currencies
 *  - all arithmetic is Decimal; the rate is stored unrounded
 */
export class CurrencyService {
  private provider: ExchangeRateProvider;
  private cache = new Map<string, CacheEntry>();
  /** Test/observability counter: how many times the provider was actually hit. */
  public providerCallCount = 0;

  constructor(provider?: ExchangeRateProvider) {
    this.provider =
      provider ?? new ExchangeRateHostProvider(env.EXCHANGE_RATE_API_KEY, env.EXCHANGE_RATE_BASE_URL);
  }

  /** Swaps the provider. Used by tests to inject deterministic rates. */
  setProvider(provider: ExchangeRateProvider): void {
    this.provider = provider;
    this.cache.clear();
    this.providerCallCount = 0;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /** Cache key: FROM:TO:YYYY-MM-DD, as specified. */
  private cacheKey(from: Currency, to: Currency, date: string): string {
    return `${from}:${to}:${date}`;
  }

  private static isoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Resolves the rate for 1 unit of `from` expressed in `to`, as of `date`.
   * Same currency short-circuits to exactly 1 with no provider call.
   */
  async getRate(from: Currency, to: Currency, date: Date): Promise<Prisma.Decimal> {
    if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
      throw new AppError('Unsupported currency', 400);
    }
    if (from === to) return IDENTITY_RATE;

    const iso = CurrencyService.isoDate(date);
    const key = this.cacheKey(from, to, iso);

    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.storedAt < CACHE_TTL_MS) return hit.rate;

    try {
      this.providerCallCount++;
      const rate = await this.provider.getRate(from, to, iso);
      this.cache.set(key, { rate, storedAt: Date.now() });
      return rate;
    } catch (error) {
      if (error instanceof RateUnavailableError) {
        console.error(
          `[currencyService] rate unavailable ${from}->${to} @${iso} via ${this.provider.name}: ${error.message}`
        );
        // Fail closed. Never fall back to 1, never fall back to today's rate.
        throw new ConversionUnavailableError();
      }
      throw error;
    }
  }

  /**
   * Produces the conversion triple to persist alongside a monetary record.
   * `date` is the record's own date, so historical entries price historically.
   */
  async resolveConversion(
    amount: Prisma.Decimal | number | string,
    currency: Currency,
    baseCurrency: Currency,
    date: Date
  ): Promise<Conversion> {
    const rate = await this.getRate(currency, baseCurrency, date);
    const converted = convertAmount(toDecimal(amount), rate);

    if (!isStorableMoney(converted)) {
      throw new AppError('Converted amount is out of the supported range', 400);
    }

    return { baseCurrency, exchangeRate: rate, convertedAmount: converted };
  }

  /**
   * Recomputes only the converted amount, reusing a rate already stored on the
   * record. Used when a transaction's amount changes but its currency does not,
   * so an edit can never silently re-price history at today's rate.
   */
  recomputeWithStoredRate(
    amount: Prisma.Decimal | number | string,
    storedRate: Prisma.Decimal | number | string
  ): Prisma.Decimal {
    return convertAmount(toDecimal(amount), toDecimal(storedRate));
  }
}

export default new CurrencyService();
