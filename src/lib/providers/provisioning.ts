/**
 * LioranDB Provisioning Provider Interface
 *
 * This abstraction defines how the dashboard interacts with LioranDB's
 * infrastructure control plane. In production, replace MockProvisioningProvider
 * with a RealProvisioningProvider that calls actual LioranDB control-plane APIs.
 *
 * INTEGRATION POINT: Replace MockProvisioningProvider with real API calls
 * once the LioranDB provisioning API is available.
 */

export interface DeploymentParams {
  customerId: string;
  customerEmail: string;
  deploymentName: string;
  username: string;
  password: string;
  host: string;
  port: number;
  databaseName: string;
  planId: string;
}

export interface DeploymentResult {
  success: boolean;
  providerDeploymentId?: string;
  error?: string;
}

export interface CredentialResult {
  success: boolean;
  temporaryPassword?: string;
  error?: string;
}

export type DeploymentStatusResult =
  | { status: 'ACTIVE' | 'PROVISIONING' | 'SUSPENDED' | 'FAILED' }
  | { status: 'UNKNOWN'; error: string };

export interface LioranProvisioningProvider {
  createDeployment(params: DeploymentParams): Promise<DeploymentResult>;
  suspendDeployment(providerDeploymentId: string, reason: string): Promise<{ success: boolean; error?: string }>;
  resumeDeployment(providerDeploymentId: string): Promise<{ success: boolean; error?: string }>;
  rotateCredentials(providerDeploymentId: string): Promise<CredentialResult>;
  getDeploymentStatus(providerDeploymentId: string): Promise<DeploymentStatusResult>;
}

/**
 * Mock implementation for development and testing.
 *
 * This provider simulates successful infrastructure operations without
 * making real API calls. It logs all operations to the console.
 *
 * DO NOT use in production without replacing with a real provider.
 */
export class MockProvisioningProvider implements LioranProvisioningProvider {
  private log(operation: string, params: Record<string, unknown>): void {
    console.info(`[MockProvisioningProvider] ${operation}:`, JSON.stringify(params, null, 2));
  }

  async createDeployment(params: DeploymentParams): Promise<DeploymentResult> {
    this.log('createDeployment', {
      customerId: params.customerId,
      deploymentName: params.deploymentName,
      host: params.host,
      port: params.port,
      databaseName: params.databaseName,
      planId: params.planId,
      // password intentionally omitted from logs
    });
    return {
      success: true,
      providerDeploymentId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  async suspendDeployment(
    providerDeploymentId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    this.log('suspendDeployment', { providerDeploymentId, reason });
    return { success: true };
  }

  async resumeDeployment(
    providerDeploymentId: string
  ): Promise<{ success: boolean; error?: string }> {
    this.log('resumeDeployment', { providerDeploymentId });
    return { success: true };
  }

  async rotateCredentials(providerDeploymentId: string): Promise<CredentialResult> {
    this.log('rotateCredentials', { providerDeploymentId });
    // Returns a mock temporary password
    return { success: true, temporaryPassword: undefined }; // Real implementation would return new credentials
  }

  async getDeploymentStatus(providerDeploymentId: string): Promise<DeploymentStatusResult> {
    this.log('getDeploymentStatus', { providerDeploymentId });
    return { status: 'ACTIVE' };
  }
}

// Active provider — swap out for real implementation
export const provisioningProvider: LioranProvisioningProvider = new MockProvisioningProvider();
