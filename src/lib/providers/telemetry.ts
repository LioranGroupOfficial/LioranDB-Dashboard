/**
 * LioranDB Telemetry Provider Interface
 *
 * INTEGRATION POINT: Replace MockTelemetryProvider with a real provider
 * that queries LioranDB telemetry APIs once they are available.
 *
 * IMPORTANT: Never present mock data as live production telemetry.
 * The mock provider clearly marks all data as sample data.
 */

export interface UsageMetrics {
  documentCount: number;
  storageUsedBytes: number;
  storageAllocatedBytes: number;
  readsLast24h: number;
  writesLast24h: number;
  opsPerSecCurrent: number;
  uptimePercent: number;
  lastBackupAt?: Date;
  nextBackupAt?: Date;
  backupStatus: 'OK' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  isMockData: boolean; // Always true in mock provider
}

export interface HealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latencyMs?: number;
  message?: string;
  isMockData: boolean;
}

export interface LioranTelemetryProvider {
  getUsage(deploymentId: string): Promise<UsageMetrics>;
  getHealth(deploymentId: string): Promise<HealthStatus>;
}

export class MockTelemetryProvider implements LioranTelemetryProvider {
  async getUsage(deploymentId: string): Promise<UsageMetrics> {
    console.info(`[MockTelemetryProvider] getUsage called for: ${deploymentId}`);
    return {
      documentCount: 0,
      storageUsedBytes: 0,
      storageAllocatedBytes: 10 * 1024 * 1024 * 1024, // 10 GB allocated
      readsLast24h: 0,
      writesLast24h: 0,
      opsPerSecCurrent: 0,
      uptimePercent: 0,
      lastBackupAt: undefined,
      nextBackupAt: undefined,
      backupStatus: 'UNKNOWN',
      isMockData: true,
    };
  }

  async getHealth(deploymentId: string): Promise<HealthStatus> {
    console.info(`[MockTelemetryProvider] getHealth called for: ${deploymentId}`);
    return {
      status: 'UNKNOWN',
      isMockData: true,
      message: 'Telemetry integration not yet configured.',
    };
  }
}

export const telemetryProvider: LioranTelemetryProvider = new MockTelemetryProvider();
