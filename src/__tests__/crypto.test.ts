import {
  encrypt,
  decrypt,
  sha256,
  generateOTP,
  generateDatabasePassword,
  generateSecureToken,
} from '@/lib/crypto';

process.env.CREDENTIAL_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Crypto Module', () => {
  test('encrypt and decrypt roundtrip matches plaintext', () => {
    const secret = 'lioran://admin:SecretPass123!@managed.liorandb.com:27017/prod_db';
    const encrypted = encrypt(secret);
    expect(encrypted).not.toEqual(secret);
    expect(encrypted.split(':').length).toBe(3); // iv:tag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(secret);
  });

  test('sha256 produces 64-character hex hash', () => {
    const hash = sha256('test-password-string');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  test('generateOTP produces 6-digit numeric string', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      const num = Number(otp);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  test('generateDatabasePassword produces strong random string of requested length', () => {
    const pass = generateDatabasePassword(24);
    expect(pass).toHaveLength(24);
  });

  test('generateSecureToken produces hex string of 2x byteLength', () => {
    const token = generateSecureToken(32);
    expect(token).toHaveLength(64);
  });
});

