/**
 * Multi-currency integration suite — real HTTP, real database.
 *
 * The exchange-rate provider is replaced with a deterministic stub so rates are
 * fixed and provider behaviour (failure, timeout, bad data) can be exercised.
 * Nothing else is mocked.
 *
 * Run:  NODE_ENV=test npx ts-node --files src/tests/integration/multiCurrencyTest.ts
 */
process.env.NODE_ENV = 'test';

import crypto from 'crypto';
import type { Server } from 'http';
import { Prisma } from '@prisma/client';
import app from '../../app';
import prisma from '../../database/prisma';
import currencyService from '../../services/currencyService';
import {
  ExchangeRateProvider,
  RateUnavailableError,
} from '../../services/providers/exchangeRateProvider';

// ========== harness ==========
let passed = 0, failed = 0;
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

async function request(method: string, path: string, o: { body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const raw = await res.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  return { status: res.status, body, raw };
}

// ========== deterministic provider ==========
const RATES: Record<string, string> = {
  'USD:INR': '84', 'INR:USD': '0.0119', 'EUR:INR': '91.5', 'GBP:INR': '106.2',
};

class StubProvider implements ExchangeRateProvider {
  readonly name = 'stub';
  public calls = 0;
  constructor(private mode: 'ok' | 'fail' | 'timeout' | 'zero' | 'negative' | 'garbage' = 'ok') {}
  setMode(m: typeof this.mode) { this.mode = m; }
  async getRate(from: string, to: string): Promise<Prisma.Decimal> {
    this.calls++;
    if (this.mode === 'fail') throw new RateUnavailableError('stub: provider down');
    if (this.mode === 'timeout') throw new RateUnavailableError('stub: request timed out');
    if (this.mode === 'zero') throw new RateUnavailableError('stub: rejected rate 0');
    if (this.mode === 'negative') throw new RateUnavailableError('stub: rejected negative rate');
    if (this.mode === 'garbage') throw new RateUnavailableError('stub: unparseable rate');
    const r = RATES[`${from}:${to}`];
    if (!r) throw new RateUnavailableError(`stub: no rate ${from}->${to}`);
    return new Prisma.Decimal(r);
  }
}
const stub = new StubProvider();

const PW = 'Str0ng!Passw0rd';
const email = (l: string) => `mc.${l}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}@spendsense.test`;

async function makeUser(label: string, base: 'INR' | 'USD' = 'INR') {
  const e = email(label);
  const reg = await request('POST', '/api/auth/register', {
    body: { firstName: 'MC', lastName: 'Test', email: e, password: PW },
  });
  assert(reg.status === 201, `register failed ${reg.status}`);
  const userId = reg.body.data.user.id;
  createdUserIds.push(userId);
  await prisma.user.update({ where: { id: userId }, data: { baseCurrency: base, preferredCurrency: base } });

  const login = await request('POST', '/api/auth/login', { body: { email: e, password: PW } });
  const token = login.body.data.tokens.accessToken as string;
  const cats = await request('GET', '/api/categories', { token });
  const expenseCat = cats.body.data.categories.find((c: any) => c.type === 'EXPENSE').id;
  const incomeCat = cats.body.data.categories.find((c: any) => c.type === 'INCOME').id;
  return { userId, token, expenseCat, incomeCat, base };
}

const TODAY = new Date().toISOString().slice(0, 10);
const tx = (u: any, over: Record<string, unknown> = {}) => ({
  amount: 100, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY, merchant: 'MC', ...over,
});

// ========== tests ==========
async function run() {
  console.log('\n💱 Multi-currency integration suite\n');
  currencyService.setProvider(stub);

  // ---- write path ----
  console.log('── Conversion write path ──');

  await test('1/6 same-currency transaction converts at rate 1 with ZERO provider calls', async () => {
    const u = await makeUser('same');
    stub.setMode('ok'); currencyService.clearCache();
    const before = stub.calls;
    const r = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 500, currency: 'INR' }) });
    assert(r.status === 201, `expected 201, got ${r.status} ${r.raw.slice(0, 120)}`);
    assert(stub.calls === before, `provider must not be called, got ${stub.calls - before} call(s)`);
    const t = r.body.data.transaction;
    assert(t.exchangeRate === 1, `rate should be 1, got ${t.exchangeRate}`);
    assert(t.convertedAmount === 500, `converted should be 500, got ${t.convertedAmount}`);
    assert(t.baseCurrency === 'INR', 'baseCurrency should be INR');
  });

  await test('2/3 USD transaction in an INR account converts at the provider rate', async () => {
    const u = await makeUser('usd');
    stub.setMode('ok'); currencyService.clearCache();
    const r = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 100, currency: 'USD' }) });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    const t = r.body.data.transaction;
    assert(t.amount === 100, `ORIGINAL amount must stay 100, got ${t.amount}`);
    assert(t.currency === 'USD', 'ORIGINAL currency must stay USD');
    assert(t.exchangeRate === 84, `rate should be 84, got ${t.exchangeRate}`);
    assert(t.convertedAmount === 8400, `converted should be 8400, got ${t.convertedAmount}`);
  });

  await test('4 INR transaction in a USD account converts in the other direction', async () => {
    const u = await makeUser('inr-in-usd', 'USD');
    stub.setMode('ok'); currencyService.clearCache();
    const r = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 1000, currency: 'INR' }) });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    const t = r.body.data.transaction;
    assert(t.exchangeRate === 0.0119, `rate should be 0.0119, got ${t.exchangeRate}`);
    assert(t.convertedAmount === 11.9, `converted should be 11.90, got ${t.convertedAmount}`);
    assert(t.baseCurrency === 'USD', 'baseCurrency should be USD');
  });

  await test('13 rate direction: USD→INR inflates, INR→USD deflates', async () => {
    const inr = await makeUser('dir-inr'); const usd = await makeUser('dir-usd', 'USD');
    stub.setMode('ok'); currencyService.clearCache();
    const a = await request('POST', '/api/transactions', { token: inr.token, body: tx(inr, { amount: 100, currency: 'USD' }) });
    const b = await request('POST', '/api/transactions', { token: usd.token, body: tx(usd, { amount: 100, currency: 'INR' }) });
    assert(a.body.data.transaction.convertedAmount > 100, 'USD→INR must be larger');
    assert(b.body.data.transaction.convertedAmount < 100, 'INR→USD must be smaller');
  });

  await test('14/15 decimal precision and deterministic rounding', async () => {
    const u = await makeUser('round');
    stub.setMode('ok'); currencyService.clearCache();
    const mk = () => request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 33.33, currency: 'USD' }) });
    const a = await mk(); const b = await mk();
    // 33.33 × 84 = 2799.72 exactly
    assert(a.body.data.transaction.convertedAmount === 2799.72, `got ${a.body.data.transaction.convertedAmount}`);
    assert(
      a.body.data.transaction.convertedAmount === b.body.data.transaction.convertedAmount,
      'identical inputs must produce identical stored values'
    );
  });

  await test('16/17 same-day currency pair is cached — one provider call for two writes', async () => {
    const u = await makeUser('cache');
    stub.setMode('ok'); currencyService.clearCache();
    const before = stub.calls;
    await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 10, currency: 'USD' }) });
    await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 20, currency: 'USD' }) });
    assert(stub.calls - before === 1, `expected exactly 1 provider call, got ${stub.calls - before}`);
  });

  // ---- provider failure ----
  console.log('\n── Provider failure (must fail closed) ──');

  for (const [label, mode] of [['9 failure', 'fail'], ['8 timeout', 'timeout'], ['11 zero rate', 'zero'], ['12 negative rate', 'negative'], ['7 garbage response', 'garbage']] as const) {
    await test(`${label}: foreign transaction is REJECTED with 503, nothing stored`, async () => {
      const u = await makeUser(`fail-${mode}`);
      currencyService.clearCache(); stub.setMode(mode as any);
      const r = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 100, currency: 'USD' }) });
      stub.setMode('ok');
      assert(r.status === 503, `expected 503, got ${r.status}`);
      const count = await prisma.transaction.count({ where: { userId: u.userId } });
      assert(count === 0, `no transaction may be stored, found ${count}`);
    });
  }

  await test('provider failure does NOT block a same-currency transaction', async () => {
    const u = await makeUser('fail-same');
    currencyService.clearCache(); stub.setMode('fail');
    const r = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 700, currency: 'INR' }) });
    stub.setMode('ok');
    assert(r.status === 201, `same-currency must still succeed, got ${r.status}`);
    assert(r.body.data.transaction.convertedAmount === 700, 'converted should equal amount');
  });

  await test('10 unsupported currency is rejected with 400', async () => {
    const u = await makeUser('badcur');
    const r = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { currency: 'XYZ' }) });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  // ---- the headline invariant ----
  console.log('\n── THE INVARIANT ──');

  await test('₹10,000 income + $100 expense @84 ⇒ balance ₹1,600 (never ₹9,900)', async () => {
    const u = await makeUser('invariant');
    stub.setMode('ok'); currencyService.clearCache();

    const inc = await request('POST', '/api/transactions', {
      token: u.token, body: { amount: 10000, type: 'INCOME', categoryId: u.incomeCat, date: TODAY, merchant: 'INR Salary', currency: 'INR' },
    });
    const exp = await request('POST', '/api/transactions', {
      token: u.token, body: { amount: 100, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY, merchant: 'USD Vendor', currency: 'USD' },
    });
    assert(inc.status === 201 && exp.status === 201, 'both transactions must be created');

    const d = (await request('GET', '/api/dashboard', { token: u.token })).body.data;
    assert(d.summary.monthlyIncome === 10000, `income should be 10000, got ${d.summary.monthlyIncome}`);
    assert(d.summary.monthlyExpenses === 8400, `expenses should be 8400 (converted), got ${d.summary.monthlyExpenses}`);
    assert(d.summary.totalBalance !== 9900, 'MUST NOT be the raw-subtraction 9900');
    assert(d.summary.totalBalance === 1600, `balance should be 1600, got ${d.summary.totalBalance}`);
    assert(d.summary.savings === 1600, `savings should be 1600, got ${d.summary.savings}`);

    // 34: the original record is untouched
    const list = (await request('GET', '/api/transactions?limit=10', { token: u.token })).body.data.transactions;
    const usdTx = list.find((t: any) => t.merchant === 'USD Vendor');
    assert(usdTx.amount === 100 && usdTx.currency === 'USD', 'transaction list must still show 100 USD');
  });

  // ---- aggregation surfaces ----
  console.log('\n── Aggregations under mixed currency ──');

  await test('22/24/25/27/29 dashboard category, merchant, trend and savings rate use converted values', async () => {
    const u = await makeUser('agg');
    stub.setMode('ok'); currencyService.clearCache();
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 10000, type: 'INCOME', categoryId: u.incomeCat, date: TODAY, merchant: 'Salary', currency: 'INR' } });
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 100, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY, merchant: 'USD Vendor', currency: 'USD' } });

    const d = (await request('GET', '/api/dashboard', { token: u.token })).body.data;
    assert(d.categorySpending[0].amount === 8400, `category total should be 8400, got ${d.categorySpending[0].amount}`);
    assert(d.topMerchants[0].amount === 8400, `merchant total should be 8400, got ${d.topMerchants[0].amount}`);
    const active = d.spendingTrend.filter((b: any) => b.expense > 0);
    assert(active[0].expense === 8400, `trend expense should be 8400, got ${active[0].expense}`);
    assert(d.summary.savingsRate === 16, `savings rate should be 16%, got ${d.summary.savingsRate}`);
  });

  await test('26 analytics cash flow uses converted values', async () => {
    const u = await makeUser('analytics');
    stub.setMode('ok'); currencyService.clearCache();
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 10000, type: 'INCOME', categoryId: u.incomeCat, date: TODAY, merchant: 'Salary', currency: 'INR' } });
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 100, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY, merchant: 'V', currency: 'USD' } });
    const a = (await request('GET', '/api/analytics', { token: u.token })).body.data;
    assert(a.cashFlow.outflow === 8400, `outflow should be 8400, got ${a.cashFlow.outflow}`);
    assert(a.cashFlow.net === 1600, `net should be 1600, got ${a.cashFlow.net}`);
  });

  await test('23 budget spending compares converted spend against a base-currency limit', async () => {
    const u = await makeUser('budget');
    stub.setMode('ok'); currencyService.clearCache();
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 100, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY, merchant: 'V', currency: 'USD' } });
    const b = await request('POST', '/api/budgets', {
      token: u.token, body: { amount: 5000, startDate: TODAY, endDate: TODAY, categoryId: u.expenseCat },
    });
    assert(b.status === 201, `budget create failed ${b.status}`);
    const bud = b.body.data.budget;
    assert(bud.currency === 'INR', `budget must be pinned to base currency, got ${bud.currency}`);
    assert(bud.spent === 8400, `spent should be 8400 (converted), got ${bud.spent}`);
    assert(bud.isExceeded === true, 'a ₹5,000 budget with ₹8,400 spend must be exceeded');
  });

  // ---- stability guarantees ----
  console.log('\n── Historical stability ──');

  await test('18 amount-only edit REUSES the stored rate (no new provider call)', async () => {
    const u = await makeUser('edit-amount');
    stub.setMode('ok'); currencyService.clearCache();
    const c = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 100, currency: 'USD' }) });
    const id = c.body.data.transaction.id;
    const before = stub.calls;
    const up = await request('PUT', `/api/transactions/${id}`, { token: u.token, body: { amount: 200 } });
    assert(up.status === 200, `expected 200, got ${up.status}`);
    assert(stub.calls === before, 'must not fetch a new rate for an amount-only edit');
    assert(up.body.data.transaction.exchangeRate === 84, 'stored rate must be unchanged');
    assert(up.body.data.transaction.convertedAmount === 16800, `converted should be 16800, got ${up.body.data.transaction.convertedAmount}`);
  });

  await test('33 changing today’s rate does NOT alter an existing transaction', async () => {
    const u = await makeUser('stability');
    stub.setMode('ok'); currencyService.clearCache();
    const c = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 100, currency: 'USD' }) });
    const id = c.body.data.transaction.id;

    RATES['USD:INR'] = '999';       // the world moves
    currencyService.clearCache();
    const after = (await request('GET', `/api/transactions/${id}`, { token: u.token })).body.data.transaction;
    RATES['USD:INR'] = '84';

    assert(after.exchangeRate === 84, `historical rate must stay 84, got ${after.exchangeRate}`);
    assert(after.convertedAmount === 8400, `historical converted must stay 8400, got ${after.convertedAmount}`);
  });

  await test('20/21 changing preferredCurrency does not touch stored conversion or the accounting base', async () => {
    const u = await makeUser('pref');
    stub.setMode('ok'); currencyService.clearCache();
    const c = await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 100, currency: 'USD' }) });
    const id = c.body.data.transaction.id;

    const upd = await request('PUT', '/api/users/profile', { token: u.token, body: { preferredCurrency: 'USD' } });
    assert(upd.status === 200, `profile update failed ${upd.status}`);

    const row = await prisma.transaction.findUnique({ where: { id } });
    assert(row!.baseCurrency === 'INR', `baseCurrency must stay INR, got ${row!.baseCurrency}`);
    assert(Number(row!.exchangeRate) === 84, 'exchangeRate must be unchanged');
    assert(Number(row!.convertedAmount) === 8400, 'convertedAmount must be unchanged');
    assert(Number(row!.amount) === 100 && row!.currency === 'USD', 'original amount/currency unchanged');

    const user = await prisma.user.findUnique({ where: { id: u.userId } });
    assert(user!.baseCurrency === 'INR', 'accounting base must not follow the display preference');
  });

  // ---- NULL safety ----
  console.log('\n── NULL convertedAmount safety ──');

  await test('31 an unconverted row makes reporting FAIL LOUDLY, never understate', async () => {
    const u = await makeUser('nullsafe');
    stub.setMode('ok'); currencyService.clearCache();
    await request('POST', '/api/transactions', { token: u.token, body: tx(u, { amount: 1000, currency: 'INR' }) });

    // Simulate a legacy/unbackfilled row.
    await prisma.transaction.create({
      data: {
        amount: new Prisma.Decimal(500), currency: 'INR', date: new Date(), type: 'EXPENSE',
        userId: u.userId, categoryId: u.expenseCat, convertedAmount: null, exchangeRate: null, baseCurrency: null,
      },
    });

    const d = await request('GET', '/api/dashboard', { token: u.token });
    assert(d.status === 409, `dashboard must refuse, got ${d.status}`);
    assert(/converted amount/i.test(d.body.message), `message should explain, got: ${d.body.message}`);
    const a = await request('GET', '/api/analytics', { token: u.token });
    assert(a.status === 409, `analytics must refuse, got ${a.status}`);
  });

  // ---- regression ----
  console.log('\n── Single-currency regression ──');

  await test('32 a purely single-currency account behaves exactly as before', async () => {
    const u = await makeUser('regression');
    stub.setMode('ok'); currencyService.clearCache();
    const before = stub.calls;
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 5000, type: 'INCOME', categoryId: u.incomeCat, date: TODAY, currency: 'INR' } });
    await request('POST', '/api/transactions', { token: u.token, body: { amount: 2000, type: 'EXPENSE', categoryId: u.expenseCat, date: TODAY, currency: 'INR' } });
    assert(stub.calls === before, 'single-currency accounts must never call the provider');
    const d = (await request('GET', '/api/dashboard', { token: u.token })).body.data;
    assert(d.summary.monthlyIncome === 5000 && d.summary.monthlyExpenses === 2000, 'raw totals preserved');
    assert(d.summary.totalBalance === 3000, `balance should be 3000, got ${d.summary.totalBalance}`);
  });

  console.log(`\n${'='.repeat(46)}\n Passed: ${passed} | Failed: ${failed}\n${'='.repeat(46)}`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log('  • ' + f)); }
}

async function main() {
  const server: Server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  try { await run(); }
  finally {
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.$disconnect();
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('💥 Suite crashed:', e);
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
