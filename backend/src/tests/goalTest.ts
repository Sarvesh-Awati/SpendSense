import goalService from '../services/goalService';
import goalRepository from '../repositories/GoalRepository';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import { Decimal } from '@prisma/client/runtime/library';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Savings Goals Service Unit Tests...\n');
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

  const mockGoal = {
    id: 'goal-uuid',
    name: 'Emergency Fund',
    targetAmount: new Decimal(50000),
    currentAmount: new Decimal(20000),
    targetDate: (() => {
      // Calculate a date exactly 82 days from now to test example criteria
      const date = new Date();
      date.setDate(date.getDate() + 82);
      return date;
    })(),
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. Goal Creation & Initial Calculation Check
  await runTest('Goal Creation & Calculations', async () => {
    goalRepository.create = async (data: any) => ({
      id: 'new-goal-uuid',
      name: data.name,
      targetAmount: new Decimal(data.targetAmount),
      currentAmount: new Decimal(data.currentAmount || 0),
      targetDate: data.targetDate || null,
      userId: data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await goalService.createGoal('user-1', {
      name: 'Emergency Fund',
      targetAmount: 50000,
      currentAmount: 20000,
      targetDate: mockGoal.targetDate,
    });

    assert(result.name === 'Emergency Fund', 'Name matches');
    assert(result.targetAmount === 50000, 'Target amount matches');
    assert(result.currentAmount === 20000, 'Current amount matches');
    assert(result.progressPercentage === 40, 'Progress percentage is 40%');
    assert(result.remainingAmount === 30000, 'Remaining is 30000');
    assert(result.daysRemaining === 82, 'Days remaining is 82');
    assert(result.isCompleted === false, 'isCompleted is false');
  });

  // 2. Goal Updates
  await runTest('Goal Update Operations', async () => {
    goalRepository.findById = async () => mockGoal as any;
    goalRepository.update = async (id: string, data: any) => ({
      ...mockGoal,
      name: data.name || mockGoal.name,
      targetAmount: data.targetAmount !== undefined ? new Decimal(data.targetAmount) : mockGoal.targetAmount,
    } as any);

    const result = await goalService.updateGoal('user-1', 'goal-uuid', {
      name: 'Emergency Fund V2',
      targetAmount: 60000,
    });

    assert(result.name === 'Emergency Fund V2', 'Name updated');
    assert(result.targetAmount === 60000, 'Target amount updated');
    assert(result.progressPercentage === 33.3, 'Progress recalculated');
  });

  // 3. Goal Deletion
  await runTest('Goal Deletion Operations', async () => {
    goalRepository.findById = async () => mockGoal as any;
    goalRepository.delete = async () => mockGoal as any;

    const result = await goalService.deleteGoal('user-1', 'goal-uuid');
    assert(result.id === 'goal-uuid', 'Goal deleted successfully');
  });

  // 4. Contribution and Increment Logic
  await runTest('Contribution and Increment Math', async () => {
    goalRepository.findById = async () => mockGoal as any;
    goalRepository.updateBalance = async (id: string, amount: number) => ({
      ...mockGoal,
      currentAmount: new Decimal(amount),
    } as any);

    const result = await goalService.contributeToGoal('user-1', 'goal-uuid', 10000);
    assert(result.currentAmount === 30000, 'Balance incremented by 10000');
    assert(result.progressPercentage === 60, 'Progress updated to 60%');
    assert(result.remainingAmount === 20000, 'Remaining is 20000');
  });

  // 5. Completed Goal State
  await runTest('Completed Goal Checks', async () => {
    const customGoal = {
      ...mockGoal,
      currentAmount: new Decimal(50000),
    };
    goalRepository.findById = async () => customGoal as any;

    const result = await goalService.getGoalById('user-1', 'goal-uuid');
    assert(result.isCompleted === true, 'Goal should resolve to completed');
    assert(result.progressPercentage === 100, 'Progress is 100%');
    assert(result.remainingAmount === 0, 'Remaining should be 0');
  });

  // 6. Tenant Isolation checks
  await runTest('Prevent Fetching Foreign Goal Detail (Tenant Isolation)', async () => {
    const foreignGoal = {
      ...mockGoal,
      userId: 'user-2',
    };
    goalRepository.findById = async () => foreignGoal as any;

    try {
      await goalService.getGoalById('user-1', 'goal-uuid');
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Error must be a NotFoundError');
    }
  });

  // 7. Validation Boundary Check
  await runTest('Reject Negative Contribution Values', async () => {
    goalRepository.findById = async () => mockGoal as any;

    try {
      await goalService.contributeToGoal('user-1', 'goal-uuid', -100);
      assert(false, 'Should throw BadRequestError');
    } catch (err: unknown) {
      assert(err instanceof BadRequestError, 'Error must be a BadRequestError');
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
