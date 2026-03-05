const { describe, it, before, after } = require('node:test');
const assert = require('assert');

/**
 * Tests for src/utils/encryption.js
 *
 * AES-256-GCM encrypt/decrypt using SESSION_SECRET.
 * We manipulate process.env and clear the module cache between test groups
 * so each require() picks up the current environment.
 */

const MODULE_PATH = require('path').resolve(__dirname, '../src/utils/encryption');

function freshLoad() {
  delete require.cache[MODULE_PATH];
  // Also clear logger since encryption.js requires it
  const loggerPath = require('path').resolve(__dirname, '../src/logger');
  delete require.cache[loggerPath];
  return require(MODULE_PATH);
}

describe('Encryption utility', () => {
  const ORIG_SECRET = process.env.SESSION_SECRET;

  after(() => {
    // Restore original env
    if (ORIG_SECRET !== undefined) process.env.SESSION_SECRET = ORIG_SECRET;
    else delete process.env.SESSION_SECRET;
    delete require.cache[MODULE_PATH];
  });

  describe('encrypt / decrypt roundtrip (SESSION_SECRET set)', () => {
    before(() => { process.env.SESSION_SECRET = 'test-secret-long-enough-for-scrypt-32'; });

    it('decrypts back to the original plaintext', () => {
      const { encrypt, decrypt } = freshLoad();
      const plain = 'AIzaSy-my-youtube-api-key';
      assert.strictEqual(decrypt(encrypt(plain)), plain);
    });

    it('produces different ciphertexts for the same input (random IV)', () => {
      const { encrypt } = freshLoad();
      const plain = 'same-input';
      assert.notStrictEqual(encrypt(plain), encrypt(plain));
    });

    it('output starts with enc:v1: prefix', () => {
      const { encrypt } = freshLoad();
      assert.ok(encrypt('anything').startsWith('enc:v1:'));
    });

    it('round-trips values containing unicode and special characters', () => {
      const { encrypt, decrypt } = freshLoad();
      const plain = 'APIキー_🔑_<>&"\'';
      assert.strictEqual(decrypt(encrypt(plain)), plain);
    });

    it('round-trips an empty string', () => {
      const { encrypt, decrypt } = freshLoad();
      assert.strictEqual(decrypt(encrypt('')), '');
    });
  });

  describe('decrypt passthrough (no enc:v1: prefix)', () => {
    before(() => { process.env.SESSION_SECRET = 'test-secret-long-enough-for-scrypt-32'; });

    it('returns a plain string unchanged', () => {
      const { decrypt } = freshLoad();
      assert.strictEqual(decrypt('plain-old-key'), 'plain-old-key');
    });

    it('returns null unchanged', () => {
      const { decrypt } = freshLoad();
      assert.strictEqual(decrypt(null), null);
    });

    it('returns undefined unchanged', () => {
      const { decrypt } = freshLoad();
      assert.strictEqual(decrypt(undefined), undefined);
    });

    it('returns empty string unchanged', () => {
      const { decrypt } = freshLoad();
      assert.strictEqual(decrypt(''), '');
    });
  });

  describe('error handling', () => {
    before(() => { process.env.SESSION_SECRET = 'test-secret-long-enough-for-scrypt-32'; });

    it('throws with SESSION_SECRET message when secret missing but value is encrypted', () => {
      const { encrypt } = freshLoad();
      const ciphertext = encrypt('secret-value');

      delete process.env.SESSION_SECRET;
      const { decrypt } = freshLoad();
      assert.throws(
        () => decrypt(ciphertext),
        (err) => err.message.includes('SESSION_SECRET')
      );
      process.env.SESSION_SECRET = 'test-secret-long-enough-for-scrypt-32';
    });

    it('throws on malformed enc:v1: value (wrong number of parts)', () => {
      const { decrypt } = freshLoad();
      assert.throws(
        () => decrypt('enc:v1:only-one-part'),
        (err) => err.message.includes('format')
      );
    });

    it('throws when GCM auth tag is tampered (integrity check)', () => {
      const { encrypt, decrypt } = freshLoad();
      const ciphertext = encrypt('secret-value');
      // Replace the authTag segment (index 3 in enc:v1:iv:tag:data) with garbage
      const parts = ciphertext.split(':');
      parts[3] = 'deadbeefdeadbeefdeadbeefdeadbeef';
      assert.throws(() => decrypt(parts.join(':')));
    });

    it('throws when ciphertext is tampered', () => {
      const { encrypt, decrypt } = freshLoad();
      const ciphertext = encrypt('secret-value');
      const parts = ciphertext.split(':');
      parts[4] = 'cafebabecafebabecafebabe';
      assert.throws(() => decrypt(parts.join(':')));
    });
  });

  describe('without SESSION_SECRET (no-op mode)', () => {
    before(() => { delete process.env.SESSION_SECRET; });
    after(() => { process.env.SESSION_SECRET = 'test-secret-long-enough-for-scrypt-32'; });

    it('encrypt returns plaintext unchanged', () => {
      const { encrypt } = freshLoad();
      const plain = 'my-key';
      assert.strictEqual(encrypt(plain), plain);
    });

    it('encrypt does not add enc:v1: prefix', () => {
      const { encrypt } = freshLoad();
      assert.ok(!encrypt('my-key').startsWith('enc:v1:'));
    });
  });
});
