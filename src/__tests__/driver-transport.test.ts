import { connectToDatabase, disconnectFromDatabase, reconnectToDatabase } from '@/lib/db/connection';
import { buildLioranDBConnectionUri, parseLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';

describe('LioranDB Driver gRPC Transport Configuration', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    await disconnectFromDatabase();
    process.env = { ...originalEnv };
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    process.env = originalEnv;
  });

  test('connectToDatabase initializes LioranDBClient with transport="grpc" and allowHttpFallback=false by default', async () => {
    const { client } = await connectToDatabase();
    expect(client).toBeDefined();

    // Verify mock captured options passed to LioranDBClient.connect
    const clientOptions = (client as any).options;
    expect(clientOptions).toBeDefined();
    expect(clientOptions.transport).toBe('grpc');
    expect(clientOptions.allowHttpFallback).toBe(false);
  });

  test('reconnectToDatabase closes the stale client and performs a fresh connection', async () => {
    const first = await connectToDatabase();
    const second = await reconnectToDatabase();

    expect(second.client).not.toBe(first.client);
    expect(second.client.isConnected()).toBe(true);
  });

  test('buildLioranDBConnectionUri encodes transport="grpc" and allowHttpFallback="false"', () => {
    const uri = buildLioranDBConnectionUri({
      username: 'admin',
      password: 'password123',
      host: 'cx01.db.liorandb.com',
      port: 443,
      database: 'lcs',
      transport: 'grpc',
      allowHttpFallback: false,
    });

    expect(uri).toContain('transport=grpc');
    expect(uri).toContain('allowHttpFallback=false');

    const parsed = parseLioranDBConnectionUri(uri);
    expect(parsed.transport).toBe('grpc');
    expect(parsed.allowHttpFallback).toBe(false);
  });
});
