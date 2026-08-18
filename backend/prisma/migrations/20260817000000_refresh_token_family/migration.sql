-- Refresh-token family tracking, for rotation-replay detection.
--
-- Written by hand rather than generated, because Prisma's generated form
-- (`ADD COLUMN "familyId" UUID NOT NULL`) cannot be applied to a table that
-- already holds rows. The column is added nullable, backfilled with one
-- distinct family per existing session, and only then constrained.

-- 1. Add the columns, familyId temporarily nullable.
ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" UUID;
ALTER TABLE "refresh_tokens" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- 2. Backfill. Every pre-existing token predates rotation tracking, so each
--    one becomes the sole member of its own family: a replay of any of them
--    revokes only that session, never somebody else's.
UPDATE "refresh_tokens" SET "familyId" = gen_random_uuid() WHERE "familyId" IS NULL;

-- 3. Now that no NULLs remain, enforce the constraint.
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET NOT NULL;

-- 4. Indexes: familyId for family-wide revocation, expiresAt for the
--    stale-token purge.
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");
