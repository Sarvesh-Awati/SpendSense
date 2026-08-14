import { PasswordResetToken } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class PasswordResetTokenRepository extends BaseRepository<PasswordResetToken> {
  constructor() {
    super(prisma.passwordResetToken);
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.modelDelegate.findUnique({
      where: { tokenHash },
    });
  }

  async markAsUsed(id: string): Promise<PasswordResetToken> {
    return this.modelDelegate.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteManyByUserId(userId: string): Promise<{ count: number }> {
    return this.modelDelegate.deleteMany({
      where: { userId },
    });
  }
}

export default new PasswordResetTokenRepository();
