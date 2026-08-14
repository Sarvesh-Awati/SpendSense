import goalRepository from '../repositories/GoalRepository';
import userRepository from '../repositories/UserRepository';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import { Goal, Prisma, Currency } from '@prisma/client';

export interface GoalWithStats {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  targetDate: Date | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  progressPercentage: number;
  remainingAmount: number;
  daysRemaining: number | null;
  isCompleted: boolean;
  predictions: {
    requiredMonthlyContribution: number | null;
    recommendedContribution: number;
    projectedCompletionDate: Date | null;
    completionProbability: 'High' | 'Medium' | 'Low' | null;
  };
}

export class GoalService {
  /**
   * Helper to append dynamic computed stats to a Goal object.
   */
  private formatGoalStats(goal: Goal): GoalWithStats {
    const currentAmount = Number(goal.currentAmount);
    const targetAmount = Number(goal.targetAmount);
    
    const progressPercentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);
    const isCompleted = currentAmount >= targetAmount;

    let daysRemaining: number | null = null;
    let requiredMonthlyContribution: number | null = null;
    let completionProbability: 'High' | 'Medium' | 'Low' | null = null;
    let projectedCompletionDate: Date | null = null;
    const recommendedContribution = remainingAmount > 0 ? (remainingAmount * 0.1) : 0; // fallback default
    
    if (goal.targetDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(goal.targetDate);
      target.setHours(0, 0, 0, 0);
      
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, diffDays);

      if (daysRemaining > 0) {
        const monthsRemaining = daysRemaining / 30.44; // avg days in month
        requiredMonthlyContribution = remainingAmount / monthsRemaining;
        
        // Simplified probability model (would normally use historical savings data)
        if (progressPercentage >= (100 - (monthsRemaining * 5))) {
          completionProbability = 'High';
        } else if (progressPercentage >= (100 - (monthsRemaining * 15))) {
          completionProbability = 'Medium';
        } else {
          completionProbability = 'Low';
        }
      } else if (!isCompleted) {
        completionProbability = 'Low';
      }
    }

    if (!isCompleted && remainingAmount > 0) {
      // Assuming user can save around 5% of target per month
      const estMonths = remainingAmount / (targetAmount * 0.05 + 1);
      const projDate = new Date();
      projDate.setMonth(projDate.getMonth() + Math.ceil(estMonths));
      projectedCompletionDate = projDate;
    }

    return {
      id: goal.id,
      name: goal.name,
      targetAmount,
      currentAmount,
      currency: goal.currency,
      targetDate: goal.targetDate,
      userId: goal.userId,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      progressPercentage: Number(progressPercentage.toFixed(1)),
      remainingAmount: Number(remainingAmount.toFixed(2)),
      daysRemaining,
      isCompleted,
      predictions: {
        requiredMonthlyContribution: requiredMonthlyContribution ? Number(requiredMonthlyContribution.toFixed(2)) : null,
        recommendedContribution: requiredMonthlyContribution ? Number(requiredMonthlyContribution.toFixed(2)) : Number(recommendedContribution.toFixed(2)),
        projectedCompletionDate,
        completionProbability,
      }
    };
  }

  /**
   * Create a new savings goal.
   */
  async createGoal(
    userId: string,
    data: {
      name: string;
      targetAmount: number;
      currentAmount?: number;
      currency?: Currency;
      targetDate?: Date | null;
    }
  ): Promise<GoalWithStats> {
    // Phase 1 multi-currency: goals are denominated in the account base
    // currency. No FX model is applied to currentAmount — correct handling
    // needs a per-contribution ledger, deferred to a future phase.
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    const baseCurrency = (user.baseCurrency ?? user.preferredCurrency) as Currency;

    const goal = await goalRepository.create({
      name: data.name,
      targetAmount: new Prisma.Decimal(data.targetAmount),
      currentAmount: new Prisma.Decimal(data.currentAmount || 0),
      currency: baseCurrency,
      targetDate: data.targetDate || null,
      userId,
    });

    return this.formatGoalStats(goal);
  }

  /**
   * Fetch all goals for a user.
   */
  async getGoals(userId: string): Promise<GoalWithStats[]> {
    const goals = await goalRepository.findByUserId(userId);
    return goals.map((g) => this.formatGoalStats(g));
  }

  /**
   * Fetch a single goal by ID.
   */
  async getGoalById(userId: string, id: string): Promise<GoalWithStats> {
    const goal = await goalRepository.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new NotFoundError('Goal not found');
    }
    return this.formatGoalStats(goal);
  }

  /**
   * Update goal details.
   */
  async updateGoal(
    userId: string,
    id: string,
    data: Partial<{
      name: string;
      targetAmount: number;
      currentAmount: number;
      currency: Currency;
      targetDate: Date | null;
    }>
  ): Promise<GoalWithStats> {
    const goal = await goalRepository.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new NotFoundError('Goal not found');
    }

    const { currency: _ignoredCurrency, ...safeData } = data;

    const updatedGoal = await goalRepository.update(id, {
      ...safeData,
      targetAmount: data.targetAmount !== undefined ? new Prisma.Decimal(data.targetAmount) : undefined,
      currentAmount: data.currentAmount !== undefined ? new Prisma.Decimal(data.currentAmount) : undefined,
    });

    return this.formatGoalStats(updatedGoal);
  }

  /**
   * Delete savings goal.
   */
  async deleteGoal(userId: string, id: string): Promise<Goal> {
    const goal = await goalRepository.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new NotFoundError('Goal not found');
    }
    return goalRepository.delete(id);
  }

  /**
   * Add contribution toward savings goal.
   */
  async contributeToGoal(
    userId: string,
    id: string,
    amount: number
  ): Promise<GoalWithStats> {
    const goal = await goalRepository.findById(id);
    if (!goal || goal.userId !== userId) {
      throw new NotFoundError('Goal not found');
    }

    if (amount <= 0) {
      throw new BadRequestError('Contribution amount must be positive');
    }

    const newAmount = Number(goal.currentAmount) + amount;
    if (newAmount < 0) {
      throw new BadRequestError('Target balance cannot fall below zero');
    }

    const updatedGoal = await goalRepository.updateBalance(id, newAmount);
    return this.formatGoalStats(updatedGoal);
  }
}

export default new GoalService();
