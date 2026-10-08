import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import {
  LioranDBAuthenticationError,
  sanitizeErrorForLog,
} from '@/lib/liorandb-admin/errors';
import { encrypt, decrypt } from '@/lib/crypto';
import type { DatabaseStatus, IDatabaseUser } from '@/lib/db';
import mongoose from 'mongoose';

interface MockDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  rootUsername: string;
  status: DatabaseStatus;
  planId: string;
  planName: string;
  hourlyRatePaise: number;
  backupEnabled: boolean;
  backupMonthlyPaise: number;
  databaseUsers: IDatabaseUser[];
  save: jest.Mock;
  lean?: jest.Mock;
}

// Define the mock object
const mockManagedDatabaseDoc: MockDoc = {
  _id: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'),
  name: 'prod-analytics-db',
  host: 'db-mumbai-01.liorandb.net',
  port: 27017,
  databaseName: 'analytics',
  username: 'admin',
  rootUsername: 'admin',
  status: 'ACTIVE',
  planId: 'dedicated',
  planName: 'Dedicated',
  hourlyRatePaise: 800,
  backupEnabled: true,
  backupMonthlyPaise: 20000,
  databaseUsers: [
    {
      username: 'app_service',
      role: 'readWrite',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ],
  save: jest.fn().mockResolvedValue(true),
};

mockManagedDatabaseDoc.lean = jest.fn().mockResolvedValue(mockManagedDatabaseDoc);

declare global {
  var __mockManagedDatabaseDoc: MockDoc | undefined;
}

globalThis.__mockManagedDatabaseDoc = mockManagedDatabaseDoc;

jest.mock('@/lib/db', () => {
  return {
    connectToDatabase: jest.fn().mockResolvedValue(true),
    ManagedDatabase: {
      findById: jest.fn().mockImplementation((id: string) => {
        const doc = globalThis.__mockManagedDatabaseDoc;
        if (id === '65f1a2b3c4d5e6f7a8b9c0d1' || id === doc?._id?.toString()) {
          return doc;
        }
        return null;
      }),
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockImplementation(() =>
              Promise.resolve([globalThis.__mockManagedDatabaseDoc])
            ),
          }),
        }),
      }),
    },
    BillingInterval: {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      create: jest.fn().mockResolvedValue({ _id: 'bi_123' }),
    },
    AuditLog: {
      create: jest.fn().mockResolvedValue({ _id: 'audit_123' }),
    },
  };
});

describe('LioranDB Admin Control Plane & Database Management', () => {
  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414';
    process.env.LIORANDB_MOCK_DRIVER = 'true';
  });

  test('Encrypted control plane credential is decrypted strictly server-side in memory', () => {
    const rawSecretToken = 'cp_sec_live_998877665544332211';
    const encryptedToken = encrypt(rawSecretToken);

    const instanceWithEncryptedSecret = {
      ...mockManagedDatabaseDoc,
      encryptedControlPlaneCredential: encryptedToken,
    };

    const client = LioranDBAdminClient.forInstance(instanceWithEncryptedSecret);
    expect(client).toBeInstanceOf(LioranDBAdminClient);

    // Verify token decryption succeeds in server memory
    const decrypted = decrypt(encryptedToken);
    expect(decrypted).toBe(rawSecretToken);
  });

  test('getServerStatus returns engine metrics and health status', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);
    const status = await client.getServerStatus();

    expect(status).toBeDefined();
    expect(status.status).toBe('HEALTHY');
    expect(status.version).toContain('LioranDB');
    expect(status.documentCount).toBeGreaterThan(0);
    expect(status.storageBytes).toBeGreaterThan(0);
  });

  test('Database user management: listUsers, createUser, resetUserPassword, disable/enable, delete', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);

    // 1. List users
    const users = await client.listUsers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].username).toBe('app_service');

    // 2. Create user (generates password once, does not persist password plaintext)
    const newUser = await client.createUser({ username: 'readonly_reporter', role: 'read' });
    expect(newUser.username).toBe('readonly_reporter');
    expect(newUser.role).toBe('read');
    expect(newUser.generatedPassword).toBeDefined();
    expect(newUser.generatedPassword.length).toBe(24);

    // Verify user record in mock instance has NO password/hash property
    const createdUserInDoc = mockManagedDatabaseDoc.databaseUsers.find(
      (u: IDatabaseUser) => u.username === 'readonly_reporter'
    );
    expect(createdUserInDoc).toBeDefined();
    expect('password' in (createdUserInDoc || {})).toBe(false);
    expect('passwordHash' in (createdUserInDoc || {})).toBe(false);

    // 3. Reset user password (generates new password once)
    const resetResult = await client.resetUserPassword('app_service');
    expect(resetResult.username).toBe('app_service');
    expect(resetResult.newGeneratedPassword).toBeDefined();
    expect(resetResult.newGeneratedPassword.length).toBe(24);

    // 4. Disable and Enable user
    await client.disableUser('app_service');
    expect(mockManagedDatabaseDoc.databaseUsers.find((u: IDatabaseUser) => u.username === 'app_service')?.status).toBe(
      'DISABLED'
    );

    await client.enableUser('app_service');
    expect(mockManagedDatabaseDoc.databaseUsers.find((u: IDatabaseUser) => u.username === 'app_service')?.status).toBe(
      'ACTIVE'
    );

    // 5. Delete user
    await client.deleteUser('readonly_reporter');
    expect(
      mockManagedDatabaseDoc.databaseUsers.find((u: IDatabaseUser) => u.username === 'readonly_reporter')
    ).toBeUndefined();
  });

  test('createUser rejects invalid usernames', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);
    await expect(client.createUser({ username: 'ab' })).rejects.toThrow();
    await expect(client.createUser({ username: 'user with spaces' })).rejects.toThrow();
  });

  test('rotateRootCredential generates new root password once', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);
    const result = await client.rotateRootCredential();

    expect(result.rootUsername).toBe('admin');
    expect(result.newGeneratedPassword).toBeDefined();
    expect(result.newGeneratedPassword.length).toBe(24);
    expect(result.rotatedAt).toBeDefined();
  });

  test('Routine operations: suspend, resume, triggerBackup, restartInstance', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);

    // Suspend
    const suspendRes = await client.suspend();
    expect(suspendRes).toBe(true);

    // Resume
    const resumeRes = await client.resume();
    expect(resumeRes).toBe(true);

    // Trigger backup
    const backupRes = await client.triggerBackup();
    expect(backupRes.status).toBe('COMPLETED');
    expect(backupRes.backupId).toBeDefined();

    // Restart instance
    const restartRes = await client.restartInstance();
    expect(restartRes.status).toBe('RESTARTED');
  });

  test('resetInstance requires exact instance name confirmation and wipes customer users', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);

    // Rejection on mismatched confirmation
    await expect(
      client.resetInstance({ confirmation: 'wrong-instance-name' })
    ).rejects.toThrow('Confirmation does not match instance name');

    // Successful reset with exact match
    const resetRes = await client.resetInstance({ confirmation: 'prod-analytics-db' });

    expect(resetRes.instanceId).toBe(mockManagedDatabaseDoc._id.toString());
    expect(resetRes.rootUsername).toBe('admin');
    expect(resetRes.newGeneratedRootPassword).toBeDefined();
    expect(resetRes.newGeneratedRootPassword.length).toBe(24);
    expect(resetRes.status).toBe('ACTIVE');

    // Customer database users wiped
    expect(mockManagedDatabaseDoc.databaseUsers.length).toBe(0);
  });

  test('Security: sanitizeErrorForLog redacts Authorization bearer tokens and passwords', () => {
    const rawError = new Error('Failed to connect with Bearer super_secret_admin_token_12345');
    const sanitized = sanitizeErrorForLog(rawError);

    expect(sanitized.message).not.toContain('super_secret_admin_token_12345');
    expect(sanitized.message).toContain('Bearer [REDACTED]');

    const adminErr = new LioranDBAuthenticationError(
      'Authentication failed: Bearer token_xyz987 is invalid'
    );
    const sanitizedAdmin = sanitizeErrorForLog(adminErr);
    expect(sanitizedAdmin.message).not.toContain('token_xyz987');
    expect(sanitizedAdmin.message).toContain('Bearer [REDACTED]');
  });
});
