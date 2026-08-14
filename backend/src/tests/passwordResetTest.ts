import '../config/env';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import authService from '../services/authService';
import userRepository from '../repositories/UserRepository';
import refreshTokenRepository from '../repositories/RefreshTokenRepository';
import passwordResetTokenRepository from '../repositories/PasswordResetTokenRepository';
import emailService from '../services/EmailService';
import { hashPassword, comparePassword } from '../utils/password';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '../errors/AppError';

// Mock email sending for automated unit tests if real SMTP is not configured
if (!emailService.isConfigured()) {
  emailService.sendPasswordResetEmail = async () => {};
}

const prisma = new PrismaClient();

// Quick assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

// Unique email generator for test isolation
let testCounter = 0;
function uniqueEmail(): string {
  testCounter++;
  return `pwreset-test-${Date.now()}-${testCounter}@test.local`;
}

const STRONG_PASSWORD = 'TestPass123!';
const NEW_STRONG_PASSWORD = 'NewPass456@';

async function runTests() {
  console.log('🧪 Starting Comprehensive Auth & Password Reset Tests...\n');
  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, testFn: () => Promise<void>) => {
    try {
      await testFn();
      console.log(`✅ Passed: ${name}`);
      passed++;
    } catch (error: any) {
      console.error(`❌ Failed: ${name}`);
      console.error(`   Reason: ${error.message || error}`);
      failed++;
    }
  };

  // ==========================================
  // REGISTRATION TESTS
  // ==========================================
  console.log('\n--- Registration Tests ---');

  let registeredEmail = '';

  await runTest('Registration - Valid registration persists user', async () => {
    registeredEmail = uniqueEmail();
    const result = await authService.register({
      firstName: 'Test',
      lastName: 'User',
      email: registeredEmail,
      password: STRONG_PASSWORD,
    });

    assert(!!result.id, 'Should return user id');
    assert(result.email === registeredEmail, 'Should return matching email');
    assert((result as any).passwordHash === undefined, 'Should not expose password hash');

    // Verify in database
    const dbUser = await prisma.user.findUnique({ where: { email: registeredEmail } });
    assert(!!dbUser, 'User should exist in database');
    assert(dbUser!.passwordHash.startsWith('$2a$') || dbUser!.passwordHash.startsWith('$2b$'), 'Password should be bcrypt hashed');
  });

  await runTest('Registration - Duplicate email throws ConflictError', async () => {
    try {
      await authService.register({
        firstName: 'Dupe',
        lastName: 'User',
        email: registeredEmail,
        password: STRONG_PASSWORD,
      });
      assert(false, 'Should throw ConflictError');
    } catch (err: any) {
      assert(err instanceof ConflictError, 'Error should be ConflictError');
    }
  });

  // ==========================================
  // LOGIN TESTS
  // ==========================================
  console.log('\n--- Login Tests ---');

  await runTest('Login - Correct credentials returns tokens', async () => {
    const result = await authService.login({
      email: registeredEmail,
      password: STRONG_PASSWORD,
    });

    assert(!!result.tokens.accessToken, 'Should return access token');
    assert(!!result.tokens.refreshToken, 'Should return refresh token');
    assert(result.user.email === registeredEmail, 'User email should match');

    // Verify refresh token persisted in DB
    const dbToken = await prisma.refreshToken.findFirst({
      where: { userId: result.user.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(!!dbToken, 'Refresh token should be persisted in database');
  });

  await runTest('Login - Incorrect password throws UnauthorizedError', async () => {
    try {
      await authService.login({
        email: registeredEmail,
        password: 'WrongPassword!',
      });
      assert(false, 'Should throw UnauthorizedError');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'Error should be UnauthorizedError');
      assert(err.message.includes('Invalid'), 'Message should be generic');
    }
  });

  await runTest('Login - Nonexistent email throws UnauthorizedError', async () => {
    try {
      await authService.login({
        email: 'nonexistent-user@nowhere.test',
        password: STRONG_PASSWORD,
      });
      assert(false, 'Should throw UnauthorizedError');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'Error should be UnauthorizedError');
    }
  });

  // ==========================================
  // FORGOT PASSWORD TESTS
  // ==========================================
  console.log('\n--- Forgot Password Tests ---');

  await runTest('Forgot Password - Existing email creates reset token (no error)', async () => {
    // Should not throw
    await authService.forgotPassword(registeredEmail);

    // Verify token was created in DB
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(tokens.length > 0, 'Reset token should be created in database');
    assert(tokens[0].tokenHash.length === 64, 'Token hash should be SHA-256 (64 hex chars)');
    assert(tokens[0].usedAt === null, 'Token should not be marked as used');
    assert(tokens[0].expiresAt > new Date(), 'Token should not be expired yet');
  });

  await runTest('Forgot Password - Nonexistent email does NOT throw (anti-enumeration)', async () => {
    // Should complete without error, same behavior as existing email
    await authService.forgotPassword('definitely-not-a-real-user@nowhere.test');
    // No assertion needed — if it threw, the test would fail
  });

  // ==========================================
  // RESET PASSWORD TESTS
  // ==========================================
  console.log('\n--- Reset Password Tests ---');

  // Helper: create a real reset token and return the raw token
  async function createResetToken(email: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { email } });
    assert(!!user, 'User must exist to create reset token');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId: user!.id,
      },
    });

    return rawToken;
  }

  await runTest('Reset Password - Valid token resets password', async () => {
    const rawToken = await createResetToken(registeredEmail);

    await authService.resetPassword(rawToken, NEW_STRONG_PASSWORD);

    // Verify password was changed
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const isNewPasswordValid = await comparePassword(NEW_STRONG_PASSWORD, user!.passwordHash);
    assert(isNewPasswordValid, 'New password should be valid');

    // Verify old password no longer works
    const isOldPasswordValid = await comparePassword(STRONG_PASSWORD, user!.passwordHash);
    assert(!isOldPasswordValid, 'Old password should no longer work');
  });

  await runTest('Reset Password - Token is marked as used after reset', async () => {
    // Get the most recently used token
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const usedTokens = await prisma.passwordResetToken.findMany({
      where: { userId: user!.id, usedAt: { not: null } },
    });
    assert(usedTokens.length > 0, 'At least one token should be marked as used');
  });

  await runTest('Reset Password - Reuse of token throws BadRequestError', async () => {
    // Create a new token, use it, then try again
    const rawToken = await createResetToken(registeredEmail);
    await authService.resetPassword(rawToken, STRONG_PASSWORD); // Use it once

    try {
      await authService.resetPassword(rawToken, 'AnotherPass789#'); // Try to reuse
      assert(false, 'Should throw BadRequestError for reused token');
    } catch (err: any) {
      assert(err instanceof BadRequestError, 'Error should be BadRequestError');
      assert(err.message.includes('already been used'), 'Message should indicate token was already used');
    }
  });

  await runTest('Reset Password - Expired token throws BadRequestError', async () => {
    // Create token with past expiry
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt: new Date(Date.now() - 1000), // Already expired
        userId: user!.id,
      },
    });

    try {
      await authService.resetPassword(rawToken, NEW_STRONG_PASSWORD);
      assert(false, 'Should throw BadRequestError for expired token');
    } catch (err: any) {
      assert(err instanceof BadRequestError, 'Error should be BadRequestError');
      assert(err.message.includes('expired'), 'Message should indicate token expired');
    }
  });

  await runTest('Reset Password - Invalid/random token throws BadRequestError', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex');

    try {
      await authService.resetPassword(fakeToken, NEW_STRONG_PASSWORD);
      assert(false, 'Should throw BadRequestError for invalid token');
    } catch (err: any) {
      assert(err instanceof BadRequestError, 'Error should be BadRequestError');
    }
  });

  await runTest('Reset Password - Refresh tokens are invalidated after reset', async () => {
    // Login to create refresh tokens
    const loginResult = await authService.login({
      email: registeredEmail,
      password: STRONG_PASSWORD, // Current password after previous resets
    });

    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const preResetTokens = await prisma.refreshToken.count({ where: { userId: user!.id } });
    assert(preResetTokens > 0, 'Should have refresh tokens before reset');

    // Reset password
    const rawToken = await createResetToken(registeredEmail);
    await authService.resetPassword(rawToken, NEW_STRONG_PASSWORD);

    // Verify all refresh tokens for this user are deleted
    const postResetTokens = await prisma.refreshToken.count({ where: { userId: user!.id } });
    assert(postResetTokens === 0, 'All refresh tokens should be deleted after password reset');
  });

  await runTest('Reset Password - Login with new password succeeds', async () => {
    const result = await authService.login({
      email: registeredEmail,
      password: NEW_STRONG_PASSWORD,
    });

    assert(!!result.tokens.accessToken, 'Should get access token with new password');
    assert(result.user.email === registeredEmail, 'User email should match');
  });

  await runTest('Reset Password - Login with old password fails', async () => {
    try {
      await authService.login({
        email: registeredEmail,
        password: STRONG_PASSWORD, // Old password
      });
      assert(false, 'Should throw UnauthorizedError');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'Error should be UnauthorizedError');
    }
  });

  // ==========================================
  // DATABASE VERIFICATION
  // ==========================================
  console.log('\n--- Database Verification ---');

  await runTest('Database - User record exists with bcrypt hash', async () => {
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    assert(!!user, 'User should exist in database');
    assert(
      user!.passwordHash.startsWith('$2a$') || user!.passwordHash.startsWith('$2b$'),
      'Password must be bcrypt hashed'
    );
    // Ensure no plaintext password field exists
    const userKeys = Object.keys(user!);
    assert(!userKeys.includes('password'), 'No plaintext password field should exist');
  });

  await runTest('Database - Reset tokens stored as SHA-256 hashes', async () => {
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const resetTokens = await prisma.passwordResetToken.findMany({
      where: { userId: user!.id },
    });
    assert(resetTokens.length > 0, 'Should have reset tokens');
    resetTokens.forEach((rt) => {
      assert(rt.tokenHash.length === 64, `Token hash should be 64 hex chars, got ${rt.tokenHash.length}`);
      assert(/^[a-f0-9]+$/.test(rt.tokenHash), 'Token hash should be valid hex');
    });
  });

  await runTest('Database - Used reset tokens have usedAt set', async () => {
    const user = await prisma.user.findUnique({ where: { email: registeredEmail } });
    const usedTokens = await prisma.passwordResetToken.findMany({
      where: { userId: user!.id, usedAt: { not: null } },
    });
    assert(usedTokens.length > 0, 'At least one token should have usedAt set');
    usedTokens.forEach((rt) => {
      assert(rt.usedAt instanceof Date, 'usedAt should be a Date');
    });
  });

  // ==========================================
  // CLEANUP
  // ==========================================
  console.log('\n--- Cleanup ---');

  // Delete test user and related data (cascade delete handles tokens)
  const testUser = await prisma.user.findUnique({ where: { email: registeredEmail } });
  if (testUser) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log(`🧹 Cleaned up test user: ${registeredEmail}`);
  }

  await prisma.$disconnect();

  // Test report summary
  console.log(`\n=========================================`);
  console.log(` Comprehensive Test Execution Complete `);
  console.log(` Passed: ${passed} | Failed: ${failed} `);
  console.log(`=========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Execute tests
runTests();
