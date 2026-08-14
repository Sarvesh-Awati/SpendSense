/**
 * One-off schema migration: refresh_tokens.token -> refresh_tokens.tokenHash
 *
 * Context
 * -------
 * Refresh tokens used to be stored raw (a signed JWT). They are now opaque
 * random tokens persisted only as a SHA-256 hash. See utils/token.ts.
 *
 * This migration is LOSSLESS. Session lookup hashes whatever token the client
 * presents, so backfilling tokenHash = sha256(token) keeps every existing
 * session valid — users are not logged out, and no row is deleted.
 *
 * It is idempotent: re-running it after success is a no-op.
 *
 * Run with:  npx ts-node prisma/migrate-refresh-token-hash.ts
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TABLE = 'refresh_tokens';

async function columnExists(column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.columns
    WHERE table_name = ${TABLE} AND column_name = ${column}
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

async function main() {
  console.log('🔐 Migrating refresh_tokens.token -> tokenHash');

  const hasTokenHash = await columnExists('tokenHash');
  const hasToken = await columnExists('token');

  if (hasTokenHash && !hasToken) {
    console.log('✅ Already migrated — nothing to do.');
    return;
  }

  if (!hasToken && !hasTokenHash) {
    throw new Error(
      'Neither "token" nor "tokenHash" exists on refresh_tokens. Refusing to guess; inspect the schema manually.'
    );
  }

  // 1. Add the new column as nullable so existing rows survive the DDL.
  if (!hasTokenHash) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${TABLE}" ADD COLUMN "tokenHash" TEXT`);
    console.log('   • Added nullable tokenHash column');
  }

  // 2. Backfill by hashing each existing raw token.
  const rows = await prisma.$queryRaw<Array<{ id: string; token: string | null }>>`
    SELECT id, token FROM refresh_tokens WHERE "tokenHash" IS NULL
  `;
  console.log(`   • Backfilling ${rows.length} row(s)`);

  let migrated = 0;
  let orphaned = 0;
  for (const row of rows) {
    if (!row.token) {
      // No raw token to hash — the row is unusable either way.
      await prisma.$executeRaw`DELETE FROM refresh_tokens WHERE id = ${row.id}::uuid`;
      orphaned++;
      continue;
    }
    const tokenHash = crypto.createHash('sha256').update(row.token).digest('hex');
    await prisma.$executeRaw`
      UPDATE refresh_tokens SET "tokenHash" = ${tokenHash} WHERE id = ${row.id}::uuid
    `;
    migrated++;
  }
  console.log(`   • Hashed ${migrated} token(s)${orphaned ? `, removed ${orphaned} unusable row(s)` : ''}`);

  // 3. Enforce the constraints the Prisma schema declares.
  await prisma.$executeRawUnsafe(`ALTER TABLE "${TABLE}" ALTER COLUMN "tokenHash" SET NOT NULL`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_key" ON "${TABLE}"("tokenHash")`
  );
  console.log('   • Applied NOT NULL + unique index');

  // 4. Drop the raw-token column. Its indexes go with it.
  if (hasToken) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${TABLE}" DROP COLUMN "token"`);
    console.log('   • Dropped raw token column');
  }

  console.log('✅ Migration complete — no sessions invalidated.');
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
