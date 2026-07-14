import authService from '../services/authService';
import userRepository from '../repositories/UserRepository';
import refreshTokenRepository from '../repositories/RefreshTokenRepository';
import { hashPassword } from '../utils/password';
import { ConflictError, UnauthorizedError, NotFoundError } from '../errors/AppError';

// Quick assertion helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Auth Service Unit Tests...\n');
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

  // 1. Test Registration Success
  await runTest('Registration Success', async () => {
    const mockUser = {
      id: 'mock-user-uuid',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      firstName: 'Jane',
      lastName: 'Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock repository layers
    userRepository.findByEmail = async () => null;
    userRepository.create = async () => mockUser;

    const result = await authService.register({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'test@example.com',
      password: 'Password123!',
    });

    assert(result.id === 'mock-user-uuid', 'Should return user id');
    assert(result.email === 'test@example.com', 'Should return email');
    assert((result as any).passwordHash === undefined, 'Should not return password hash');
  });

  // 2. Test Registration Duplicate Email
  await runTest('Registration Duplicate Email Conflict', async () => {
    const mockUser = {
      id: 'mock-user-uuid',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      firstName: 'Jane',
      lastName: 'Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findByEmail = async () => mockUser;

    try {
      await authService.register({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'test@example.com',
        password: 'Password123!',
      });
      assert(false, 'Should throw ConflictError');
    } catch (err: any) {
      assert(err instanceof ConflictError, 'Error should be instance of ConflictError');
      assert(err.message.includes('exists'), 'Error message should report already exists');
    }
  });

  // 3. Test Login Success
  await runTest('Login Success with Correct Credentials', async () => {
    const plainPassword = 'Password123!';
    const passwordHash = await hashPassword(plainPassword);
    
    const mockUser = {
      id: 'user-uuid',
      email: 'user@example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Smith',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findByEmail = async () => mockUser;
    refreshTokenRepository.create = async (data: any) => data;

    const result = await authService.login({
      email: 'user@example.com',
      password: plainPassword,
    });

    assert(!!result.tokens.accessToken, 'Access token must be generated');
    assert(!!result.tokens.refreshToken, 'Refresh token must be generated');
    assert(result.user.email === 'user@example.com', 'User email must match');
  });

  // 4. Test Login Incorrect Password
  await runTest('Login Fails with Wrong Password', async () => {
    const passwordHash = await hashPassword('Password123!');
    
    const mockUser = {
      id: 'user-uuid',
      email: 'user@example.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Smith',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findByEmail = async () => mockUser;

    try {
      await authService.login({
        email: 'user@example.com',
        password: 'WrongPassword!',
      });
      assert(false, 'Should throw UnauthorizedError');
    } catch (err: any) {
      assert(err instanceof UnauthorizedError, 'Error should be instance of UnauthorizedError');
      assert(err.message.includes('Invalid'), 'Error message should report invalid credentials');
    }
  });

  // 5. Test Profile Search
  await runTest('Profile Retrieval Success', async () => {
    const mockUser = {
      id: 'user-uuid',
      email: 'user@example.com',
      passwordHash: 'hash',
      firstName: 'Alice',
      lastName: 'Smith',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    userRepository.findById = async (id: string) => {
      assert(id === 'user-uuid', 'Should pass correct id');
      return mockUser;
    };

    const result = await authService.getCurrentUser('user-uuid');
    assert(result.firstName === 'Alice', 'First name must match');
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

// Execute tests
runTests();
