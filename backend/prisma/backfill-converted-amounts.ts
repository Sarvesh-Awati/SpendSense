/**
 * Backfill Transaction.baseCurrency / exchangeRate / convertedAmount.
 *
 * Safety properties:
 *  - DRY RUN BY DEFAULT. Writes only with --apply.
 *  - Idempotent: rows that already have a valid convertedAmount are skipped.
 *  - Batched, with per-row logging.
 *  - Same-currency rows are exact: rate = 1, converted = amount. No provider.
 *  - Foreign-currency rows are priced at the TRANSACTION'S OWN DATE.
 *  - If a trustworthy historical rate cannot be obtained the row is LEFT NULL
 *    and reported. It never substitutes 1, and never substitutes today's rate.
 *    Inventing history is worse than an incomplete total — the reporting guard
 *    turns any remaining NULL into a loud error rather than a silent shortfall.
 *
 * Usage:
 *   npx ts-node prisma/backfill-converted-amounts.ts            # dry run
 *   npx ts-node prisma/backfill-converted-amounts.ts --apply    # write
 */
import { PrismaClient, Currency, Prisma } from '@prisma/client';
import currencyService from '../src/services/currencyService';
import { convertAmount, IDENTITY_RATE } from '../src/utils/money';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const BATCH = 200;

interface Report {
  scanned: number;
  alreadyConverted: number;
  sameCurrency: number;
  convertedViaProvider: number;
  leftUnconverted: Array<{ id: string; currency: string; base: string; date: string; reason: string }>;
}

async function main() {
  const report: Report = {
    scanned: 0,
    alreadyConverted: 0,
    sameCurrency: 0,
    convertedViaProvider: 0,
    leftUnconverted: [],
  };

  console.log(`\n🔁 Converted-amount backfill — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, baseCurrency: true, preferredCurrency: true },
  });

  for (const user of users) {
    const base = (user.baseCurrency ?? user.preferredCurrency) as Currency;

    let cursor: string | undefined;
    for (;;) {
      const rows = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, amount: true, currency: true, date: true, convertedAmount: true },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      for (const tx of rows) {
        report.scanned++;

        // Idempotent: never overwrite an already valid conversion.
        if (tx.convertedAmount !== null) {
          report.alreadyConverted++;
          continue;
        }

        let rate: Prisma.Decimal;
        let converted: Prisma.Decimal;

        if (tx.currency === base) {
          rate = IDENTITY_RATE;
          converted = new Prisma.Decimal(tx.amount);
          report.sameCurrency++;
        } else {
          try {
            rate = await currencyService.getRate(tx.currency, base, tx.date);
            converted = convertAmount(new Prisma.Decimal(tx.amount), rate);
            report.convertedViaProvider++;
          } catch (error) {
            // Do NOT invent a historical rate.
            report.leftUnconverted.push({
              id: tx.id,
              currency: tx.currency,
              base,
              date: tx.date.toISOString().slice(0, 10),
              reason: error instanceof Error ? error.message : String(error),
            });
            continue;
          }
        }

        if (APPLY) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { baseCurrency: base, exchangeRate: rate, convertedAmount: converted },
          });
        }
        console.log(
          `   ${APPLY ? 'wrote' : 'would write'} ${tx.id} ${tx.amount} ${tx.currency} ` +
            `× ${rate.toString()} = ${converted.toString()} ${base}`
        );
      }
    }
  }

  console.log('\n──────── SUMMARY ────────');
  console.log(`  scanned:              ${report.scanned}`);
  console.log(`  already converted:    ${report.alreadyConverted}`);
  console.log(`  same-currency (rate 1): ${report.sameCurrency}`);
  console.log(`  priced via provider:  ${report.convertedViaProvider}`);
  console.log(`  LEFT UNCONVERTED:     ${report.leftUnconverted.length}`);
  for (const row of report.leftUnconverted) {
    console.log(`    ⚠️  ${row.id} ${row.currency}->${row.base} @${row.date}: ${row.reason}`);
  }
  if (report.leftUnconverted.length > 0) {
    console.log(
      '\n  These rows have NO conversion. Reporting will refuse to produce totals\n' +
        '  until they are resolved — by design, so no total is silently understated.'
    );
  }
  if (!APPLY) console.log('\n  DRY RUN — nothing was written. Re-run with --apply to commit.\n');
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
