/**
 * LioranDB Provisioning Service & Provider Interface
 *
 * This abstraction defines how the dashboard interacts with LioranDB's
 * infrastructure control plane. In production, replace MockProvisioningProvider
 * with a RealProvisioningProvider that calls actual LioranDB control-plane APIs.
 *
 * NOTE: Do NOT scatter infrastructure code inside React components or API handlers.
 */

import { connectToDatabase, ManagedDatabase } from '../db';
import { encrypt, generateDatabasePassword } from '../crypto';
import { getPlan } from '../plans';
import type { IManagedDatabase } from '../db/models/ManagedDatabase';

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
 * making real API calls.
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
    });
    return {
      success: true,
      providerDeploymentId: `lioran-dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    return { success: true, temporaryPassword: generateDatabasePassword() };
  }

  async getDeploymentStatus(providerDeploymentId: string): Promise<DeploymentStatusResult> {
    this.log('getDeploymentStatus', { providerDeploymentId });
    return { status: 'ACTIVE' };
  }
}

// Active provider instance — swap out for Azure/AWS/Excloud provider in production
export const provisioningProvider: LioranProvisioningProvider = new MockProvisioningProvider();

/**
 * High-level provisioning service method
 * Transitions an instance record from PENDING/PROVISIONING to ACTIVE with secure credentials
 */
export async function provisionInstance(
  instanceOrId: string | IManagedDatabase,
  customerEmail?: string
): Promise<IManagedDatabase> {
  await connectToDatabase();

  const instance =
    typeof instanceOrId === 'string'
      ? await ManagedDatabase.findById(instanceOrId)
      : instanceOrId;

  if (!instance) {
    throw new Error('Database instance not found');
  }

  const plan = getPlan(instance.planId);
  const regionCode = 'ap-south-1';
  const cleanId = instance._id.toString().slice(-8);

  const host = instance.host && instance.host !== 'pending-allocation'
    ? instance.host
    : `db-${regionCode}-${cleanId}.liorandb.net`;
  const port = 27017;
  const username = instance.username || `usr_${cleanId}`;
  const databaseName = instance.databaseName || `app_${cleanId}`;
  const generatedPassword = generateDatabasePassword(24);

  // Generate connection string and encrypt it with AES-256-GCM
  const connectionUri = `mongodb://${username}:${encodeURIComponent(
    generatedPassword
  )}@${host}:${port}/${databaseName}?authSource=admin&ssl=true`;
  const encryptedConnectionUri = encrypt(connectionUri);

  const deploymentResult = await provisioningProvider.createDeployment({
    customerId: instance.customerId.toString(),
    customerEmail: customerEmail || 'customer@liorandb.com',
    deploymentName: instance.name,
    username,
    password: generatedPassword,
    host,
    port,
    databaseName,
    planId: instance.planId,
  });

  if (!deploymentResult.success) {
    instance.status = 'FAILED';
    await instance.save();
    throw new Error(deploymentResult.error || 'Failed to provision database infrastructure');
  }

  instance.host = host;
  instance.port = port;
  instance.username = username;
  instance.databaseName = databaseName;
  instance.encryptedConnectionUri = encryptedConnectionUri;
  instance.status = 'ACTIVE';
  instance.provisionedAt = new Date();
  instance.providerDeploymentId = deploymentResult.providerDeploymentId;
  instance.cpu = plan?.cpu || instance.cpu || '1 vCPU';
  instance.memoryMb = plan?.memoryMb || instance.memoryMb || 1024;
  instance.documentLimit = plan?.documentLimit || instance.documentLimit || 100000;
  instance.type = plan?.type || instance.type || 'dedicated';

  await instance.save();
  return instance;
}
