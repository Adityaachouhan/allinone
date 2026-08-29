/**
 * server/master-db/crypto.js
 *
 * AES-256-GCM encryption/decryption for storing tenant DB passwords
 * and JWT secrets in the master database.
 *
 * MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * GUARDRAIL: Never log the plaintext or the key itself.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX   = process.env.MASTER_ENCRYPTION_KEY || '';

function getKey() {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypt plaintext → "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
  const key    = getKey();
  const iv     = randomBytes(12);          // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt "<iv_hex>:<authTag_hex>:<ciphertext_hex>" → plaintext
 * @param {string} encryptedStr
 * @returns {string}
 */
export function decrypt(encryptedStr) {
  const key              = getKey();
  const [ivHex, tagHex, dataHex] = encryptedStr.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted string format');

  const iv       = Buffer.from(ivHex, 'hex');
  const authTag  = Buffer.from(tagHex, 'hex');
  const data     = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
