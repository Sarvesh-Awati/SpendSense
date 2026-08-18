import { RefreshToken } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class RefreshTokenRepository extends BaseRepository<RefreshToken> {
  constructor() {
    super(prisma.refreshToken);
  }

  /**
   * Looks up a session by the SHA-256 hash of its refresh token.
   * Callers must hash the raw token first — raw tokens are never stored.
   *
   * Revoked rows are returned deliberately: recognising a replayed token is
   * the whole point of keeping them.
   */
  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.modelDelegate.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Marks a token as consumed by rotation.
   * Uses updateMany so rotating an already-rotated row is a no-op rather than
   * a thrown P2025 — two concurrent refreshes must not crash the second one.
   */
  async markRevoked(id: string): Promise<{ count: number }> {
    return this.modelDelegate.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes every token descended from one login.
   *
   * Called when a replayed token proves the family is compromised. Rows are
   * marked rather than deleted so a further replay is still recognised as a
   * replay instead of an unknown token.
   */
  async revokeFamily(familyId: string): Promise<{ count: number }> {
    return this.modelDelegate.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes a single session by token hash.
   * Uses updateMany so revoking an already-revoked session is a no-op
   * rather than a thrown P2025.
   */
  async revokeByTokenHash(tokenHash: string): Promise<{ count: number }> {
    return this.modelDelegate.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes every session belonging to a user. Used on password change,
   * password reset, logout-all and account deletion.
   *
   * This deletes rather than marks: the intent is "no session of mine
   * survives", and there is no attacker-detection value in retaining rows
   * the legitimate user deliberately destroyed.
   */
  async deleteManyByUserId(userId: string): Promise<{ count: number }> {
    return this.modelDelegate.deleteMany({
      where: { userId },
    });
  }

  /**
   * Removes rows that can no longer serve any purpose: expired, or revoked
   * long enough ago that a replay is no longer worth detecting.
   *
   * Without this the table grows without bound — every login and every
   * rotation adds a row that is never removed.
   */
  async purgeStale(revokedRetentionDays = 30): Promise<{ count: number }> {
    const now = new Date();
    const revokedCutoff = new Date(now.getTime() - revokedRetentionDays * 24 * 60 * 60 * 1000);

    return this.modelDelegate.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: revokedCutoff } },
        ],
      },
    });
  }
}

export default new RefreshTokenRepository();
