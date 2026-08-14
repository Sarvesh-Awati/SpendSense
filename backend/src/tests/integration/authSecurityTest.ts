/**
 * Phase 1 security regression suite — HTTP integration tests.
 *
 * Unlike the other suites in this directory, this one mocks nothing. It boots
 * the real Express app on an ephemeral port and drives it over HTTP against
 * the real database, so routes, middleware, validators, services, repositories
 * and the error handler are all exercised.
 *
 * Every test here corresponds to a finding in SPENDSENSE_PRODUCTION_AUDIT.md
 * and fails against the pre-Phase-1 code.
 *
 * Run with:  NODE_ENV=test npx ts-node src/tests/integration/authSecurityTest.ts
 */
process.env.NODE_ENV = 'test';

import crypto from 'crypto';
import type { Server } from 'http';
import app from '../../app';
import prisma from '../../database/prisma';
import { hashToken, generateSecureToken } from '../../utils/token';
import { Prisma } from '@prisma/client';
import currencyService from '../../services/currencyService';
import type { ExchangeRateProvider } from '../../services/providers/exchangeRateProvider';

/**
 * Multi-currency: a foreign-currency transaction now requires an exchange rate
 * and fails closed without one. These tests care about currency *persistence*,
 * not about the provider, so a deterministic stub is injected. Rate handling
 * itself is covered by multiCurrencyTest.ts.
 */
const stubRateProvider: ExchangeRateProvider = {
  name: 'stub',
  async getRate(from: string, to: string) {
    if (from === 'USD' && to === 'INR') return new Prisma.Decimal('84');
    return new Prisma.Decimal('1');
  },
};

// ==========================================
// HARNESS
// ==========================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${name}\n     ${reason}`);
    failures.push(`${name} — ${reason}`);
    failed++;
  }
}

let baseUrl = '';
const createdUserIds: string[] = [];

interface ApiResponse<T = any> {
  status: number;
  body: T;
  raw: string;
}

async function request(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {}
): Promise<ApiResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await res.text();
  let body: any = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, raw };
}

const STRONG_PASSWORD = 'Str0ng!Passw0rd';
const NEW_PASSWORD = 'An0ther!Passw0rd';

function uniqueEmail(label: string): string {
  return `phase1.${label}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}@spendsense.test`;
}

/** Registers a user and returns its credentials plus a logged-in session. */
async function createUser(label: string) {
  const email = uniqueEmail(label);
  const reg = await request('POST', '/api/auth/register', {
    body: { firstName: 'Phase', lastName: 'One', email, password: STRONG_PASSWORD },
  });
  assert(reg.status === 201, `setup: registration failed (${reg.status}) ${reg.raw.slice(0, 200)}`);
  const userId = reg.body.data.user.id;
  createdUserIds.push(userId);

  const login = await request('POST', '/api/auth/login', {
    body: { email, password: STRONG_PASSWORD },
  });
  assert(login.status === 200, `setup: login failed (${login.status})`);

  return {
    userId,
    email,
    password: STRONG_PASSWORD,
    accessToken: login.body.data.tokens.accessToken as string,
    refreshToken: login.body.data.tokens.refreshToken as string,
  };
}

// ==========================================
// TESTS
// ==========================================

async function runTests() {
  console.log('\n🔒 Phase 1 Security Regression Suite (HTTP integration)\n');

  // ---------- AUTH ----------
  console.log('── Authentication ──');

  await test('Registration creates an account and never returns a password hash', async () => {
    const email = uniqueEmail('register');
    const res = await request('POST', '/api/auth/register', {
      body: { firstName: 'Phase', lastName: 'One', email, password: STRONG_PASSWORD },
    });
    assert(res.status === 201, `expected 201, got ${res.status}`);
    assert(res.body.data.user.email === email, 'returned email should match');
    assert(res.body.data.user.passwordHash === undefined, 'passwordHash must never be returned');
    createdUserIds.push(res.body.data.user.id);
  });

  await test('Registration rejects a weak password (shared policy)', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: { firstName: 'A', lastName: 'B', email: uniqueEmail('weak'), password: 'weakpass' },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test('Login returns an access and refresh token pair', async () => {
    const user = await createUser('login');
    assert(!!user.accessToken, 'accessToken missing');
    assert(!!user.refreshToken, 'refreshToken missing');
  });

  await test('Login with a wrong password is rejected with a generic 401', async () => {
    const user = await createUser('wrongpw');
    const res = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: 'Wr0ng!Passw0rd' },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
    assert(
      /invalid email or password/i.test(res.body.message),
      'message must not distinguish unknown account from wrong password'
    );
  });

  // C2: this is the regression test for the 409 collision.
  await test('C2 — two SIMULTANEOUS logins both succeed with different refresh tokens', async () => {
    const user = await createUser('concurrent');
    const [a, b, c] = await Promise.all([
      request('POST', '/api/auth/login', { body: { email: user.email, password: user.password } }),
      request('POST', '/api/auth/login', { body: { email: user.email, password: user.password } }),
      request('POST', '/api/auth/login', { body: { email: user.email, password: user.password } }),
    ]);

    assert(a.status === 200, `login A failed: ${a.status} ${a.body?.message ?? ''}`);
    assert(b.status === 200, `login B failed: ${b.status} ${b.body?.message ?? ''}`);
    assert(c.status === 200, `login C failed: ${c.status} ${c.body?.message ?? ''}`);

    const tokens = [
      a.body.data.tokens.refreshToken,
      b.body.data.tokens.refreshToken,
      c.body.data.tokens.refreshToken,
    ];
    assert(new Set(tokens).size === 3, 'all three refresh tokens must be distinct');

    // Both sessions must actually work.
    for (const t of tokens) {
      const r = await request('POST', '/api/auth/refresh', { body: { refreshToken: t } });
      assert(r.status === 200, `each concurrent session must be usable, got ${r.status}`);
    }
  });

  await test('Access token authenticates a protected route', async () => {
    const user = await createUser('me');
    const res = await request('GET', '/api/auth/me', { token: user.accessToken });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(res.body.data.user.email === user.email, 'should return the calling user');
  });

  await test('Protected route rejects a missing or malformed token', async () => {
    const none = await request('GET', '/api/auth/me');
    assert(none.status === 401, `no token: expected 401, got ${none.status}`);
    const bad = await request('GET', '/api/auth/me', { token: 'not-a-real-token' });
    assert(bad.status === 401, `bad token: expected 401, got ${bad.status}`);
  });

  await test('Refresh rotates the token and invalidates the old one', async () => {
    const user = await createUser('refresh');
    const rotated = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert(rotated.status === 200, `expected 200, got ${rotated.status}`);
    const newRefresh = rotated.body.data.tokens.refreshToken;
    assert(newRefresh !== user.refreshToken, 'refresh token must rotate');

    const replay = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert(replay.status === 401, `rotated-away token must be rejected, got ${replay.status}`);
  });

  await test('Refresh rejects an unknown token', async () => {
    const res = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: generateSecureToken() },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await test('C3 — logout revokes the refresh token server-side', async () => {
    const user = await createUser('logout');
    const out = await request('POST', '/api/auth/logout', {
      body: { refreshToken: user.refreshToken },
    });
    assert(out.status === 200, `logout expected 200, got ${out.status}`);

    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(user.refreshToken) },
    });
    assert(row === null, 'refresh token row must be deleted from the database');

    const reuse = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert(reuse.status === 401, `revoked token must be rejected, got ${reuse.status}`);
  });

  // ---------- REFRESH TOKENS AT REST ----------
  console.log('\n── Refresh tokens at rest ──');

  await test('C4 — the database stores only a SHA-256 hash, never the raw token', async () => {
    const user = await createUser('atrest');

    const exact = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(user.refreshToken) },
    });
    assert(exact !== null, 'session should be findable by hash');
    assert(
      exact!.tokenHash === hashToken(user.refreshToken),
      'stored value must equal sha256(rawToken)'
    );
    assert(exact!.tokenHash !== user.refreshToken, 'stored value must NOT equal the raw token');

    // The raw token must not appear anywhere in the table.
    const anyRaw = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM refresh_tokens WHERE "tokenHash" = ${user.refreshToken}
    `;
    assert(Number(anyRaw[0].count) === 0, 'raw token must never be persisted');

    // And the retired raw-token column must be gone entirely.
    const col = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM information_schema.columns
      WHERE table_name = 'refresh_tokens' AND column_name = 'token'
    `;
    assert(Number(col[0].count) === 0, 'legacy plaintext "token" column must not exist');
  });

  await test('C2 — token generation is unique across rapid successive calls', async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 500; i++) tokens.add(generateSecureToken());
    assert(tokens.size === 500, 'every generated token must be unique');
  });

  // ---------- PROFILE ----------
  console.log('\n── Profile (C1) ──');

  await test('C1 — updateProfile CANNOT change the password', async () => {
    const user = await createUser('profilepw');

    const res = await request('PUT', '/api/users/profile', {
      token: user.accessToken,
      body: { firstName: 'Renamed', password: 'hijacked1' },
    });
    assert(res.status === 200, `profile update should still succeed, got ${res.status}`);
    assert(res.body.data.user.firstName === 'Renamed', 'permitted field should still update');

    // The injected password must have had no effect.
    const hijack = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: 'hijacked1' },
    });
    assert(hijack.status === 401, `injected password must NOT work, got ${hijack.status}`);

    const original = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: STRONG_PASSWORD },
    });
    assert(original.status === 200, 'original password must still work');
  });

  await test('C1 — updateProfile CANNOT change the email', async () => {
    const user = await createUser('profileemail');
    const attacker = uniqueEmail('attacker');

    const res = await request('PUT', '/api/users/profile', {
      token: user.accessToken,
      body: { email: attacker },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(res.body.data.user.email === user.email, 'email must be unchanged in the response');

    const row = await prisma.user.findUnique({ where: { id: user.userId } });
    assert(row!.email === user.email, 'email must be unchanged in the database');
  });

  await test('updateProfile still updates permitted fields', async () => {
    const user = await createUser('profileok');
    const res = await request('PUT', '/api/users/profile', {
      token: user.accessToken,
      body: { firstName: 'Ada', lastName: 'Lovelace', preferredCurrency: 'USD', theme: 'light' },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(res.body.data.user.firstName === 'Ada', 'firstName should update');
    assert(res.body.data.user.lastName === 'Lovelace', 'lastName should update');
    assert(res.body.data.user.preferredCurrency === 'USD', 'preferredCurrency should update');
    assert(res.body.data.user.theme === 'light', 'theme should update');
  });

  // ---------- PASSWORD CHANGE ----------
  console.log('\n── Password change (H2) ──');

  await test('Change password requires the correct current password', async () => {
    const user = await createUser('changepw-wrong');
    const res = await request('POST', '/api/users/change-password', {
      token: user.accessToken,
      body: { currentPassword: 'Wr0ng!Passw0rd', newPassword: NEW_PASSWORD },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await test('Change password requires currentPassword to be present', async () => {
    const user = await createUser('changepw-missing');
    const res = await request('POST', '/api/users/change-password', {
      token: user.accessToken,
      body: { newPassword: NEW_PASSWORD },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test('Change password rejects a weak new password (shared policy)', async () => {
    const user = await createUser('changepw-weak');
    const res = await request('POST', '/api/users/change-password', {
      token: user.accessToken,
      body: { currentPassword: user.password, newPassword: 'weakpass' },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
    const still = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: STRONG_PASSWORD },
    });
    assert(still.status === 200, 'original password must be unchanged');
  });

  await test('H2 — successful password change revokes ALL previous sessions', async () => {
    const user = await createUser('changepw-revoke');

    // A second device.
    const second = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: user.password },
    });
    assert(second.status === 200, 'second session should be created');
    const secondRefresh = second.body.data.tokens.refreshToken;

    const changed = await request('POST', '/api/users/change-password', {
      token: user.accessToken,
      body: { currentPassword: user.password, newPassword: NEW_PASSWORD },
    });
    assert(changed.status === 200, `expected 200, got ${changed.status}`);

    // Old sessions must be dead.
    const oldOne = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert(oldOne.status === 401, `first session must be revoked, got ${oldOne.status}`);
    const oldTwo = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: secondRefresh },
    });
    assert(oldTwo.status === 401, `second session must be revoked, got ${oldTwo.status}`);

    // The caller receives a fresh, working pair.
    const fresh = changed.body?.data?.tokens;
    assert(!!fresh?.refreshToken, 'a new token pair must be returned to the caller');
    const usable = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: fresh.refreshToken },
    });
    assert(usable.status === 200, `re-issued session must work, got ${usable.status}`);

    // And the new password is what logs in now.
    const newLogin = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: NEW_PASSWORD },
    });
    assert(newLogin.status === 200, 'new password must work');
    const oldLogin = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: STRONG_PASSWORD },
    });
    assert(oldLogin.status === 401, 'old password must no longer work');
  });

  // ---------- PASSWORD RESET ----------
  console.log('\n── Password reset (C5) ──');

  /** Seeds a reset token directly, since SMTP delivery is not available in tests. */
  async function seedResetToken(userId: string, expiresAt: Date) {
    const rawToken = generateSecureToken();
    await prisma.passwordResetToken.create({
      data: { tokenHash: hashToken(rawToken), expiresAt, userId },
    });
    return rawToken;
  }

  await test('C5 — forgot-password gives an IDENTICAL response for unknown and known emails', async () => {
    const user = await createUser('forgot');

    const unknown = await request('POST', '/api/auth/forgot-password', {
      body: { email: uniqueEmail('nobody') },
    });
    const known = await request('POST', '/api/auth/forgot-password', {
      body: { email: user.email },
    });

    assert(unknown.status === 200, `unknown email expected 200, got ${unknown.status}`);
    assert(
      known.status === 200,
      `known email expected 200, got ${known.status} — email delivery failure must not leak account existence`
    );
    assert(
      unknown.body.message === known.body.message,
      'response messages must be byte-identical'
    );

    // Detect genuine SMTP/configuration leakage only. A legitimate response
    // contains the words "email" and "password" ("...a password reset link
    // has been sent"), so matching on those produces false positives.
    const configLeak =
      /SMTP_(HOST|PORT|USER|PASS|PASSWORD|SECURE)|SMTP is not configured|Email provider is not configured|nodemailer|ECONNREFUSED|EAUTH|\/Users\/|\/home\/|\.ts:\d+/i;
    assert(
      !configLeak.test(known.raw),
      `response must not leak mail configuration: ${known.raw.slice(0, 200)}`
    );
    assert(
      !configLeak.test(unknown.raw),
      `response must not leak mail configuration: ${unknown.raw.slice(0, 200)}`
    );
  });

  await test('C5 — forgot-password still issues a token for a real account', async () => {
    const user = await createUser('forgot-token');
    await request('POST', '/api/auth/forgot-password', { body: { email: user.email } });
    const count = await prisma.passwordResetToken.count({ where: { userId: user.userId } });
    assert(count === 1, `expected exactly 1 reset token, found ${count}`);
  });

  await test('C5 — issuing a new reset token invalidates the previous one', async () => {
    const user = await createUser('forgot-single');
    const stale = await seedResetToken(user.userId, new Date(Date.now() + 3600_000));

    await request('POST', '/api/auth/forgot-password', { body: { email: user.email } });

    const count = await prisma.passwordResetToken.count({ where: { userId: user.userId } });
    assert(count === 1, `only one reset token should remain, found ${count}`);

    const res = await request('POST', '/api/auth/reset-password', {
      body: { token: stale, password: NEW_PASSWORD },
    });
    assert(res.status === 400, `superseded token must be rejected, got ${res.status}`);
  });

  await test('Password reset succeeds with a valid token', async () => {
    const user = await createUser('reset-ok');
    const raw = await seedResetToken(user.userId, new Date(Date.now() + 3600_000));

    const res = await request('POST', '/api/auth/reset-password', {
      body: { token: raw, password: NEW_PASSWORD },
    });
    assert(res.status === 200, `expected 200, got ${res.status} ${res.raw.slice(0, 160)}`);
    assert(!res.body.data?.tokens, 'reset must NOT auto-login the user');

    const login = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: NEW_PASSWORD },
    });
    assert(login.status === 200, 'new password must work after reset');
  });

  await test('Password reset token is single-use', async () => {
    const user = await createUser('reset-reuse');
    const raw = await seedResetToken(user.userId, new Date(Date.now() + 3600_000));

    const first = await request('POST', '/api/auth/reset-password', {
      body: { token: raw, password: NEW_PASSWORD },
    });
    assert(first.status === 200, `first use expected 200, got ${first.status}`);

    const second = await request('POST', '/api/auth/reset-password', {
      body: { token: raw, password: 'Third!Passw0rd1' },
    });
    assert(second.status === 400, `reuse must be rejected, got ${second.status}`);

    const login = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: 'Third!Passw0rd1' },
    });
    assert(login.status === 401, 'the replayed reset must not have changed the password');
  });

  await test('Expired password reset token is rejected', async () => {
    const user = await createUser('reset-expired');
    const raw = await seedResetToken(user.userId, new Date(Date.now() - 60_000));

    const res = await request('POST', '/api/auth/reset-password', {
      body: { token: raw, password: NEW_PASSWORD },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);

    const login = await request('POST', '/api/auth/login', {
      body: { email: user.email, password: NEW_PASSWORD },
    });
    assert(login.status === 401, 'expired token must not have changed the password');
  });

  await test('Password reset rejects a weak new password (shared policy)', async () => {
    const user = await createUser('reset-weak');
    const raw = await seedResetToken(user.userId, new Date(Date.now() + 3600_000));
    const res = await request('POST', '/api/auth/reset-password', {
      body: { token: raw, password: 'weakpass' },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test('Password reset revokes all existing sessions', async () => {
    const user = await createUser('reset-revoke');
    const raw = await seedResetToken(user.userId, new Date(Date.now() + 3600_000));

    const before = await prisma.refreshToken.count({ where: { userId: user.userId } });
    assert(before > 0, 'user should have an active session before reset');

    const res = await request('POST', '/api/auth/reset-password', {
      body: { token: raw, password: NEW_PASSWORD },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);

    const after = await prisma.refreshToken.count({ where: { userId: user.userId } });
    assert(after === 0, `all sessions must be revoked, ${after} remained`);

    const reuse = await request('POST', '/api/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });
    assert(reuse.status === 401, `pre-reset session must be dead, got ${reuse.status}`);
  });

  // ---------- ACCOUNT DELETION ----------
  console.log('\n── Account deletion (H1) ──');

  await test('H1 — deletion without currentPassword is rejected', async () => {
    const user = await createUser('delete-missing');
    const res = await request('DELETE', '/api/users/account', {
      token: user.accessToken,
      body: {},
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);

    const still = await prisma.user.findUnique({ where: { id: user.userId } });
    assert(still !== null, 'account must NOT be deleted');
  });

  await test('H1 — deletion with an incorrect password is rejected', async () => {
    const user = await createUser('delete-wrong');
    const res = await request('DELETE', '/api/users/account', {
      token: user.accessToken,
      body: { currentPassword: 'Wr0ng!Passw0rd' },
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);

    const still = await prisma.user.findUnique({ where: { id: user.userId } });
    assert(still !== null, 'account must NOT be deleted');
  });

  await test('H1 — deletion with the correct password succeeds and revokes sessions', async () => {
    const user = await createUser('delete-ok');
    const res = await request('DELETE', '/api/users/account', {
      token: user.accessToken,
      body: { currentPassword: user.password },
    });
    assert(res.status === 200, `expected 200, got ${res.status} ${res.raw.slice(0, 160)}`);

    const gone = await prisma.user.findUnique({ where: { id: user.userId } });
    assert(gone === null, 'account must be deleted');

    const sessions = await prisma.refreshToken.count({ where: { userId: user.userId } });
    assert(sessions === 0, 'sessions must be revoked');
  });


  // ---------- TRANSACTION CONTRACT (QA regressions) ----------
  console.log('\n── Transaction contract ──');
  currencyService.setProvider(stubRateProvider);

  /** Registers a user and returns a token plus a usable EXPENSE category id. */
  async function userWithCategory(label: string) {
    const user = await createUser(label);
    const cats = await request('GET', '/api/categories', { token: user.accessToken });
    const expense = cats.body.data.categories.find((c: any) => c.type === 'EXPENSE');
    return { ...user, categoryId: expense.id as string };
  }

  const txPayload = (categoryId: string, extra: Record<string, unknown> = {}) => ({
    amount: 250.75,
    type: 'EXPENSE',
    categoryId,
    date: '2026-08-14',
    merchant: 'Contract Test',
    ...extra,
  });

  await test('BUG#1 — currency USD is persisted, not silently replaced', async () => {
    const u = await userWithCategory('cur-usd');
    const res = await request('POST', '/api/transactions', {
      token: u.accessToken,
      body: txPayload(u.categoryId, { currency: 'USD' }),
    });
    assert(res.status === 201, `expected 201, got ${res.status} ${res.raw.slice(0, 160)}`);
    assert(
      res.body.data.transaction.currency === 'USD',
      `response currency should be USD, got ${res.body.data.transaction.currency}`
    );

    const stored = await prisma.transaction.findUnique({
      where: { id: res.body.data.transaction.id },
    });
    assert(stored!.currency === 'USD', `stored currency should be USD, got ${stored!.currency}`);
    // The original amount is preserved and a conversion is derived alongside it.
    assert(Number(stored!.amount) === 250.75, 'original amount must be untouched');
    assert(stored!.baseCurrency === 'INR', 'baseCurrency should be the account base');
    assert(Number(stored!.convertedAmount) === 21063, `converted should be 250.75x84=21063, got ${stored!.convertedAmount}`);
  });

  await test('BUG#1 — currency INR still works', async () => {
    const u = await userWithCategory('cur-inr');
    const res = await request('POST', '/api/transactions', {
      token: u.accessToken,
      body: txPayload(u.categoryId, { currency: 'INR' }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}`);
    assert(res.body.data.transaction.currency === 'INR', 'currency should be INR');
  });

  await test('BUG#1 — an unsupported currency is rejected with 400', async () => {
    const u = await userWithCategory('cur-bad');
    const res = await request('POST', '/api/transactions', {
      token: u.accessToken,
      body: txPayload(u.categoryId, { currency: 'XYZ' }),
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test('BUG#1 — omitting currency still defaults, and create still works', async () => {
    const u = await userWithCategory('cur-default');
    const res = await request('POST', '/api/transactions', {
      token: u.accessToken,
      body: txPayload(u.categoryId),
    });
    assert(res.status === 201, `expected 201, got ${res.status}`);
    assert(!!res.body.data.transaction.currency, 'a default currency should be applied');
  });

  await test('BUG#2 — amount is a number on POST, GET list, GET by id and PUT', async () => {
    const u = await userWithCategory('amount-type');

    const created = await request('POST', '/api/transactions', {
      token: u.accessToken,
      body: txPayload(u.categoryId),
    });
    assert(created.status === 201, `create failed: ${created.status}`);
    assert(
      typeof created.body.data.transaction.amount === 'number',
      `POST amount should be number, got ${typeof created.body.data.transaction.amount}`
    );
    const txId = created.body.data.transaction.id;

    const list = await request('GET', '/api/transactions?limit=5', { token: u.accessToken });
    assert(
      typeof list.body.data.transactions[0].amount === 'number',
      `GET list amount should be number, got ${typeof list.body.data.transactions[0].amount}`
    );

    const one = await request('GET', `/api/transactions/${txId}`, { token: u.accessToken });
    assert(
      typeof one.body.data.transaction.amount === 'number',
      `GET by id amount should be number, got ${typeof one.body.data.transaction.amount}`
    );

    const updated = await request('PUT', `/api/transactions/${txId}`, {
      token: u.accessToken,
      body: { amount: 99.5 },
    });
    assert(updated.status === 200, `update failed: ${updated.status}`);
    assert(
      typeof updated.body.data.transaction.amount === 'number',
      `PUT amount should be number, got ${typeof updated.body.data.transaction.amount}`
    );
    assert(updated.body.data.transaction.amount === 99.5, 'updated amount value should match');
  });

  // ---------- ERROR HANDLING ----------
  console.log('\n── Error handling ──');

  await test('Malformed :id does not leak filesystem paths or source code', async () => {
    const user = await createUser('badid');

    for (const path of ['/api/budgets/not-a-uuid', '/api/goals/not-a-uuid', '/api/transactions/abc']) {
      const res = await request('GET', path, { token: user.accessToken });
      assert(res.status !== 500, `${path}: expected a client error, got 500`);
      assert(!/\/Users\/|\/home\/|\.ts:\d+/.test(res.raw), `${path}: response leaked a filesystem path`);
      assert(!/modelDelegate|prisma\.|invocation in/i.test(res.raw), `${path}: response leaked internals`);
    }
  });

  await test('Unhandled errors return a generic message, never internals', async () => {
    const res = await request('GET', '/api/transactions?sortBy=definitelyNotAColumn', {
      token: (await createUser('sortby')).accessToken,
    });
    assert(!/\/Users\/|\.ts:\d+|modelDelegate/.test(res.raw), `response leaked internals: ${res.raw.slice(0, 200)}`);
  });

  // ---------- SUMMARY ----------
  console.log(`\n${'='.repeat(46)}`);
  console.log(` Passed: ${passed} | Failed: ${failed}`);
  console.log(`${'='.repeat(46)}`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  • ${f}`));
  }
}

// ==========================================
// BOOTSTRAP
// ==========================================

async function cleanup() {
  if (createdUserIds.length) {
    // Cascades remove sessions, reset tokens and any owned records.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

async function main() {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    await runTests();
  } finally {
    await cleanup();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error('💥 Suite crashed:', error);
  await cleanup().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
