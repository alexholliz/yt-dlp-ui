/**
 * AES-256-GCM encryption utility for sensitive config values (e.g. API keys).
 *
 * Encryption key is derived from SESSION_SECRET via scrypt so that possession
 * of the database file alone is not sufficient to read encrypted values.
 *
 * If SESSION_SECRET is not set, encrypt() returns the plaintext unchanged
 * (with a warning) and decrypt() transparently handles plain values.
 *
 * Encrypted format: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Plain values do not start with "enc:v1:" and are returned as-is by decrypt().
 */

const crypto = require('crypto');
const logger = require('../logger');

const ALGORITHM = 'aes-256-gcm';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SCRYPT_SALT = 'yt-dlp-ui:config:v1'; // static domain-separation salt
const PREFIX = 'enc:v1:';

function deriveKey(secret) {
  return crypto.scryptSync(secret, SCRYPT_SALT, 32, SCRYPT_PARAMS);
}

/**
 * Encrypts a plaintext string.
 * Returns the plaintext unchanged (with a logged warning) when SESSION_SECRET
 * is not configured.
 *
 * @param {string} plaintext
 * @returns {string} Encrypted string with enc:v1: prefix, or original plaintext.
 */
function encrypt(plaintext) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    logger.warn(
      'SESSION_SECRET is not set — sensitive config values are stored without encryption. ' +
      'Set SESSION_SECRET to enable at-rest encryption.'
    );
    return plaintext;
  }

  const key = deriveKey(secret);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return PREFIX + [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypts a value produced by encrypt().
 * Values that do not start with the enc:v1: prefix are returned as-is
 * (backwards-compatible with previously-stored plaintext values).
 *
 * @param {string} value
 * @returns {string} Decrypted plaintext.
 * @throws {Error} If SESSION_SECRET is missing when an encrypted value is encountered.
 */
function decrypt(value) {
  if (!value || !value.startsWith(PREFIX)) return value; // plaintext passthrough

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is required to decrypt stored config values. ' +
      'Set the SESSION_SECRET environment variable and restart the server.'
    );
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Encrypted config value has unexpected format');

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
