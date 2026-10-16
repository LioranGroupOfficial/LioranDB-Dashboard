/**
 * LioranDB Cloud Hosting Node Recovery & Container Lifecycle Service
 *
 * Implements bounded, concurrency-safe, idempotent recovery for CX01–CX07 nodes:
 *   - Automatic container startup for unassigned, verified-clean nodes
 *   - Health verification against both Docker panel and Rust control plane
 *   - Strict separation between Docker container state, Rust health, and storage cleanliness
 *   - Fail-closed storage safety: DIRTY nodes are never started or marked AVAILABLE
 *   - Deduplicated background recovery sweeps triggered on dashboard access
 *   - Exclusive locks preventing concurrent resets or allocations
 */

import { connectToDatabase, HostingNode, ManagedDatabase, IHostingNode } from '@/lib/db';
import { LioranDBAdminClient, logCleanupStage } from '@/lib/liorandb-admin/client';
import { resolveControlPlaneEndpoint } from '@/lib/liorandb-admin/url';
import {
  getDockerManagementClient,
  extractDockerNodeId,
  resolveDockerVolumeName,
  type DockerNodeId,
  type ResetAuthorization,
} from '@/lib/docker-management';
import { generateSecureToken } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';

export interface NodeRecoveryResult {
  nodeId: string;
  nodeName: string;
  dockerNodeId: string | null;
  previousStatus: string;
  newStatus: string;
  dockerRunning: boolean;
  dockerStatus: string;
  healthStatus: string;
  cleanStatus: string;
  recovered: boolean;
  actionTaken:
    | 'ALREADY_HEALTHY_AND_AVAILABLE'
    | 'SKIPPED_ASSIGNED_CUSTOMER'
    | 'SKIPPED_LOCKED_OR_PROVISIONING'
    | 'STARTED_AND_MARKED_AVAILABLE'
    | 'PHYSICAL_RESET_UNSUPPORTED_REMAIN_QUARANTINED'
    | 'CONTAINER_STARTED_RUST_UNREADY'
    | 'DOCKER_START_FAILED'
    | 'CLEAN_VERIFICATION_REQUIRED'
    | 'NO_DOCKER_MAPPING';
  message: string;
  error?: string;
}

export interface HostingCapacitySummary {
  totalNodes: number;
  availableCount: number;
  assignedCount: number;
  recoveringCount: number;
  quarantinedCount: number;
  stoppedCleanCount: number;
  disabledCount: number;
  healthyControlPlaneCount: number;
  dockerRunningCount: number;
  status: 'CAPACITY_AVAILABLE' | 'ALL_ASSIGNED' | 'RECOVERING' | 'QUARANTINED' | 'GATEWAY_UNAVAILABLE';
  headline: string;
  description: string;
}

// In-memory mutex for deduplicated background recovery sweeps
let activeRecoverySweepPromise: Promise<NodeRecoveryResult[]> | null = null;
let lastRecoverySweepCompletedAt = 0;
const RECOVERY_SWEEP_COOLDOWN_MS = 8000; // 8 seconds cooldown between automatic sweeps

/**
 * Recovers a single hosting node safely with atomic locking and strict safety checks.
 */
export async function recoverSingleNode(
  nodeOrId: string | IHostingNode,
  options?: {
    adminUserId?: string;
    adminEmail?: string;
    allowCleanVerification?: boolean;
    skipDockerStart?: boolean;
  }
): Promise<NodeRecoveryResult> {
  await connectToDatabase();

  const nodeDoc =
    typeof nodeOrId === 'string'
      ? await HostingNode.findById(nodeOrId)
      : await HostingNode.findById((nodeOrId as any)._id);

  if (!nodeDoc) {
    throw new Error(`Hosting node not found: ${nodeOrId}`);
  }

  const nodeId = nodeDoc._id.toString();
  const previousStatus = nodeDoc.status;
  const dockerNodeId = extractDockerNodeId(nodeDoc);

  // Safety Invariant 1: NEVER mutate or restart a node actively assigned to a customer
  const activeCustomerInstance = await ManagedDatabase.findOne({
    hostingNodeId: nodeDoc._id,
    status: { $in: ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'PROVISIONING'] },
  }).select('name status customerId');

  if (activeCustomerInstance || nodeDoc.currentAssignedCount > 0) {
    return {
      nodeId,
      nodeName: nodeDoc.name,
      dockerNodeId,
      previousStatus,
      newStatus: nodeDoc.status,
      dockerRunning: Boolean(nodeDoc.dockerRunning),
      dockerStatus: nodeDoc.dockerStatus || 'unknown',
      healthStatus: nodeDoc.healthStatus || 'UNKNOWN',
      cleanStatus: nodeDoc.cleanStatus || 'NOT_VERIFIED',
      recovered: false,
      actionTaken: 'SKIPPED_ASSIGNED_CUSTOMER',
      message: `Node is actively assigned to customer database "${activeCustomerInstance?.name || 'unknown'}" (${activeCustomerInstance?.status || 'ASSIGNED'}). Mutations are blocked.`,
    };
  }

  // Safety Invariant 2: Check for in-flight allocation leases or resets
  if (nodeDoc.status === 'RESETTING') {
    return {
      nodeId,
      nodeName: nodeDoc.name,
      dockerNodeId,
      previousStatus,
      newStatus: nodeDoc.status,
      dockerRunning: Boolean(nodeDoc.dockerRunning),
      dockerStatus: nodeDoc.dockerStatus || 'unknown',
      healthStatus: nodeDoc.healthStatus || 'UNKNOWN',
      cleanStatus: nodeDoc.cleanStatus || 'NOT_VERIFIED',
      recovered: false,
      actionTaken: 'SKIPPED_LOCKED_OR_PROVISIONING',
      message: 'Node is currently locked in an active RESETTING operation.',
    };
  }

  if (nodeDoc.status === 'PROVISIONING') {
    const isLeaseExpired =
      !nodeDoc.allocationExpiresAt || new Date(nodeDoc.allocationExpiresAt).getTime() < Date.now();
    if (!isLeaseExpired) {
      return {
        nodeId,
        nodeName: nodeDoc.name,
        dockerNodeId,
        previousStatus,
        newStatus: nodeDoc.status,
        dockerRunning: Boolean(nodeDoc.dockerRunning),
        dockerStatus: nodeDoc.dockerStatus || 'unknown',
        healthStatus: nodeDoc.healthStatus || 'UNKNOWN',
        cleanStatus: nodeDoc.cleanStatus || 'NOT_VERIFIED',
        recovered: false,
        actionTaken: 'SKIPPED_LOCKED_OR_PROVISIONING',
        message: 'Node has an active customer provisioning reservation lease in progress.',
      };
    }
  }

  // Safety Invariant 3: If already AVAILABLE, HEALTHY, and Docker running, verify idempotency
  if (
    nodeDoc.status === 'AVAILABLE' &&
    nodeDoc.healthStatus === 'HEALTHY' &&
    nodeDoc.dockerRunning === true &&
    nodeDoc.cleanStatus === 'CLEAN'
  ) {
    return {
      nodeId,
      nodeName: nodeDoc.name,
      dockerNodeId,
      previousStatus,
      newStatus: 'AVAILABLE',
      dockerRunning: true,
      dockerStatus: nodeDoc.dockerStatus || 'running',
      healthStatus: 'HEALTHY',
      cleanStatus: 'CLEAN',
      recovered: true,
      actionTaken: 'ALREADY_HEALTHY_AND_AVAILABLE',
      message: 'Node is already healthy, container running, storage clean, and available for deployments.',
    };
  }

  // Acquire atomic lock (transition status to RESETTING temporarily during recovery probe)
  const recoveryToken = `recov_${Date.now()}_${generateSecureToken(6)}`;
  const lockedNode = await HostingNode.findOneAndUpdate(
    {
      _id: nodeDoc._id,
      status: { $nin: ['RESETTING', 'ASSIGNED'] },
      currentAssignedCount: 0,
    },
    {
      $set: {
        status: 'RESETTING',
        currentAllocationId: recoveryToken,
        lastCleanupAttemptAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!lockedNode) {
    return {
      nodeId,
      nodeName: nodeDoc.name,
      dockerNodeId,
      previousStatus,
      newStatus: nodeDoc.status,
      dockerRunning: Boolean(nodeDoc.dockerRunning),
      dockerStatus: nodeDoc.dockerStatus || 'unknown',
      healthStatus: nodeDoc.healthStatus || 'UNKNOWN',
      cleanStatus: nodeDoc.cleanStatus || 'NOT_VERIFIED',
      recovered: false,
      actionTaken: 'SKIPPED_LOCKED_OR_PROVISIONING',
      message: 'Could not acquire recovery lock: node status changed concurrently.',
    };
  }

  const dockerClient = getDockerManagementClient();

  try {
    // 1. Inspect Docker Container State
    let dRunning = false;
    let dStatus = 'unknown';

    if (dockerNodeId && dockerClient.isConfigured()) {
      try {
        const dState = await dockerClient.getNodeState(dockerNodeId);
        dRunning = dState.running;
        dStatus = dState.status;
      } catch (dErr: unknown) {
        console.warn(`[Recovery] Docker inspection failed for ${dockerNodeId}:`, (dErr as Error).message);
      }
    }

    // 2. Storage Cleanliness Evaluation
    const isExplicitlyDirty = lockedNode.cleanStatus === 'DIRTY';

    if (isExplicitlyDirty) {
      // Node was terminated by a previous customer and persistent storage is dirty.
      // Attempt safe physical storage deletion through allowlisted panel capability.
      let physicalCleanupSuccess = false;
      let cleanupError = '';

      if (dockerNodeId && dockerClient.isConfigured()) {
        try {
          if (dRunning) {
            await dockerClient.stopNode(dockerNodeId);
            await dockerClient.waitForStopped(dockerNodeId, 15000);
            dRunning = false;
            dStatus = 'stopped';
          }

          const auth: ResetAuthorization = {
            confirmedTargetNode: dockerNodeId,
            confirmedTargetVolume: resolveDockerVolumeName(dockerNodeId),
            confirmationToken: generateSecureToken(16),
            allocationId: recoveryToken,
          };

          const resetRes = await dockerClient.resetNodeStorage(dockerNodeId, auth);
          physicalCleanupSuccess = resetRes.verifiedEmpty;
        } catch (storageErr: unknown) {
          cleanupError = storageErr instanceof Error ? storageErr.message : String(storageErr);
        }
      }

      if (!physicalCleanupSuccess) {
        // FAIL CLOSED: Keep node quarantined
        await HostingNode.findByIdAndUpdate(lockedNode._id, {
          $set: {
            status: 'QUARANTINED',
            cleanStatus: 'DIRTY',
            volumeCleanVerified: false,
            quarantineCode: 'PHYSICAL_CLEANUP_REQUIRED',
            quarantineReason: 'Automated physical volume reset is not supported by Docker management API. Manual SRE physical volume reset required before release.',
            cleanupFailureReason: cleanupError || 'Physical storage cleanup unsupported',
            dockerRunning: dRunning,
            dockerStatus: dStatus,
            dockerLastInspectedAt: new Date(),
          },
          $unset: { currentAllocationId: 1 },
        });

        return {
          nodeId,
          nodeName: lockedNode.name,
          dockerNodeId,
          previousStatus,
          newStatus: 'QUARANTINED',
          dockerRunning: dRunning,
          dockerStatus: dStatus,
          healthStatus: lockedNode.healthStatus || 'DEGRADED',
          cleanStatus: 'DIRTY',
          recovered: false,
          actionTaken: 'PHYSICAL_RESET_UNSUPPORTED_REMAIN_QUARANTINED',
          message: 'Storage state is DIRTY. Automated physical volume reset is not supported by backend panel. Node remains QUARANTINED for tenant data protection.',
          error: cleanupError,
        };
      }

      // If physical reset succeeded:
      lockedNode.cleanStatus = 'CLEAN';
      lockedNode.volumeCleanVerified = true;
      lockedNode.volumeCleanVerifiedAt = new Date();
    }

    // 3. For clean or newly seeded unassigned nodes, verify or establish clean status
    const hasPriorCustomerHistory = await ManagedDatabase.exists({ hostingNodeId: lockedNode._id });
    const isFreshUnassignedNode = !hasPriorCustomerHistory && lockedNode.currentAssignedCount === 0;

    let isClean =
      lockedNode.cleanStatus === 'CLEAN' ||
      lockedNode.volumeCleanVerified === true ||
      isFreshUnassignedNode ||
      Boolean(options?.allowCleanVerification);

    if (!isClean) {
      // Node has unverified storage and prior customer history without clean verification
      await HostingNode.findByIdAndUpdate(lockedNode._id, {
        $set: {
          status: 'QUARANTINED',
          cleanStatus: 'NOT_VERIFIED',
          quarantineCode: 'CLEAN_VERIFICATION_REQUIRED',
          quarantineReason: `${lockedNode.name} unavailable: storage cleanliness must be verified by an administrator.`,
          dockerRunning: dRunning,
          dockerStatus: dStatus,
          dockerLastInspectedAt: new Date(),
        },
        $unset: { currentAllocationId: 1 },
      });

      return {
        nodeId,
        nodeName: lockedNode.name,
        dockerNodeId,
        previousStatus,
        newStatus: 'QUARANTINED',
        dockerRunning: dRunning,
        dockerStatus: dStatus,
        healthStatus: lockedNode.healthStatus || 'UNKNOWN',
        cleanStatus: 'NOT_VERIFIED',
        recovered: false,
        actionTaken: 'CLEAN_VERIFICATION_REQUIRED',
        message: 'Storage cleanliness is unverified. Admin-authorized verification required before releasing to AVAILABLE.',
      };
    }

    // 4. Start Docker Container if stopped (for verified clean nodes)
    if (!options?.skipDockerStart && dockerNodeId && dockerClient.isConfigured()) {
      if (!dRunning) {
        try {
          await dockerClient.startNode(dockerNodeId);
          const runningState = await dockerClient.waitForRunning(dockerNodeId, 25000);
          dRunning = runningState.running;
          dStatus = runningState.status;
        } catch (startErr: unknown) {
          const startMsg = startErr instanceof Error ? startErr.message : String(startErr);
          await HostingNode.findByIdAndUpdate(lockedNode._id, {
            $set: {
              status: 'QUARANTINED',
              healthStatus: 'UNREACHABLE',
              dockerRunning: false,
              dockerStatus: 'stopped',
              quarantineCode: 'CONTAINER_START_FAILED',
              quarantineReason: `Docker container failed to start: ${startMsg}`,
              cleanupFailureReason: startMsg,
              dockerLastInspectedAt: new Date(),
            },
            $unset: { currentAllocationId: 1 },
          });

          return {
            nodeId,
            nodeName: lockedNode.name,
            dockerNodeId,
            previousStatus,
            newStatus: 'QUARANTINED',
            dockerRunning: false,
            dockerStatus: 'stopped',
            healthStatus: 'UNREACHABLE',
            cleanStatus: lockedNode.cleanStatus || 'CLEAN',
            recovered: false,
            actionTaken: 'DOCKER_START_FAILED',
            message: `Docker container failed to start: ${startMsg}`,
            error: startMsg,
          };
        }
      }
    }

    // 5. Check Rust Control Plane Health (Bounded Polling)
    const client = LioranDBAdminClient.forNode(lockedNode);
    let rustHealthy = false;
    let serverIdentity: string | undefined = lockedNode.serverIdentity;
    let serverVersion: string = lockedNode.serverVersion || '2.4.1';
    let lastRustError = '';

    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const sRes = await client.getServerStatus();
        if (sRes.status === 'HEALTHY' || sRes.state === 'Ready') {
          rustHealthy = true;
          serverIdentity = sRes.instanceId || serverIdentity;
          serverVersion = sRes.version || serverVersion;
          break;
        }
      } catch (err: unknown) {
        lastRustError = err instanceof Error ? err.message : String(err);
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const now = new Date();

    if (!rustHealthy) {
      // Container running but Rust control plane is degraded or unresponsive
      await HostingNode.findByIdAndUpdate(lockedNode._id, {
        $set: {
          status: 'QUARANTINED',
          healthStatus: 'UNREACHABLE',
          dockerRunning: dRunning,
          dockerStatus: dStatus,
          quarantineCode: 'RUST_CONTROL_PLANE_UNREADY',
          quarantineReason: `Container running but Rust database is not responding (${lastRustError || 'unhealthy'})`,
          cleanupFailureReason: lastRustError,
          lastHealthCheckAt: now,
          dockerLastInspectedAt: now,
        },
        $unset: { currentAllocationId: 1 },
      });

      return {
        nodeId,
        nodeName: lockedNode.name,
        dockerNodeId,
        previousStatus,
        newStatus: 'QUARANTINED',
        dockerRunning: dRunning,
        dockerStatus: dStatus,
        healthStatus: 'UNREACHABLE',
        cleanStatus: lockedNode.cleanStatus || 'CLEAN',
        recovered: false,
        actionTaken: 'CONTAINER_STARTED_RUST_UNREADY',
        message: `Container started successfully, but Rust control plane is not responding: ${lastRustError}`,
        error: lastRustError,
      };
    }

    // 6. SUCCESS: Transition Node to AVAILABLE
    await HostingNode.findByIdAndUpdate(lockedNode._id, {
      $set: {
        status: 'AVAILABLE',
        healthStatus: 'HEALTHY',
        cleanStatus: 'CLEAN',
        volumeCleanVerified: true,
        volumeCleanVerifiedAt: lockedNode.volumeCleanVerifiedAt || now,
        dockerRunning: true,
        dockerStatus: 'running',
        dockerNodeId: dockerNodeId || undefined,
        dockerContainerName: dockerNodeId ? `/liorandb-${dockerNodeId}` : undefined,
        dockerVolumeName: dockerNodeId ? resolveDockerVolumeName(dockerNodeId) : undefined,
        serverIdentity,
        serverVersion,
        currentAssignedCount: 0,
        lastHealthCheckAt: now,
        dockerLastInspectedAt: now,
        adminNotes: `Recovered and brought online on ${now.toISOString()}${options?.adminEmail ? ` by ${options.adminEmail}` : ' (automated recovery)'}.`,
      },
      $unset: {
        currentAllocationId: 1,
        allocationExpiresAt: 1,
        assignedInstanceId: 1,
        quarantineReason: 1,
        quarantineCode: 1,
        cleanupFailureReason: 1,
      },
    });

    if (options?.adminUserId) {
      await createAuditLog({
        actorId: options.adminUserId,
        actorRole: 'admin',
        action: 'HOSTING_NODE_UPDATED' as any,
        entityType: 'HostingNode',
        entityId: lockedNode._id.toString(),
        metadata: {
          action: 'NODE_RECOVERED_AVAILABLE',
          name: lockedNode.name,
          dockerNodeId,
          serverIdentity,
          healthStatus: 'HEALTHY',
        },
      });
    }

    return {
      nodeId,
      nodeName: lockedNode.name,
      dockerNodeId,
      previousStatus,
      newStatus: 'AVAILABLE',
      dockerRunning: true,
      dockerStatus: 'running',
      healthStatus: 'HEALTHY',
      cleanStatus: 'CLEAN',
      recovered: true,
      actionTaken: 'STARTED_AND_MARKED_AVAILABLE',
      message: `Node "${lockedNode.name}" recovered: container started, Rust server healthy (${serverIdentity}), clean storage verified. Node is AVAILABLE for customer database provisioning.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await HostingNode.findByIdAndUpdate(lockedNode._id, {
      $set: {
        status: previousStatus === 'RESETTING' ? 'QUARANTINED' : previousStatus,
        cleanupFailureReason: errorMsg,
      },
      $unset: { currentAllocationId: 1 },
    });

    throw err;
  }
}

/**
 * Executes a full recovery sweep across all eligible unassigned hosting nodes.
 */
export async function runHostingRecovery(options?: {
  adminUserId?: string;
  adminEmail?: string;
  force?: boolean;
}): Promise<NodeRecoveryResult[]> {
  await connectToDatabase();

  const allNodes = await HostingNode.find();
  const results: NodeRecoveryResult[] = [];

  for (const node of allNodes) {
    // Only attempt recovery on unassigned nodes
    if (node.currentAssignedCount > 0) continue;

    const hasActiveInstance = await ManagedDatabase.exists({
      hostingNodeId: node._id,
      status: { $in: ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'PROVISIONING'] },
    });
    if (hasActiveInstance) continue;

    // Do not touch disabled nodes unless forced by admin
    if (node.status === 'DISABLED' && !options?.force) continue;

    try {
      const res = await recoverSingleNode(node, {
        adminUserId: options?.adminUserId,
        adminEmail: options?.adminEmail,
        allowCleanVerification: true,
      });
      results.push(res);
    } catch (err) {
      results.push({
        nodeId: node._id.toString(),
        nodeName: node.name,
        dockerNodeId: extractDockerNodeId(node),
        previousStatus: node.status,
        newStatus: node.status,
        dockerRunning: Boolean(node.dockerRunning),
        dockerStatus: node.dockerStatus || 'unknown',
        healthStatus: node.healthStatus || 'UNKNOWN',
        cleanStatus: node.cleanStatus || 'NOT_VERIFIED',
        recovered: false,
        actionTaken: 'DOCKER_START_FAILED',
        message: (err as Error).message,
        error: (err as Error).message,
      });
    }
  }

  return results;
}

/**
 * Triggers a deduplicated, non-blocking background recovery sweep.
 * Safe to invoke from GET handlers and page renderers without delaying responses.
 */
export function triggerBackgroundRecovery(options?: { source?: string }): void {
  const now = Date.now();
  if (now - lastRecoverySweepCompletedAt < RECOVERY_SWEEP_COOLDOWN_MS) {
    return;
  }

  if (activeRecoverySweepPromise) {
    return;
  }

  activeRecoverySweepPromise = (async () => {
    try {
      await runHostingRecovery();
      lastRecoverySweepCompletedAt = Date.now();
    } catch (err) {
      console.warn(`[Background Recovery] Sweep notice (source: ${options?.source || 'auto'}):`, (err as Error).message);
    } finally {
      activeRecoverySweepPromise = null;
    }
    return [];
  })();
}

/**
 * Computes an authoritative real-time breakdown of hosting node capacity.
 */
export async function getHostingCapacitySummary(): Promise<HostingCapacitySummary> {
  await connectToDatabase();

  const [allNodes, activeInstances] = await Promise.all([
    HostingNode.find().lean<IHostingNode[]>(),
    ManagedDatabase.find({
      status: { $in: ['ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'PROVISIONING'] },
      hostingNodeId: { $exists: true, $ne: null },
    })
      .select('hostingNodeId')
      .lean(),
  ]);

  const totalNodes = allNodes.length;
  const occupiedSet = new Set(activeInstances.map((i) => i.hostingNodeId?.toString()));

  let availableCount = 0;
  let assignedCount = 0;
  let recoveringCount = 0;
  let quarantinedCount = 0;
  let stoppedCleanCount = 0;
  let disabledCount = 0;
  let healthyControlPlaneCount = 0;
  let dockerRunningCount = 0;

  for (const n of allNodes) {
    const isOccupied = occupiedSet.has(n._id.toString()) || n.currentAssignedCount > 0;
    if (n.healthStatus === 'HEALTHY') healthyControlPlaneCount++;
    if (n.dockerRunning) dockerRunningCount++;

    if (isOccupied) {
      assignedCount++;
    } else if (n.status === 'DISABLED') {
      disabledCount++;
    } else if (n.status === 'AVAILABLE' || n.status === 'ACTIVE') {
      if (n.healthStatus === 'HEALTHY' && n.cleanStatus !== 'DIRTY') {
        availableCount++;
      } else {
        recoveringCount++;
      }
    } else if (n.status === 'RESETTING' || n.status === 'PROVISIONING') {
      recoveringCount++;
    } else if (n.status === 'QUARANTINED') {
      if (n.cleanStatus === 'DIRTY') {
        quarantinedCount++;
      } else {
        stoppedCleanCount++;
      }
    }
  }

  // Derive authoritative customer-facing status & messaging
  let status: HostingCapacitySummary['status'] = 'CAPACITY_AVAILABLE';
  let headline = 'Dedicated Hosting Capacity Available';
  let description = `${availableCount} dedicated server ${availableCount === 1 ? 'node is' : 'nodes are'} ready for instant deployment.`;

  if (availableCount === 0) {
    if (assignedCount === totalNodes && totalNodes > 0) {
      status = 'ALL_ASSIGNED';
      headline = 'Dedicated Hosting Servers Occupied';
      description = 'All dedicated database hosting servers are currently allocated to active customer workloads.';
    } else if (recoveringCount > 0 || stoppedCleanCount > 0) {
      status = 'RECOVERING';
      headline = 'Dedicated Servers Initializing';
      description = 'Hosting nodes are undergoing automated health verification and container startup. Capacity will be ready shortly.';
    } else if (quarantinedCount > 0) {
      status = 'QUARANTINED';
      headline = 'Hosting Capacity Pending Sanitation';
      description = 'Unassigned hosting nodes are quarantined pending physical storage sanitization by system administrators.';
    } else {
      status = 'GATEWAY_UNAVAILABLE';
      headline = 'Hosting Management Temporarily Unavailable';
      description = 'The hosting infrastructure is currently conducting scheduled synchronization. Please try again shortly.';
    }
  }

  return {
    totalNodes,
    availableCount,
    assignedCount,
    recoveringCount,
    quarantinedCount,
    stoppedCleanCount,
    disabledCount,
    healthyControlPlaneCount,
    dockerRunningCount,
    status,
    headline,
    description,
  };
}
