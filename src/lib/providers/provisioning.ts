/**
 * LioranDB Authoritative Provisioning Service & Provider
 *
 * Implements real, end-to-end integration with the LioranDB Rust Server control plane:
 *   - Atomic node reservation and conflict prevention
 *   - Live server health and identity verification
 *   - Automatic root/admin credential rotation on allocation
 *   - Customer database user provisioning
 *   - Native LioranDB connection URI generation (liorandb://...)
 *   - Server-side AES-256-GCM encryption of credentials
 *   - Activation and billing interval synchronization
 *   - Zero simulated responses in production
 */

import { connectToDatabase, ManagedDatabase, HostingNode, BillingInterval } from '../db';
import { encrypt } from '../crypto';
import { BACKUP_MONTHLY_PAISE, getPlan } from '../plans';
import type { IManagedDatabase } from '../db/models/ManagedDatabase';
import type { IHostingNode } from '../db/models/HostingNode';
import { LioranDBAdminClient } from '../liorandb-admin/client';
import { buildLioranDBConnectionUri } from '../liorandb-admin/uri';
import { LioranDBAdminError, LioranDBUnreachableError } from '../liorandb-admin/errors';
import { reconcileHostingNodes } from './reconciliation';

export interface DeploymentParams {
  customerId: string;
  customerEmail: string;
  deploymentName: string;
  username: string;
  password?: string;
  host: string;
  port: number;
  databaseName: string;
  planId: string;
  nodeId?: string;
}

export interface DeploymentResult {
  success: boolean;
  providerDeploymentId?: string;
  serverVersion?: string;
  nativeConnectionUri?: string;
  generatedPassword?: string;
  error?: string;
}

export interface CredentialResult {
  success: boolean;
  temporaryPassword?: string;
  error?: string;
}

export type DeploymentStatusResult =
  | { status: 'ACTIVE' | 'PROVISIONING' | 'SUSPENDED' | 'FAILED' | 'READY' | 'MAINTENANCE'; version?: string; uptimeSeconds?: number }
  | { status: 'UNKNOWN'; error: string };

export interface LioranProvisioningProvider {
  createDeployment(params: DeploymentParams): Promise<DeploymentResult>;
  suspendDeployment(providerDeploymentId: string, reason?: string): Promise<{ success: boolean; error?: string }>;
  resumeDeployment(providerDeploymentId: string): Promise<{ success: boolean; error?: string }>;
  rotateCredentials(instanceId: string): Promise<CredentialResult>;
  resetDeployment(instanceId: string, confirmation: string): Promise<{ success: boolean; error?: string }>;
  terminateDeployment(instanceId: string): Promise<{ success: boolean; error?: string }>;
  getDeploymentStatus(instanceId: string): Promise<DeploymentStatusResult>;
}

/**
 * Real production provider communicating with the LioranDB Rust Server Control Plane.
 */
export class RealLioranDBProvisioningProvider implements LioranProvisioningProvider {
  async createDeployment(params: DeploymentParams): Promise<DeploymentResult> {
    await connectToDatabase();

    let node: IHostingNode | null = null;

    if (params.nodeId) {
      node = await HostingNode.findById(params.nodeId);
    }

    if (!node) {
      // Select an available unassigned dedicated hosting node
      node = await HostingNode.findOne({
        status: 'AVAILABLE',
        healthStatus: 'HEALTHY',
        currentAssignedCount: 0,
      });
    }

    if (!node) {
      return {
        success: false,
        error: 'No dedicated database hosting servers are currently available. Please email support@liorandb.com for this query.',
      };
    }

    // Connect to the Rust server control plane
    const client = LioranDBAdminClient.forNode(node);

    try {
      // 1. Verify clean state and live server status before allocation
      const cleanCheck = await client.verifyCleanState();
      if (!cleanCheck.isClean) {
        console.error(`[Provisioning] Node '${node.name}' failed pre-provision clean state check: ${cleanCheck.reasons.join(', ')}`);
        node.status = 'QUARANTINED';
        node.healthStatus = 'DEGRADED';
        node.adminNotes = `Pre-provision clean state failed: ${cleanCheck.reasons.join(', ')}`;
        await node.save();
        return {
          success: false,
          error: `Target hosting node '${node.name}' contains residual state and has been quarantined.`,
        };
      }

      const status = await client.getServerStatus();
      if (status.status !== 'HEALTHY' && status.state !== 'Ready') {
        return {
          success: false,
          error: `Target hosting node '${node.name}' is not in Ready state (current state: ${status.state || status.status}).`,
        };
      }

      // 2. Authoritatively rotate or reset the root database password on the Rust server
      let rootPassword: string;
      let rootUsername = 'admin';

      if (params.password && params.password.trim()) {
        try {
          const resetRes = await client.resetUserPassword('admin', params.password.trim());
          rootPassword = resetRes.newGeneratedPassword || params.password.trim();
          rootUsername = resetRes.username || 'admin';
        } catch {
          const rotated = await client.rotateRootCredential();
          rootPassword = rotated.newGeneratedPassword;
          rootUsername = rotated.rootUsername || 'admin';
        }
      } else {
        const rotated = await client.rotateRootCredential();
        rootPassword = rotated.newGeneratedPassword;
        rootUsername = rotated.rootUsername || 'admin';
      }

      // 3. If a distinct customer username was requested, create it on the server
      let activeUsername = rootUsername;
      let activePassword = rootPassword;

      if (params.username && params.username !== 'admin' && params.username !== rootUsername) {
        const userResult = await client.createUser({
          username: params.username,
          password: params.password,
          role: 'read_write',
          roles: ['read_write'],
        });
        activeUsername = userResult.username;
        activePassword = userResult.generatedPassword || params.password || rootPassword;
      }

      // 4. Construct canonical native LioranDB connection URI
      const isTls = node.protocol === 'https';
      const nativeUri = buildLioranDBConnectionUri({
        username: activeUsername,
        password: activePassword,
        host: node.dbUrl,
        port: node.port || 27018,
        database: params.databaseName || 'default',
        scheme: isTls ? 'liorandb+https' : 'liorandb',
        tls: isTls,
        transport: 'grpc',
      });

      return {
        success: true,
        providerDeploymentId: status.instanceId || `node-${node._id.toString().slice(-6)}`,
        serverVersion: status.version,
        nativeConnectionUri: nativeUri,
        generatedPassword: activePassword,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown provisioning error';
      return {
        success: false,
        error: `Failed to provision on LioranDB Rust server: ${errMsg}`,
      };
    }
  }

  async rotateCredentials(instanceId: string): Promise<CredentialResult> {
    await connectToDatabase();
    const instance = await ManagedDatabase.findById(instanceId).populate('hostingNodeId');
    if (!instance) return { success: false, error: 'Instance not found' };

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    try {
      const result = await client.rotateRootCredential();

      // Update encrypted connection URI with new credential
      const isTls = instance.port === 443 || instance.port === 8443;
      const newUri = buildLioranDBConnectionUri({
        username: result.rootUsername,
        password: result.newGeneratedPassword,
        host: instance.host,
        port: instance.port || 27018,
        database: instance.databaseName || 'default',
        scheme: isTls ? 'liorandb+https' : 'liorandb',
        tls: isTls,
        transport: 'grpc',
      });

      instance.encryptedConnectionUri = encrypt(newUri);
      instance.lastCredentialRotationAt = new Date();
      instance.rootRotatedAt = new Date();
      instance.credentialVersion = (instance.credentialVersion || 1) + 1;
      await instance.save();

      return {
        success: true,
        temporaryPassword: result.newGeneratedPassword,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Credential rotation failed',
      };
    }
  }

  async suspendDeployment(instanceId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    await connectToDatabase();
    const instance = await ManagedDatabase.findById(instanceId);
    if (!instance) return { success: false, error: 'Instance not found' };

    const now = new Date();
    instance.status = 'SUSPENDED';
    instance.suspendedAt = now;
    if (reason) instance.suspensionReason = reason;
    await instance.save();

    await BillingInterval.updateMany(
      { instanceId: instance._id, stoppedAt: { $exists: false } },
      { $set: { stoppedAt: now } }
    );

    return { success: true };
  }

  async resumeDeployment(instanceId: string): Promise<{ success: boolean; error?: string }> {
    await connectToDatabase();
    const instance = await ManagedDatabase.findById(instanceId);
    if (!instance) return { success: false, error: 'Instance not found' };

    const now = new Date();
    instance.status = 'ACTIVE';
    instance.suspendedAt = undefined;
    instance.suspensionReason = undefined;
    await instance.save();

    await BillingInterval.create({
      instanceId: instance._id,
      customerId: instance.customerId,
      startedAt: now,
      hourlyRatePaise: instance.hourlyRatePaise || 100,
      backupMonthlyPaise: instance.backupEnabled ? (instance.backupMonthlyPaise || 20000) : 0,
      planId: instance.planId || 'dedicated',
    });

    return { success: true };
  }

  async resetDeployment(instanceId: string, confirmation: string): Promise<{ success: boolean; error?: string }> {
    await connectToDatabase();
    const instance = await ManagedDatabase.findById(instanceId).populate('hostingNodeId');
    if (!instance) return { success: false, error: 'Instance not found' };

    const client = await LioranDBAdminClient.forInstanceAsync(instance);
    try {
      const serverStatus = await client.getServerStatus();
      const targetInstanceId = serverStatus.instanceId || `node-${instance._id}`;
      const result = await client.resetInstance({ instanceId: targetInstanceId });

      // Re-key native URI with new bootstrap root password
      const isTls = instance.port === 443 || instance.port === 8443;
      const newUri = buildLioranDBConnectionUri({
        username: result.rootUsername,
        password: result.newGeneratedRootPassword,
        host: instance.host,
        port: instance.port || 27018,
        database: instance.databaseName || 'default',
        scheme: isTls ? 'liorandb+https' : 'liorandb',
        tls: isTls,
        transport: 'grpc',
      });

      instance.encryptedConnectionUri = encrypt(newUri);
      instance.status = 'ACTIVE';
      instance.databaseUsers = [];
      instance.rootRotatedAt = new Date();
      instance.lastCredentialRotationAt = new Date();
      await instance.save();

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Server reset failed' };
    }
  }

  async terminateDeployment(instanceId: string): Promise<{ success: boolean; error?: string }> {
    await connectToDatabase();
    const now = new Date();

    // 1. Atomically lock and claim the instance for termination (prevents concurrent duplicate cleanups)
    let instance = await ManagedDatabase.findOneAndUpdate(
      {
        _id: instanceId,
        status: { $nin: ['DELETING', 'TERMINATED'] },
      },
      {
        $set: {
          status: 'DELETING',
          databaseUsers: [],
          billingStoppedAt: now,
          ...( { backupStoppedAt: now } ),
        },
      },
      { returnDocument: 'after' }
    );

    if (!instance) {
      const existing = (await ManagedDatabase.findById(instanceId)) || (await ManagedDatabase.findOne({ providerDeploymentId: instanceId }));
      if (!existing) return { success: false, error: 'Instance not found' };
      if (existing.status === 'TERMINATED') return { success: true };
      if (existing.status === 'DELETING') {
        return { success: false, error: 'Instance termination is already in progress' };
      }
      instance = existing;
    }

    const { logCleanupStage } = await import('../liorandb-admin/client');

    logCleanupStage({
      stage: 'ACCESS_REVOCATION',
      instanceId: instance._id.toString(),
      nodeId: instance.hostingNodeId?.toString(),
    });

    // 2. Stop active billing intervals
    await BillingInterval.updateMany(
      { instanceId: instance._id, endedAt: { $exists: false } },
      { $set: { endedAt: now, stoppedAt: now } }
    );

    // 3. If assigned to a hosting node, lock node to RESETTING and execute comprehensive purge
    if (instance.hostingNodeId) {
      const node = await HostingNode.findById(instance.hostingNodeId);
      if (node) {
        // Lock node in RESETTING state to prevent concurrent allocation
        node.status = 'RESETTING';
        await node.save();

        logCleanupStage({
          stage: 'LOCK_NODE',
          instanceId: instance._id.toString(),
          nodeId: node._id.toString(),
          endpoint: node.controlPlaneEndpoint || node.dbUrl,
        });

        try {
          const client = LioranDBAdminClient.forNode(node);
          const purgeResult = await client.purgeAndResetTenant({
            instanceId: instance._id.toString(),
            expectedInstanceName: instance.name,
            nodeId: node._id.toString(),
          });

          if (!purgeResult.verifiedClean) {
            throw new Error(`Clean state verification failed post-reset. Residual data detected: ${purgeResult.error || 'Check failed'}`);
          }

          // Successful cleanup: return node to AVAILABLE
          node.status = 'AVAILABLE';
          node.currentAssignedCount = 0;
          node.healthStatus = 'HEALTHY';
          node.lastResetAt = now;
          node.lastCredentialRotationAt = now;
          node.adminNotes = `Purged and reset on ${now.toISOString()}. Pre-mem: ${purgeResult.preResetMemoryBytes || 'N/A'}, Post-mem: ${purgeResult.postResetMemoryBytes || 'N/A'}`;
          await node.save();

          instance.status = 'TERMINATED';
          instance.terminatedAt = now;
          await instance.save();

          logCleanupStage({
            stage: 'NODE_RELEASE',
            instanceId: instance._id.toString(),
            nodeId: node._id.toString(),
            endpoint: client.endpoint,
            isClean: true,
          });

          return { success: true };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown termination error';
          console.error(`[Provisioning] CRITICAL: Failed to clean and verify node ${node.name || node._id} on termination: ${errMsg}`);

          // Quarantine dirty node to prevent other customers from receiving it
          node.status = 'QUARANTINED';
          node.healthStatus = 'DEGRADED';
          node.adminNotes = `QUARANTINED: Cleanup failed during termination: ${errMsg}`;
          await node.save();

          instance.status = 'FAILED';
          instance.adminNotes = `Cleanup failed during deletion: ${errMsg}. Node quarantined.`;
          await instance.save();

          logCleanupStage({
            stage: 'NODE_QUARANTINE',
            instanceId: instance._id.toString(),
            nodeId: node._id.toString(),
            isClean: false,
            failureReason: errMsg,
          });

          return {
            success: false,
            error: `Failed to safely clean database engine on node ${node.name}. The node has been quarantined: ${errMsg}`,
          };
        }
      }
    }

    instance.status = 'TERMINATED';
    instance.terminatedAt = now;
    await instance.save();

    return { success: true };
  }

  async getDeploymentStatus(instanceId: string): Promise<DeploymentStatusResult> {
    await connectToDatabase();
    const instance = await ManagedDatabase.findById(instanceId).populate('hostingNodeId');
    if (!instance) return { status: 'UNKNOWN', error: 'Instance not found' };

    try {
      const client = await LioranDBAdminClient.forInstanceAsync(instance);
      const status = await client.getServerStatus();
      return {
        status: status.status === 'HEALTHY' ? 'ACTIVE' : status.status === 'MAINTENANCE' ? 'SUSPENDED' : 'FAILED',
        version: status.version,
        uptimeSeconds: status.uptimeSeconds,
      };
    } catch (err: unknown) {
      return { status: 'UNKNOWN', error: err instanceof Error ? err.message : 'Server unreachable' };
    }
  }
}

/**
 * Mock Provider for testing environments only
 */
export class MockProvisioningProvider implements LioranProvisioningProvider {
  public instances = new Map<string, {
    databaseCount: number;
    collectionCount: number;
    documentCount: number;
    userCount: number;
    memoryBytesUsed: number;
    isQuarantined?: boolean;
    status: 'ACTIVE' | 'SUSPENDED' | 'DELETING' | 'TERMINATED' | 'FAILED';
  }>();

  async createDeployment(params: DeploymentParams): Promise<DeploymentResult> {
    const password = params.password || 'mock_secret_pass_123';
    const nativeUri = buildLioranDBConnectionUri({
      username: params.username,
      password,
      host: params.host,
      port: params.port || 27018,
      database: params.databaseName || 'default',
    });

    const deploymentId = `mock-dep-${Date.now()}`;
    this.instances.set(deploymentId, {
      databaseCount: 0,
      collectionCount: 0,
      documentCount: 0,
      userCount: 1,
      memoryBytesUsed: 52428800, // 50 MB baseline
      status: 'ACTIVE',
    });

    return {
      success: true,
      providerDeploymentId: deploymentId,
      serverVersion: '2.4.1-mock',
      nativeConnectionUri: nativeUri,
      generatedPassword: password,
    };
  }

  async suspendDeployment(providerDeploymentId: string, _reason?: string): Promise<{ success: boolean }> {
    const inst = this.instances.get(providerDeploymentId);
    if (inst) inst.status = 'SUSPENDED';
    return { success: true };
  }

  async resumeDeployment(providerDeploymentId: string): Promise<{ success: boolean }> {
    const inst = this.instances.get(providerDeploymentId);
    if (inst) inst.status = 'ACTIVE';
    return { success: true };
  }

  async rotateCredentials(_instanceId?: string): Promise<CredentialResult> {
    return { success: true, temporaryPassword: 'mock_new_password_456' };
  }

  async resetDeployment(instanceId: string, _confirmation?: string): Promise<{ success: boolean }> {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.databaseCount = 0;
      inst.collectionCount = 0;
      inst.documentCount = 0;
      inst.userCount = 0;
      inst.memoryBytesUsed = 52428800; // Reset to 50 MB baseline
    }
    return { success: true };
  }

  async terminateDeployment(instanceId: string): Promise<{ success: boolean; error?: string }> {
    const inst = this.instances.get(instanceId);
    if (inst) {
      if (inst.isQuarantined) {
        return { success: false, error: 'Instance failed cleanup and has been quarantined' };
      }
      inst.status = 'TERMINATED';
      inst.databaseCount = 0;
      inst.collectionCount = 0;
      inst.documentCount = 0;
      inst.userCount = 0;
      inst.memoryBytesUsed = 52428800; // Flushed memory baseline
    }
    return { success: true };
  }

  async getDeploymentStatus(instanceId: string): Promise<DeploymentStatusResult> {
    const inst = this.instances.get(instanceId);
    return {
      status: inst?.status === 'SUSPENDED' ? 'SUSPENDED' : inst?.status === 'FAILED' ? 'FAILED' : 'ACTIVE',
      version: '2.4.1-mock',
      uptimeSeconds: 3600,
    };
  }
}

// Select active provider: Real Rust provider by default, mock only if explicitly enabled
export function getProvisioningProvider(): LioranProvisioningProvider {
  if (process.env.LIORANDB_MOCK_DRIVER === 'true') {
    return new MockProvisioningProvider();
  }
  return new RealLioranDBProvisioningProvider();
}

export const provisioningProvider: LioranProvisioningProvider = new Proxy({} as LioranProvisioningProvider, {
  get(_target, prop: keyof LioranProvisioningProvider) {
    const provider = getProvisioningProvider();
    const val = provider[prop];
    return typeof val === 'function' ? val.bind(provider) : val;
  },
});

/**
 * High-level provisioning service method
 * Transitions an instance record through the state machine to ACTIVE with verified credentials.
 * Billing starts ONLY upon successful transition to ACTIVE.
 */
export async function provisionInstance(
  instanceOrId: string | IManagedDatabase,
  optionsOrEmail?: string | { customerEmail?: string; initialPassword?: string }
): Promise<IManagedDatabase> {
  const customerEmail = typeof optionsOrEmail === 'string' ? optionsOrEmail : optionsOrEmail?.customerEmail;
  const initialPassword = typeof optionsOrEmail === 'object' ? optionsOrEmail?.initialPassword : undefined;
  await connectToDatabase();
  await reconcileHostingNodes();

  const instance =
    typeof instanceOrId === 'string'
      ? await ManagedDatabase.findById(instanceOrId)
      : instanceOrId;

  if (!instance) {
    throw new Error('Database instance not found');
  }

  // 1. Atomically reserve an available hosting node if not already assigned
  let node: IHostingNode | null = null;

  if (instance.hostingNodeId) {
    node = await HostingNode.findById(instance.hostingNodeId);
    if (node) {
      node.status = 'PROVISIONING';
      node.currentAssignedCount = 1;
      await node.save();
    }
  }

  if (!node) {
    // Atomically find and reserve an strictly AVAILABLE & HEALTHY node
    node = await HostingNode.findOneAndUpdate(
      {
        status: 'AVAILABLE',
        healthStatus: 'HEALTHY',
        currentAssignedCount: 0,
      },
      {
        $set: {
          status: 'PROVISIONING',
          currentAssignedCount: 1,
        },
      },
      { returnDocument: 'after', sort: { isDefault: -1, createdAt: 1 } }
    );
  }

  if (!node) {
    instance.status = 'FAILED';
    instance.adminNotes = 'No dedicated database hosting servers available for assignment';
    await instance.save();
    throw new Error('No dedicated database hosting servers are currently available. Please email support@liorandb.com for this query.');
  }

  const plan = getPlan(instance.planId);
  const region = node.region || 'Asia (Mumbai)';
  const host = node.dbUrl;
  const port = node.port || 27018;
  const grpcUrl = node.grpcUrl;
  const grpcPort = node.grpcPort || 27019;
  const httpPort = node.httpPort || 27018;
  const isTls = node.protocol === 'https';
  const databaseName = instance.databaseName || 'default';
  const username = instance.username || 'admin';

  instance.hostingNodeId = node._id;
  instance.host = host;
  instance.port = port;
  instance.grpcUrl = grpcUrl;
  instance.grpcPort = grpcPort;
  instance.region = region;
  instance.status = 'PROVISIONING';
  await instance.save();

  // 2. Call the provisioning provider to interact with the real Rust control plane
  const deploymentResult = await provisioningProvider.createDeployment({
    customerId: instance.customerId.toString(),
    customerEmail: customerEmail || 'customer@liorandb.com',
    deploymentName: instance.name,
    username,
    password: initialPassword,
    host,
    port,
    databaseName,
    planId: instance.planId,
    nodeId: node._id.toString(),
  });

  if (!deploymentResult.success || !deploymentResult.nativeConnectionUri) {
    instance.status = 'FAILED';
    instance.adminNotes = deploymentResult.error || 'Failed to provision on Rust server';
    await instance.save();

    // Do NOT blindly make node AVAILABLE if it was quarantined during pre-check
    const refreshedNode = await HostingNode.findById(node._id);
    if (refreshedNode && refreshedNode.status !== 'QUARANTINED') {
      refreshedNode.status = 'AVAILABLE';
      refreshedNode.currentAssignedCount = 0;
      await refreshedNode.save();
    }

    throw new Error(deploymentResult.error || 'Failed to provision database infrastructure');
  }

  const now = new Date();
  const hourlyRatePaise = plan?.hourlyRatePaise || (instance.planId === 'shared' ? 100 : 800);
  const backupMonthlyPaise = instance.backupEnabled ? BACKUP_MONTHLY_PAISE : 0;

  // 3. Store encrypted native connection URI and admin password
  instance.encryptedConnectionUri = encrypt(deploymentResult.nativeConnectionUri);
  if (deploymentResult.generatedPassword) {
    instance.encryptedControlPlaneCredential = encrypt(deploymentResult.generatedPassword);
  }
  instance.status = 'ACTIVE';
  instance.planName = plan?.name || 'Dedicated';
  instance.hourlyRatePaise = hourlyRatePaise;
  instance.backupMonthlyPaise = backupMonthlyPaise;
  instance.provisionedAt = now;
  instance.billingStartedAt = now;
  instance.serverVersion = deploymentResult.serverVersion || '2.4.1';
  instance.serverHealth = 'HEALTHY';
  instance.providerDeploymentId = deploymentResult.providerDeploymentId;
  instance.opsPerSecondLimit = plan?.opsPerSecondLimit || 3000;
  instance.documentLimit = plan?.documentLimit || 1000;
  instance.type = plan?.type || 'dedicated';
  instance.lastCredentialRotationAt = now;
  instance.rootRotatedAt = now;

  if (instance.backupEnabled) {
    instance.backupStartedAt = now;
  }

  const adminEncryptedPassword = deploymentResult.generatedPassword
    ? encrypt(deploymentResult.generatedPassword)
    : undefined;

  if (!instance.databaseUsers || instance.databaseUsers.length === 0) {
    instance.databaseUsers = [
      {
        username,
        role: 'admin',
        status: 'ACTIVE',
        encryptedPassword: adminEncryptedPassword,
        createdAt: now,
      },
    ];
  } else {
    const adminUser = instance.databaseUsers.find((u) => u.username === username);
    if (adminUser && adminEncryptedPassword) {
      adminUser.encryptedPassword = adminEncryptedPassword;
    }
  }

  await instance.save();

  // 4. Update hosting node status to ASSIGNED
  node.status = 'ASSIGNED';
  node.currentAssignedCount = 1;
  node.serverVersion = deploymentResult.serverVersion || '2.4.1';
  node.healthStatus = 'HEALTHY';
  node.lastCredentialRotationAt = now;
  await node.save();

  // 5. Create initial billing interval record only after active verification
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
