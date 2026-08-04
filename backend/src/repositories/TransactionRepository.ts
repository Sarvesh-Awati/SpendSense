import { Transaction, CategoryType, Prisma } from '@prisma/client';
import { BaseRepository } from './BaseRepository';
import prisma from '../database/prisma';

export interface TransactionFilters {
  search?: string;
  categoryId?: string;
  type?: CategoryType;
  startDate?: Date;
  endDate?: Date;
  isSubscription?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginationParams {
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor() {
    super(prisma.transaction);
  }

  // Advanced query filters, sorting and pagination for transactions log
  async findFiltered(
    userId: string,
    filters: TransactionFilters,
    pagination: PaginationParams
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const where: Prisma.TransactionWhereInput = { userId };

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { merchant: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isSubscription !== undefined) {
      where.isSubscription = filters.isSubscription;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    const total = await this.count(where);

    const transactions = await this.modelDelegate.findMany({
      where,
      orderBy: {
        [pagination.sortBy || 'date']: pagination.sortOrder || 'desc',
      },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        category: {
          select: {
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    return { transactions, total };
  }

  // Get aggregated sum group by category for dashboard breakdowns
  async getCategorySpending(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<unknown[]> {
    return this.modelDelegate.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: CategoryType.EXPENSE,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });
  }
}

export default new TransactionRepository();
