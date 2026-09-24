import { MockProvisioningProvider } from '@/lib/providers/provisioning';
import { encrypt, decrypt, generateDatabasePassword } from '@/lib/crypto';

describe('Provisioning Service & Credentials', () => {
  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414';
  });

  test('MockProvisioningProvider returns active status and deployment ID', async () => {
    const provider = new MockProvisioningProvider();
    const result = await provider.createDeployment({
      customerId: 'cust_123',
      customerEmail: 'test@liorandb.com',
      deploymentName: 'test-db',
      username: 'test_usr',
      password: 'test_password',
      host: 'db-test.liorandb.net',
      port: 27017,
      databaseName: 'test_db',
      planId: 'starter',
    });

    expect(result.success).toBe(true);
    expect(result.providerDeploymentId).toBeDefined();

    const status = await provider.getDeploymentStatus(result.providerDeploymentId!);
    expect(status.status).toBe('ACTIVE');
  });

  test('Database connection URI encryption and decryption with AES-256-GCM', () => {
    const rawUri = 'mongodb://user_123:SecretPass123!@db-mumbai-01.liorandb.net:27017/core_db?ssl=true';
    const encrypted = encrypt(rawUri);

    expect(encrypted).not.toBe(rawUri);
    expect(encrypted.split(':').length).toBe(3); // IV:Tag:Ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawUri);
  });

  test('Secure database password generator creates required entropy', () => {
    const pass1 = generateDatabasePassword(24);
    const pass2 = generateDatabasePassword(24);

    expect(pass1.length).toBe(24);
    expect(pass2.length).toBe(24);
    expect(pass1).not.toBe(pass2);
  });
});
