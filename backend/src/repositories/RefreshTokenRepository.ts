import { RefreshToken } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class RefreshTokenRepository extends BaseRepository<RefreshToken> {
  constructor() {
    super(prisma.refreshToken);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return this.modelDelegate.findUnique({
      where: { token },
    });
  }

  async deleteByToken(token: string): Promise<RefreshToken | null> {
    return this.modelDelegate.delete({
      where: { token },
    });
  }

  async deleteManyByUserId(userId: string): Promise<{ count: number }> {
    return this.modelDelegate.deleteMany({
      where: { userId },
    });
  }
}

export default new RefreshTokenRepository();
