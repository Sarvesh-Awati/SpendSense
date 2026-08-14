import prisma from '../database/prisma';
import { CategoryType, Transaction } from '@prisma/client';
import subscriptionService, { SubscriptionStats } from './subscriptionService';
import { Decimal } from '@prisma/client/runtime/library';
import { assertAllTransactionsConverted } from '../utils/reportingGuard';

// Shared interfaces to avoid 'any'
interface CategorySpendingData {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
}

interface TrendBucket {
  date: string;
  income: number;
  expense: number;
}

interface TopMerchant {
  merchant: string;
  amount: number;
}

interface SubscriptionDashboardData {
  activeCount: number;
  monthlyTotal: number;
  unconvertibleCount: number;
  upcomingRenewals: SubscriptionStats[];
  topExpensive: SubscriptionStats[];
}

export interface DashboardData {
  summary: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    savings: number;
    savingsRate: number;
    dailyAverageExpense: number;
  };
  health: {
    score: number;
    status: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  };
  quickInsights: string[];
  comparison: {
    incomeChangePercent: number;
    expenseChangePercent: number;
    prevMonthlyIncome: number;
    prevMonthlyExpenses: number;
  };
  categorySpending: CategorySpendingData[];
  spendingTrend: TrendBucket[];
  topMerchants: TopMerchant[];
  recentTransactions: Array<Transaction & { category: { name: string; icon: string; color: string } | null }>;
  subscriptions: SubscriptionDashboardData;
}

// Utility to parse Prisma Decimals safely
const safeDecimal = (val: Decimal | number | null | undefined): number => {
  if (val === null || val === undefined) return 0;
  return Number(val);
};

export class DashboardService {
  async getMetrics(userId: string): Promise<DashboardData> {
    // Refuse to report rather than silently understate: SUM() skips NULLs.
    await assertAllTransactionsConverted({ userId });

    const now = new Date();
    
    // Strict Date Boundaries (using local start/end times but parsed safely to avoid jumps)
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Start/End of current month
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const endOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    
    // Start/End of previous month
    const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    
    // 30 Days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Parallelize all independent external fetches to reduce latency (split to avoid TS tuple overflow)
    const [
      allTimeIncome,
      allTimeExpense,
      currentMonthSums,
      prevMonthSums,
      categoryGroupSums,
    ] = await Promise.all([
      // Total Income
      prisma.transaction.aggregate({
        _sum: { convertedAmount: true },
        where: { userId, type: CategoryType.INCOME },
      }),
      // Total Expense
      prisma.transaction.aggregate({
        _sum: { convertedAmount: true },
        where: { userId, type: CategoryType.EXPENSE },
      }),
      // Current Month
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { convertedAmount: true },
        where: { userId, date: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
      }),
      // Previous Month
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { convertedAmount: true },
        where: { userId, date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      }),
      // Category Breakdown (Current Month)
      prisma.transaction.groupBy({
        by: ['categoryId'],
        _sum: { convertedAmount: true },
        where: { userId, type: CategoryType.EXPENSE, date: { gte: startOfCurrentMonth, lte: endOfCurrentMonth } },
      }),
    ]);

    const [
      last30DaysTransactions,
      merchantSums,
      recentTransactions,
      userSubscriptions,
      allCategories,
      activeBudgets
    ] = await Promise.all([
      // 30 Day Trend
      prisma.transaction.findMany({
        select: { date: true, convertedAmount: true, type: true },
        where: { userId, date: { gte: thirtyDaysAgo } },
      }),
      // Top Merchants
      prisma.transaction.groupBy({
        by: ['merchant'],
        _sum: { convertedAmount: true },
        where: { 
          userId, 
          type: CategoryType.EXPENSE, 
          date: { gte: startOfCurrentMonth, lte: endOfCurrentMonth }, 
          merchant: { not: null },
          NOT: { merchant: '' }
        },
        orderBy: { _sum: { convertedAmount: 'desc' } },
        take: 5,
      }),
      // Recent Transactions
      prisma.transaction.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        include: { category: { select: { name: true, icon: true, color: true } } },
      }),
      // Subscriptions (delegated to SubscriptionService for all logic and rolling forwards)
      subscriptionService.getSubscriptions(userId),
      // User and System Categories
      prisma.category.findMany({
        where: { OR: [{ userId: null }, { userId }] },
      }),
      // Active Budgets
      prisma.budget.findMany({
        where: { userId, startDate: { lte: now }, endDate: { gte: now } },
        include: { category: true }
      }),
    ]);

    // 1. Total Balance Calculations
    const totalIncome = safeDecimal(allTimeIncome._sum.convertedAmount);
    const totalExpense = safeDecimal(allTimeExpense._sum.convertedAmount);
    const totalBalance = totalIncome - totalExpense;

    // 2. Month-over-Month Comparisons
    type SumGroup = { type: CategoryType; _sum: { convertedAmount: Decimal | null } };
    
    const getSums = (sumsArray: SumGroup[]) => {
      let income = 0;
      let expense = 0;
      for (const group of sumsArray) {
        if (group.type === CategoryType.INCOME) income = safeDecimal(group._sum.convertedAmount);
        if (group.type === CategoryType.EXPENSE) expense = safeDecimal(group._sum.convertedAmount);
      }
      return { income, expense };
    };

    const currentSums = getSums(currentMonthSums);
    const previousSums = getSums(prevMonthSums);

    const monthlyIncome = currentSums.income;
    const monthlyExpenses = currentSums.expense;
    const savings = monthlyIncome - monthlyExpenses;
    
    // Protection against division by zero
    const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
    
    const currentDay = Math.max(1, now.getDate());
    const dailyAverageExpense = monthlyExpenses / currentDay;

    const calcChangePercent = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const incomeChangePercent = calcChangePercent(monthlyIncome, previousSums.income);
    const expenseChangePercent = calcChangePercent(monthlyExpenses, previousSums.expense);

    // 3. Category Spending Breakdown
    const categorySpendingMap = new Map<string, typeof allCategories[0]>();
    for (const cat of allCategories) {
      categorySpendingMap.set(cat.id, cat);
    }

    let categorySpending: CategorySpendingData[] = categoryGroupSums.map((group) => {
      const catInfo = categorySpendingMap.get(group.categoryId);
      return {
        id: group.categoryId,
        name: catInfo?.name || 'Uncategorized',
        icon: catInfo?.icon || 'Tag',
        color: catInfo?.color || '#94a3b8',
        amount: safeDecimal(group._sum.convertedAmount),
        percentage: 0, // Calculated sequentially below
      };
    });

    categorySpending.sort((a, b) => b.amount - a.amount);
    if (monthlyExpenses > 0) {
      for (const cat of categorySpending) {
        cat.percentage = Number(((cat.amount / monthlyExpenses) * 100).toFixed(1));
      }
    }

    // 4. Daily Spending Trend
    const trendBucketsMap = new Map<string, TrendBucket>();
    
    // Seed buckets correctly considering local time boundaries
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      // To strictly match ISO date string behavior without timezone drift, format locally
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      trendBucketsMap.set(dateKey, { date: dateKey, income: 0, expense: 0 });
    }

    for (const tx of last30DaysTransactions) {
      // Extract local YYYY-MM-DD from the UTC date to match how user sees it
      const txYear = tx.date.getFullYear();
      const txMonth = String(tx.date.getMonth() + 1).padStart(2, '0');
      const txDay = String(tx.date.getDate()).padStart(2, '0');
      const dateKey = `${txYear}-${txMonth}-${txDay}`;
      
      const bucket = trendBucketsMap.get(dateKey);
      if (bucket) {
        const val = safeDecimal(tx.convertedAmount);
        if (tx.type === CategoryType.INCOME) bucket.income += val;
        if (tx.type === CategoryType.EXPENSE) bucket.expense += val;
      }
    }

    const spendingTrend = Array.from(trendBucketsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 5. Top Merchants
    const topMerchants: TopMerchant[] = merchantSums
      .filter((group) => group.merchant && group.merchant.trim() !== '')
      .map((group) => ({
        merchant: group.merchant!,
        amount: safeDecimal(group._sum.convertedAmount),
      }));

    // 6. Subscriptions Data Handling
    // Rely entirely on the heavily tested SubscriptionService outputs
    const activeSubs = userSubscriptions.filter(sub => sub.isActive);
    let subMonthlyTotal = 0;
    const upcomingRenewals: SubscriptionStats[] = [];

    let subsUnconvertible = 0;
    for (const sub of activeSubs) {
      // Only base-currency-comparable values may enter the total.
      if (sub.monthlyEquivalentInBase === null) {
        subsUnconvertible++;
      } else {
        subMonthlyTotal += sub.monthlyEquivalentInBase;
      }
      if (sub.daysUntilRenewal <= 14) {
        upcomingRenewals.push(sub);
      }
    }

    upcomingRenewals.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
    
    // Get top 3 expensive active subscriptions
    const topExpensive = [...activeSubs]
      .sort((a, b) => b.monthlyEquivalentCost - a.monthlyEquivalentCost)
      .slice(0, 3);
      
    // Map Recent Transactions to ensure non-null icons
    const safeRecentTransactions = recentTransactions.map(tx => ({
      ...tx,
      category: tx.category ? {
        name: tx.category.name,
        icon: tx.category.icon || 'category',
        color: tx.category.color || '#94a3b8'
      } : null
    }));

    // --- Health Score Calculation ---
    let healthScore = 0;

    // 1. Savings Rate (max 40 points)
    if (savingsRate >= 20) {
      healthScore += 40;
    } else if (savingsRate > 0) {
      healthScore += (savingsRate / 20) * 40;
    }

    // 2. Budget Adherence (max 30 points)
    if (activeBudgets.length > 0) {
      let totalBudgetLimit = 0;
      let totalSpentAgainstBudget = 0;
      for (const budget of activeBudgets) {
        const limit = safeDecimal(budget.amount);
        totalBudgetLimit += limit;
        if (budget.categoryId) {
          const catSpend = categorySpending.find(c => c.id === budget.categoryId);
          totalSpentAgainstBudget += (catSpend ? catSpend.amount : 0);
        } else {
          totalSpentAgainstBudget += monthlyExpenses;
        }
      }
      if (totalBudgetLimit > 0) {
        const adherence = totalSpentAgainstBudget / totalBudgetLimit;
        if (adherence <= 0.8) {
          healthScore += 30;
        } else if (adherence <= 1) {
          healthScore += 30 - ((adherence - 0.8) / 0.2) * 20;
        }
      } else {
        healthScore += 20; 
      }
    } else {
      // If no budgets, neutral score addition
      healthScore += 15;
    }

    // 3. Subscription Burden (max 15 points)
    const subBurden = monthlyIncome > 0 ? (subMonthlyTotal / monthlyIncome) * 100 : 0;
    if (subBurden <= 5) {
      healthScore += 15;
    } else if (subBurden <= 15) {
      healthScore += 15 - ((subBurden - 5) / 10) * 15;
    }

    // 4. Income vs Expense (max 15 points)
    if (monthlyIncome > monthlyExpenses) {
      healthScore += 15;
    } else if (monthlyIncome > 0) {
      const deficit = (monthlyExpenses - monthlyIncome) / monthlyIncome;
      healthScore += Math.max(0, 15 - deficit * 15);
    }

    // Determine status
    let healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
    if (healthScore >= 80) healthStatus = 'Excellent';
    else if (healthScore >= 60) healthStatus = 'Good';
    else if (healthScore >= 40) healthStatus = 'Fair';
    else healthStatus = 'Needs Attention';

    // --- Quick Insights Generation ---
    const quickInsights: string[] = [];

    if (expenseChangePercent < 0) {
      quickInsights.push(`You spent ${Math.abs(Number(expenseChangePercent.toFixed(1)))}% less than last month.`);
    } else if (expenseChangePercent > 0) {
      quickInsights.push(`Your spending increased by ${Number(expenseChangePercent.toFixed(1))}% compared to last month.`);
    }

    if (savingsRate > 0) {
      quickInsights.push(`You are saving ${Number(savingsRate.toFixed(1))}% of your income.`);
    }

    if (upcomingRenewals.length > 0) {
      const nextSub = upcomingRenewals[0];
      quickInsights.push(`${nextSub.name} renews in ${nextSub.daysUntilRenewal} days.`);
    }

    for (const budget of activeBudgets) {
      const limit = safeDecimal(budget.amount);
      let spent = 0;
      if (budget.categoryId) {
        const catSpend = categorySpending.find(c => c.id === budget.categoryId);
        spent = catSpend ? catSpend.amount : 0;
      } else {
        spent = monthlyExpenses;
      }
      if (limit > 0) {
        const usage = spent / limit;
        const name = budget.categoryId && budget.category ? budget.category.name : 'your overall';
        if (usage >= 0.9 && usage <= 1) {
          quickInsights.push(`You are close to exceeding ${name} budget.`);
        } else if (usage > 1) {
          quickInsights.push(`You have exceeded ${name} budget.`);
        }
      }
    }

    const finalInsights = quickInsights.slice(0, 4);

    // Assembly and numeric serialization
    return {
      summary: {
        totalBalance: Number(totalBalance.toFixed(2)),
        monthlyIncome: Number(monthlyIncome.toFixed(2)),
        monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
        savings: Number(savings.toFixed(2)),
        savingsRate: Number(savingsRate.toFixed(1)),
        dailyAverageExpense: Number(dailyAverageExpense.toFixed(2)),
      },
      health: {
        score: Math.round(healthScore),
        status: healthStatus,
      },
      quickInsights: finalInsights,
      comparison: {
        incomeChangePercent: Number(incomeChangePercent.toFixed(1)),
        expenseChangePercent: Number(expenseChangePercent.toFixed(1)),
        prevMonthlyIncome: Number(previousSums.income.toFixed(2)),
        prevMonthlyExpenses: Number(previousSums.expense.toFixed(2)),
      },
      categorySpending,
      spendingTrend,
      topMerchants,
      recentTransactions: safeRecentTransactions,
      subscriptions: {
        activeCount: activeSubs.length,
        monthlyTotal: Number(subMonthlyTotal.toFixed(2)),
        // > 0 means the monthly total excludes subscriptions that could not be
        // priced in the base currency; the UI must not present it as complete.
        unconvertibleCount: subsUnconvertible,
        upcomingRenewals: upcomingRenewals.slice(0, 3), // Provide max 3 for dashboard space constraints
        topExpensive,
      }
    };
  }
}

export default new DashboardService();
