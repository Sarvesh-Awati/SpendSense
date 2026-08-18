import crypto from 'crypto';
import { User } from '@prisma/client';
import userRepository from '../repositories/UserRepository';
import refreshTokenRepository from '../repositories/RefreshTokenRepository';
import passwordResetTokenRepository from '../repositories/PasswordResetTokenRepository';
import emailService from './EmailService';
import { hashPassword, comparePassword } from '../utils/password';
import { generateSecureToken, hashToken } from '../utils/token';
import { generateAccessToken, TokenPayload } from '../utils/jwt';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
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

// Reset token expiry: 1 hour
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

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
   * The incoming token is opaque, so identity comes from the stored record
   * rather than from a signature.
   */
  async refresh(tokenString: string): Promise<AuthTokens> {
    // 1. Look the session up by hash — raw tokens are never stored
    const storedToken = await refreshTokenRepository.findByTokenHash(hashToken(tokenString));
    if (!storedToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 2. REUSE DETECTION.
    //
    //    This token was already consumed by a rotation, yet somebody is
    //    presenting it again. Exactly one legitimate holder can exist per
    //    token, so either a thief is replaying a token the real user has
    //    already rotated past, or the real user is replaying one the thief
    //    rotated. The two are indistinguishable from here, and in both cases
    //    the family is compromised — so every descendant of that original
    //    login is revoked and everyone re-authenticates.
    if (storedToken.revokedAt) {
      await refreshTokenRepository.revokeFamily(storedToken.familyId);
      console.error(
        `[auth] Refresh token reuse detected for user ${storedToken.userId}; ` +
          `family ${storedToken.familyId} revoked (token value withheld)`
      );
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 3. Enforce expiration checks
    if (storedToken.expiresAt < new Date()) {
      await refreshTokenRepository.markRevoked(storedToken.id);
      throw new UnauthorizedError('Refresh token has expired');
    }

    // 4. Retrieve associated user
    const user = await userRepository.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedError('User session not found');
    }

    // 5. Rotation: consume the presented token, then mint its successor into
    //    the same family. Marking (not deleting) is what leaves the evidence
    //    a later replay is recognised by.
    const rotated = await refreshTokenRepository.markRevoked(storedToken.id);

    // Two requests raced for the same token and the other one won. Treat the
    // loser as a replay rather than issuing a second live successor from one
    // parent — that would fork the family and defeat the detection above.
    if (rotated.count === 0) {
      await refreshTokenRepository.revokeFamily(storedToken.familyId);
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 6. Generate and save a brand new token set within the same family
    return this.generateUserSession(user, storedToken.familyId);
  }

  /**
   * Revokes a user session by deleting the refresh token from the database.
   * Never logs the raw token.
   */
  async logout(tokenString: string): Promise<void> {
    try {
      await refreshTokenRepository.revokeByTokenHash(hashToken(tokenString));
    } catch (error) {
      // Fail silently if token doesn't exist, as the session is already terminated
      console.error('Logout revocation failed for a refresh token (token value withheld)');
    }
  }

  /**
   * Revokes every session belonging to a user.
   * Used after a password change, a password reset, and account deletion.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await refreshTokenRepository.deleteManyByUserId(userId);

    /**
     * Pending password-reset links die with the sessions.
     *
     * A reset token issued before a password change stayed live for its full
     * hour afterwards, so someone who had triggered "forgot password" — the
     * exact scenario a worried user changes their password to shut down —
     * could still use their emailed link to set a new one and take the account
     * back. Changing a password must invalidate every other route to it.
     */
    await passwordResetTokenRepository.deleteManyByUserId(userId);
  }

  /**
   * Removes refresh tokens that are expired or long since revoked.
   *
   * Rotation now marks rows rather than deleting them (so replays stay
   * detectable), which means the table grows with every refresh. Called on a
   * timer from server.ts.
   */
  async purgeStaleTokens(): Promise<number> {
    const { count } = await refreshTokenRepository.purgeStale();
    return count;
  }

  /**
   * Issues a fresh token pair for an already-authenticated user.
   * Used to keep the caller signed in immediately after their own password
   * change invalidates every existing session.
   */
  async issueSessionForUser(userId: string): Promise<AuthTokens> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.generateUserSession(user);
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

  /**
   * Initiates a password reset flow.
   * Always returns void to prevent account enumeration (OWASP).
   * Sends transactional email to user.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);

    // If user doesn't exist, return silently (anti-enumeration)
    if (!user) {
      return;
    }

    // Invalidate any previously issued reset tokens so at most one is live
    await passwordResetTokenRepository.deleteManyByUserId(user.id);

    // Generate a cryptographically secure random token (32 bytes = 64 hex chars)
    const rawToken = generateSecureToken();

    // Store only the SHA-256 hash in the database
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    // Persist hashed token
    await passwordResetTokenRepository.create({
      tokenHash,
      expiresAt,
      userId: user.id,
    });

    // Send transactional password reset email.
    //
    // SECURITY: delivery failure must NEVER change the externally observable
    // response. Letting this throw made the endpoint return 500 for real
    // accounts and 200 for unknown ones — a perfect account-enumeration
    // oracle. The failure is logged server-side and swallowed here so the
    // controller returns the same generic success either way.
    try {
      await emailService.sendPasswordResetEmail(user.email, rawToken);
    } catch (error) {
      console.error(
        '[forgotPassword] Password reset email delivery failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Resets a user's password using a valid reset token.
   * Does NOT auto-login the user (OWASP recommendation).
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    // 1. Hash the incoming token to compare against stored hash
    const tokenHash = hashToken(rawToken);

    // 2. Look up the token
    const storedToken = await passwordResetTokenRepository.findByTokenHash(tokenHash);
    if (!storedToken) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    // 3. Check if token has already been used
    if (storedToken.usedAt) {
      throw new BadRequestError('This password reset link has already been used');
    }

    // 4. Check expiration
    if (storedToken.expiresAt < new Date()) {
      throw new BadRequestError('This password reset link has expired');
    }

    // 5. Retrieve the associated user
    const user = await userRepository.findById(storedToken.userId);
    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    // 6. Hash the new password with bcrypt
    const hashedPassword = await hashPassword(newPassword);

    // 7. Update the user's password
    await userRepository.update(user.id, { passwordHash: hashedPassword });

    // 8. Mark the reset token as used (single-use enforcement)
    await passwordResetTokenRepository.markAsUsed(storedToken.id);

    // 9. Invalidate all existing refresh tokens / sessions for this user
    await refreshTokenRepository.deleteManyByUserId(user.id);
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

  /**
   * @param familyId when rotating, the family the previous token belonged to.
   *   Omitted for a fresh login, which starts a new family.
   */
  private async generateUserSession(user: User, familyId?: string): Promise<AuthTokens> {
    const payload: TokenPayload = { userId: user.id, email: user.email };

    const accessToken = generateAccessToken(payload);

    // Opaque, cryptographically random refresh token. Two tokens generated in
    // the same second are guaranteed distinct (256 bits of entropy), which is
    // what makes concurrent logins work.
    const refreshTokenString = generateSecureToken();

    // Calculate expiry date: 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Persist ONLY the hash — the raw token is returned to the client below
    // and never stored, so the database holds no usable credential.
    await refreshTokenRepository.create({
      tokenHash: hashToken(refreshTokenString),
      expiresAt,
      userId: user.id,
      familyId: familyId ?? crypto.randomUUID(),
    });

    return {
      accessToken,
      refreshToken: refreshTokenString,
    };
  }
}

export default new AuthService();
