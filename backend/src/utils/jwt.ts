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
 * Generates a Refresh Token with a long lifespan.
 * @param payload User identity information.
 * @returns The signed JWT string.
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(
    { sub: payload.userId, email: payload.email },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

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

/**
 * Verifies a Refresh Token signature and retrieves the decoded payload.
 * @param token The incoming Refresh JWT.
 * @returns The decoded payload or null if invalid.
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
    return {
      userId: decoded.sub,
      email: decoded.email,
    };
  } catch (error) {
    return null;
  }
}
