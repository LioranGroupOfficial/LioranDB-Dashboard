/**
 * LioranDB Provisioning Service & Provider Interface
 *
 * Infrastructure control plane for provisioning, scaling, suspending, resuming,
 * terminating, and resetting managed database instances.
 */

import { connectToDatabase, ManagedDatabase, BillingInterval } from '../db';
import { encrypt, generateDatabasePassword } from '../crypto';
import { BACKUP_MONTHLY_PAISE, getPlan } from '../plans';
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
  resetDeployment(providerDeploymentId: string): Promise<{ success: boolean; error?: string }>;
  terminateDeployment(providerDeploymentId: string): Promise<{ success: boolean; error?: string }>;
  getDeploymentStatus(providerDeploymentId: string): Promise<DeploymentStatusResult>;
}

/**
 * Mock implementation for development and testing.
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

  async resetDeployment(
    providerDeploymentId: string
  ): Promise<{ success: boolean; error?: string }> {
    this.log('resetDeployment', { providerDeploymentId });
    return { success: true };
  }

  async terminateDeployment(
    providerDeploymentId: string
  ): Promise<{ success: boolean; error?: string }> {
    this.log('terminateDeployment', { providerDeploymentId });
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

export const provisioningProvider: LioranProvisioningProvider = new MockProvisioningProvider();

/**
 * High-level provisioning service method
 * Transitions an instance record from PENDING/PROVISIONING to ACTIVE with secure credentials.
 * Billing starts ONLY upon successful transition to ACTIVE.
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

  const host =
    instance.host && instance.host !== 'pending-allocation'
      ? instance.host
      : `db-${regionCode}-${cleanId}.liorandb.net`;
  const port = instance.port || 27017;
  const username = instance.username || `usr_${cleanId}`;
  const databaseName = instance.databaseName || `app_${cleanId}`;
  const generatedPassword = generateDatabasePassword(24);

  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host === '::1' ||
    host.includes('local');
  const sslParam = isLocal ? 'ssl=false' : 'ssl=true';

  // Generate connection string and encrypt it with AES-256-GCM for control plane use
  const connectionUri = `mongodb://${username}:${encodeURIComponent(
    generatedPassword
  )}@${host}:${port}/${databaseName}?authSource=admin&${sslParam}`;
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

  const now = new Date();
  const hourlyRatePaise = plan?.hourlyRatePaise || (instance.planId === 'shared' ? 100 : 800);
  const backupMonthlyPaise = instance.backupEnabled ? BACKUP_MONTHLY_PAISE : 0;

  instance.host = host;
  instance.port = port;
  instance.username = username;
  instance.databaseName = databaseName;
  instance.encryptedConnectionUri = encryptedConnectionUri;
  instance.status = 'ACTIVE';
  instance.planName = plan?.name || 'Shared';
  instance.hourlyRatePaise = hourlyRatePaise;
  instance.backupMonthlyPaise = backupMonthlyPaise;
  instance.provisionedAt = now;
  instance.billingStartedAt = now;
  if (instance.backupEnabled) {
    instance.backupStartedAt = now;
  }
  instance.providerDeploymentId = deploymentResult.providerDeploymentId;
  instance.opsPerSecondLimit = plan?.opsPerSecondLimit || 3000;
  instance.documentLimit = plan?.documentLimit || 1000;
  instance.type = plan?.type || 'shared';

  if (!instance.databaseUsers || instance.databaseUsers.length === 0) {
    instance.databaseUsers = [{ username, createdAt: now }];
  }

  await instance.save();

  // Create initial billing interval record
  await BillingInterval.create({
    instanceId: instance._id,
    customerId: instance.customerId,
    startedAt: now,
    hourlyRatePaise,
    backupMonthlyPaise,
    backupEnabled: instance.backupEnabled,
    planId: instance.planId,
    planName: instance.planName,
    couponCode: instance.couponCode,
    couponDiscountPercentage: instance.couponDiscountPercentage,
  });

  return instance;
}
