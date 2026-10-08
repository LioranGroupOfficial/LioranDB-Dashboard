import {
  normalizeControlPlaneUrl,
  resolveControlPlaneEndpoint,
  resolveControlPlaneToken,
  isLocalhost,
} from '@/lib/liorandb-admin/url';
import { LioranDBAdminClient } from '@/lib/liorandb-admin/client';

describe('Control Plane URL Resolution & Normalization', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isLocalhost', () => {
    it('detects 127.0.0.1, localhost, 0.0.0.0, and ::1', () => {
      expect(isLocalhost('127.0.0.1')).toBe(true);
      expect(isLocalhost('localhost')).toBe(true);
      expect(isLocalhost('0.0.0.0')).toBe(true);
      expect(isLocalhost('::1')).toBe(true);
      expect(isLocalhost('127.0.0.2')).toBe(true);
      expect(isLocalhost('http://127.0.0.1:27018')).toBe(true);
      expect(isLocalhost('db.production.com')).toBe(false);
      expect(isLocalhost('192.168.1.50')).toBe(false);
    });
  });

  describe('normalizeControlPlaneUrl', () => {
    it('normalizes local http URLs with 27018 port', () => {
      expect(normalizeControlPlaneUrl('127.0.0.1:27018')).toBe('http://127.0.0.1:27018');
      expect(normalizeControlPlaneUrl('http://127.0.0.1:27018/')).toBe('http://127.0.0.1:27018');
      expect(normalizeControlPlaneUrl('http://localhost:27018/v1/admin/status')).toBe('http://localhost:27018');
    });

    it('preserves remote https endpoints and standard ports', () => {
      expect(normalizeControlPlaneUrl('https://db.example.com')).toBe('https://db.example.com');
      expect(normalizeControlPlaneUrl('https://db.example.com:8443/v1/admin')).toBe('https://db.example.com:8443');
      expect(normalizeControlPlaneUrl('http://192.168.1.50:27018')).toBe('http://192.168.1.50:27018');
    });

    it('rejects invalid or empty URLs', () => {
      expect(() => normalizeControlPlaneUrl('')).toThrow();
      expect(() => normalizeControlPlaneUrl('ftp://127.0.0.1:27018')).toThrow();
    });
  });

  describe('resolveControlPlaneEndpoint', () => {
    it('prioritizes explicitUrl parameter if provided', () => {
      const endpoint = resolveControlPlaneEndpoint(null, 'http://custom-host:27018');
      expect(endpoint).toBe('http://custom-host:27018');
    });

    it('prioritizes LIORANDB_CONTROL_PLANE_URL for localhost nodes in development', () => {
      process.env.LIORANDB_CONTROL_PLANE_URL = 'http://127.0.0.1:27018';
      const endpoint = resolveControlPlaneEndpoint({
        dbUrl: '127.0.0.1',
        port: 27018,
        controlPlaneEndpoint: 'http://127.0.0.1:8080',
        isDefault: true,
      });
      expect(endpoint).toBe('http://127.0.0.1:27018');
    });

    it('corrects legacy port 8080 on localhost to 27018', () => {
      delete process.env.LIORANDB_CONTROL_PLANE_URL;
      const endpoint = resolveControlPlaneEndpoint({
        dbUrl: '127.0.0.1',
        controlPlaneEndpoint: 'http://127.0.0.1:8080',
      });
      expect(endpoint).toBe('http://127.0.0.1:27018');
    });

    it('preserves remote production nodes endpoint', () => {
      const endpoint = resolveControlPlaneEndpoint({
        dbUrl: 'db.prod.company.com',
        protocol: 'https',
        httpPort: 443,
        controlPlaneEndpoint: 'https://db.prod.company.com:8443',
      });
      expect(endpoint).toBe('https://db.prod.company.com:8443');
    });
  });

  describe('resolveControlPlaneToken', () => {
    it('returns environment token if node has no token', () => {
      process.env.LIORANDB_CONTROL_PLANE_TOKEN = 'secret-env-token-123';
      const token = resolveControlPlaneToken(null);
      expect(token).toBe('secret-env-token-123');
    });

    it('returns explicit token if provided', () => {
      process.env.LIORANDB_CONTROL_PLANE_TOKEN = 'env-token';
      const token = resolveControlPlaneToken(null, 'explicit-token-456');
      expect(token).toBe('explicit-token-456');
    });
  });

  describe('LioranDBAdminClient status normalization', () => {
    it('treats READY (uppercase) as HEALTHY', async () => {
      const client = new LioranDBAdminClient({
        endpoint: 'http://127.0.0.1:27018',
        controlPlaneToken: 'test-token',
      });

      // Mock dispatch
      (client as any).dispatch = jest.fn().mockResolvedValue({
        instance_id: 'node-1',
        server_version: '2.4.1',
        state: 'READY',
        uptime_seconds: 120,
        database_count: 3,
        storage_usage: { engine_accounted_bytes: 4096 },
      });

      const status = await client.getServerStatus();
      expect(status.status).toBe('HEALTHY');
      expect(status.instanceId).toBe('node-1');
      expect(status.databaseCount).toBe(3);
    });

    it('treats Active / Ready as HEALTHY', async () => {
      const client = new LioranDBAdminClient({
        endpoint: 'http://127.0.0.1:27018',
      });

      (client as any).dispatch = jest.fn().mockResolvedValue({
        instance_id: 'node-2',
        server_version: '2.4.1',
        state: 'Active',
      });

      const status = await client.getServerStatus();
      expect(status.status).toBe('HEALTHY');
    });
  });
});
