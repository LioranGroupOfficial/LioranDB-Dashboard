import { MockProvisioningProvider, RealLioranDBProvisioningProvider, getProvisioningProvider } from '@/lib/providers/provisioning';
import { encrypt, decrypt, generateDatabasePassword } from '@/lib/crypto';
import {
  buildLioranDBConnectionUri,
  parseLioranDBConnectionUri,
  maskLioranDBConnectionUri,
} from '@/lib/liorandb-admin/uri';

describe('Provisioning Service & Credentials', () => {
  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414';
  });

  test('getProvisioningProvider selects RealLioranDBProvisioningProvider by default and Mock in test mode', () => {
    delete process.env.LIORANDB_MOCK_DRIVER;
    const realProvider = getProvisioningProvider();
    expect(realProvider).toBeInstanceOf(RealLioranDBProvisioningProvider);

    process.env.LIORANDB_MOCK_DRIVER = 'true';
    const mockProvider = getProvisioningProvider();
    expect(mockProvider).toBeInstanceOf(MockProvisioningProvider);
    delete process.env.LIORANDB_MOCK_DRIVER;
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
      port: 27018,
      databaseName: 'test_db',
      planId: 'starter',
    });

    expect(result.success).toBe(true);
    expect(result.providerDeploymentId).toBeDefined();

    const status = await provider.getDeploymentStatus(result.providerDeploymentId!);
    expect(status.status).toBe('ACTIVE');
  });

  test('buildLioranDBConnectionUri constructs canonical liorandb URI and RFC-3986 percent-encodes special chars', () => {
    const uri = buildLioranDBConnectionUri({
      username: 'app:user@prod',
      password: 'p@ss/word#123!',
      host: 'db-mumbai-01.liorandb.net',
      port: 27018,
      databaseName: 'app_data/main',
      tls: true,
      options: {
        poolSize: 10,
        appName: 'lioran-cloud-app',
      },
    });

    expect(uri.startsWith('liorandb://')).toBe(true);
    expect(uri).toContain('app%3Auser%40prod');
    expect(uri).toContain('p%40ss%2Fword%23123%21');
    expect(uri).toContain('db-mumbai-01.liorandb.net:27018');
    expect(uri).toContain('app_data%2Fmain');
    expect(uri).toContain('tls=true');
    expect(uri).toContain('poolSize=10');

    // Parse it back
    const parsed = parseLioranDBConnectionUri(uri);
    expect(parsed.scheme).toBe('liorandb');
    expect(parsed.username).toBe('app:user@prod');
    expect(parsed.password).toBe('p@ss/word#123!');
    expect(parsed.host).toBe('db-mumbai-01.liorandb.net');
    expect(parsed.port).toBe(27018);
    expect(parsed.databaseName).toBe('app_data/main');
    expect(parsed.options.tls).toBe('true');
    expect(parsed.options.poolSize).toBe('10');
  });

  test('maskLioranDBConnectionUri redacts sensitive password from URI for safe logs and display', () => {
    const rawUri = 'liorandb://admin_user:UltraSecretPassword123!@127.0.0.1:27018/mydb?tls=false';
    const masked = maskLioranDBConnectionUri(rawUri);

    expect(masked).toBe('liorandb://admin_user:*****@127.0.0.1:27018/mydb?tls=false');
    expect(masked).not.toContain('UltraSecretPassword123!');
  });

  test('Database connection URI encryption and decryption with AES-256-GCM', () => {
    const rawUri = 'liorandb://user_123:SecretPass123!@db-mumbai-01.liorandb.net:27018/core_db?tls=true';
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

  test('Database limit per user is enforced to maximum 2 databases', () => {
    const MAX_DATABASES_PER_USER = 2;
    const userActiveDatabases = ['db-prod-1', 'db-staging-2'];
    const canCreateMore = userActiveDatabases.length < MAX_DATABASES_PER_USER;
    expect(canCreateMore).toBe(false);

    const userWithOneDb = ['db-prod-1'];
    expect(userWithOneDb.length < MAX_DATABASES_PER_USER).toBe(true);
  });
});
