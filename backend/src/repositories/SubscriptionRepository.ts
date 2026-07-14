import { Subscription } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class SubscriptionRepository extends BaseRepository<Subscription> {
  constructor() {
    super(prisma.subscription);
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
