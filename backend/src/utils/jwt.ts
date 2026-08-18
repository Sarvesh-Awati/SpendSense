import jwt from 'jsonwebtoken';
import env from '../config/env';

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Generates an Access Token with a short lifespan.
 * @param payload User identity information.
 * @returns The signed JWT string.
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { sub: payload.userId, email: payload.email },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * NOTE: Refresh tokens are no longer JWTs.
 *
 * A signed JWT whose only claims were `sub`, `email`, `iat` and `exp` was
 * byte-identical for two tokens minted in the same second, which collided
 * with the unique constraint on the stored token and failed concurrent
 * logins with a 409. Refresh tokens are looked up in the database anyway,
 * so the signature bought nothing.
 *
 * They are now opaque random tokens — see utils/token.ts — stored as a
 * SHA-256 hash. There is deliberately NO refresh-token secret: nothing signs
 * or verifies them, so a second secret would protect nothing and rotating it
 * would revoke nothing. Revocation is a database operation — clear the rows
 * in `refresh_tokens` (or use authService.revokeAllSessions for one user).
 */

/**
 * Verifies an Access Token signature and retrieves the decoded payload.
 * @param token The incoming Bearer JWT.
 * @returns The decoded payload or null if invalid.
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    return {
      userId: decoded.sub,
      email: decoded.email,
    };
  } catch (error) {
    return null;
  }
}

