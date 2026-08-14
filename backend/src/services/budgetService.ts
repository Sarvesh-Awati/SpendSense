import prisma from '../database/prisma';
import budgetRepository from '../repositories/BudgetRepository';
import categoryRepository from '../repositories/CategoryRepository';
import userRepository from '../repositories/UserRepository';
import { NotFoundError } from '../errors/AppError';
import { assertAllTransactionsConverted } from '../utils/reportingGuard';
import { Budget, CategoryType, Prisma, Currency } from '@prisma/client';

export interface BudgetWithStats {
  id: string;
  amount: number;
  currency: Currency;
  startDate: Date;
  endDate: Date;
  userId: string;
  categoryId: string | null;
  category: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isWarning: boolean;
  isExceeded: boolean;
  predictions: {
    projectedSpend: number;
    recommendedDailyLimit: number;
    suggestedBudgetLimit: number;
    status: 'Safe' | 'At Risk' | 'Exceeded';
  };
}

export class BudgetService {
  /**
   * Helper to calculate aggregate spending for a budget.
   */
  private async calculateSpending(
    userId: string,
    categoryId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    // Budget amounts are denominated in the account base currency, so spend
    // must be compared in the same unit.
    await assertAllTransactionsConverted({ userId });

    const aggregate = await prisma.transaction.aggregate({
      _sum: { convertedAmount: true },
      where: {
        userId,
        type: CategoryType.EXPENSE,
        date: { gte: startDate, lte: endDate },
        ...(categoryId && { categoryId }),
      },
    });

    return aggregate._sum.convertedAmount ? Number(aggregate._sum.convertedAmount) : 0;
  }

  /**
   * Helper to format raw Budget items to Budgets with Stats payload.
   */
  private async formatBudgetStats(
    userId: string, 
    budget: Budget & { category?: { name: string; icon: string | null; color: string | null } | null }
  ): Promise<BudgetWithStats> {
    const spent = await this.calculateSpending(
      userId,
      budget.categoryId,
      budget.startDate,
      budget.endDate
    );

    const amount = Number(budget.amount);
    const remaining = amount - spent;
    const percentageUsed = amount > 0 ? (spent / amount) * 100 : 0;

    // --- Predictive Logic ---
    const now = new Date();
    const start = new Date(budget.startDate);
    const end = new Date(budget.endDate);
    
    // Default to 1 to avoid division by zero
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    let daysElapsed = 0;
    if (now >= start) {
      daysElapsed = Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    const daysLeft = Math.max(0, totalDays - daysElapsed);

    // Projected Spend
    let projectedSpend = spent;
    if (daysElapsed > 0 && daysElapsed < totalDays) {
      const dailySpendPace = spent / daysElapsed;
      projectedSpend = spent + (dailySpendPace * daysLeft);
    }

    // Recommended Daily Limit
    const recommendedDailyLimit = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : 0;

    // Suggested Limit
    let suggestedBudgetLimit = amount;
    if (projectedSpend > amount) {
      suggestedBudgetLimit = projectedSpend * 1.05; // 5% buffer on projection
    }

    // Status
    let status: 'Safe' | 'At Risk' | 'Exceeded' = 'Safe';
    if (spent >= amount) {
      status = 'Exceeded';
    } else if (projectedSpend > amount || percentageUsed >= 80) {
      status = 'At Risk';
    }

    return {
      id: budget.id,
      amount,
      currency: budget.currency,
      startDate: budget.startDate,
      endDate: budget.endDate,
      userId: budget.userId,
      categoryId: budget.categoryId,
      category: budget.category
        ? {
            name: budget.category.name,
            icon: budget.category.icon,
            color: budget.category.color,
          }
        : null,
      spent: Number(spent.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      percentageUsed: Number(percentageUsed.toFixed(1)),
      isWarning: percentageUsed >= 80,
      isExceeded: percentageUsed > 100,
      predictions: {
        projectedSpend: Number(projectedSpend.toFixed(2)),
        recommendedDailyLimit: Number(recommendedDailyLimit.toFixed(2)),
        suggestedBudgetLimit: Math.ceil(suggestedBudgetLimit / 10) * 10, // Round up to nearest 10
        status
      }
    };
  }

  /**
   * Creates a new budget.
   */
  async create(
    userId: string,
    data: {
      amount: number;
      currency?: Currency;
      startDate: Date;
      endDate: Date;
      categoryId?: string | null;
    }
  ): Promise<BudgetWithStats> {
    // If categoryId is set, verify it belongs to user
    if (data.categoryId) {
      const category = await categoryRepository.findById(data.categoryId);
      if (!category || (category.userId && category.userId !== userId)) {
        throw new NotFoundError('Category not found');
      }
    }

    // Phase 1 multi-currency: budgets are always denominated in the account
    // base currency, so `spent` (converted) and `amount` share one unit and no
    // FX happens during budget maths. A client-supplied currency is ignored.
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const baseCurrency = (user.baseCurrency ?? user.preferredCurrency) as Currency;

    const budget = await budgetRepository.create({
      currency: baseCurrency,
      amount: new Prisma.Decimal(data.amount),
      startDate: data.startDate,
      endDate: data.endDate,
      userId,
      categoryId: data.categoryId || null,
    });

    // Populate category metadata for response if present
    const categoryInfo = data.categoryId
      ? await categoryRepository.findById(data.categoryId)
      : null;

    const budgetWithCategory = {
      ...budget,
      category: categoryInfo,
    };

    return this.formatBudgetStats(userId, budgetWithCategory);
  }

  /**
   * Fetches all budgets for a user along with aggregate stats.
   */
  async findAll(userId: string): Promise<BudgetWithStats[]> {
    const budgets = await budgetRepository.findByUserId(userId);
    
    // Resolve stats for all budgets concurrently
    return Promise.all(budgets.map((b) => this.formatBudgetStats(userId, b)));
  }

  /**
   * Fetches a single budget details.
   */
  async findById(userId: string, id: string): Promise<BudgetWithStats> {
    const budget = await budgetRepository.findById(id);
    if (!budget || budget.userId !== userId) {
      throw new NotFoundError('Budget not found');
    }

    // Resolve category details
    const categoryInfo = budget.categoryId
      ? await categoryRepository.findById(budget.categoryId)
      : null;

    const budgetWithCategory = {
      ...budget,
      category: categoryInfo,
    };

    return this.formatBudgetStats(userId, budgetWithCategory);
  }

  /**
   * Updates an existing budget.
   */
  async update(
    userId: string,
    id: string,
    data: Partial<{
      amount: number;
      currency: Currency;
      startDate: Date;
      endDate: Date;
      categoryId: string | null;
    }>
  ): Promise<BudgetWithStats> {
    const budget = await budgetRepository.findById(id);
    if (!budget || budget.userId !== userId) {
      throw new NotFoundError('Budget not found');
    }

    if (data.categoryId) {
      const category = await categoryRepository.findById(data.categoryId);
      if (!category || (category.userId && category.userId !== userId)) {
        throw new NotFoundError('Category not found');
      }
    }

    // Currency is not user-editable in this phase.
    const { currency: _ignoredCurrency, ...safeData } = data;

    const updatedBudget = await budgetRepository.update(id, {
      ...safeData,
      amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
    });

    const categoryInfo = updatedBudget.categoryId
      ? await categoryRepository.findById(updatedBudget.categoryId)
      : null;

    const budgetWithCategory = {
      ...updatedBudget,
      category: categoryInfo,
    };

    return this.formatBudgetStats(userId, budgetWithCategory);
  }

  /**
   * Permanently deletes a budget.
   */
  async delete(userId: string, id: string): Promise<Budget> {
    const budget = await budgetRepository.findById(id);
    if (!budget || budget.userId !== userId) {
      throw new NotFoundError('Budget not found');
    }

    return budgetRepository.delete(id);
  }
}

export default new BudgetService();
