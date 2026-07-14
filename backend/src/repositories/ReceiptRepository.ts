import { Receipt } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class ReceiptRepository extends BaseRepository<Receipt> {
  constructor() {
    super(prisma.receipt);
  }

  async findByUserId(userId: string): Promise<Receipt[]> {
    return this.modelDelegate.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Find receipts that do not have an associated transaction yet
  async findUnlinked(userId: string): Promise<Receipt[]> {
    return this.modelDelegate.findMany({
      where: {
        userId,
        transaction: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

export default new ReceiptRepository();
