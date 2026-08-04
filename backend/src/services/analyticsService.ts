import prisma from '../database/prisma';
import { CategoryType, Transaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import aiService from './aiService';

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
    largestExpenses: Transaction[];
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
    largestTransaction: Transaction | null;
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
  async getAnalytics(userId: string): Promise<AnalyticsData> {
    const now = new Date();
    
    // Fetch all user transactions to do comprehensive analysis
    // For a real production app, we would bound this to a year or 6 months,
    // but the prompt implies comprehensive historical analysis
    const allTransactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    // We can also fetch categories to have their full names
    const allCategories = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] }
    });

    const categoryMap = new Map<string, string>();
    allCategories.forEach(c => categoryMap.set(c.id, c.name));

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
      const amount = safeDecimal(tx.amount);
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
        curMonthCat.set(catName, (curMonthCat.get(catName) || 0) + safeDecimal(tx.amount));
      } else if (mk === prevMonthKey) {
        prevMonthCat.set(catName, (prevMonthCat.get(catName) || 0) + safeDecimal(tx.amount));
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

    // Largest Expenses
    const largestExpenses = allTransactions
      .filter(tx => tx.type === CategoryType.EXPENSE)
      .sort((a, b) => safeDecimal(b.amount) - safeDecimal(a.amount))
      .slice(0, 10);
      
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

    // Generate AI Insights
    const summaryPayload = {
      monthlySavings: Number(monthlySavings.toFixed(2)),
      topCategories: sortedCategories.slice(0, 3),
      savingsTrend: savingsTrend.slice(-3),
      fastestGrowingCategory,
      dailySpending: Number(dailySpending.toFixed(2)),
    };
    
    // Non-blocking AI call or blocking? Blocking is fine for the analytics endpoint.
    const aiInsights = await aiService.generateFinancialInsights(summaryPayload);

    return {
      basic: {
        monthlySpendingTrend,
        incomeVsExpense,
        categoryComparison: sortedCategories,
        netWorthTrend,
        savingsTrend,
        topMerchants: sortedMerchants.slice(0, 5),
        largestExpenses: largestExpenses.slice(0, 5),
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
        largestTransaction: largestExpenses[0] || null,
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
}

export default new AnalyticsService();
