/**
 * Password hashing utilities using argon2
 * Requirements: 18.1 - Hash all passwords using argon2 before storage
 */
import argon2 from 'argon2';

/**
 * Hash a password using argon2id (recommended variant)
 * @param password - The plaintext password to hash
 * @returns The hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against a hash
 * @param password - The plaintext password to verify
 * @param hash - The hash to verify against
 * @returns True if the password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Invalid hash format or other error
    return false;
  }
}
