import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using Bcrypt with salt stretching.
 * @param password The plaintext password to hash.
 * @returns A promise resolving to the hashed password string.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password with a stored hash.
 * @param password The plaintext password to check.
 * @param hash The database bcrypt hash.
 * @returns A promise resolving to true if matching.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
