import { User } from '@prisma/client';
import userRepository from '../repositories/UserRepository';
import refreshTokenRepository from '../repositories/RefreshTokenRepository';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from '../errors/AppError';

export interface SanitizedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  preferredCurrency: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  theme: string;
  budgetAlerts: boolean;
  savingsReminders: boolean;
  subscriptionRenewals: boolean;
  receiptScanNotifications: boolean;
  emailNotifications: boolean;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Registers a new user account.
   */
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<SanitizedUser> {
    // 1. Enforce email uniqueness
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('A user with this email address already exists');
    }

    // 2. Hash raw password
    const hashedPassword = await hashPassword(data.password);

    // 3. Create user in database
    const user = await userRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash: hashedPassword,
    });

    return this.sanitizeUser(user);
  }

  /**
   * Authenticates a user by validating their credentials.
   */
  async login(data: {
    email: string;
    password: string;
  }): Promise<{ tokens: AuthTokens; user: SanitizedUser }> {
    // 1. Retrieve user (generic credentials error checks for anti-enumeration)
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 2. Compare bcrypt hash
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // 3. Create access & refresh tokens
    const tokens = await this.generateUserSession(user);

    return {
      tokens,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Refreshes a user's access token and implements Refresh Token Rotation.
   */
  async refresh(tokenString: string): Promise<AuthTokens> {
    // 1. Verify token signature
    const decoded = verifyRefreshToken(tokenString);
    if (!decoded) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 2. Check token existence in database
    const storedToken = await refreshTokenRepository.findByToken(tokenString);
    if (!storedToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 3. Enforce expiration checks
    if (storedToken.expiresAt < new Date()) {
      await refreshTokenRepository.delete(storedToken.id);
      throw new UnauthorizedError('Refresh token has expired');
    }

    // 4. Retrieve associated user
    const user = await userRepository.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedError('User session not found');
    }

    // 5. Rotation: delete the old token first
    await refreshTokenRepository.delete(storedToken.id);

    // 6. Generate and save a brand new token set
    const newTokens = await this.generateUserSession(user);

    return newTokens;
  }

  /**
   * Revokes a user session by deleting the refresh token from the database.
   */
  async logout(tokenString: string): Promise<void> {
    try {
      await refreshTokenRepository.deleteByToken(tokenString);
    } catch (error) {
      // Fail silently if token doesn't exist, as the session is already terminated
    }
  }

  /**
   * Fetches the user details profile.
   */
  async getCurrentUser(userId: string): Promise<SanitizedUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.sanitizeUser(user);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      preferredCurrency: user.preferredCurrency,
      language: user.language,
      dateFormat: user.dateFormat,
      timeFormat: user.timeFormat,
      theme: user.theme,
      budgetAlerts: user.budgetAlerts,
      savingsReminders: user.savingsReminders,
      subscriptionRenewals: user.subscriptionRenewals,
      receiptScanNotifications: user.receiptScanNotifications,
      emailNotifications: user.emailNotifications,
      createdAt: user.createdAt,
    };
  }

  private async generateUserSession(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = { userId: user.id, email: user.email };
    
    const accessToken = generateAccessToken(payload);
    const refreshTokenString = generateRefreshToken(payload);

    // Calculate expiry date: 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save refresh token to database
    await refreshTokenRepository.create({
      token: refreshTokenString,
      expiresAt,
      userId: user.id,
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
    };
  }
}

export default new AuthService();
