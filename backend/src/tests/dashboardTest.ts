import dashboardService from '../services/dashboardService';
import prisma from '../database/prisma';
import { CategoryType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Dashboard Aggregation Unit Tests...\n');
  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, testFn: () => Promise<void>) => {
    try {
      await testFn();
      console.log(`✅ Passed: ${name}`);
      passed++;
    } catch (error: unknown) {
      console.error(`❌ Failed: ${name}`);
      console.error(`   Reason: ${(error instanceof Error ? error.message : String(error)) || error}`);
      failed++;
    }
  };

  // Mock Date objects to keep testing consistent
  const mockTransactions = [
    { id: '1', amount: new Decimal(5000), type: CategoryType.INCOME, date: new Date() },
    { id: '2', amount: new Decimal(2000), type: CategoryType.EXPENSE, date: new Date() },
  ];

  // 1. Dashboard calculations success
  await runTest('Dashboard Standard Calculations Math', async () => {
    // Mock prisma database aggregate checks
    (prisma.transaction as unknown as Record<string, Function>).aggregate = async (args: any) => {
      if (args.where.type === CategoryType.INCOME) {
        return { _sum: { amount: new Decimal(5000) } } as any;
      }
      return { _sum: { amount: new Decimal(2000) } } as any;
    };

    // Mock prisma database group check conditions
    (prisma.transaction as unknown as Record<string, Function>).groupBy = async (args: any) => {
      // Category Spending groupBy
      if (args.by.includes('categoryId')) {
        return [
          { categoryId: 'cat-1', _sum: { amount: new Decimal(2000) } },
        ] as any;
      }
      
      // Merchant Spending groupBy
      if (args.by.includes('merchant')) {
        return [
          { merchant: 'Starbucks', _sum: { amount: new Decimal(100) } },
        ] as any;
      }

      // Monthly Sums groupBy
      return [
        { type: CategoryType.INCOME, _sum: { amount: new Decimal(5000) } },
        { type: CategoryType.EXPENSE, _sum: { amount: new Decimal(2000) } },
      ] as any;
    };

    (prisma.category as unknown as Record<string, Function>).findMany = async () => {
      return [
        { id: 'cat-1', name: 'Food', type: CategoryType.EXPENSE, icon: 'Utensils', color: '#ff0000', userId: null, createdAt: new Date(), updatedAt: new Date() },
      ] as any;
    };

    (prisma.transaction as unknown as Record<string, Function>).findMany = async (args: any) => {
      if (args.take === 5) {
        return [] as any; // mock recent transactions
      }
      return mockTransactions as any; // mock trend transactions
    };

    (prisma.subscription as unknown as Record<string, Function>).findMany = async () => [] as any;
    (prisma.budget as unknown as Record<string, Function>).findMany = async () => [] as any;

    const metrics = await dashboardService.getMetrics('c7bce779-7e73-41ae-90aa-705fd63d26c1');

    assert(metrics.summary.totalBalance === 3000, 'Total balance should be Incomes (5000) - Expenses (2000) = 3000');
    assert(metrics.summary.monthlyIncome === 5000, 'Monthly income should be 5000');
    assert(metrics.summary.monthlyExpenses === 2000, 'Monthly expenses should be 2000');
    assert(metrics.summary.savings === 3000, 'Savings should be 3000');
    assert(metrics.summary.savingsRate === 60, 'Savings rate should be (3000/5000) * 100 = 60%');
    assert(metrics.categorySpending.length === 1, 'Should return exactly 1 category spending tag');
    assert(metrics.categorySpending[0].name === 'Food', 'Category name should match mock category');
    assert(metrics.categorySpending[0].amount === 2000, 'Category spent amount should be 2000');
  });

  // 2. Division by zero protection (Zero Income rate checks)
  await runTest('Division By Zero Protection for Zero Income', async () => {
    (prisma.transaction as unknown as Record<string, Function>).aggregate = async (args: any) => {
      if (args.where.type === CategoryType.INCOME) {
        return { _sum: { amount: null } } as any; // No income
      }
      return { _sum: { amount: new Decimal(1500) } } as any;
    };

    (prisma.transaction as unknown as Record<string, Function>).groupBy = async (args: any) => {
      if (args.by.includes('categoryId')) return [] as any;
      if (args.by.includes('merchant')) return [] as any;
      return [
        { type: CategoryType.EXPENSE, _sum: { amount: new Decimal(1500) } },
      ] as any;
    };

    (prisma.transaction as unknown as Record<string, Function>).findMany = async () => [] as any;
    (prisma.subscription as unknown as Record<string, Function>).findMany = async () => [] as any;
    (prisma.budget as unknown as Record<string, Function>).findMany = async () => [] as any;

    const metrics = await dashboardService.getMetrics('c7bce779-7e73-41ae-90aa-705fd63d26c1');

    assert(metrics.summary.totalBalance === -1500, 'Total balance should reflect -1500');
    assert(metrics.summary.monthlyIncome === 0, 'Income must be zero');
    assert(metrics.summary.savingsRate === 0, 'Savings rate must fall back to 0 without throwing system division exception');
  });

  // Test report summary
  console.log(`\n=========================================`);
  console.log(` Test Executions Complete `);
  console.log(` Passed: ${passed} | Failed: ${failed} `);
  console.log(`=========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
