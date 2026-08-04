import aiService from '../services/aiService';
import receiptService from '../services/receiptService';
import receiptRepository from '../repositories/ReceiptRepository';
import { NotFoundError } from '../errors/AppError';
import { Decimal } from '@prisma/client/runtime/library';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Receipt & AI Service Unit Tests...\n');
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

  // Mock receipt data
  const mockReceipt = {
    id: 'receipt-uuid',
    imageUrl: 'data:image/png;base64,abc123',
    rawText: '{"merchant":"TestStore","amount":99.99}',
    extractedMerchant: 'TestStore',
    extractedAmount: new Decimal(99.99),
    extractedDate: new Date('2026-07-15'),
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. AI Response Parsing — Valid JSON
  await runTest('AI Parsing: Valid JSON extraction', async () => {
    const validJson = '{"merchant":"Starbucks","amount":4.50,"date":"2026-07-15","currency":"USD","suggestedCategory":"Food","description":"Coffee purchase","confidence":0.95}';
    const result = (aiService as any).parseAIResponse(validJson);

    assert(result.merchant === 'Starbucks', 'Merchant extracted correctly');
    assert(result.amount === 4.50, 'Amount extracted correctly');
    assert(result.date === '2026-07-15', 'Date extracted correctly');
    assert(result.currency === 'USD', 'Currency extracted correctly');
    assert(result.suggestedCategory === 'Food', 'Category extracted correctly');
    assert(result.confidence === 0.95, 'Confidence extracted correctly');
  });

  // 2. AI Response Parsing — Markdown Code Fences
  await runTest('AI Parsing: Strip markdown code fences', async () => {
    const markdownJson = '```json\n{"merchant":"Amazon","amount":29.99,"date":"2026-07-10","currency":"INR","suggestedCategory":"Shopping","description":"Online order","confidence":0.88}\n```';
    const result = (aiService as any).parseAIResponse(markdownJson);

    assert(result.merchant === 'Amazon', 'Merchant from fenced JSON');
    assert(result.amount === 29.99, 'Amount from fenced JSON');
  });

  // 3. AI Response Parsing — Malformed JSON
  await runTest('AI Parsing: Graceful malformed JSON handling', async () => {
    const malformedJson = 'This is not valid JSON at all!!!';
    const result = (aiService as any).parseAIResponse(malformedJson);

    assert(result.merchant === null, 'Merchant should be null');
    assert(result.amount === null, 'Amount should be null');
    assert(result.date === null, 'Date should be null');
    assert(result.confidence === null, 'Confidence should be null');
  });

  // 4. AI Response Parsing — Missing fields
  await runTest('AI Parsing: Handle missing fields', async () => {
    const partialJson = '{"merchant":"SomeStore"}';
    const result = (aiService as any).parseAIResponse(partialJson);

    assert(result.merchant === 'SomeStore', 'Merchant extracted');
    assert(result.amount === null, 'Missing amount returns null');
    assert(result.date === null, 'Missing date returns null');
    assert(result.suggestedCategory === null, 'Missing category returns null');
  });

  // 5. AI Response Parsing — Negative amount
  await runTest('AI Parsing: Reject negative amounts', async () => {
    const negativeJson = '{"merchant":"Store","amount":-50,"date":"2026-07-15","currency":"INR","suggestedCategory":"Other","description":"test","confidence":0.5}';
    const result = (aiService as any).parseAIResponse(negativeJson);

    assert(result.amount === null, 'Negative amount should be rejected');
  });

  // 6. Receipt Service — Tenant Isolation (Get by ID)
  await runTest('Tenant Isolation: Prevent fetching foreign receipt', async () => {
    const foreignReceipt = { ...mockReceipt, userId: 'user-2' };
    receiptRepository.findById = async () => foreignReceipt as any;

    try {
      await receiptService.getReceiptById('user-1', 'receipt-uuid');
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Error must be NotFoundError');
    }
  });

  // 7. Receipt Service — Tenant Isolation (Delete)
  await runTest('Tenant Isolation: Prevent deleting foreign receipt', async () => {
    const foreignReceipt = { ...mockReceipt, userId: 'user-2' };
    receiptRepository.findById = async () => foreignReceipt as any;

    try {
      await receiptService.deleteReceipt('user-1', 'receipt-uuid');
      assert(false, 'Should throw NotFoundError');
    } catch (err: unknown) {
      assert(err instanceof NotFoundError, 'Error must be NotFoundError');
    }
  });

  // 8. Receipt Service — Get own receipt
  await runTest('Fetch Own Receipt Successfully', async () => {
    receiptRepository.findById = async () => mockReceipt as any;
    const result = await receiptService.getReceiptById('user-1', 'receipt-uuid');
    assert(result.id === 'receipt-uuid', 'Receipt ID matches');
    assert(result.extractedMerchant === 'TestStore', 'Extracted merchant matches');
  });

  // 9. AI Response Parsing — Confidence clamping
  await runTest('AI Parsing: Clamp confidence to [0, 1]', async () => {
    const highConfidence = '{"merchant":"Test","amount":10,"date":"2026-07-15","currency":"INR","suggestedCategory":"Other","description":"test","confidence":1.5}';
    const result = (aiService as any).parseAIResponse(highConfidence);
    assert(result.confidence === 1, 'Confidence clamped to 1');
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
