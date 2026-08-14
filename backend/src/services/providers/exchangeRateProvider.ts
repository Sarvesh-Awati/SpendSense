import { Prisma } from '@prisma/client';
import { isStorableRate, toDecimal } from '../../utils/money';

/**
 * Exchange-rate provider abstraction.
 *
 * Domain code depends only on this interface — never on a specific vendor —
 * so the provider can be replaced without touching transaction, dashboard,
 * budget or analytics logic.
 *
 * Contract for `rate`: 1 unit of `from` equals `rate` units of `to`.
 *   getRate('USD', 'INR') === 84  =>  100 USD = 8,400 INR
 */
export interface ExchangeRateProvider {
  readonly name: string;
  /**
   * @param date ISO YYYY-MM-DD. Providers should return the rate as of this
   *   date so historical transactions convert at historical rates.
   * @throws RateUnavailableError when a trustworthy rate cannot be obtained.
   */
  getRate(from: string, to: string, date: string): Promise<Prisma.Decimal>;
}

/**
 * Raised when a rate genuinely cannot be obtained. Callers must fail closed —
 * never substitute 1, never substitute today's rate for a historical date.
 */
export class RateUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RateUnavailableError';
  }
}

const REQUEST_TIMEOUT_MS = 3000;

/**
 * Validates a candidate rate before it is allowed anywhere near the database.
 * Rejects zero, negative, NaN, Infinity and values that overflow Decimal(10,6),
 * so a malformed or hostile provider response cannot corrupt stored financials.
 */
export function assertValidRate(raw: unknown, from: string, to: string): Prisma.Decimal {
  if (typeof raw !== 'number' && typeof raw !== 'string') {
    throw new RateUnavailableError(`Provider returned a non-numeric rate for ${from}->${to}`);
  }

  let rate: Prisma.Decimal;
  try {
    rate = toDecimal(raw);
  } catch {
    throw new RateUnavailableError(`Provider returned an unparseable rate for ${from}->${to}`);
  }

  if (!isStorableRate(rate)) {
    throw new RateUnavailableError(
      `Provider returned an out-of-range rate for ${from}->${to} (must be > 0 and <= 9999.999999)`
    );
  }

  return rate;
}

/**
 * exchangerate.host implementation.
 *
 * Requires EXCHANGE_RATE_API_KEY. When no key is configured the provider
 * reports itself unavailable rather than guessing — same-currency transactions
 * are unaffected because they never reach a provider.
 */
export class ExchangeRateHostProvider implements ExchangeRateProvider {
  readonly name = 'exchangerate.host';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl = 'https://api.exchangerate.host'
  ) {}

  async getRate(from: string, to: string, date: string): Promise<Prisma.Decimal> {
    if (!this.apiKey) {
      throw new RateUnavailableError(
        'Exchange rate provider is not configured (EXCHANGE_RATE_API_KEY missing)'
      );
    }

    // Historical endpoint keeps past transactions on past rates.
    const url = `${this.baseUrl}/historical?access_key=${encodeURIComponent(
      this.apiKey
    )}&date=${encodeURIComponent(date)}&source=${encodeURIComponent(from)}&currencies=${encodeURIComponent(to)}`;

    // Single attempt with a hard timeout: no unbounded retries on a user's
    // request path.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let payload: any;
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new RateUnavailableError(`Provider responded ${res.status} for ${from}->${to}`);
      }
      payload = await res.json();
    } catch (error) {
      if (error instanceof RateUnavailableError) throw error;
      const reason = (error as Error)?.name === 'AbortError' ? 'timed out' : 'request failed';
      throw new RateUnavailableError(`Provider ${reason} for ${from}->${to}`, error);
    } finally {
      clearTimeout(timer);
    }

    if (payload?.success === false) {
      throw new RateUnavailableError(
        `Provider reported failure for ${from}->${to}: ${payload?.error?.type ?? 'unknown'}`
      );
    }

    // exchangerate.host quotes keyed `${source}${target}`, e.g. { USDINR: 84.1 }
    const quote = payload?.quotes?.[`${from}${to}`];
    if (quote === undefined) {
      throw new RateUnavailableError(`Provider did not return a quote for ${from}->${to}`);
    }

    return assertValidRate(quote, from, to);
  }
}
