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
   */
  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.modelDelegate.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Revokes a single session by token hash.
   * Uses deleteMany so revoking an already-revoked session is a no-op
   * rather than a thrown P2025.
   */
  async deleteByTokenHash(tokenHash: string): Promise<{ count: number }> {
    return this.modelDelegate.deleteMany({
      where: { tokenHash },
    });
  }

  /**
   * Revokes every session belonging to a user. Used on password change,
   * password reset, logout-all and account deletion.
   */
  async deleteManyByUserId(userId: string): Promise<{ count: number }> {
    return this.modelDelegate.deleteMany({
      where: { userId },
    });
  }
}

export default new RefreshTokenRepository();
