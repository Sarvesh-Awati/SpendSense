import transactionService from '../services/transactionService';
import transactionRepository from '../repositories/TransactionRepository';
import categoryRepository from '../repositories/CategoryRepository';
import userRepository from '../repositories/UserRepository';
import { NotFoundError } from '../errors/AppError';
import { CategoryType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Multi-currency: transactionService resolves the account base currency before
 * deriving a conversion, so tests must stub the user lookup. Base = INR here,
 * matching the transaction currency, so conversion is rate 1 with no provider.
 */
const stubBaseCurrencyUser = () => {
  userRepository.findById = async () =>
    ({ id: 'user-1', baseCurrency: 'INR', preferredCurrency: 'INR' } as any);
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Transaction Service Unit Tests...\n');
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
    name: 'Food',
    type: CategoryType.EXPENSE,
    userId: null, // default system category
    icon: 'Utensils',
    color: '#ff0000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. Create Transaction Success
  await runTest('Create Transaction Success', async () => {
    const mockTransaction = {
      id: 'tx-uuid',
      amount: new Decimal(250.5),
      description: 'Dinner at Pizza place',
      merchant: 'Dominos',
      date: new Date(),
      type: CategoryType.EXPENSE,
      paymentMethod: 'Card',
      isSubscription: false,
      userId: 'user-1',
      categoryId: 'category-uuid',
      receiptId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    stubBaseCurrencyUser();

    categoryRepository.findById = async (id: string) => {
      assert(id === 'category-uuid', 'Should check correct category ID');
      return mockCategory;
    };

    transactionRepository.create = async (data: any) => {
      assert(data.userId === 'user-1', 'Should pass correct user ID');
      assert(data.amount === 250.5, 'Should pass correct transaction amount');
      return mockTransaction as any;
    };

    const result = await transactionService.create('user-1', {
      amount: 250.5,
      description: 'Dinner at Pizza place',
      merchant: 'Dominos',
      date: new Date(),
      type: CategoryType.EXPENSE,
      paymentMethod: 'Card',
      categoryId: 'category-uuid',
    });

    assert(result.id === 'tx-uuid', 'Should return created transaction ID');
    // Contract change: transaction endpoints now return a number, not a Decimal.
    assert(typeof result.amount === 'number', 'Amount must be serialized as a number');
    assert(result.amount === 250.5, 'Transaction amount must match input');
  });

  // 2. Reject Creating Transaction with Other User's Category
  await runTest('Reject Creating Transaction with Other User Category', async () => {
    const foreignCategory = {
      ...mockCategory,
      userId: 'user-2', // belongs to another user
    };

    categoryRepository.findById = async () => foreignCategory;

    try {
      await transactionService.create('user-1', { // user-1 is creating
        amount: 50.0,
        date: new Date(),
        type: CategoryType.EXPENSE,
        categoryId: 'foreign-category-uuid',
      });
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Error must be a NotFoundError');
      assert((err instanceof Error ? err.message : String(err)).includes('Category not found'), 'Error should report category not found');
    }
  });

  // 3. Prevent Fetching Other User's Transaction details
  await runTest('Prevent Fetching Foreign Transaction Detail (User Isolation)', async () => {
    const foreignTx = {
      id: 'tx-uuid',
      amount: new Decimal(100.0),
      userId: 'user-2', // belongs to user-2
      categoryId: 'category-uuid',
    };

    transactionRepository.findById = async (id: string) => {
      assert(id === 'tx-uuid', 'Should query correct ID');
      return foreignTx as any;
    };

    try {
      await transactionService.findById('user-1', 'tx-uuid'); // user-1 tries to read
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Error must be NotFoundError');
      assert((err instanceof Error ? err.message : String(err)).includes('Transaction not found'), 'Should mask security exception as 404');
    }
  });

  // 4. Update Transaction success
  await runTest('Update Own Transaction Success', async () => {
    const ownTx = {
      id: 'tx-uuid',
      amount: new Decimal(100.0),
      currency: 'INR',
      // Already-converted record: an amount-only edit must REUSE this rate
      // rather than fetching a new one.
      baseCurrency: 'INR',
      exchangeRate: new Decimal(1),
      convertedAmount: new Decimal(100.0),
      userId: 'user-1', // owned by user-1
      categoryId: 'category-uuid',
    };

    transactionRepository.findById = async () => ownTx as any;
    transactionRepository.update = async (id: string, data: any) => {
      assert(id === 'tx-uuid', 'Should update correct ID');
      assert(data.amount === 120.0, 'Should update amount');
      // amount-only edit reuses the stored rate of 1
      assert(
        data.convertedAmount?.toString() === '120',
        'convertedAmount must be recomputed with the STORED rate'
      );
      return { ...ownTx, amount: new Decimal(120.0), convertedAmount: new Decimal(120.0) } as any;
    };

    stubBaseCurrencyUser();

    const result = await transactionService.update('user-1', 'tx-uuid', {
      amount: 120.0,
    });

    assert(typeof result.amount === 'number', 'Amount must be serialized as a number');
    assert(result.amount === 120.0, 'Amount must be updated');
  });

  // 5. Delete foreign transaction restriction
  await runTest('Reject Deleting Foreign Transaction', async () => {
    const foreignTx = {
      id: 'tx-uuid',
      amount: new Decimal(100.0),
      userId: 'user-2', // owned by user-2
      categoryId: 'category-uuid',
    };

    transactionRepository.findById = async () => foreignTx as any;

    try {
      await transactionService.delete('user-1', 'tx-uuid'); // user-1 tries to delete
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Should throw NotFoundError');
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
