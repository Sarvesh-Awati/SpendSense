import subscriptionService from '../services/subscriptionService';
import subscriptionRepository from '../repositories/SubscriptionRepository';
import { NotFoundError, BadRequestError } from '../errors/AppError';
import { SubscriptionFrequency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Subscription Service Unit Tests...\n');
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

  // 1. Calculate Next Renewal (Weekly)
  await runTest('Calculate Next Renewal: Weekly', async () => {
    const startDate = new Date('2026-07-01T00:00:00Z');
    const refDate = new Date('2026-07-10T00:00:00Z');
    const nextDate = subscriptionService.calculateNextRenewal(startDate, SubscriptionFrequency.WEEKLY, refDate);
    assert(nextDate.toISOString().startsWith('2026-07-15'), 'Next weekly renewal should be July 15');
  });

  // 2. Calculate Next Renewal (Monthly)
  await runTest('Calculate Next Renewal: Monthly', async () => {
    const startDate = new Date('2026-05-15T00:00:00Z');
    const refDate = new Date('2026-07-10T00:00:00Z');
    const nextDate = subscriptionService.calculateNextRenewal(startDate, SubscriptionFrequency.MONTHLY, refDate);
    assert(nextDate.toISOString().startsWith('2026-07-15'), 'Next monthly renewal should be July 15');
  });

  // 3. Calculate Next Renewal (Yearly)
  await runTest('Calculate Next Renewal: Yearly', async () => {
    const startDate = new Date('2025-07-10T00:00:00Z');
    const refDate = new Date('2026-07-11T00:00:00Z');
    const nextDate = subscriptionService.calculateNextRenewal(startDate, SubscriptionFrequency.YEARLY, refDate);
    assert(nextDate.toISOString().startsWith('2027-07-10'), 'Next yearly renewal should be July 10, 2027');
  });

  // 4. Monthly Equivalent Cost Math
  await runTest('Equivalent Costs: Monthly Math', async () => {
    const resultWeekly = (subscriptionService as any).calculateEquivalentCosts(new Decimal(10), SubscriptionFrequency.WEEKLY);
    assert(resultWeekly.monthlyCost === (10 * 52) / 12, 'Weekly to Monthly cost incorrect');
    assert(resultWeekly.annualCost === 10 * 52, 'Weekly to Annual cost incorrect');

    const resultYearly = (subscriptionService as any).calculateEquivalentCosts(new Decimal(120), SubscriptionFrequency.YEARLY);
    assert(resultYearly.monthlyCost === 10, 'Yearly to Monthly cost incorrect');
    assert(resultYearly.annualCost === 120, 'Yearly to Annual cost incorrect');
  });

  // 5. Tenant Isolation Checks
  await runTest('Tenant Isolation: Prevent fetching foreign subscription', async () => {
    subscriptionRepository.findById = async () => ({ id: 'sub-1', userId: 'user-2' } as any);
    try {
      await subscriptionService.getSubscriptionById('user-1', 'sub-1');
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Must be NotFoundError');
    }
  });

  await runTest('Tenant Isolation: Prevent deleting foreign subscription', async () => {
    subscriptionRepository.findById = async () => ({ id: 'sub-1', userId: 'user-2' } as any);
    try {
      await subscriptionService.deleteSubscription('user-1', 'sub-1');
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Must be NotFoundError');
    }
  });

  // 6. Duplicate Active Subscription Rejection
  await runTest('Validation: Prevent duplicate active subscriptions', async () => {
    subscriptionRepository.findByUserId = async () => ([
      { name: 'Netflix', isActive: true }
    ] as any);

    try {
      await subscriptionService.createSubscription('user-1', {
        name: 'netflix',
        amount: 15,
        frequency: SubscriptionFrequency.MONTHLY,
        startDate: new Date(),
      });
      assert(false, 'Should throw BadRequestError');
    } catch (err: unknown) {
      assert(err instanceof BadRequestError, 'Must be BadRequestError for duplicate');
    }
  });

  console.log(`\n=========================================`);
  console.log(` Test Executions Complete `);
  console.log(` Passed: ${passed} | Failed: ${failed} `);
  console.log(`=========================================`);

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
