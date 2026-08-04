import { Transaction, CategoryType, Currency } from '@prisma/client';
import transactionRepository, { TransactionFilters } from '../repositories/TransactionRepository';
import categoryRepository from '../repositories/CategoryRepository';
import { NotFoundError } from '../errors/AppError';

export class TransactionService {
  /**
   * Creates a new transaction for the authenticated user.
   */
  async create(
    userId: string,
    data: {
      amount: number;
      currency?: Currency;
      description?: string | null;
      merchant?: string | null;
      date: Date;
      type: CategoryType;
      paymentMethod?: string | null;
      categoryId: string;
      isSubscription?: boolean;
      receiptId?: string | null;
    }
  ): Promise<Transaction> {
    // Verify the category exists and belongs to this user (or is system default)
    const category = await categoryRepository.findById(data.categoryId);
    if (!category || (category.userId && category.userId !== userId)) {
      throw new NotFoundError('Category not found');
    }

    return transactionRepository.create({
      ...data,
      userId,
    });
  }

  /**
   * Retrieves a filtered, paginated list of transactions for the user.
   */
  async findAll(
    userId: string,
    query: {
      page: number;
      limit: number;
      search?: string;
      categoryId?: string;
      type?: CategoryType;
      isSubscription?: boolean;
      startDate?: Date;
      endDate?: Date;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ) {
    const { page, limit, sortBy, sortOrder, ...filters } = query;
    const skip = (page - 1) * limit;
    const take = limit;

    const { transactions, total } = await transactionRepository.findFiltered(
      userId,
      filters as TransactionFilters,
      { skip, take, sortBy, sortOrder }
    );

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single transaction, ensuring it belongs to the authenticated user.
   */
  async findById(userId: string, id: string): Promise<Transaction> {
    const transaction = await transactionRepository.findById(id);
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  /**
   * Updates a transaction, ensuring user ownership.
   */
  async update(
    userId: string,
    id: string,
    data: Partial<{
      amount: number;
      currency: Currency;
      description: string | null;
      merchant: string | null;
      date: Date;
      type: CategoryType;
      paymentMethod: string | null;
      categoryId: string;
      isSubscription: boolean;
      receiptId: string | null;
    }>
  ): Promise<Transaction> {
    // 1. Enforce transaction ownership
    const transaction = await transactionRepository.findById(id);
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }

    // 2. Validate category ownership if it is being modified
    if (data.categoryId) {
      const category = await categoryRepository.findById(data.categoryId);
      if (!category || (category.userId && category.userId !== userId)) {
        throw new NotFoundError('Category not found');
      }
    }

    return transactionRepository.update(id, data);
  }

  /**
   * Permanently deletes a transaction, enforcing ownership checks.
   */
  async delete(userId: string, id: string): Promise<Transaction> {
    // Enforce transaction ownership
    const transaction = await transactionRepository.findById(id);
    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }

    return transactionRepository.delete(id);
  }
}

export default new TransactionService();
