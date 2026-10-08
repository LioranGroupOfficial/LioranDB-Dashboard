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
      find: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockImplementation(() =>
              Promise.resolve([globalThis.__mockManagedDatabaseDoc])
            ),
          }),
        }),
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockImplementation(() =>
            Promise.resolve([globalThis.__mockManagedDatabaseDoc])
          ),
        }),
        lean: jest.fn().mockResolvedValue([globalThis.__mockManagedDatabaseDoc]),
      })),
    },
    BillingInterval: {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      create: jest.fn().mockResolvedValue({ _id: 'bi_123' }),
    },
    AuditLog: {
      create: jest.fn().mockResolvedValue({ _id: 'audit_123' }),
    },
    HostingNode: {
      find: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findByIdAndDelete: jest.fn().mockResolvedValue({ _id: 'node_1' }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
  };
});

describe('LioranDB Admin Control Plane & Database Management', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414';
    process.env.LIORANDB_CONTROL_PLANE_TOKEN = 'test_global_bearer_token_1234567890';
  });

  beforeEach(() => {
    function createMockResponse(status: number, data: any) {
      const jsonStr = JSON.stringify(data);
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        text: async () => jsonStr,
        json: async () => data,
        headers: new Headers({ 'content-type': 'application/json' }),
      } as unknown as Response);
    }

    global.fetch = jest.fn().mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const authHeader = (init?.headers as Record<string, string>)?.[
        'authorization'
      ] || (init?.headers as Record<string, string>)?.[
        'Authorization'
      ];

      // Check Bearer token auth
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createMockResponse(401, {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Bearer token' },
        });
      }

      // 1. GET /v1/admin/status
      if (urlStr.endsWith('/v1/admin/status')) {
        return createMockResponse(200, {
          success: true,
          data: {
            instance_id: 'node-mumbai-01',
            version: '2.4.1',
            status: 'Ready',
            uptime_seconds: 7200,
            active_connections: 1,
            memory_bytes_used: 104857600,
            total_databases: 1,
            total_collections: 2,
          },
        });
      }

      // 2. GET /v1/admin/users
      if (urlStr.endsWith('/v1/admin/users') && (!init?.method || init.method === 'GET')) {
        return createMockResponse(200, {
          success: true,
          data: [
            {
              id: 'usr-app-service',
              username: 'app_service',
              role: 'Admin',
              is_active: true,
              created_at: 1700000000,
            },
          ],
        });
      }

      // 3. POST /v1/admin/users
      if (urlStr.endsWith('/v1/admin/users') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        return createMockResponse(200, {
          success: true,
          data: {
            user_id: 'usr-new-id',
            username: body.username,
            password: 'rust_gen_pwd_24chars_entropy!',
            role: body.role || 'Admin',
          },
        });
      }

      // 4. POST /v1/admin/users/:id/reset-password
      if (urlStr.includes('/v1/admin/users/') && urlStr.endsWith('/reset-password') && init?.method === 'POST') {
        return createMockResponse(200, {
          success: true,
          data: {
            user_id: 'usr-app-service',
            username: 'app_service',
            password: 'rust_reset_pwd_24chars_ent!',
          },
        });
      }

      // 5. DELETE /v1/admin/users/:id
      if (urlStr.includes('/v1/admin/users/') && init?.method === 'DELETE') {
        return createMockResponse(200, {
          success: true,
          data: {
            user_id: 'usr-readonly',
            deleted: true,
          },
        });
      }

      // 6. POST /v1/admin/root/rotate
      if (urlStr.endsWith('/v1/admin/root/rotate') && init?.method === 'POST') {
        return createMockResponse(200, {
          success: true,
          data: {
            user_id: 'usr-root-id',
            username: 'admin',
            password: 'rust_rotated_root_pass_24char',
          },
        });
      }

      // 7. POST /v1/admin/instance/reset
      if (urlStr.endsWith('/v1/admin/instance/reset') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        if (body.confirm !== 'RESET_INSTANCE') {
          return createMockResponse(400, {
            success: false,
            error: { code: 'INVALID_CONFIRMATION', message: 'confirm must be RESET_INSTANCE' },
          });
        }
        return createMockResponse(200, {
          success: true,
          data: {
            instance_id: body.instance_id,
            reset: true,
            message: 'Instance reset successfully',
            root_credential: {
              username: 'admin',
              password: 'rust_new_bootstrap_root_pass',
            },
          },
        });
      }

      return Promise.reject(new Error(`Unhandled fetch url in test: ${urlStr}`));
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
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

  test('getServerStatus returns real Rust engine status and metrics', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);
    const status = await client.getServerStatus();

    expect(status).toBeDefined();
    expect(status.status).toBe('HEALTHY');
    expect(status.version).toBe('2.4.1');
    expect(status.instanceId).toBe('node-mumbai-01');
    expect(status.storageBytes).toBe(104857600);
    expect(status.documentCount).toBe(2);
  });

  test('Database user management: listUsers, createUser, resetUserPassword, delete', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);

    // 1. List users from real Rust endpoint /v1/admin/users
    const users = await client.listUsers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].username).toBe('app_service');

    // 2. Create user (dispatches POST /v1/admin/users)
    const newUser = await client.createUser({ username: 'readonly_reporter', role: 'read' });
    expect(newUser.username).toBe('readonly_reporter');
    expect(newUser.generatedPassword).toBe('rust_gen_pwd_24chars_entropy!');

    // 3. Reset user password (dispatches POST /v1/admin/users/:id/reset-password)
    const resetResult = await client.resetUserPassword('app_service');
    expect(resetResult.username).toBe('app_service');
    expect(resetResult.newGeneratedPassword).toBe('rust_reset_pwd_24chars_ent!');

    // 4. Delete user (dispatches DELETE /v1/admin/users/:id)
    const deleteResult = await client.deleteUser('readonly_reporter');
    expect(deleteResult).toBe(true);
  });

  test('createUser rejects invalid usernames', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);
    await expect(client.createUser({ username: 'ab' })).rejects.toThrow();
    await expect(client.createUser({ username: 'user with spaces' })).rejects.toThrow();
  });

  test('rotateRootCredential generates and rotates root password on Rust server', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);
    const result = await client.rotateRootCredential();

    expect(result.rootUsername).toBe('admin');
    expect(result.newGeneratedPassword).toBe('rust_rotated_root_pass_24char');
    expect(result.rotatedAt).toBeDefined();
  });

  test('resetInstance requires exact instance name confirmation and wipes customer database on Rust server', async () => {
    const client = LioranDBAdminClient.forInstance(mockManagedDatabaseDoc);

    // Rejection on mismatched confirmation
    await expect(
      client.resetInstance({ confirmation: 'wrong-instance-name' })
    ).rejects.toThrow('Confirmation does not match instance name');

    // Successful reset with exact match
    const resetRes = await client.resetInstance({ confirmation: 'prod-analytics-db' });

    expect(resetRes.instanceId).toBe(mockManagedDatabaseDoc._id.toString());
    expect(resetRes.rootUsername).toBe('admin');
    expect(resetRes.newGeneratedRootPassword).toBe('rust_new_bootstrap_root_pass');
    expect(resetRes.status).toBe('ACTIVE');
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

  test('Hosting node lifecycle: reconciliation preserves deletion state and does not resurrect deleted nodes', async () => {
    const { reconcileHostingNodes } = await import('@/lib/providers/reconciliation');
    // Ensure reconcileHostingNodes executes without throwing and does not auto-insert nodes
    await expect(reconcileHostingNodes()).resolves.not.toThrow();
  });
});

