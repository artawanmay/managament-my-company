/**
 * AES-256-GCM Encryption Service for secrets
 * Requirements: 7.2, 18.4 - Encrypt all secrets at rest using AES-256-GCM
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

// AES-256-GCM configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16; // 128 bits for key derivation
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Get the encryption key from environment variable
 * Uses scrypt for key derivation to ensure proper key length
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;

  if (!envKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Please set a secure encryption key in your environment.'
    );
  }

  // Use scrypt to derive a proper 256-bit key from the environment variable
  return scryptSync(envKey, salt, KEY_LENGTH);
}

/**
 * Encrypt a plaintext secret using AES-256-GCM
 * @param plaintext - The secret value to encrypt
 * @returns Base64 encoded string containing salt, IV, auth tag, and ciphertext
 */
export function encryptSecret(plaintext: string): string {
  if (plaintext === '') {
    // Handle empty string case - still encrypt it
    plaintext = '';
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from environment variable using the salt
  const key = getEncryptionKey(salt);

  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine salt + IV + authTag + ciphertext into a single buffer
  // Format: [salt (16 bytes)][iv (12 bytes)][authTag (16 bytes)][ciphertext]
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a ciphertext that was encrypted with encryptSecret
 * @param ciphertext - Base64 encoded string from encryptSecret
 * @returns The original plaintext secret
 * @throws Error if decryption fails (invalid ciphertext, wrong key, or tampered data)
 */
export function decryptSecret(ciphertext: string): string {
  try {
    const combined = Buffer.from(ciphertext, 'base64');

    // Minimum length check: salt + iv + authTag = 44 bytes
    if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid ciphertext: too short');
    }

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );

    // Derive the same key using the extracted salt
    const key = getEncryptionKey(salt);

    // Create decipher and decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid ciphertext')) {
      throw error;
    }
    throw new Error(
      'Decryption failed: invalid ciphertext, wrong key, or data has been tampered with'
    );
  }
}
