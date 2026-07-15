/**
 * Encryption utilities for IdentiFind
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive fields.
 * The encryption key is derived from the ENCRYPTION_KEY environment variable.
 *
 * IMPORTANT: Never log or expose decrypted values. All PII must go through
 * this module before storage.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV
const TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required but not set."
    );
  }
  // Derive a fixed-length key using SHA-256
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing: IV + auth tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Combine: iv (16) + tag (16) + encrypted
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts a base64-encoded encrypted string.
 * Returns the original plaintext string.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short.");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Encrypts a value if it exists, returns null otherwise.
 */
export function encryptOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  return encrypt(value);
}

/**
 * Decrypts a value if it exists, returns null otherwise.
 */
export function decryptOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  return decrypt(value);
}

/**
 * Hashes a value using SHA-256 for use in searchable indexes.
 * This is a one-way operation — use for lookup, not for retrieval.
 */
export function hashForIndex(value: string): string {
  const pepper = process.env.HASH_PEPPER || "";
  return crypto
    .createHmac("sha256", pepper)
    .update(value.toLowerCase().trim())
    .digest("hex");
}

/**
 * Generates a secure random token (e.g. for verification codes).
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generates a time-based OTP secret (base32 encoded).
 */
export function generateTOTPSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

function base32Encode(buffer: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}
