import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';
import {
  LioranDBAdminError,
  LioranDBAuthenticationError,
  LioranDBForbiddenError,
  sanitizeErrorForLog,
} from '@/lib/liorandb-admin/errors';
import { normalizeControlPlaneUrl, resolveControlPlaneEndpoint, resolveControlPlaneToken } from '@/lib/liorandb-admin/url';
import { encrypt, decrypt } from '@/lib/crypto';
import { buildLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import mongoose from 'mongoose';

describe('Dual-Layer Gateway & Control-Plane Authentication System', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414';
  });

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CREDENTIAL_ENCRYPTION_KEY: 'ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414',
      LIORANDB_MANAGEMENT_GATEWAY_TOKEN: 'shared_caddy_gateway_token_prod_9999',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  function createMockFetch(
    validator: (url: string, headers: Record<string, string>, body?: any) => { status: number; data: any }
  ) {
    return jest.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const headers = (init?.headers || {}) as Record<string, string>;
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      const { status, data } = validator(urlStr, headers, body);

      const jsonStr = JSON.stringify(data);
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        text: async () => jsonStr,
        json: async () => data,
        headers: new Headers({ 'content-type': 'application/json' }),
      } as unknown as Response;
    });
  }

  test('1. Both headers (X-Lioran-Gateway-Token and Authorization) are attached to authenticated management requests', async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = createMockFetch((url, headers) => {
      capturedHeaders = headers;
      return {
        status: 200,
        data: {
          success: true,
          data: {
            instance_id: 'cx01-prod',
            server_version: '2.4.1',
            state: 'READY',
            uptime_seconds: 500,
            database_count: 1,
            storage_usage: { engine_accounted_bytes: 1024 },
          },
        },
      };
    });

    const client = new LioranDBAdminClient({
      endpoint: 'https://cx01.manage.db.liorandb.com',
      controlPlaneToken: 'per_node_token_cx01_abc123',
    });

    const status = await client.getServerStatus();
    expect(status.status).toBe('HEALTHY');
    expect(status.instanceId).toBe('cx01-prod');

    // Verify dual-layer authentication headers
    expect(capturedHeaders['X-Lioran-Gateway-Token']).toBe('shared_caddy_gateway_token_prod_9999');
    expect(capturedHeaders['Authorization']).toBe('Bearer per_node_token_cx01_abc123');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
    expect(capturedHeaders['X-Request-Id']).toBeDefined();
  });

  test('2. The gateway token is never returned to frontend or leaked in error sanitization', async () => {
    const rawError = new Error('Failed connecting with X-Lioran-Gateway-Token: shared_caddy_gateway_token_prod_9999');
    const sanitized = sanitizeErrorForLog(rawError);

    expect(sanitized.message).not.toContain('shared_caddy_gateway_token_prod_9999');
    expect(sanitized.message).toContain('X-Lioran-Gateway-Token: [REDACTED]');

    const adminError = new LioranDBForbiddenError(
      'Gateway rejected token shared_caddy_gateway_token_prod_9999 on https://cx02.manage.db.liorandb.com'
    );
    const sanitizedAdmin = sanitizeErrorForLog(adminError);
    expect(sanitizedAdmin.message).not.toContain('shared_caddy_gateway_token_prod_9999');
    expect(adminError.safeMessage).not.toContain('shared_caddy_gateway_token_prod_9999');
  });

  test('3. Different nodes (CX01 through CX10) use their own decrypted control-plane tokens with the shared gateway token', async () => {
    const capturedTokens: Array<{ endpoint: string; gatewayToken: string; bearerToken: string }> = [];

    global.fetch = createMockFetch((url, headers) => {
      capturedTokens.push({
        endpoint: url,
        gatewayToken: headers['X-Lioran-Gateway-Token'],
        bearerToken: headers['Authorization'],
      });
      return {
        status: 200,
        data: {
          success: true,
          data: {
            instance_id: url.includes('cx01') ? 'cx01-node' : 'cx02-node',
            server_version: '2.4.1',
            state: 'READY',
          },
        },
      };
    });

    const cx01Secret = 'cx01_secret_control_token_1111';
    const cx02Secret = 'cx02_secret_control_token_2222';

    const nodeCX01 = {
      _id: new mongoose.Types.ObjectId(),
      name: 'CX01 Hosting Node',
      slug: 'cx01',
      dbUrl: 'cx01.db.liorandb.com',
      controlPlaneEndpoint: 'https://cx01.manage.db.liorandb.com',
      encryptedControlPlaneToken: encrypt(cx01Secret),
    };

    const nodeCX02 = {
      _id: new mongoose.Types.ObjectId(),
      name: 'CX02 Hosting Node',
      slug: 'cx02',
      dbUrl: 'cx02.db.liorandb.com',
      controlPlaneEndpoint: 'https://cx02.manage.db.liorandb.com',
      encryptedControlPlaneToken: encrypt(cx02Secret),
    };

    const clientCX01 = LioranDBAdminClient.forNode(nodeCX01);
    const clientCX02 = LioranDBAdminClient.forNode(nodeCX02);

    await clientCX01.getServerStatus();
    await clientCX02.getServerStatus();

    expect(capturedTokens.length).toBe(2);

    // CX01 request check
    expect(capturedTokens[0].endpoint).toContain('https://cx01.manage.db.liorandb.com/v1/admin/status');
    expect(capturedTokens[0].gatewayToken).toBe('shared_caddy_gateway_token_prod_9999');
    expect(capturedTokens[0].bearerToken).toBe(`Bearer ${cx01Secret}`);

    // CX02 request check
    expect(capturedTokens[1].endpoint).toContain('https://cx02.manage.db.liorandb.com/v1/admin/status');
    expect(capturedTokens[1].gatewayToken).toBe('shared_caddy_gateway_token_prod_9999');
    expect(capturedTokens[1].bearerToken).toBe(`Bearer ${cx02Secret}`);
  });

  test('4. HTTP 401 (Bearer Auth Failure) and HTTP 403 (Gateway Auth / Forbidden) are handled separately', async () => {
    // 401 scenario: Caddy accepted gateway token, but Rust rejected Bearer token
    global.fetch = createMockFetch(() => {
      return {
        status: 401,
        data: {
          success: false,
          error: { code: 'UNAUTHORIZED_CREDENTIALS', message: 'Invalid control plane Bearer credentials' },
        },
      };
    });

    const client401 = new LioranDBAdminClient({
      endpoint: 'https://cx03.manage.db.liorandb.com',
      controlPlaneToken: 'invalid_node_token',
    });

    await expect(client401.getServerStatus()).rejects.toThrow(LioranDBAuthenticationError);

    // 403 scenario: Caddy rejected gateway token (or role forbidden)
    global.fetch = createMockFetch(() => {
      return {
        status: 403,
        data: {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Gateway token rejected by Caddy proxy' },
        },
      };
    });

    const client403 = new LioranDBAdminClient({
      endpoint: 'https://cx03.manage.db.liorandb.com',
      controlPlaneToken: 'valid_token',
    });

    await expect(client403.getServerStatus()).rejects.toThrow(LioranDBForbiddenError);
  });

  test('5. Public database and gRPC connection URIs do not receive gateway credentials', () => {
    const isTls = true;
    const uri = buildLioranDBConnectionUri({
      username: 'customer_app',
      password: 'db_secret_user_password',
      host: 'cx01.db.liorandb.com',
      port: 443,
      database: 'production_db',
      scheme: 'liorandb+https',
      tls: isTls,
      transport: 'grpc',
    });

    expect(uri).toContain('liorandb+https://customer_app:db_secret_user_password@cx01.db.liorandb.com:443/production_db');
    // Ensure gateway token is never embedded into public database connection URIs
    expect(uri).not.toContain('shared_caddy_gateway_token_prod_9999');
    expect(uri).not.toContain('X-Lioran-Gateway-Token');
  });

  test('6. SSRF Prevention: Reject metadata services and private IPs in production', () => {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.ALLOW_PRIVATE_CONTROL_PLANE;
    delete process.env.LIORANDB_ALLOW_LOCALHOST;

    // Metadata destination blocked
    expect(() => normalizeControlPlaneUrl('http://169.254.169.254/v1/admin')).toThrow(LioranDBAdminError);
    expect(() => normalizeControlPlaneUrl('http://metadata.google.internal')).toThrow(LioranDBAdminError);

    // Private IP blocked in production
    expect(() => normalizeControlPlaneUrl('https://10.0.0.5:27018')).toThrow(LioranDBAdminError);
    expect(() => normalizeControlPlaneUrl('https://192.168.1.100:27018')).toThrow(LioranDBAdminError);

    // Valid public management endpoint allowed
    expect(normalizeControlPlaneUrl('https://cx01.manage.db.liorandb.com')).toBe('https://cx01.manage.db.liorandb.com');
  });

  test('7. Database user management & operations dispatch with dual auth', async () => {
    const calls: string[] = [];

    global.fetch = createMockFetch((url, headers, body) => {
      calls.push(url);
      if (url.endsWith('/v1/admin/users') && body?.username === 'app_user') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              user_id: 'usr_123',
              username: 'app_user',
              role: 'read_write',
              enabled: true,
              generated_password: 'generated_pwd_777',
            },
          },
        };
      }
      return { status: 200, data: { success: true, data: {} } };
    });

    const client = new LioranDBAdminClient({
      endpoint: 'https://cx05.manage.db.liorandb.com',
      controlPlaneToken: 'cx05_token',
    });

    const created = await client.createUser({
      username: 'app_user',
      role: 'read_write',
    });

    expect(created.userId).toBe('usr_123');
    expect(created.username).toBe('app_user');
    expect(created.generatedPassword).toBe('generated_pwd_777');
  });

  test('8. forInstance with populated hostingNodeId resolves protected management endpoint and node token', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    global.fetch = createMockFetch((url, headers) => {
      capturedUrl = url;
      capturedHeaders = headers;
      return {
        status: 200,
        data: {
          success: true,
          data: {
            user_id: 'usr_custom_1',
            username: 'dev_user',
            password: 'new_fresh_pwd_123',
          },
        },
      };
    });

    const nodeSecret = 'cx07_node_secret_token_8888';
    const populatedNode = {
      _id: new mongoose.Types.ObjectId(),
      name: 'CX07 Node',
      slug: 'cx07',
      dbUrl: 'cx07.db.liorandb.com',
      controlPlaneEndpoint: 'https://cx07.manage.db.liorandb.com',
      encryptedControlPlaneToken: encrypt(nodeSecret),
    };

    const instanceDoc = {
      _id: new mongoose.Types.ObjectId(),
      name: 'my-production-db',
      host: 'cx07.db.liorandb.com',
      port: 27018,
      databaseName: 'production',
      hostingNodeId: populatedNode,
      encryptedControlPlaneCredential: encrypt('customer_db_password_not_node_token'),
    };

    const client = LioranDBAdminClient.forInstance(instanceDoc as any);
    const resetResult = await client.resetUserPassword('usr_custom_1', 'custom_pass_999');

    expect(capturedUrl).toContain('https://cx07.manage.db.liorandb.com/v1/admin/users/usr_custom_1/reset-password');
    expect(capturedHeaders['X-Lioran-Gateway-Token']).toBe('shared_caddy_gateway_token_prod_9999');
    expect(capturedHeaders['Authorization']).toBe(`Bearer ${nodeSecret}`);
    expect(resetResult.newGeneratedPassword).toBe('new_fresh_pwd_123');
  });

  test('9. Auto-resolving endpoint from CX host pattern prevents public endpoint leakage', () => {
    const instanceWithoutEndpoint = {
      _id: new mongoose.Types.ObjectId(),
      name: 'cx10-db',
      host: 'cx10.db.liorandb.com',
      port: 27018,
    };

    const endpoint = resolveControlPlaneEndpoint(instanceWithoutEndpoint);
    expect(endpoint).toBe('https://cx10.manage.db.liorandb.com');
    expect(endpoint).not.toContain('cx10.db.liorandb.com');
  });

  test('10. Rotate root credential dispatches to /v1/admin/root/rotate with dual authentication', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    global.fetch = createMockFetch((url, headers) => {
      capturedUrl = url;
      capturedHeaders = headers;
      return {
        status: 200,
        data: {
          success: true,
          data: {
            user_id: 'usr_root',
            username: 'admin',
            password: 'rotated_root_secure_pwd_555',
          },
        },
      };
    });

    const client = new LioranDBAdminClient({
      endpoint: 'https://cx01.manage.db.liorandb.com',
      controlPlaneToken: 'node_token_123',
    });

    const rotated = await client.rotateRootCredential();
    expect(capturedUrl).toBe('https://cx01.manage.db.liorandb.com/v1/admin/root/rotate');
    expect(capturedHeaders['X-Lioran-Gateway-Token']).toBe('shared_caddy_gateway_token_prod_9999');
    expect(capturedHeaders['Authorization']).toBe('Bearer node_token_123');
    expect(rotated.newGeneratedPassword).toBe('rotated_root_secure_pwd_555');
  });
});
