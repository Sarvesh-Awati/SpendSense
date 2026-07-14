import { Budget } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export class BudgetRepository extends BaseRepository<Budget> {
  constructor() {
    super(prisma.budget);
  }

  async findByUserId(userId: string): Promise<Budget[]> {
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
        createdAt: 'desc',
      },
    });
  }

  // Find active budget for a category during a specific date
  async findActiveByCategory(
    userId: string,
    categoryId: string,
    date: Date
  ): Promise<Budget | null> {
    return this.modelDelegate.findFirst({
      where: {
        userId,
        categoryId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }
}

export default new BudgetRepository();
