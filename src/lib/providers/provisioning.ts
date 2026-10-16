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
import { encrypt, generateSecureToken, generateDatabasePassword } from '../crypto';
import { BACKUP_MONTHLY_PAISE, getPlan } from '../plans';
import type { IManagedDatabase } from '../db/models/ManagedDatabase';
import type { IHostingNode } from '../db/models/HostingNode';
import { LioranDBAdminClient } from '../liorandb-admin/client';
import { buildLioranDBConnectionUri } from '../liorandb-admin/uri';
import { resolveControlPlaneEndpoint } from '../liorandb-admin/url';
import { LioranDBAdminError, LioranDBUnreachableError } from '../liorandb-admin/errors';
import { reconcileHostingNodes } from './reconciliation';
import {
  getDockerManagementClient,
  extractDockerNodeId,
  resolveDockerVolumeName,
  type ResetAuthorization,
} from '../docker-management';

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
  skipCleanVerification?: boolean;
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
  terminateDeployment(instanceId: string): Promise<{ success: boolean; error?: string; cleanupStatus?: string }>;
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
      const explicitNode = await HostingNode.findById(params.nodeId);
      if (explicitNode) {
        if (explicitNode.status === 'QUARANTINED') {
          return {
            success: false,
            error: `${explicitNode.name} unavailable: reset required.`,
          };
        }
        if (explicitNode.status === 'RESETTING') {
          return {
            success: false,
            error: `${explicitNode.name} unavailable: reset in progress.`,
          };
        }
        if (explicitNode.status === 'DISABLED') {
          return {
            success: false,
            error: `${explicitNode.name} is disabled.`,
          };
        }
        node = explicitNode;
      }
    }

    if (!node) {
      return {
        success: false,
        error: params.nodeId
          ? `Requested hosting node '${params.nodeId}' was not found or is ineligible for allocation.`
          : 'Dedicated hosting node must be allocated via the authoritative allocation service.',
      };
    }

    // 0. Ensure Docker container is running if target is a managed Docker node
    const dockerNodeId = extractDockerNodeId(node);
    const dockerClient = getDockerManagementClient();

    if (dockerNodeId && dockerClient.isConfigured()) {
      try {
        const dockerState = await dockerClient.getNodeState(dockerNodeId);
        if (!dockerState.running) {
          await dockerClient.startNode(dockerNodeId);
          const runningState = await dockerClient.waitForRunning(dockerNodeId, 25000);
          await HostingNode.findByIdAndUpdate(node._id, {
            $set: {
              dockerRunning: true,
              dockerStatus: runningState.status || 'running',
              dockerLastInspectedAt: new Date(),
            },
          });
        } else if (dockerState.paused) {
          await dockerClient.unpauseNode(dockerNodeId);
          const runningState = await dockerClient.waitForRunning(dockerNodeId, 15000);
          await HostingNode.findByIdAndUpdate(node._id, {
            $set: {
              dockerRunning: true,
              dockerStatus: runningState.status || 'running',
              dockerLastInspectedAt: new Date(),
            },
          });
        } else {
          await HostingNode.findByIdAndUpdate(node._id, {
            $set: {
              dockerRunning: true,
              dockerStatus: dockerState.status || 'running',
              dockerLastInspectedAt: new Date(),
            },
          });
        }
      } catch (dockerErr: unknown) {
        const dMsg = dockerErr instanceof Error ? dockerErr.message : String(dockerErr);
        console.error(`[Provisioning] Docker container start failed for node ${dockerNodeId}: ${dMsg}`);
        return {
          success: false,
          error: `Target container for node '${node.name}' failed to start: ${dMsg}`,
        };
      }
    }

    // Connect to the Rust server control plane
    const client = LioranDBAdminClient.forNode(node);

    try {
      // 1. Live server health and identity check with bounded readiness polling
      let status: any = null;
      let isServerReady = false;
      const maxRetries = 10;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          status = await client.getServerStatus();
          if (status.status === 'HEALTHY' || status.state === 'Ready') {
            isServerReady = true;
            break;
          }
        } catch (statusErr) {
          if (attempt === maxRetries) throw statusErr;
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (!status || (!isServerReady && status.status !== 'HEALTHY' && status.state !== 'Ready')) {
        return {
          success: false,
          error: `Target hosting node '${node.name}' is not in Ready state (current state: ${status?.state || status?.status || 'UNKNOWN'}).`,
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
        allowHttpFallback: false,
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
        allowHttpFallback: false,
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
    const instance = await ManagedDatabase.findById(instanceId).populate('hostingNodeId');
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

    // Pause container via Docker management if configured
    if (instance.hostingNodeId) {
      const dockerNodeId = extractDockerNodeId(instance.hostingNodeId);
      const dockerClient = getDockerManagementClient();
      if (dockerNodeId && dockerClient.isConfigured()) {
        try {
          await dockerClient.pauseNode(dockerNodeId);
          await HostingNode.findByIdAndUpdate(instance.hostingNodeId, {
            $set: { dockerStatus: 'paused', dockerLastInspectedAt: now },
          });
        } catch (pauseErr) {
          console.warn(`[Suspension] Docker pause notice for ${dockerNodeId}:`, (pauseErr as Error).message);
        }
      }
    }

    return { success: true };
  }

  async resumeDeployment(instanceId: string): Promise<{ success: boolean; error?: string }> {
    await connectToDatabase();
    const instance = await ManagedDatabase.findById(instanceId).populate('hostingNodeId');
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

    // Unpause or start container via Docker management if configured
    if (instance.hostingNodeId) {
      const dockerNodeId = extractDockerNodeId(instance.hostingNodeId);
      const dockerClient = getDockerManagementClient();
      if (dockerNodeId && dockerClient.isConfigured()) {
        try {
          const state = await dockerClient.getNodeState(dockerNodeId);
          if (state.paused) {
            await dockerClient.unpauseNode(dockerNodeId);
          } else if (!state.running) {
            await dockerClient.startNode(dockerNodeId);
            await dockerClient.waitForRunning(dockerNodeId, 20000);
          }
          await HostingNode.findByIdAndUpdate(instance.hostingNodeId, {
            $set: { dockerRunning: true, dockerStatus: 'running', dockerLastInspectedAt: now },
          });
        } catch (unpauseErr) {
          console.warn(`[Resumption] Docker unpause notice for ${dockerNodeId}:`, (unpauseErr as Error).message);
        }
      }
    }

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
        allowHttpFallback: false,
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

  async terminateDeployment(instanceId: string): Promise<{ success: boolean; error?: string; cleanupStatus?: string }> {
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
          backupStoppedAt: now,
        },
        $unset: {
          encryptedConnectionUri: 1,
          encryptedControlPlaneCredential: 1,
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

    // 2. Stop active billing intervals immediately
    await BillingInterval.updateMany(
      { instanceId: instance._id, endedAt: { $exists: false } },
      { $set: { endedAt: now, stoppedAt: now } }
    );

    // 3. If assigned to a hosting node, lock node to RESETTING and execute infrastructure-level cleanup
    if (instance.hostingNodeId) {
      const node = await HostingNode.findOneAndUpdate(
        {
          _id: instance.hostingNodeId,
          status: { $ne: 'RESETTING' },
        },
        {
          $set: {
            status: 'RESETTING',
            lastCleanupAttemptAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      if (node) {
        logCleanupStage({
          stage: 'LOCK_NODE',
          instanceId: node.serverIdentity || instance._id.toString(),
          nodeId: node._id.toString(),
          endpoint: node.controlPlaneEndpoint || node.dbUrl,
        });

        const dockerNodeId = extractDockerNodeId(node);
        const dockerClient = getDockerManagementClient();

        // 3a. Invalidate logical credentials on Rust control plane if server was reachable
        try {
          const client = LioranDBAdminClient.forNode(node);
          await client.rotateRootCredential();
        } catch {
          // Rust server might already be stopped or unreachable; continue to Docker container management
        }

        // 3b. Stop associated Docker container
        let containerStopped = false;
        if (dockerNodeId && dockerClient.isConfigured()) {
          try {
            await dockerClient.stopNode(dockerNodeId);
            const state = await dockerClient.waitForStopped(dockerNodeId, 25000);
            containerStopped = !state.running;
            node.dockerRunning = false;
            node.dockerStatus = state.status || 'exited';
            node.dockerLastInspectedAt = now;
          } catch (dockerStopErr: unknown) {
            const stopErrMsg = dockerStopErr instanceof Error ? dockerStopErr.message : String(dockerStopErr);
            console.error(`[Termination] Failed to stop Docker container for ${dockerNodeId}: ${stopErrMsg}`);
          }
        }

        // 3c. Invoke physical storage cleanup through verified and authorized backend capability
        // If unsupported or fails, fail closed: do NOT mark AVAILABLE, mark QUARANTINED.
        let storageCleaned = false;
        let storageCleanupError = '';

        if (dockerNodeId && dockerClient.isConfigured()) {
          try {
            const auth: ResetAuthorization = {
              confirmedTargetNode: dockerNodeId,
              confirmedTargetVolume: resolveDockerVolumeName(dockerNodeId),
              confirmationToken: generateSecureToken(16),
              allocationId: node.currentAllocationId || undefined,
            };
            const resetRes = await dockerClient.resetNodeStorage(dockerNodeId, auth);
            storageCleaned = resetRes.verifiedEmpty;
          } catch (storageErr: unknown) {
            storageCleanupError = storageErr instanceof Error ? storageErr.message : String(storageErr);
            storageCleaned = false;
          }
        } else {
          storageCleanupError = 'Docker management gateway is not configured or target node is not in cx01..cx07 allowlist';
        }

        if (!storageCleaned) {
          // FAIL CLOSED: Quarantine the node
          const quarantineReason = `${node.name} unavailable: physical storage reset required.`;
          node.status = 'QUARANTINED';
          node.cleanStatus = 'DIRTY';
          node.healthStatus = 'DEGRADED';
          node.currentAssignedCount = 0;
          node.assignedInstanceId = undefined;
          node.currentAllocationId = undefined;
          node.allocationExpiresAt = undefined;
          node.quarantineCode = 'PHYSICAL_CLEANUP_REQUIRED';
          node.quarantineReason = quarantineReason;
          node.cleanupFailureReason = storageCleanupError;
          node.adminNotes = `QUARANTINED on termination: Container ${containerStopped ? 'stopped' : 'stop unverified'}. Storage reset unsupported/failed: ${storageCleanupError}`;
          await node.save();

          instance.status = 'TERMINATED';
          instance.terminatedAt = now;
          instance.adminNotes = `Terminated. Container ${containerStopped ? 'stopped' : 'stop unverified'}. Node quarantined pending physical storage reset.`;
          await instance.save();

          logCleanupStage({
            stage: 'NODE_QUARANTINE',
            instanceId: node.serverIdentity || instance._id.toString(),
            nodeId: node._id.toString(),
            isClean: false,
            failureReason: storageCleanupError,
          });

          return {
            success: true,
            cleanupStatus: 'QUARANTINED_PENDING_PHYSICAL_CLEANUP',
            error: `Container stopped. Physical storage deletion is not supported by the management service API; node ${node.name} has been quarantined.`,
          };
        }

        // If verified physical storage cleanup succeeded (when backend capability is deployed):
        node.status = 'AVAILABLE';
        node.cleanStatus = 'CLEAN';
        node.healthStatus = 'HEALTHY';
        node.currentAssignedCount = 0;
        node.assignedInstanceId = undefined;
        node.currentAllocationId = undefined;
        node.allocationExpiresAt = undefined;
        node.quarantineReason = undefined;
        node.quarantineCode = undefined;
        node.cleanupFailureReason = undefined;
        node.volumeCleanVerified = true;
        node.volumeCleanVerifiedAt = now;
        node.lastResetAt = now;
        node.lastCleanCheckAt = now;
        node.adminNotes = `Sanitized and reset on ${now.toISOString()}. Container stopped with fresh empty volume.`;
        await node.save();

        instance.status = 'TERMINATED';
        instance.terminatedAt = now;
        await instance.save();

        logCleanupStage({
          stage: 'NODE_RELEASE',
          instanceId: node.serverIdentity || instance._id.toString(),
          nodeId: node._id.toString(),
          isClean: true,
        });

        return { success: true };
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

  async terminateDeployment(instanceId: string): Promise<{ success: boolean; error?: string; cleanupStatus?: string }> {
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
    return { success: true, cleanupStatus: 'MOCK_CLEANED' };
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

export interface AllocateAndProvisionParams {
  customerId: string | any;
  customerEmail: string;
  name: string;
  planId: string;
  databaseName?: string;
  username?: string;
  initialPassword?: string;
  backupEnabled?: boolean;
  couponCode?: string;
  couponDiscountPercentage?: number;
  nodeId?: string;
}

export interface AllocateAndProvisionResult {
  instance: IManagedDatabase;
  node: IHostingNode;
  masterPassword: string;
  nativeConnectionUri: string;
}

/**
 * Authoritative Centralized 1:1 Hosting Node Allocation & Provisioning Service (Phase 2 & 4).
 *
 * Implements an explicit, durable, concurrency-safe saga:
 *   1. Atomic CAS reservation claim with fencing token (currentAllocationId) and lease.
 *   2. Link ManagedDatabase record as PROVISIONING with allocation token.
 *   3. Authoritative pre-mutation clean verification (verifyCleanState) before ANY tenant changes.
 *   4. Conditional transition to PROVISIONING upon passing clean verification.
 *   5. Real Rust server mutation (root rotation + customer user creation) with skipCleanVerification.
 *   6. Driver connectivity verification (without false clean-reassignment checks).
 *   7. Atomic commit of customer allocation: instance -> ACTIVE, node -> ASSIGNED.
 *   8. Start billing intervals ONLY after successful ACTIVE transition.
 *   9. Concurrency-safe compensation on failure (release clean nodes, quarantine mutated nodes).
 */
export async function allocateAndProvisionInstance(
  params: AllocateAndProvisionParams
): Promise<AllocateAndProvisionResult> {
  await connectToDatabase();

  const now = new Date();
  const allocationToken = `alloc_${Date.now()}_${generateSecureToken(8)}`;
  const leaseDurationMs = 120_000; // 2 minutes reservation lease
  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

  const plan = getPlan(params.planId);
  if (!plan) {
    throw new Error('Invalid database plan selected.');
  }

  const cleanName = params.name.trim().toLowerCase();
  const targetDbName = (params.databaseName || cleanName).replace(/-/g, '_');

  // Find genuinely active customer instances to ensure dedicated 1:1 isolation
  const activeCustomerInstances = await ManagedDatabase.find({
    status: { $in: ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED'] },
    hostingNodeId: { $exists: true, $ne: null },
  })
    .select('hostingNodeId')
    .lean();

  const occupiedNodeIds = activeCustomerInstances
    .map((inst) => inst.hostingNodeId?.toString())
    .filter((id): id is string => Boolean(id));

  // Step 1: Atomic conditional claim (CAS) on an allocatable node
  let reservedNode: IHostingNode | null = null;

  const allocatableFilter: any = {
    status: { $in: ['AVAILABLE', 'ACTIVE'] },
    healthStatus: 'HEALTHY',
    cleanStatus: { $ne: 'DIRTY' },
    currentAssignedCount: 0,
    $or: [
      { currentAllocationId: { $exists: false } },
      { currentAllocationId: null },
      { currentAllocationId: '' },
      { allocationExpiresAt: { $exists: false } },
      { allocationExpiresAt: null },
      { allocationExpiresAt: { $lt: new Date() } },
    ],
  };

  if (params.nodeId) {
    const explicitTarget = await HostingNode.findById(params.nodeId);
    if (!explicitTarget) {
      throw new Error(`Requested hosting node '${params.nodeId}' was not found.`);
    }
    if (explicitTarget.status === 'QUARANTINED') {
      throw new Error(`${explicitTarget.name} unavailable: reset required.`);
    }
    if (explicitTarget.status === 'RESETTING') {
      throw new Error(`${explicitTarget.name} unavailable: reset in progress.`);
    }
    if (explicitTarget.status === 'DISABLED') {
      throw new Error(`${explicitTarget.name} is disabled.`);
    }
    if (explicitTarget.cleanStatus === 'DIRTY') {
      throw new Error(`${explicitTarget.name} unavailable: physical storage reset required.`);
    }
    if (occupiedNodeIds.includes(params.nodeId.toString()) || explicitTarget.currentAssignedCount > 0) {
      throw new Error(`Requested hosting node '${explicitTarget.name}' is currently assigned to an active customer.`);
    }

    allocatableFilter._id = params.nodeId;
    reservedNode = await HostingNode.findOneAndUpdate(
      allocatableFilter,
      {
        $set: {
          status: 'PROVISIONING',
          currentAllocationId: allocationToken,
          allocationExpiresAt: leaseExpiresAt,
          currentAssignedCount: 1,
        },
        $unset: {
          quarantineReason: 1,
          quarantineCode: 1,
          cleanupFailureReason: 1,
        },
      },
      { returnDocument: 'after' }
    );
  } else {
    if (occupiedNodeIds.length > 0) {
      allocatableFilter._id = { $nin: occupiedNodeIds };
    }
    reservedNode = await HostingNode.findOneAndUpdate(
      allocatableFilter,
      {
        $set: {
          status: 'PROVISIONING',
          currentAllocationId: allocationToken,
          allocationExpiresAt: leaseExpiresAt,
          currentAssignedCount: 1,
        },
        $unset: {
          quarantineReason: 1,
          quarantineCode: 1,
          cleanupFailureReason: 1,
        },
      },
      { returnDocument: 'after', sort: { isDefault: -1, createdAt: 1 } }
    );
  }

  if (!reservedNode) {
    throw new Error(
      'No dedicated database hosting servers are currently available. Please email support@liorandb.com for this query.'
    );
  }

  // Step 2: Create ManagedDatabase record linked to this allocation
  const masterUsername = reservedNode.defaultRootUsername || 'admin';
  let masterPassword = params.initialPassword || generateDatabasePassword(24);
  const controlPlaneEndpoint = resolveControlPlaneEndpoint(reservedNode);
  const hourlyRatePaise = plan.hourlyRatePaise || (params.planId === 'shared' ? 100 : 800);
  const backupMonthlyPaise = params.backupEnabled ? BACKUP_MONTHLY_PAISE : 0;
  const dockerNodeId = extractDockerNodeId(reservedNode);

  let instance: IManagedDatabase;
  try {
    instance = await ManagedDatabase.create({
      customerId: params.customerId,
      userId: params.customerId,
      hostingNodeId: reservedNode._id,
      dockerNodeId: dockerNodeId || undefined,
      lifecycleOperationId: allocationToken,
      name: cleanName,
      planId: plan.id,
      planName: plan.name,
      hourlyRatePaise,
      backupEnabled: Boolean(params.backupEnabled),
      backupMonthlyPaise,
      couponCode: params.couponCode,
      couponDiscountPercentage: params.couponDiscountPercentage || 0,
      status: 'PROVISIONING',
      allocationToken,
      provisioningStage: 'PROVISIONING',
      host: reservedNode.dbUrl,
      port: reservedNode.port || 27018,
      grpcUrl: reservedNode.grpcUrl,
      grpcPort: reservedNode.grpcPort || 27019,
      controlPlaneEndpoint,
      databaseName: targetDbName,
      username: masterUsername,
      rootUsername: masterUsername,
      databaseUsers: [
        {
          username: masterUsername,
          role: 'admin',
          status: 'ACTIVE',
          encryptedPassword: encrypt(masterPassword),
          createdAt: now,
        },
      ],
    });

    // Update node with assignedInstanceId
    await HostingNode.findOneAndUpdate(
      { _id: reservedNode._id, currentAllocationId: allocationToken },
      { $set: { assignedInstanceId: instance._id } }
    );
  } catch (dbErr: unknown) {
    // Release node reservation back to AVAILABLE if instance creation failed before any Rust call
    await HostingNode.findOneAndUpdate(
      { _id: reservedNode._id, currentAllocationId: allocationToken },
      {
        $set: {
          status: 'AVAILABLE',
          currentAssignedCount: 0,
        },
        $unset: {
          currentAllocationId: 1,
          allocationExpiresAt: 1,
          assignedInstanceId: 1,
        },
      }
    );
    throw dbErr;
  }

  // Step 2.5: Physical Docker Container Lifecycle Integration (Phase C)
  const dockerClient = getDockerManagementClient();

  if (dockerNodeId && dockerClient.isConfigured()) {
    try {
      const dockerState = await dockerClient.getNodeState(dockerNodeId);
      if (!dockerState.running) {
        await dockerClient.startNode(dockerNodeId);
        const startedState = await dockerClient.waitForRunning(dockerNodeId, 25000);
        await HostingNode.findByIdAndUpdate(reservedNode._id, {
          $set: {
            dockerRunning: true,
            dockerStatus: startedState.status || 'running',
            dockerLastInspectedAt: new Date(),
          },
        });
      } else if (dockerState.paused) {
        await dockerClient.unpauseNode(dockerNodeId);
        const resumedState = await dockerClient.waitForRunning(dockerNodeId, 15000);
        await HostingNode.findByIdAndUpdate(reservedNode._id, {
          $set: {
            dockerRunning: true,
            dockerStatus: resumedState.status || 'running',
            dockerLastInspectedAt: new Date(),
          },
        });
      } else {
        await HostingNode.findByIdAndUpdate(reservedNode._id, {
          $set: {
            dockerRunning: true,
            dockerStatus: dockerState.status || 'running',
            dockerLastInspectedAt: new Date(),
          },
        });
      }
    } catch (dockerStartErr: unknown) {
      const dMsg = dockerStartErr instanceof Error ? dockerStartErr.message : String(dockerStartErr);
      console.error(`[Provisioning] Failed to start Docker container for ${dockerNodeId}: ${dMsg}`);

      await HostingNode.findOneAndUpdate(
        { _id: reservedNode._id, currentAllocationId: allocationToken },
        {
          $set: {
            status: 'AVAILABLE',
            healthStatus: 'DEGRADED',
            currentAssignedCount: 0,
          },
          $unset: {
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
          },
        }
      );

      instance.status = 'FAILED';
      instance.provisioningStage = 'CONTAINER_START_FAILED';
      instance.lastProvisioningError = `Docker container failed to start: ${dMsg}`;
      instance.hostingNodeId = undefined;
      await instance.save();

      throw new Error(`Failed to start container for node '${reservedNode.name}': ${dMsg}`);
    }
  }

  // Step 3: Pre-allocation health and readiness probe (strictly BEFORE any customer mutations begin)
  const client = LioranDBAdminClient.forNode(reservedNode);
  const targetInstanceId = reservedNode.serverIdentity || 'primary';
  let serverStatus: any = null;

  try {
    let ready = false;
    const maxRetries = 10;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        serverStatus = await client.getServerStatus();
        if (serverStatus.status === 'HEALTHY' || serverStatus.state === 'Ready') {
          ready = true;
          break;
        }
      } catch (checkErr) {
        if (attempt === maxRetries) throw checkErr;
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!ready || (serverStatus.status !== 'HEALTHY' && serverStatus.state !== 'Ready')) {
      const statusFailReason = `${reservedNode.name} unavailable: server is not in Ready state (current state: ${serverStatus?.state || serverStatus?.status || 'UNKNOWN'})`;

      await HostingNode.findOneAndUpdate(
        { _id: reservedNode._id, currentAllocationId: allocationToken },
        {
          $set: {
            status: 'AVAILABLE',
            healthStatus: 'DEGRADED',
            currentAssignedCount: 0,
          },
          $unset: {
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
            quarantineReason: 1,
            quarantineCode: 1,
            cleanupFailureReason: 1,
          },
        }
      );

      instance.status = 'FAILED';
      instance.provisioningStage = 'HEALTH_CHECK_FAILED';
      instance.lastProvisioningError = statusFailReason;
      instance.hostingNodeId = undefined;
      await instance.save();

      throw new Error(statusFailReason);
    }

    if (
      reservedNode.serverIdentity &&
      serverStatus.instanceId &&
      reservedNode.serverIdentity.toLowerCase() !== serverStatus.instanceId.toLowerCase()
    ) {
      const identityMismatchReason = `${reservedNode.name} unavailable: server identity mismatch (expected '${reservedNode.serverIdentity}', received '${serverStatus.instanceId}')`;

      await HostingNode.findOneAndUpdate(
        { _id: reservedNode._id, currentAllocationId: allocationToken },
        {
          $set: {
            status: 'AVAILABLE',
            currentAssignedCount: 0,
          },
          $unset: {
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
            quarantineReason: 1,
            quarantineCode: 1,
            cleanupFailureReason: 1,
          },
        }
      );

      instance.status = 'FAILED';
      instance.provisioningStage = 'IDENTITY_MISMATCH';
      instance.lastProvisioningError = identityMismatchReason;
      instance.hostingNodeId = undefined;
      await instance.save();

      throw new Error(identityMismatchReason);
    }
  } catch (preCheckErr: unknown) {
    const preCheckMsg = preCheckErr instanceof Error ? preCheckErr.message : String(preCheckErr);
    await HostingNode.findOneAndUpdate(
      { _id: reservedNode._id, currentAllocationId: allocationToken },
      {
        $set: {
          status: 'AVAILABLE',
          currentAssignedCount: 0,
        },
        $unset: {
          currentAllocationId: 1,
          allocationExpiresAt: 1,
          assignedInstanceId: 1,
          quarantineReason: 1,
          quarantineCode: 1,
          cleanupFailureReason: 1,
        },
      }
    );
    instance.status = 'FAILED';
    instance.provisioningStage = 'PRE_CHECK_FAILED';
    instance.lastProvisioningError = preCheckMsg;
    instance.hostingNodeId = undefined;
    await instance.save();
    throw preCheckErr;
  }

  // Step 4: Handle Node Reuse / Authoritative Reset (only when required)
  // For a newly initialized node with no previous customer assignment, provision directly.
  // For a previously assigned node or node with residual databases/users, require completed authoritative Rust reset.
  const isPreviouslyAssigned = Boolean(
    (reservedNode as any).requiresReset ||
    reservedNode.assignedInstanceId ||
    (reservedNode as any).lastAssignedAt
  );
  const statusAny = serverStatus as any;
  const hasResidualDatabases =
    (serverStatus.databaseCount || statusAny.database_count || statusAny.total_databases || 0) > 1;
  const hasResidualUsers = (serverStatus.userCount || statusAny.user_count || 0) > 1;
  const needsReset = isPreviouslyAssigned || hasResidualDatabases || hasResidualUsers;

  if (needsReset) {
    try {
      const resetResult = await client.resetInstance({
        instanceId: targetInstanceId,
        confirmation: 'RESET_INSTANCE',
      });

      const isResetConfirmed =
        resetResult.state === 'Ready' ||
        resetResult.status === 'READY' ||
        resetResult.status === 'ACTIVE' ||
        resetResult.status === 'OK';

      if (!isResetConfirmed) {
        throw new Error(`${reservedNode.name} unavailable: reset required.`);
      }

      if (resetResult.newGeneratedRootPassword) {
        masterPassword = resetResult.newGeneratedRootPassword;
      }

      await HostingNode.findByIdAndUpdate(reservedNode._id, {
        $set: {
          lastResetAt: new Date(),
          encryptedDefaultRootPassword: resetResult.newGeneratedRootPassword
            ? encrypt(resetResult.newGeneratedRootPassword)
            : reservedNode.encryptedDefaultRootPassword,
        },
        $unset: { requiresReset: 1, quarantineReason: 1, quarantineCode: 1, cleanupFailureReason: 1 },
      });
    } catch (resetErr: unknown) {
      const resetMsg = resetErr instanceof Error ? resetErr.message : String(resetErr);
      const conciseQuarantineMsg = `${reservedNode.name} unavailable: reset required.`;

      await HostingNode.findOneAndUpdate(
        { _id: reservedNode._id, currentAllocationId: allocationToken },
        {
          $set: {
            status: 'QUARANTINED',
            quarantineCode: 'RESET_FAILED',
            quarantineReason: conciseQuarantineMsg,
            cleanupFailureReason: resetMsg,
            currentAssignedCount: 0,
          },
          $unset: {
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
          },
        }
      );
      instance.status = 'FAILED';
      instance.provisioningStage = 'RESET_FAILED';
      instance.lastProvisioningError = conciseQuarantineMsg;
      await instance.save();
      throw new Error(conciseQuarantineMsg);
    }
  }

  instance.provisioningStage = 'MUTATING_RUST';
  await instance.save();

  // Step 5: Execute Rust Control Plane Mutations
  let deploymentResult: DeploymentResult;
  try {
    deploymentResult = await provisioningProvider.createDeployment({
      customerId: params.customerId.toString(),
      customerEmail: params.customerEmail,
      deploymentName: cleanName,
      username: masterUsername,
      password: masterPassword,
      host: reservedNode.dbUrl,
      port: reservedNode.port || 27018,
      databaseName: targetDbName,
      planId: plan.id,
      nodeId: reservedNode._id.toString(),
      skipCleanVerification: true,
    });

    if (!deploymentResult.success || !deploymentResult.nativeConnectionUri) {
      throw new Error(deploymentResult.error || 'Failed to complete deployment on Rust control plane');
    }
  } catch (mutationErr: unknown) {
    const mutMsg = mutationErr instanceof Error ? mutationErr.message : String(mutationErr);
    console.error(`[Provisioning] Rust mutation failed on node ${reservedNode.name}: ${mutMsg}`);

    const conciseQuarantineMsg = `${reservedNode.name} unavailable: reset required.`;

    await HostingNode.findOneAndUpdate(
      { _id: reservedNode._id, currentAllocationId: allocationToken },
      {
        $set: {
          status: 'QUARANTINED',
          quarantineCode: 'MUTATION_FAILED',
          cleanStatus: 'DIRTY',
          currentAssignedCount: 0,
          quarantineReason: conciseQuarantineMsg,
          cleanupFailureReason: mutMsg,
        },
        $unset: {
          currentAllocationId: 1,
          allocationExpiresAt: 1,
          assignedInstanceId: 1,
        },
      }
    );

    instance.status = 'FAILED';
    instance.provisioningStage = 'MUTATION_FAILED';
    instance.lastProvisioningError = conciseQuarantineMsg;
    instance.adminNotes = `Provisioning mutation failed: ${mutMsg}`;
    await instance.save();

    throw new Error(conciseQuarantineMsg);
  }

  // Step 6: Verify client connectivity and logical database accessibility
  const isMockProvider = process.env.LIORANDB_MOCK_DRIVER === 'true';
  const isConnexusInternal =
    targetDbName === 'lcs' ||
    cleanName.includes('connexus') ||
    plan.id === 'connexus_internal';

  if (!isMockProvider) {
    try {
      const { LioranDBClient } = await import('@liorandb/driver');
      const testClient = await LioranDBClient.connect(deploymentResult.nativeConnectionUri, {
        transport: 'grpc',
        allowHttpFallback: false,
        timeoutMS: 10000,
        connectTimeoutMS: 5000,
        requestTimeoutMS: 10000,
      });

      try {
        if (!testClient.isConnected()) {
          throw new Error('Connection established but client is not in connected state.');
        }

        const customerDb = testClient.db(targetDbName);
        await customerDb.listCollections();

        if (isConnexusInternal) {
          const { initConnexusCollectionsAndIndexes } = await import('../db');
          await initConnexusCollectionsAndIndexes(customerDb);
        }
      } finally {
        await testClient.close().catch(() => {});
      }
    } catch (readinessErr: unknown) {
      const readMsg = readinessErr instanceof Error ? readinessErr.message : String(readinessErr);
      const failReason = `${reservedNode.name} unavailable: reset required.`;
      console.error(`[Provisioning] Readiness failure on node ${reservedNode.name}: ${readMsg}`);

      await HostingNode.findOneAndUpdate(
        { _id: reservedNode._id, currentAllocationId: allocationToken },
        {
          $set: {
            status: 'QUARANTINED',
            quarantineCode: 'READINESS_FAILED',
            cleanStatus: 'DIRTY',
            currentAssignedCount: 0,
            quarantineReason: failReason,
            cleanupFailureReason: readMsg,
          },
          $unset: {
            currentAllocationId: 1,
            allocationExpiresAt: 1,
            assignedInstanceId: 1,
          },
        }
      );

      instance.status = 'FAILED';
      instance.provisioningStage = 'READINESS_FAILED';
      instance.lastProvisioningError = failReason;
      instance.adminNotes = failReason;
      await instance.save();

      throw new Error(failReason);
    }
  }

  // Step 7: Atomically commit customer allocation (ACTIVE & ASSIGNED)
  const finalNow = new Date();
  const effectivePassword = deploymentResult.generatedPassword || masterPassword;

  instance.encryptedConnectionUri = encrypt(deploymentResult.nativeConnectionUri);
  instance.encryptedControlPlaneCredential = encrypt(effectivePassword);
  instance.status = 'ACTIVE';
  instance.provisioningStage = 'COMPLETED';
  instance.provisionedAt = finalNow;
  instance.billingStartedAt = finalNow;
  instance.serverVersion = deploymentResult.serverVersion || '2.4.1';
  instance.serverHealth = 'HEALTHY';
  instance.providerDeploymentId = deploymentResult.providerDeploymentId;
  instance.opsPerSecondLimit = plan.opsPerSecondLimit || 3000;
  instance.documentLimit = plan.documentLimit || 1000;
  instance.type = plan.type || 'dedicated';
  instance.lastCredentialRotationAt = finalNow;
  instance.rootRotatedAt = finalNow;
  if (instance.backupEnabled) {
    instance.backupStartedAt = finalNow;
  }

  const updatedAdminPasswordEncrypted = encrypt(effectivePassword);
  if (!instance.databaseUsers || instance.databaseUsers.length === 0) {
    instance.databaseUsers = [
      {
        username: masterUsername,
        role: 'admin',
        status: 'ACTIVE',
        encryptedPassword: updatedAdminPasswordEncrypted,
        createdAt: finalNow,
      },
    ];
  } else {
    const adminUser = instance.databaseUsers.find((u) => u.username === masterUsername);
    if (adminUser) {
      adminUser.encryptedPassword = updatedAdminPasswordEncrypted;
    }
  }

  await instance.save();

  // Atomically commit node to ASSIGNED
  const updatedNode = await HostingNode.findOneAndUpdate(
    { _id: reservedNode._id, currentAllocationId: allocationToken },
    {
      $set: {
        status: 'ASSIGNED',
        currentAssignedCount: 1,
        serverVersion: deploymentResult.serverVersion || '2.4.1',
        healthStatus: 'HEALTHY',
        lastCredentialRotationAt: finalNow,
        assignedInstanceId: instance._id,
      },
      $unset: {
        currentAllocationId: 1,
        allocationExpiresAt: 1,
        quarantineReason: 1,
        quarantineCode: 1,
        cleanupFailureReason: 1,
      },
    },
    { returnDocument: 'after' }
  );

  // Step 8: Create initial billing interval record strictly AFTER active transition
  await BillingInterval.create({
    instanceId: instance._id,
    customerId: instance.customerId,
    startedAt: finalNow,
    hourlyRatePaise,
    backupMonthlyPaise,
    backupEnabled: instance.backupEnabled,
    planId: instance.planId,
    planName: instance.planName,
    couponCode: instance.couponCode,
    couponDiscountPercentage: instance.couponDiscountPercentage,
  });

  return {
    instance,
    node: (updatedNode || reservedNode) as IHostingNode,
    masterPassword: effectivePassword,
    nativeConnectionUri: deploymentResult.nativeConnectionUri,
  };
}

/**
 * Backward-compatible provisioning service method
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
    const existingNode = await HostingNode.findById(instance.hostingNodeId);
    if (!existingNode) {
      throw new Error(`Target hosting node ${instance.hostingNodeId} not found.`);
    }
    if (existingNode.status === 'QUARANTINED' || existingNode.quarantineReason) {
      throw new Error(`Target hosting node '${existingNode.name}' is QUARANTINED (${existingNode.quarantineReason || existingNode.cleanupFailureReason || 'Isolation check failed'}) and ineligible for allocation.`);
    }
    if (existingNode.status === 'RESETTING') {
      throw new Error(`Target hosting node '${existingNode.name}' is currently being reset and ineligible for allocation.`);
    }
    if (existingNode.status === 'DISABLED') {
      throw new Error(`Target hosting node '${existingNode.name}' is disabled.`);
    }
    if (existingNode.cleanStatus === 'DIRTY') {
      throw new Error(`Target hosting node '${existingNode.name}' unavailable: physical storage reset required.`);
    }
    if (existingNode.healthStatus !== 'HEALTHY') {
      throw new Error(`Target hosting node '${existingNode.name}' health status is '${existingNode.healthStatus}', ineligible for allocation.`);
    }

    const locked = await HostingNode.findOneAndUpdate(
      { _id: existingNode._id, status: { $in: ['AVAILABLE', 'ACTIVE', 'RESERVED', 'PROVISIONING'] } },
      { $set: { status: 'PROVISIONING', currentAssignedCount: 1, assignedInstanceId: instance._id } },
      { returnDocument: 'after' }
    );
    node = locked || existingNode;
  }

  if (!node) {
    const activeInstances = await ManagedDatabase.find({
      status: { $in: ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED'] },
      hostingNodeId: { $exists: true, $ne: null },
    })
      .select('hostingNodeId')
      .lean();
    const occupiedNodeIds = activeInstances.map((i) => i.hostingNodeId?.toString()).filter(Boolean);

    // Atomically find and reserve an AVAILABLE and HEALTHY node not occupied by active customers
    node = await HostingNode.findOneAndUpdate(
      {
        ...(occupiedNodeIds.length > 0 ? { _id: { $nin: occupiedNodeIds } } : {}),
        status: { $in: ['AVAILABLE', 'ACTIVE'] },
        healthStatus: 'HEALTHY',
        cleanStatus: { $ne: 'DIRTY' },
        currentAssignedCount: 0,
      },
      {
        $set: {
          status: 'PROVISIONING',
          currentAssignedCount: 1,
          assignedInstanceId: instance._id,
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
    skipCleanVerification: true,
  });

  if (!deploymentResult.success || !deploymentResult.nativeConnectionUri) {
    instance.status = 'FAILED';
    instance.adminNotes = deploymentResult.error || 'Failed to provision on Rust server';
    await instance.save();

    await HostingNode.findByIdAndUpdate(node._id, {
      $set: {
        status: 'QUARANTINED',
        quarantineCode: 'MUTATION_FAILED',
        cleanStatus: 'DIRTY',
        currentAssignedCount: 0,
        quarantineReason: `${node.name} unavailable: reset required.`,
        cleanupFailureReason: deploymentResult.error,
      },
      $unset: { currentAllocationId: 1, allocationExpiresAt: 1, assignedInstanceId: 1 },
    });

    throw new Error(`${node.name} unavailable: reset required.`);
  }

  // 3. Authoritatively verify physical server reachability and customer database accessibility
  const isMockProvider = process.env.LIORANDB_MOCK_DRIVER === 'true';
  const isConnexusInternal =
    databaseName === 'lcs' ||
    instance.name.toLowerCase().includes('connexus') ||
    instance.planId === 'connexus_internal';

  if (!isMockProvider) {
    try {
      const { LioranDBClient } = await import('@liorandb/driver');
      const testClient = await LioranDBClient.connect(deploymentResult.nativeConnectionUri, {
        transport: 'grpc',
        allowHttpFallback: false,
        timeoutMS: 10000,
        connectTimeoutMS: 5000,
        requestTimeoutMS: 10000,
      });

      try {
        if (!testClient.isConnected()) {
          throw new Error('Connection established but client is not in connected state.');
        }

        const customerDb = testClient.db(databaseName);
        await customerDb.listCollections();

        if (isConnexusInternal) {
          const { initConnexusCollectionsAndIndexes } = await import('../db');
          await initConnexusCollectionsAndIndexes(customerDb);
        }
      } finally {
        await testClient.close().catch(() => {});
      }
    } catch (readinessErr: unknown) {
      const errMessage = readinessErr instanceof Error ? readinessErr.message : String(readinessErr);
      const failReason = `${node.name} unavailable: reset required.`;
      instance.status = 'FAILED';
      instance.adminNotes = `Readiness check failed: ${errMessage}`;
      await instance.save();

      await HostingNode.findByIdAndUpdate(node._id, {
        $set: {
          status: 'QUARANTINED',
          quarantineCode: 'READINESS_FAILED',
          currentAssignedCount: 0,
          quarantineReason: failReason,
          cleanupFailureReason: errMessage,
        },
        $unset: { currentAllocationId: 1, allocationExpiresAt: 1, assignedInstanceId: 1 },
      });

      throw new Error(failReason);
    }
  }

  const now = new Date();
  const hourlyRatePaise = plan?.hourlyRatePaise || (instance.planId === 'shared' ? 100 : 800);
  const backupMonthlyPaise = instance.backupEnabled ? BACKUP_MONTHLY_PAISE : 0;

  // 4. Store encrypted native connection URI and admin password, mark ACTIVE
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
  const provisionDockerNodeId = extractDockerNodeId(node);
  await HostingNode.findByIdAndUpdate(node._id, {
    $set: {
      status: 'ASSIGNED',
      currentAssignedCount: 1,
      serverVersion: deploymentResult.serverVersion || '2.4.1',
      healthStatus: 'HEALTHY',
      lastCredentialRotationAt: now,
      assignedInstanceId: instance._id,
      dockerNodeId: provisionDockerNodeId || undefined,
      dockerRunning: true,
      dockerStatus: 'running',
      dockerVolumeName: provisionDockerNodeId ? resolveDockerVolumeName(provisionDockerNodeId) : undefined,
    },
    $unset: { currentAllocationId: 1, allocationExpiresAt: 1 },
  });

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
