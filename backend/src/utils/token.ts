import crypto from 'crypto';

// 32 bytes = 256 bits of entropy, encoded as 64 hex characters.
const TOKEN_BYTES = 32;

/**
 * Generates a cryptographically secure, opaque random token.
 * Used for refresh tokens and password reset tokens — both are looked up
 * in the database, so they gain nothing from being signed JWTs and must
 * instead be guaranteed unique and unguessable.
 * @returns A 64-character hex string.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Hashes a raw token with SHA-256 for storage at rest.
 * Only the hash is ever persisted, so a database disclosure does not yield
 * usable credentials. SHA-256 (not bcrypt) is appropriate here because the
 * input already carries full entropy and lookups must stay indexable.
 * @param token The raw token as issued to the client.
 * @returns The hex-encoded SHA-256 digest.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
