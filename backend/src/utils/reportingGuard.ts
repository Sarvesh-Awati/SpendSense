import { Prisma } from '@prisma/client';
import prisma from '../database/prisma';
import { AppError } from '../errors/AppError';

/**
 * Guards every cross-transaction financial aggregate.
 *
 * Postgres SUM() skips NULLs silently, so a transaction with a NULL
 * convertedAmount (a legacy row, or one the backfill could not price) would
 * quietly vanish from a total and understate it with no error anywhere.
 *
 * An understated financial total that LOOKS correct is worse than an explicit
 * failure, so reporting refuses to answer until every in-scope row is priced.
 */
export class ReportingUnavailableError extends AppError {
  constructor(public readonly unconvertedCount: number) {
    super(
      `Reporting is unavailable: ${unconvertedCount} transaction(s) have no converted amount. ` +
        `Totals would be understated. Run the conversion backfill to resolve this.`,
      409
    );
  }
}

/**
 * Throws if any transaction in scope lacks a convertedAmount.
 * Call this BEFORE running any aggregate that sums convertedAmount.
 *
 * @param where the same scope the aggregate will use (at minimum { userId })
 */
export async function assertAllTransactionsConverted(
  where: Prisma.TransactionWhereInput
): Promise<void> {
  const unconverted = await prisma.transaction.count({
    where: { ...where, convertedAmount: null },
  });

  if (unconverted > 0) {
    throw new ReportingUnavailableError(unconverted);
  }
}

/**
 * Scope filter applied to every reporting aggregate. Explicitly excludes
 * unpriced rows so the intent is visible at each call site — the guard above
 * is what makes their absence an error rather than a silent omission.
 */
export const CONVERTED_ONLY: Prisma.TransactionWhereInput = {
  convertedAmount: { not: null },
};
