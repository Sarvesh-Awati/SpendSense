import prisma from '../database/prisma';
import { CategoryType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import aiService from './aiService';
import { assertAllTransactionsConverted } from '../utils/reportingGuard';
import {
  serializeTransaction,
  serializeTransactions,
  SerializedTransaction,
} from '../utils/serializeTransaction';

const safeDecimal = (val: Decimal | number | null | undefined): number => {
  if (val === null || val === undefined) return 0;
  return Number(val);
};

export interface AnalyticsData {
  basic: {
    monthlySpendingTrend: { month: string; amount: number }[];
    incomeVsExpense: { month: string; income: number; expense: number }[];
    categoryComparison: { category: string; amount: number; percentage: number }[];
    netWorthTrend: { date: string; balance: number }[];
    savingsTrend: { month: string; amount: number }[];
    topMerchants: { merchant: string; amount: number }[];
    largestExpenses: SerializedTransaction[];
  };
  averages: {
    dailySpending: number;
    weeklySpending: number;
    transactionAmount: number;
    monthlySavings: number;
  };
  smart: {
    top5Categories: { name: string; amount: number }[];
    top10Merchants: { merchant: string; amount: number }[];
    fastestGrowingCategory: { name: string; growthPercent: number } | null;
    largestTransaction: SerializedTransaction | null;
    longestSpendingStreak: number;
    biggestSavingsMonth: { month: string; amount: number } | null;
    mostExpensiveWeekday: { day: string; amount: number } | null;
    mostExpensiveWeekend: { day: string; amount: number } | null;
    mostUsedPaymentMethod: { method: string; count: number } | null;
    highestSpendingDay: { date: string; amount: number } | null;
    highestIncomeMonth: { month: string; amount: number } | null;
  };
  cashFlow: {
    inflow: number;
    outflow: number;
    net: number;
  };
  aiInsights: string[];
}

export class AnalyticsService {
  /**
   * @param includeInsights when false, the Gemini call is skipped and
   *   `aiInsights` comes back empty.
   *
   *   The whole payload used to block on the model: every page load spent a
   *   quota unit and waited seconds for text that occupies one panel at the
   *   bottom of the page, so charts that were ready in ~200ms were held behind
   *   it. The default stays `true` so existing clients see no change; the UI
   *   passes `?includeInsights=false` and fetches `GET /analytics/insights`
   *   separately, which lets the charts paint immediately and the advisor
   *   panel resolve — or fail, and be retried — on its own.
   */
  async getAnalytics(userId: string, includeInsights = true): Promise<AnalyticsData> {
    await assertAllTransactionsConverted({ userId });

    const now = new Date();
    
    /**
     * The whole history is loaded because cash-flow figures are all-time by
     * contract — see the known-limitations note in the README.
     *
     * What it does NOT do any more is join `category` onto every one of those
     * rows. Nothing in this method read the joined relation: category names
     * come from `categoryMap` below, built from one small separate query. The
     * join hydrated a full Category object per transaction across the entire
     * history purely so that five of them could be echoed back in
     * `largestExpenses` — which is reattached from the same map, for free,
     * further down. The response shape is unchanged.
     */
    const allTransactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    // Categories the user can see: their own plus the system-wide ones.
    const allCategories = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] }
    });

    const categoryMap = new Map<string, string>();
    allCategories.forEach(c => categoryMap.set(c.id, c.name));

    // Full rows, for reattaching to the handful of transactions we echo back.
    const categoryById = new Map(allCategories.map((c) => [c.id, c]));

    // Initialize all basic aggregations
    let totalExpense = 0;
    let totalIncome = 0;
    let expenseTxCount = 0;
    const monthlyDataMap = new Map<string, { income: number; expense: number }>();
    const categoryExpenseMap = new Map<string, number>();
    const merchantExpenseMap = new Map<string, number>();
    const paymentMethodMap = new Map<string, number>();
    const dailyExpenseMap = new Map<string, number>();
    const weekdayExpenseMap = new Map<string, number>();
    const weekendExpenseMap = new Map<string, number>();
    
    // For Net Worth Trend
    let runningBalance = 0;
    const netWorthTrendMap = new Map<string, number>();

    const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const getDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const tx of allTransactions) {
      const amount = safeDecimal(tx.convertedAmount);
      const monthKey = getMonthKey(tx.date);
      const dateKey = getDateKey(tx.date);
      const dayOfWeek = tx.date.getDay(); // 0 = Sunday, 6 = Saturday

      if (!monthlyDataMap.has(monthKey)) {
        monthlyDataMap.set(monthKey, { income: 0, expense: 0 });
      }
      const monthData = monthlyDataMap.get(monthKey)!;

      if (tx.type === CategoryType.INCOME) {
        totalIncome += amount;
        monthData.income += amount;
        runningBalance += amount;
      } else if (tx.type === CategoryType.EXPENSE) {
        totalExpense += amount;
        monthData.expense += amount;
        runningBalance -= amount;
        expenseTxCount++;
        
        // Category
        const catName = categoryMap.get(tx.categoryId) || 'Unknown';
        categoryExpenseMap.set(catName, (categoryExpenseMap.get(catName) || 0) + amount);
        
        // Merchant
        if (tx.merchant && tx.merchant.trim() !== '') {
          merchantExpenseMap.set(tx.merchant, (merchantExpenseMap.get(tx.merchant) || 0) + amount);
        }

        // Payment Method
        if (tx.paymentMethod) {
          paymentMethodMap.set(tx.paymentMethod, (paymentMethodMap.get(tx.paymentMethod) || 0) + 1);
        }

        // Daily
        dailyExpenseMap.set(dateKey, (dailyExpenseMap.get(dateKey) || 0) + amount);

        // Weekday vs Weekend
        const dayName = dayNames[dayOfWeek];
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendExpenseMap.set(dayName, (weekendExpenseMap.get(dayName) || 0) + amount);
        } else {
          weekdayExpenseMap.set(dayName, (weekdayExpenseMap.get(dayName) || 0) + amount);
        }
      }

      // Record net worth per day (takes the latest balance for that day)
      netWorthTrendMap.set(dateKey, runningBalance);
    }

    // Sort Month Data
    const sortedMonths = Array.from(monthlyDataMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    // Monthly spending trend & Income vs Expense & Savings Trend
    const monthlySpendingTrend = [];
    const incomeVsExpense = [];
    const savingsTrend = [];
    
    let biggestSavingsMonth = null;
    let highestIncomeMonth = null;
    
    let totalSavingsAcrossMonths = 0;
    
    for (const [month, data] of sortedMonths) {
      monthlySpendingTrend.push({ month, amount: data.expense });
      incomeVsExpense.push({ month, income: data.income, expense: data.expense });
      const savings = data.income - data.expense;
      savingsTrend.push({ month, amount: savings });
      totalSavingsAcrossMonths += savings;

      if (!biggestSavingsMonth || savings > biggestSavingsMonth.amount) {
        biggestSavingsMonth = { month, amount: savings };
      }
      
      if (!highestIncomeMonth || data.income > highestIncomeMonth.amount) {
        highestIncomeMonth = { month, amount: data.income };
      }
    }

    // Category comparison
    const sortedCategories = Array.from(categoryExpenseMap.entries())
      .map(([category, amount]) => ({ category, name: category, amount, percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
      
    // Fastest growing category (comparing current month to previous month)
    const currentMonthKey = getMonthKey(now);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = getMonthKey(prevMonthDate);
    
    let fastestGrowingCategory = null;
    let maxGrowth = -Infinity;
    
    // We would need month-by-month category data for strict fastest growing. Let's do a simplified approach:
    // Aggregate categories for current and prev month
    const curMonthCat = new Map<string, number>();
    const prevMonthCat = new Map<string, number>();
    
    for (const tx of allTransactions) {
      if (tx.type !== CategoryType.EXPENSE) continue;
      const mk = getMonthKey(tx.date);
      const catName = categoryMap.get(tx.categoryId) || 'Unknown';
      if (mk === currentMonthKey) {
        curMonthCat.set(catName, (curMonthCat.get(catName) || 0) + safeDecimal(tx.convertedAmount));
      } else if (mk === prevMonthKey) {
        prevMonthCat.set(catName, (prevMonthCat.get(catName) || 0) + safeDecimal(tx.convertedAmount));
      }
    }
    
    for (const [catName, curAmt] of curMonthCat.entries()) {
      const prevAmt = prevMonthCat.get(catName) || 0;
      if (prevAmt > 0) {
        const growth = ((curAmt - prevAmt) / prevAmt) * 100;
        if (growth > maxGrowth) {
          maxGrowth = growth;
          fastestGrowingCategory = { name: catName, growthPercent: Number(growth.toFixed(1)) };
        }
      }
    }

    // Top Merchants
    const sortedMerchants = Array.from(merchantExpenseMap.entries())
      .map(([merchant, amount]) => ({ merchant, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Largest Expenses.
    //
    // `category` is reattached here, from the map already in memory, so these
    // records carry exactly the shape they did when the bulk query eager-loaded
    // the relation for every transaction in the account. Ten objects instead of
    // a join across the whole history.
    const largestExpenses = allTransactions
      .filter(tx => tx.type === CategoryType.EXPENSE)
      .sort((a, b) => safeDecimal(b.convertedAmount) - safeDecimal(a.convertedAmount))
      .slice(0, 10)
      .map((tx) => ({ ...tx, category: categoryById.get(tx.categoryId) ?? null }));
      
    // Averages
    const transactionAmount = expenseTxCount > 0 ? totalExpense / expenseTxCount : 0;
    
    // Determine number of days tracked (from first transaction to now)
    let daysTracked = 1;
    if (allTransactions.length > 0) {
      const firstTxDate = allTransactions[0].date;
      const diffTime = Math.abs(now.getTime() - firstTxDate.getTime());
      daysTracked = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    }
    
    const dailySpending = totalExpense / daysTracked;
    const weeklySpending = dailySpending * 7;
    const monthlySavings = sortedMonths.length > 0 ? totalSavingsAcrossMonths / sortedMonths.length : 0;

    // Highest spending day
    let highestSpendingDay = null;
    let maxDaySpend = -Infinity;
    for (const [date, amount] of dailyExpenseMap.entries()) {
      if (amount > maxDaySpend) {
        maxDaySpend = amount;
        highestSpendingDay = { date, amount };
      }
    }

    // Longest spending streak
    let longestSpendingStreak = 0;
    let currentStreak = 0;
    const sortedDates = Array.from(dailyExpenseMap.keys()).sort();
    let prevDate = null;
    
    for (const d of sortedDates) {
      const curr = new Date(d);
      if (prevDate) {
        const diffDays = Math.round((curr.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          if (currentStreak > longestSpendingStreak) longestSpendingStreak = currentStreak;
          currentStreak = 1; // start new streak
        }
      } else {
        currentStreak = 1;
      }
      prevDate = curr;
    }
    if (currentStreak > longestSpendingStreak) longestSpendingStreak = currentStreak;

    // Most expensive weekday & weekend
    let mostExpensiveWeekday = null;
    let maxWkdaySpend = -Infinity;
    for (const [day, amount] of weekdayExpenseMap.entries()) {
      if (amount > maxWkdaySpend) {
        maxWkdaySpend = amount;
        mostExpensiveWeekday = { day, amount };
      }
    }
    
    let mostExpensiveWeekend = null;
    let maxWkendSpend = -Infinity;
    for (const [day, amount] of weekendExpenseMap.entries()) {
      if (amount > maxWkendSpend) {
        maxWkendSpend = amount;
        mostExpensiveWeekend = { day, amount };
      }
    }

    // Most used payment method
    let mostUsedPaymentMethod = null;
    let maxPmCount = -Infinity;
    for (const [method, count] of paymentMethodMap.entries()) {
      if (count > maxPmCount) {
        maxPmCount = count;
        mostUsedPaymentMethod = { method, count };
      }
    }

    // Transform maps to arrays for basic output
    const netWorthTrend = Array.from(netWorthTrendMap.entries()).map(([date, balance]) => ({ date, balance }));

    const aiInsights = includeInsights
      ? await aiService.generateFinancialInsights(
          this.buildInsightsSummary({
            monthlySavings,
            sortedCategories,
            savingsTrend,
            fastestGrowingCategory,
            dailySpending,
          })
        )
      : [];

    return {
      basic: {
        monthlySpendingTrend,
        incomeVsExpense,
        categoryComparison: sortedCategories,
        netWorthTrend,
        savingsTrend,
        topMerchants: sortedMerchants.slice(0, 5),
        // Serialised so `amount` is a number here exactly as it is on
        // /transactions. Prisma renders Decimal as a JSON string, so these
        // records used to arrive with `amount: "250.75"` on this one endpoint.
        largestExpenses: serializeTransactions(largestExpenses.slice(0, 5)),
      },
      averages: {
        dailySpending: Number(dailySpending.toFixed(2)),
        weeklySpending: Number(weeklySpending.toFixed(2)),
        transactionAmount: Number(transactionAmount.toFixed(2)),
        monthlySavings: Number(monthlySavings.toFixed(2)),
      },
      smart: {
        top5Categories: sortedCategories.slice(0, 5),
        top10Merchants: sortedMerchants.slice(0, 10),
        fastestGrowingCategory,
        largestTransaction: largestExpenses[0] ? serializeTransaction(largestExpenses[0]) : null,
        longestSpendingStreak,
        biggestSavingsMonth,
        mostExpensiveWeekday,
        mostExpensiveWeekend,
        mostUsedPaymentMethod,
        highestSpendingDay,
        highestIncomeMonth,
      },
      cashFlow: {
        inflow: Number(totalIncome.toFixed(2)),
        outflow: Number(totalExpense.toFixed(2)),
        net: Number((totalIncome - totalExpense).toFixed(2))
      },
      aiInsights
    };
  }

  /** The only shape sent to the model. Aggregates only — never raw records. */
  private buildInsightsSummary(input: {
    monthlySavings: number;
    sortedCategories: { category: string; amount: number; percentage: number }[];
    savingsTrend: { month: string; amount: number }[];
    fastestGrowingCategory: { name: string; growthPercent: number } | null;
    dailySpending: number;
  }) {
    return {
      monthlySavings: Number(input.monthlySavings.toFixed(2)),
      topCategories: input.sortedCategories.slice(0, 3),
      savingsTrend: input.savingsTrend.slice(-3),
      fastestGrowingCategory: input.fastestGrowingCategory,
      dailySpending: Number(input.dailySpending.toFixed(2)),
    };
  }

  /**
   * AI insights on their own, for the decoupled endpoint.
   *
   * Recomputes the aggregates the model needs rather than the full analytics
   * payload — the summary is five small numbers, so this is far cheaper than
   * the page-wide computation and keeps the two endpoints independent.
   */
  async getInsights(userId: string): Promise<string[]> {
    const analytics = await this.getAnalytics(userId, false);

    return aiService.generateFinancialInsights(
      this.buildInsightsSummary({
        monthlySavings: analytics.averages.monthlySavings,
        sortedCategories: analytics.basic.categoryComparison,
        savingsTrend: analytics.basic.savingsTrend,
        fastestGrowingCategory: analytics.smart.fastestGrowingCategory,
        dailySpending: analytics.averages.dailySpending,
      })
    );
  }
}

export default new AnalyticsService();
