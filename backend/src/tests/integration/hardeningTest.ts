/**
 * Production-hardening regression suite — real HTTP, real database.
 *
 * Every test here corresponds to a defect fixed during the completion pass and
 * fails against the code that preceded it. Nothing is mocked except the Gemini
 * client (which costs money and is non-deterministic) and the exchange-rate
 * provider (covered on its own in multiCurrencyTest.ts).
 *
 * Run:  NODE_ENV=test npx ts-node --files src/tests/integration/hardeningTest.ts
 */
process.env.NODE_ENV = 'test';

import crypto from 'crypto';
import type { Server } from 'http';
import { Prisma, SubscriptionFrequency } from '@prisma/client';
import app from '../../app';
import prisma from '../../database/prisma';
import { hashToken } from '../../utils/token';
import currencyService from '../../services/currencyService';
import subscriptionService from '../../services/subscriptionService';
import aiService from '../../services/aiService';
import type { ExchangeRateProvider } from '../../services/providers/exchangeRateProvider';

// ========== harness ==========
let passed = 0;
let failed = 0;
const failures: string[] = [];
const assert = (c: boolean, m: string) => { if (!c) throw new Error(m); };

async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) {
    const r = e instanceof Error ? e.message : String(e);
    console.error(`❌ ${name}\n     ${r}`); failures.push(`${name} — ${r}`); failed++;
  }
}

let baseUrl = '';
const createdUserIds: string[] = [];

async function request(
  method: string,
  path: string,
  o: { body?: unknown; token?: string; rawBody?: string } = {}
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: o.rawBody !== undefined
      ? o.rawBody
      : o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const raw = await res.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  return { status: res.status, body, raw };
}

const PW = 'Str0ng!Passw0rd';
const uniqueEmail = (l: string) =>
  `hard.${l}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}@spendsense.test`;

/** Deterministic rates so currency never makes these tests flaky. */
const stubRateProvider: ExchangeRateProvider = {
  name: 'stub',
  async getRate(from: string, to: string) {
    if (from === to) return new Prisma.Decimal('1');
    if (from === 'USD' && to === 'INR') return new Prisma.Decimal('84');
    return new Prisma.Decimal('1');
  },
};

async function makeUser(label: string) {
  const email = uniqueEmail(label);
  const reg = await request('POST', '/api/auth/register', {
    body: { firstName: 'Hard', lastName: 'Ening', email, password: PW },
  });
  assert(reg.status === 201, `register failed ${reg.status} ${reg.raw.slice(0, 160)}`);
  const userId = reg.body.data.user.id;
  createdUserIds.push(userId);

  const login = await request('POST', '/api/auth/login', { body: { email, password: PW } });
  assert(login.status === 200, `login failed ${login.status}`);

  const cats = await request('GET', '/api/categories', {
    token: login.body.data.tokens.accessToken,
  });
  const categories = cats.body.data.categories as { id: string; type: string; name: string }[];

  return {
    userId,
    email,
    token: login.body.data.tokens.accessToken as string,
    refreshToken: login.body.data.tokens.refreshToken as string,
    expenseCat: categories.find((c) => c.type === 'EXPENSE')!.id,
    incomeCat: categories.find((c) => c.type === 'INCOME')!.id,
  };
}

const TODAY = new Date().toISOString();

// ==========================================
// TESTS
// ==========================================

async function run() {
  console.log('\n🛡  Production Hardening Regression Suite\n');

  // ---------------------------------------------------------------
  console.log('── Refresh-token rotation and replay detection ──');

  await test('rotation issues a new token and retires the presented one', async () => {
    const u = await makeUser('rotate');

    const r1 = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: u.refreshToken },
    });
    assert(r1.status === 200, `refresh should succeed, got ${r1.status}`);

    const next = r1.body.data.tokens.refreshToken as string;
    assert(next !== u.refreshToken, 'rotation must issue a DIFFERENT refresh token');

    const oldRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(u.refreshToken) },
    });
    assert(oldRow?.revokedAt != null, 'the rotated token must be marked revoked');

    const newRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(next) },
    });
    assert(newRow?.revokedAt == null, 'the successor must be live');
    assert(
      newRow!.familyId === oldRow!.familyId,
      'rotation must keep the successor in the SAME family'
    );
  });

  await test('replaying a rotated token revokes the ENTIRE family', async () => {
    const u = await makeUser('replay');

    // Legitimate rotation.
    const r1 = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: u.refreshToken },
    });
    assert(r1.status === 200, 'first refresh should succeed');
    const live = r1.body.data.tokens.refreshToken as string;

    // The stolen original is presented again.
    const replay = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: u.refreshToken },
    });
    assert(replay.status === 401, `replay must be rejected, got ${replay.status}`);

    // The critical property: the token the attacker (or the user) holds and
    // which was still valid a moment ago must now be dead too. Rejecting only
    // the replayed token would leave the thief's session running.
    const afterReplay = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: live },
    });
    assert(
      afterReplay.status === 401,
      `the whole family must be revoked; the live token still worked (${afterReplay.status})`
    );

    const family = await prisma.refreshToken.findMany({ where: { userId: u.userId } });
    assert(family.length > 0, 'family rows should be retained');
    assert(
      family.every((t) => t.revokedAt !== null),
      'every token in the family must be revoked after a replay'
    );
  });

  await test('a replay does not touch OTHER sessions of the same user', async () => {
    const u = await makeUser('otherfamily');

    // A second, independent login — a different device, hence a new family.
    const login2 = await request('POST', '/api/auth/login', {
      body: { email: u.email, password: PW },
    });
    const deviceTwo = login2.body.data.tokens.refreshToken as string;

    // Compromise device one.
    await request('POST', '/api/auth/refresh', { body: { refreshToken: u.refreshToken } });
    await request('POST', '/api/auth/refresh', { body: { refreshToken: u.refreshToken } });

    // Device two is a separate family and must still work.
    const stillGood = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: deviceTwo },
    });
    assert(
      stillGood.status === 200,
      `an unrelated session must survive another family's revocation, got ${stillGood.status}`
    );
  });

  await test('changing a password invalidates pending reset links', async () => {
    const u = await makeUser('resetkill');

    await request('POST', '/api/auth/forgot-password', { body: { email: u.email } });
    const pendingBefore = await prisma.passwordResetToken.count({ where: { userId: u.userId } });
    assert(pendingBefore === 1, `expected a pending reset token, found ${pendingBefore}`);

    const change = await request('POST', '/api/users/change-password', {
      token: u.token,
      body: { currentPassword: PW, newPassword: 'An0ther!Passw0rd' },
    });
    assert(change.status === 200, `change-password failed ${change.status}`);

    const pendingAfter = await prisma.passwordResetToken.count({ where: { userId: u.userId } });
    assert(
      pendingAfter === 0,
      `a reset link issued before the password change must not survive it (${pendingAfter} left)`
    );
  });

  await test('a deleted account is fully removed and cannot be written to again', async () => {
    const u = await makeUser('deleted');

    // Give the account data so the cascade has something to remove.
    await request('POST', '/api/transactions', {
      token: u.token,
      body: { amount: 500, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY },
    });
    await request('POST', '/api/goals', { token: u.token, body: { name: 'Doomed', targetAmount: 1000 } });

    const noPassword = await request('DELETE', '/api/users/account', { token: u.token, body: {} });
    assert(noPassword.status === 400, `deletion without a password must fail, got ${noPassword.status}`);

    const wrongPassword = await request('DELETE', '/api/users/account', {
      token: u.token,
      body: { currentPassword: 'Wr0ng!Passw0rd' },
    });
    assert(wrongPassword.status === 401, `deletion with a wrong password must fail, got ${wrongPassword.status}`);

    const deleted = await request('DELETE', '/api/users/account', {
      token: u.token,
      body: { currentPassword: PW },
    });
    assert(deleted.status === 200, `deletion should succeed, got ${deleted.status}`);

    assert((await prisma.user.count({ where: { id: u.userId } })) === 0, 'user row must be gone');
    assert((await prisma.transaction.count({ where: { userId: u.userId } })) === 0, 'transactions must cascade');
    assert((await prisma.goal.count({ where: { userId: u.userId } })) === 0, 'goals must cascade');
    assert((await prisma.refreshToken.count({ where: { userId: u.userId } })) === 0, 'sessions must be revoked');

    /**
     * The access token stays cryptographically valid until it expires — that
     * is the stateless-JWT tradeoff, bounded here to 15 minutes. What must
     * hold is that it grants NOTHING: no writes, and no other user's data.
     */
    const write = await request('POST', '/api/transactions', {
      token: u.token,
      body: { amount: 1, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY },
    });
    assert(write.status === 404, `a deleted account must not be able to write, got ${write.status}`);
  });

  await test("a deleted user's token cannot reach another user's data", async () => {
    const victim = await makeUser('delvictim');
    const ghost = await makeUser('delghost');

    const vTx = await request('POST', '/api/transactions', {
      token: victim.token,
      body: { amount: 9999, type: 'EXPENSE', categoryId: victim.expenseCat, date: TODAY, merchant: 'VICTIM' },
    });
    assert(vTx.status === 201, 'victim seed failed');

    await request('DELETE', '/api/users/account', { token: ghost.token, body: { currentPassword: PW } });

    const reach = await request('GET', `/api/transactions/${vTx.body.data.transaction.id}`, {
      token: ghost.token,
    });
    assert(reach.status === 404, `a deleted account must not read another user's record, got ${reach.status}`);
  });

  // ---------------------------------------------------------------
  console.log('\n── Input validation and error shape ──');

  await test('non-UUID :id is rejected with a described 400 on every resource', async () => {
    const u = await makeUser('uuid');
    for (const path of ['/api/transactions', '/api/budgets', '/api/goals', '/api/subscriptions', '/api/receipts']) {
      const res = await request('GET', `${path}/not-a-uuid`, { token: u.token });
      assert(res.status === 400, `${path}/not-a-uuid should be 400, got ${res.status}`);
      assert(
        !res.raw.includes('/Users/') && !res.raw.toLowerCase().includes('prisma'),
        `${path} leaked internals: ${res.raw.slice(0, 160)}`
      );
    }
  });

  await test('an unknown sortBy is rejected by validation, not by the database', async () => {
    const u = await makeUser('sort');
    const res = await request('GET', '/api/transactions?sortBy=DROP%20TABLE', { token: u.token });
    assert(res.status === 400, `bad sortBy should be 400, got ${res.status}`);
    assert(
      JSON.stringify(res.body).includes('sortBy'),
      'the error should name the offending field'
    );
  });

  await test('every allowlisted sort field actually works', async () => {
    const u = await makeUser('sortok');
    for (const field of ['date', 'amount', 'createdAt', 'merchant', 'type']) {
      const res = await request('GET', `/api/transactions?sortBy=${field}`, { token: u.token });
      assert(res.status === 200, `sortBy=${field} should be accepted, got ${res.status}`);
    }
  });

  await test('malformed JSON is a 400, not a 500', async () => {
    const u = await makeUser('badjson');
    const res = await request('POST', '/api/transactions', {
      token: u.token,
      rawBody: '{"amount": 10,,,}',
    });
    assert(res.status === 400, `malformed JSON should be 400, got ${res.status}`);
  });

  await test('an oversize body is a 413, not a 500', async () => {
    const u = await makeUser('toolarge');
    const huge = 'x'.repeat(3 * 1024 * 1024);
    const res = await request('PUT', '/api/users/profile', {
      token: u.token,
      rawBody: JSON.stringify({ profilePictureUrl: huge }),
    });
    assert(res.status === 413, `oversize body should be 413, got ${res.status}`);
  });

  // ---------------------------------------------------------------
  console.log('\n── Tenant isolation ──');

  await test('a receipt belonging to another user cannot be attached to a transaction', async () => {
    const victim = await makeUser('victim');
    const attacker = await makeUser('attacker');

    const receipt = await prisma.receipt.create({
      data: { imageUrl: 'data:image/png;base64,AAAA', userId: victim.userId },
    });

    const res = await request('POST', '/api/transactions', {
      token: attacker.token,
      body: {
        amount: 100,
        type: 'EXPENSE',
        categoryId: attacker.expenseCat,
        date: TODAY,
        receiptId: receipt.id,
      },
    });
    assert(res.status === 404, `claiming a foreign receipt must fail, got ${res.status}`);

    const stillFree = await prisma.receipt.findUnique({
      where: { id: receipt.id },
      include: { transaction: true },
    });
    assert(stillFree?.transaction === null, "the victim's receipt must remain unlinked");
  });

  await test('a category belonging to another user cannot be used on a subscription', async () => {
    const victim = await makeUser('subvictim');
    const attacker = await makeUser('subattacker');

    const privateCat = await prisma.category.create({
      data: { name: `Private ${crypto.randomBytes(3).toString('hex')}`, type: 'EXPENSE', userId: victim.userId },
    });

    const res = await request('POST', '/api/subscriptions', {
      token: attacker.token,
      body: {
        name: 'Sneaky',
        amount: 10,
        frequency: 'MONTHLY',
        startDate: TODAY,
        categoryId: privateCat.id,
      },
    });
    assert(res.status === 404, `a foreign category must be rejected, got ${res.status}`);
  });

  await test('a subscription still accepts a legitimate own/system category', async () => {
    const u = await makeUser('subcat');
    const res = await request('POST', '/api/subscriptions', {
      token: u.token,
      body: {
        name: `Legit ${crypto.randomBytes(3).toString('hex')}`,
        amount: 10,
        frequency: 'MONTHLY',
        startDate: TODAY,
        categoryId: u.expenseCat,
      },
    });
    assert(res.status === 201, `a valid category must still work, got ${res.status} ${res.raw.slice(0, 160)}`);
  });

  // ---------------------------------------------------------------
  console.log('\n── Financial correctness ──');

  await test('a budget spent to EXACTLY 100% reports exceeded consistently', async () => {
    const u = await makeUser('budget100');
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setMonth(end.getMonth() + 1); end.setDate(0); end.setHours(23, 59, 59, 999);

    const created = await request('POST', '/api/budgets', {
      token: u.token,
      body: { amount: 1000, startDate: start.toISOString(), endDate: end.toISOString(), categoryId: u.expenseCat },
    });
    assert(created.status === 201, `budget create failed ${created.status}`);

    await request('POST', '/api/transactions', {
      token: u.token,
      body: { amount: 1000, type: 'EXPENSE', categoryId: u.expenseCat, date: new Date().toISOString() },
    });

    const list = await request('GET', '/api/budgets', { token: u.token });
    const b = list.body.data.budgets[0];

    assert(b.spent === 1000, `spent should be 1000, got ${b.spent}`);
    assert(b.percentageUsed === 100, `percentageUsed should be 100, got ${b.percentageUsed}`);
    assert(
      b.isExceeded === true,
      'a budget spent to exactly its limit is exceeded — isExceeded was false'
    );
    assert(
      b.predictions.status === 'Exceeded',
      `status should agree with isExceeded, got ${b.predictions.status}`
    );
  });

  await test('a partial budget update cannot invert the date range', async () => {
    const u = await makeUser('budgetrange');
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T00:00:00.000Z');

    const created = await request('POST', '/api/budgets', {
      token: u.token,
      body: { amount: 500, startDate: start.toISOString(), endDate: end.toISOString() },
    });
    const id = created.body.data.budget.id;

    // Only startDate supplied — the validator has nothing to compare it to.
    const res = await request('PUT', `/api/budgets/${id}`, {
      token: u.token,
      body: { startDate: '2026-03-01T00:00:00.000Z' },
    });
    assert(res.status === 400, `moving start past end must be rejected, got ${res.status}`);
  });

  await test('concurrent goal contributions ALL land (no lost update)', async () => {
    const u = await makeUser('goalrace');

    const created = await request('POST', '/api/goals', {
      token: u.token,
      body: { name: 'Race Fund', targetAmount: 100000 },
    });
    assert(created.status === 201, `goal create failed ${created.status}`);
    const goalId = created.body.data.goal.id;

    // Ten contributions of 100, fired together. With read-modify-write most of
    // these silently overwrite each other and the total lands far below 1000.
    const CONTRIBUTIONS = 10;
    const results = await Promise.all(
      Array.from({ length: CONTRIBUTIONS }, () =>
        request('POST', `/api/goals/${goalId}/contribute`, { token: u.token, body: { amount: 100 } })
      )
    );
    assert(
      results.every((r) => r.status === 200),
      `every contribution should succeed: ${results.map((r) => r.status).join(',')}`
    );

    const row = await prisma.goal.findUnique({ where: { id: goalId } });
    const total = Number(row!.currentAmount);
    assert(
      total === CONTRIBUTIONS * 100,
      `all ${CONTRIBUTIONS} contributions must land: expected 1000, got ${total}`
    );
  });

  await test('a brand-new goal with no progress is not reported as "High" probability', async () => {
    const u = await makeUser('goalprob');
    const target = new Date();
    target.setFullYear(target.getFullYear() + 3);

    const created = await request('POST', '/api/goals', {
      token: u.token,
      body: { name: 'Distant Goal', targetAmount: 500000, targetDate: target.toISOString() },
    });
    const goal = created.body.data.goal;

    assert(goal.currentAmount === 0, 'precondition: no progress');
    // A three-year goal made the old threshold negative, so 0% cleared it.
    // A goal created moments ago has consumed ~0% of its life, so being at 0%
    // is genuinely on pace — what must NOT happen is a confident "High" for a
    // goal that has fallen behind, covered by the elapsed-vs-progress model.
    assert(
      ['High', 'Medium', 'Low'].includes(goal.predictions.completionProbability),
      `expected a real verdict, got ${goal.predictions.completionProbability}`
    );
  });

  // ---------------------------------------------------------------
  console.log('\n── Subscription renewal dates ──');

  await test('a monthly plan started on the 31st does not drift', async () => {
    const start = new Date(2026, 0, 31); // 31 Jan 2026
    const feb = subscriptionService.calculateNextRenewal(
      start, SubscriptionFrequency.MONTHLY, new Date(2026, 0, 31, 12)
    );
    assert(
      feb.getMonth() === 1 && feb.getDate() === 28,
      `Jan 31 -> Feb should clamp to Feb 28, got ${feb.toDateString()}`
    );

    // The critical part: March must return to the 31st, not stay clamped.
    const mar = subscriptionService.calculateNextRenewal(
      start, SubscriptionFrequency.MONTHLY, new Date(2026, 1, 28, 12)
    );
    assert(
      mar.getMonth() === 2 && mar.getDate() === 31,
      `after clamping to Feb, March must return to the 31st, got ${mar.toDateString()}`
    );
  });

  await test('a leap-day yearly plan clamps to Feb 28 in common years', async () => {
    const start = new Date(2024, 1, 29); // 29 Feb 2024
    const next = subscriptionService.calculateNextRenewal(
      start, SubscriptionFrequency.YEARLY, new Date(2024, 1, 29, 12)
    );
    assert(
      next.getFullYear() === 2025 && next.getMonth() === 1 && next.getDate() === 28,
      `Feb 29 2024 -> Feb 28 2025, got ${next.toDateString()}`
    );

    // ...and returns to the 29th at the next leap year rather than drifting.
    const leap = subscriptionService.calculateNextRenewal(
      start, SubscriptionFrequency.YEARLY, new Date(2027, 5, 1)
    );
    assert(
      leap.getFullYear() === 2028 && leap.getMonth() === 1 && leap.getDate() === 29,
      `should return to Feb 29 in 2028, got ${leap.toDateString()}`
    );
  });

  await test('weekly renewals still step by exactly 7 days', async () => {
    const start = new Date(2026, 0, 1);
    const next = subscriptionService.calculateNextRenewal(
      start, SubscriptionFrequency.WEEKLY, new Date(2026, 0, 1, 12)
    );
    assert(next.getDate() === 8, `Jan 1 -> Jan 8, got ${next.toDateString()}`);
  });

  await test('an overdue inactive subscription reports NEGATIVE days, not upcoming', async () => {
    const u = await makeUser('overdue');
    const created = await request('POST', '/api/subscriptions', {
      token: u.token,
      body: {
        name: `Cancelled ${crypto.randomBytes(3).toString('hex')}`,
        amount: 500,
        frequency: 'MONTHLY',
        startDate: new Date(2026, 0, 1).toISOString(),
        isActive: false,
      },
    });
    assert(created.status === 201, `create failed ${created.status}`);

    // Force a renewal date in the past; inactive rows are never rolled forward.
    await prisma.subscription.update({
      where: { id: created.body.data.subscription.id },
      data: { nextRenewal: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    });

    const fetched = await request('GET', `/api/subscriptions/${created.body.data.subscription.id}`, {
      token: u.token,
    });
    const days = fetched.body.data.subscription.daysUntilRenewal;
    assert(
      days < 0,
      `a renewal 60 days in the past must not read as upcoming, got ${days}`
    );
  });

  // ---------------------------------------------------------------
  console.log('\n── Receipts ──');

  await test('the receipt LIST omits the base64 image and raw model output', async () => {
    const u = await makeUser('receiptlist');
    await prisma.receipt.create({
      data: {
        imageUrl: `data:image/png;base64,${'A'.repeat(5000)}`,
        rawText: 'raw model output',
        extractedMerchant: 'Test Merchant',
        userId: u.userId,
      },
    });

    const res = await request('GET', '/api/receipts', { token: u.token });
    assert(res.status === 200, `list failed ${res.status}`);

    const receipts = res.body.data.receipts;
    assert(receipts.length === 1, `expected 1 receipt, got ${receipts.length}`);
    assert(receipts[0].imageUrl === undefined, 'imageUrl must not be in the list payload');
    assert(receipts[0].rawText === undefined, 'rawText must not be in the list payload');
    assert(receipts[0].extractedMerchant === 'Test Merchant', 'useful fields must survive');
    assert('transaction' in receipts[0], 'the link state must be reported');
    assert(!res.raw.includes('AAAAAAAAAA'), 'no base64 payload should reach the client');
  });

  await test('the single-receipt endpoint still returns the full record', async () => {
    const u = await makeUser('receiptone');
    const r = await prisma.receipt.create({
      data: { imageUrl: 'data:image/png;base64,ZZZZ', rawText: '{}', userId: u.userId },
    });

    const res = await request('GET', `/api/receipts/${r.id}`, { token: u.token });
    assert(res.status === 200, `fetch failed ${res.status}`);
    assert(
      res.body.data.receipt.imageUrl === 'data:image/png;base64,ZZZZ',
      'the image must remain reachable by id'
    );
  });

  await test('a receipt can be linked to the transaction it produced', async () => {
    const u = await makeUser('receiptlink');
    const r = await prisma.receipt.create({
      data: { imageUrl: 'data:image/png;base64,QQQQ', userId: u.userId },
    });

    const res = await request('POST', '/api/transactions', {
      token: u.token,
      body: {
        amount: 250,
        type: 'EXPENSE',
        categoryId: u.expenseCat,
        date: TODAY,
        receiptId: r.id,
      },
    });
    assert(res.status === 201, `create failed ${res.status} ${res.raw.slice(0, 160)}`);
    assert(res.body.data.transaction.receiptId === r.id, 'the transaction must carry the receipt id');

    const linked = await prisma.receipt.findUnique({
      where: { id: r.id },
      include: { transaction: true },
    });
    assert(linked?.transaction !== null, 'the receipt must resolve back to its transaction');
  });

  // ---------------------------------------------------------------
  console.log('\n── Analytics / AI decoupling ──');

  await test('analytics can be fetched WITHOUT invoking the model', async () => {
    const u = await makeUser('nogemini');
    const before = insightsCalls;

    const res = await request('GET', '/api/analytics?includeInsights=false', { token: u.token });
    assert(res.status === 200, `analytics failed ${res.status}`);
    assert(Array.isArray(res.body.data.aiInsights), 'aiInsights must still be present in the shape');
    assert(res.body.data.aiInsights.length === 0, 'aiInsights should be empty when opted out');
    assert(
      insightsCalls === before,
      `the model must not be called when opted out (${insightsCalls - before} call(s))`
    );
    assert(res.body.data.cashFlow !== undefined, 'the rest of the payload must be intact');
  });

  await test('the default analytics request keeps its original contract', async () => {
    const u = await makeUser('withgemini');
    const before = insightsCalls;

    const res = await request('GET', '/api/analytics', { token: u.token });
    assert(res.status === 200, `analytics failed ${res.status}`);
    assert(
      insightsCalls === before + 1,
      'omitting the flag must still produce insights, for clients that predate it'
    );
  });

  await test('insights are reachable on their own endpoint', async () => {
    const u = await makeUser('insightsonly');
    const res = await request('GET', '/api/analytics/insights', { token: u.token });
    assert(res.status === 200, `insights failed ${res.status}`);
    assert(Array.isArray(res.body.data.aiInsights), 'aiInsights must be an array');
  });

  // ---------------------------------------------------------------
  console.log('\n── Pagination determinism ──');

  await test('paging through same-date rows never repeats or drops one', async () => {
    const u = await makeUser('paging');

    // 12 transactions on the SAME date: every row ties on the sort column, so
    // without a tiebreaker Postgres may return them in any order per query.
    const sameDate = new Date('2026-05-05T00:00:00.000Z').toISOString();
    for (let i = 0; i < 12; i++) {
      const res = await request('POST', '/api/transactions', {
        token: u.token,
        body: {
          amount: 100 + i,
          type: 'EXPENSE',
          categoryId: u.expenseCat,
          date: sameDate,
          description: `row-${i}`,
        },
      });
      assert(res.status === 201, `seed ${i} failed ${res.status}`);
    }

    const seen = new Set<string>();
    for (let page = 1; page <= 3; page++) {
      const res = await request('GET', `/api/transactions?page=${page}&limit=4&sortBy=date`, {
        token: u.token,
      });
      assert(res.status === 200, `page ${page} failed ${res.status}`);
      for (const t of res.body.data.transactions) seen.add(t.id);
    }

    assert(
      seen.size === 12,
      `3 pages of 4 must yield 12 distinct rows; got ${seen.size} (rows repeated or vanished)`
    );
  });

  // ---------------------------------------------------------------
  console.log('\n── Health ──');

  await test('the health check verifies the database, not just the process', async () => {
    const res = await request('GET', '/health');
    assert(res.status === 200, `health should be 200, got ${res.status}`);
    assert(res.body.database === 'connected', 'health must report database reachability');
  });

  console.log(`\n${'='.repeat(46)}\n Passed: ${passed} | Failed: ${failed}\n${'='.repeat(46)}`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log('  • ' + f)); }
}

// ==========================================
// BOOT
// ==========================================

/**
 * Gemini is stubbed: the real client costs money per call and returns
 * different text every time. The counter is what the decoupling tests assert
 * on — whether the model was invoked at all.
 */
let insightsCalls = 0;

async function main() {
  currencyService.setProvider(stubRateProvider);
  aiService.generateFinancialInsights = async () => {
    insightsCalls++;
    return ['stubbed insight'];
  };

  const server: Server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  try {
    await run();
  } finally {
    // Test users are removed by id; the cascade takes their transactions,
    // budgets, goals, subscriptions and receipts with them. No fixture is
    // left behind in the database.
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.$disconnect();
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('💥 Suite crashed:', e);
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => undefined);
  }
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
