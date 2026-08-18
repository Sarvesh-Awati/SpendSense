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

    const sortBy = pagination.sortBy || 'date';
    const sortOrder = pagination.sortOrder || 'desc';

    /**
     * `id` is the tiebreaker, and it is not optional.
     *
     * Postgres gives no ordering guarantee between rows that tie on the sort
     * column, and it is free to answer two identical queries in different
     * orders. With offset pagination that means a row seen on page 1 can
     * reappear on page 2 while another is skipped entirely — most visible when
     * sorting by `date`, where a whole day of transactions ties. Appending a
     * unique column makes the total order deterministic.
     */
    const orderBy: Record<string, 'asc' | 'desc'>[] = [
      { [sortBy]: sortOrder },
      { id: sortOrder },
    ];

    const transactions = await this.modelDelegate.findMany({
      where,
      orderBy,
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
        convertedAmount: true,
      },
    });
  }
}

export default new TransactionRepository();
