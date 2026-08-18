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

  /**
   * List projection that excludes `imageUrl` (a base64 data URL, often
   * megabytes) and `rawText`. Carries the linked transaction id so the client
   * can tell which receipts have already been filed.
   */
  async findSummariesByUserId(userId: string) {
    return this.modelDelegate.findMany({
      where: { userId },
      select: {
        id: true,
        extractedMerchant: true,
        extractedAmount: true,
        extractedDate: true,
        createdAt: true,
        updatedAt: true,
        transaction: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
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
