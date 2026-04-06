/**
 * AES-256-GCM field-level encryption for sensitive coach bank details.
 *
 * KEY RULES:
 *  - Key is loaded from COACH_ENCRYPTION_KEY env var (server-side ONLY)
 *  - This module must NEVER be imported in client-side code
 *  - Each encryption call generates a unique random 12-byte IV (GCM requirement)
 *  - The 16-byte GCM auth tag is appended to the ciphertext before base64 encoding
 *
 * STORAGE FORMAT:
 *  - encrypted: base64( ciphertext || authTag )   — 16-byte auth tag appended
 *  - iv:        base64( 12-byte random IV )
 *
 * Uses Node.js built-in `crypto` module — no npm dependencies.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // GCM recommended IV size (96 bits)
const TAG_LENGTH = 16;  // GCM auth tag size (128 bits)
const KEY_BYTE_LENGTH = 32; // AES-256 requires 32 bytes

/**
 * Load and validate the encryption key from env.
 * Throws a clear error if the key is missing or the wrong length.
 * Returns a Buffer ready for use with createCipheriv / createDecipheriv.
 */
function loadKey(): Buffer {
  const hexKey = process.env.COACH_ENCRYPTION_KEY;

  if (!hexKey) {
    throw new Error(
      '[encryption] COACH_ENCRYPTION_KEY is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (hexKey.length !== KEY_BYTE_LENGTH * 2) {
    throw new Error(
      `[encryption] COACH_ENCRYPTION_KEY must be exactly ${KEY_BYTE_LENGTH * 2} hex characters ` +
      `(${KEY_BYTE_LENGTH} bytes). Got ${hexKey.length} characters.`
    );
  }

  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext  The sensitive string to encrypt (e.g. IBAN, bank name)
 * @returns          { encrypted: string, iv: string } — both base64-encoded
 *
 * @example
 *   const { encrypted, iv } = encryptField('AE070331234567890123456');
 *   // Store encrypted + iv in DB; discard plaintext
 */
export function encryptField(plaintext: string): { encrypted: string; iv: string } {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Append auth tag to ciphertext so decryption can verify integrity
  const combined = Buffer.concat([ciphertext, authTag]);

  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted field.
 *
 * @param encrypted  base64-encoded ciphertext with appended 16-byte auth tag
 * @param iv         base64-encoded 12-byte IV (stored alongside the ciphertext)
 * @returns          The original plaintext string
 * @throws           If auth tag verification fails (tampered data) or key is wrong
 *
 * @example
 *   const iban = decryptField(row.encrypted_iban, row.encryption_iv);
 */
export function decryptField(encrypted: string, iv: string): string {
  const key = loadKey();
  const combined = Buffer.from(encrypted, 'base64');
  const ivBuf = Buffer.from(iv, 'base64');

  if (combined.length < TAG_LENGTH) {
    throw new Error('[encryption] Ciphertext too short — missing auth tag');
  }

  // Split: last TAG_LENGTH bytes are the auth tag
  const ciphertext = combined.subarray(0, combined.length - TAG_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
