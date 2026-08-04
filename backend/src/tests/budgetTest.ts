import budgetService from '../services/budgetService';
import budgetRepository from '../repositories/BudgetRepository';
import categoryRepository from '../repositories/CategoryRepository';
import prisma from '../database/prisma';
import { NotFoundError } from '../errors/AppError';
import { CategoryType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Budget Service Unit Tests...\n');
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

  const mockCategory = {
    id: 'category-uuid',
    name: 'Utilities',
    type: CategoryType.EXPENSE,
    userId: 'user-1',
    icon: 'Lightbulb',
    color: '#00ff00',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBudget = {
    id: 'budget-uuid',
    amount: new Decimal(1000),
    startDate: new Date(),
    endDate: new Date(),
    userId: 'user-1',
    categoryId: 'category-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. Create Budget Success
  await runTest('Create Budget Success', async () => {
    categoryRepository.findById = async () => mockCategory;
    budgetRepository.create = async (data: any) => ({
      ...mockBudget,
      amount: new Decimal(data.amount),
    } as any);

    (prisma.transaction as unknown as Record<string, Function>).aggregate = async () => ({
      _sum: { amount: new Decimal(250) }, // spent 250 of 1000
    });

    const result = await budgetService.create('user-1', {
      amount: 1000,
      startDate: new Date(),
      endDate: new Date(),
      categoryId: 'category-uuid',
    });

    assert(result.amount === 1000, 'Budget amount must match');
    assert(result.spent === 250, 'Spent amount should be 250');
    assert(result.remaining === 750, 'Remaining should be 750');
    assert(result.percentageUsed === 25, 'Percentage used should be 25%');
    assert(result.isWarning === false, 'Warning trigger should be false');
    assert(result.isExceeded === false, 'Exceeded trigger should be false');
  });

  // 2. Budget Warning State (80%)
  await runTest('Trigger Budget Warning State at 80% Spent', async () => {
    categoryRepository.findById = async () => mockCategory;
    budgetRepository.create = async () => mockBudget as any;
    
    (prisma.transaction as unknown as Record<string, Function>).aggregate = async () => ({
      _sum: { amount: new Decimal(850) }, // spent 850 of 1000 = 85%
    });

    const result = await budgetService.create('user-1', {
      amount: 1000,
      startDate: new Date(),
      endDate: new Date(),
      categoryId: 'category-uuid',
    });

    assert(result.spent === 850, 'Spent should be 850');
    assert(result.percentageUsed === 85, 'Percentage used should be 85%');
    assert(result.isWarning === true, 'Warning flag should trigger at >= 80%');
    assert(result.isExceeded === false, 'Exceeded flag should remain false');
  });

  // 3. Budget Exceeded State (100%)
  await runTest('Trigger Budget Exceeded State at >100% Spent', async () => {
    categoryRepository.findById = async () => mockCategory;
    budgetRepository.create = async () => mockBudget as any;
    
    (prisma.transaction as unknown as Record<string, Function>).aggregate = async () => ({
      _sum: { amount: new Decimal(1200) }, // spent 1200 of 1000 = 120%
    });

    const result = await budgetService.create('user-1', {
      amount: 1000,
      startDate: new Date(),
      endDate: new Date(),
      categoryId: 'category-uuid',
    });

    assert(result.spent === 1200, 'Spent should be 1200');
    assert(result.percentageUsed === 120, 'Percentage should be 120%');
    assert(result.isWarning === true, 'Warning should be true');
    assert(result.isExceeded === true, 'Exceeded flag should trigger at > 100%');
  });

  // 4. Budget User Isolation Check
  await runTest('Prevent Fetching Foreign Budget Detail', async () => {
    const foreignBudget = {
      ...mockBudget,
      userId: 'user-2', // belongs to another user
    };

    budgetRepository.findById = async () => foreignBudget as any;

    try {
      await budgetService.findById('user-1', 'budget-uuid');
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Error must be a NotFoundError');
    }
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
