import { Subscription } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class SubscriptionRepository extends BaseRepository<Subscription> {
  constructor() {
    super(prisma.subscription);
  }

  /**
   * Single subscription with its category joined.
   *
   * Reading one subscription used to load the user's entire collection just to
   * pick one row out of it — twice, on the update path.
   */
  async findByIdWithCategory(id: string): Promise<Subscription | null> {
    return this.modelDelegate.findUnique({
      where: { id },
      include: {
        category: {
          select: { name: true, icon: true, color: true },
        },
      },
    });
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    return this.modelDelegate.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: {
        nextRenewal: 'asc',
      },
    });
  }

  // Find active subscriptions that are renewing between specified dates
  async findUpcomingRenewals(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Subscription[]> {
    return this.modelDelegate.findMany({
      where: {
        userId,
        isActive: true,
        nextRenewal: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        nextRenewal: 'asc',
      },
    });
  }
}

export default new SubscriptionRepository();
