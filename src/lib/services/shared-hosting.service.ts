import { connectToDatabase, FreeInstanceNameReservation, HostingNode, ManagedDatabase, User } from '@/lib/db';
import type { IHostingNode } from '@/lib/db/models/HostingNode';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';
import { encrypt, decrypt, generateSecureToken } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { LioranDBAdminError, LioranDBNotFoundError } from '@/lib/liorandb-admin/errors';
import { createSharedHostingClient } from '@/lib/liorandb-admin/tenant-client';
import { buildLioranDBConnectionUri, parseLioranDBConnectionUri } from '@/lib/liorandb-admin/uri';
import {
  FREE_SHARED_CPU_CORES,
  FREE_SHARED_MEMORY_BYTES,
  FREE_SHARED_PLAN_ID,
  FREE_SHARED_STORAGE_BYTES,
  formatBytes,
  getSharedRecordLogicalDatabaseName,
  getSharedTenantLogicalDatabaseName,
  getSharedTenantPhysicalDatabaseName,
} from '@/lib/liorandb-admin/shared-hosting';
import type {
  CreateTenantResult,
  RustSharedHostingStatus,
  RustSharedHostingStorage,
  RustTenant,
  RustTenantUsage,
  TenantActionResult,
  TenantCredentialRotation,
} from '@/lib/liorandb-admin/tenant-types';
import {
  bindHostingReservationToInstance,
  finalizeHostingNodeSlot,
  ensureHostingNodeAllocationReservations,
  releaseHostingNodeAssignment,
  releaseHostingNodeReservation,
  reserveHostingNodeSlot,
} from '@/lib/hosting/allocation';

export interface SharedHostingContext {
  node: Partial<IHostingNode> & { _id: unknown };
  client: ReturnType<typeof createSharedHostingClient>;
}

export interface OwnedSharedTenant {
  tenant: RustTenant;
  usage?: RustTenantUsage;
  database?: {
    id: string;
    name: string;
    databaseName: string;
    status: string;
    host: string;
    port: number;
    region?: string;
    connectionUri?: string;
    storageQuotaBytes?: number;
    storageUsedBytes?: number;
  };
}

export function getManagedSharedTenantId(
  record: Pick<IManagedDatabase, 'sharedTenantId' | 'providerDeploymentId'>,
): string | undefined {
  return record.sharedTenantId || record.providerDeploymentId;
}

export interface SharedHostingSnapshot {
  status: RustSharedHostingStatus;
  storage: RustSharedHostingStorage;
  serverStatus: {
    status: string;
    version: string;
    memoryBytesUsed?: number;
    uptimeSeconds: number;
  };
  nodeName: string;
  measuredAt: string;
}

const FREE_INSTANCE_NAME_MAX_RETRIES = 8;

function isPersistentConflict(error: unknown): boolean {
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown } | null;
  const message = String(candidate?.message || '').toLowerCase();
  return candidate?.code === 'LDB_CONFLICT'
    || candidate?.status === 409
    || message.includes('already exists')
    || message.includes('duplicate')
    || message.includes('conflict');
}

async function reserveFreeInstanceName(ownerId: string, requestKey: string): Promise<string> {
  await connectToDatabase();

  const existingReservation = await FreeInstanceNameReservation.findOne({ requestKey }).lean();
  if (existingReservation) {
    if (existingReservation.ownerId.toString() !== ownerId) {
      throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'free-instance-name-owner-check' });
    }
    return existingReservation.name;
  }

  for (let attempt = 0; attempt < FREE_INSTANCE_NAME_MAX_RETRIES; attempt += 1) {
    // generateSecureToken uses crypto.randomBytes; four bytes produce the
    // required eight lowercase hexadecimal characters without personal data.
    const name = `free-${generateSecureToken(4)}`;

    // Protect names from allocations created before this reservation collection
    // existed. The reservation's unique index handles concurrent new requests.
    const legacyName = await ManagedDatabase.findOne({ planId: FREE_SHARED_PLAN_ID, name });
    if (legacyName) continue;

    try {
      await FreeInstanceNameReservation.create({
        name,
        ownerId,
        requestKey,
      });
      return name;
    } catch (error: unknown) {
      // A concurrent request may have won this request key or name. Reuse the
      // request-key reservation when available; otherwise retry a new name.
      const requestReservation = await FreeInstanceNameReservation.findOne({ requestKey }).lean();
      if (requestReservation) {
        if (requestReservation.ownerId.toString() !== ownerId) {
          throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'free-instance-name-owner-check' });
        }
        return requestReservation.name;
      }
      if (!isPersistentConflict(error)) throw error;
    }
  }

  throw new Error('FREE_INSTANCE_NAME_GENERATION_EXHAUSTED');
}

export async function getSharedHostingContext(): Promise<SharedHostingContext> {
  await connectToDatabase();
  const node = await HostingNode.findOne({
    allocationMode: 'SHARED',
    status: { $nin: ['DISABLED', 'FAILED', 'QUARANTINED', 'MAINTENANCE'] },
  })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();

  if (!node) {
    throw new LioranDBNotFoundError('No shared hosting node is configured.', { requestId: 'shared-hosting-node' });
  }

  return {
    node: node as Partial<IHostingNode> & { _id: unknown },
    client: createSharedHostingClient(node as Partial<IHostingNode> & { _id: unknown }),
  };
}

async function getSharedHostingContextForRecord(record: Pick<IManagedDatabase, 'hostingNodeId'>): Promise<SharedHostingContext> {
  if (!record.hostingNodeId) {
    throw new LioranDBAdminError('Shared allocation is missing its shared-server mapping.', {
      code: 'SHARED_TENANT_MAPPING_INCOMPLETE',
      statusCode: 409,
    });
  }
  const node = await HostingNode.findById(record.hostingNodeId).lean();
  if (!node || node.allocationMode !== 'SHARED') {
    throw new LioranDBAdminError('Shared allocation is not mapped to a shared hosting server.', {
      code: 'SHARED_TENANT_MAPPING_INCOMPLETE',
      statusCode: 409,
    });
  }
  return {
    node: node as Partial<IHostingNode> & { _id: unknown },
    client: createSharedHostingClient(node as Partial<IHostingNode> & { _id: unknown }),
  };
}

async function getSharedTenantFromControlPlane(
  context: SharedHostingContext,
  tenantId: string,
): Promise<RustTenant> {
  try {
    return await context.client.getSharedTenant(tenantId);
  } catch (error: unknown) {
    if (error instanceof LioranDBAdminError && error.statusCode === 404) {
      throw new LioranDBAdminError('The Dashboard allocation is not present in the Rust tenant registry.', {
        code: 'SHARED_TENANT_REGISTRY_MISSING',
        statusCode: 409,
        requestId: error.requestId,
      });
    }
    if (error instanceof LioranDBAdminError && error.statusCode >= 500) {
      // Some Rust versions can fail the single-tenant serializer while the
      // registry listing remains available. Use that read-only listing only
      // as a compatibility fallback, then apply the normal owner assertion.
      try {
        const listedTenant = (await context.client.listSharedTenants()).find(
          (candidate) => candidate.tenant_id === tenantId,
        );
        if (listedTenant) return listedTenant;
      } catch {
        // Preserve the original classified control-plane failure below.
      }
      throw new LioranDBAdminError('The Rust tenant registry is temporarily unavailable.', {
        code: 'SHARED_TENANT_REGISTRY_UNAVAILABLE',
        statusCode: 503,
        requestId: error.requestId,
      });
    }
    throw error;
  }
}

async function getSharedHostingContexts(): Promise<SharedHostingContext[]> {
  await connectToDatabase();
  const nodes = await HostingNode.find({
    allocationMode: 'SHARED',
    status: { $nin: ['DISABLED', 'FAILED', 'QUARANTINED', 'MAINTENANCE'] },
    healthStatus: 'HEALTHY',
  }).sort({ isDefault: -1, createdAt: 1 }).lean();
  return nodes.map((node) => ({
    node: node as Partial<IHostingNode> & { _id: unknown },
    client: createSharedHostingClient(node as Partial<IHostingNode> & { _id: unknown }),
  }));
}

export async function getSharedHostingSnapshot(): Promise<SharedHostingSnapshot> {
  const context = await getSharedHostingContext();
  const [status, storage, serverStatus] = await Promise.all([
    context.client.getSharedHostingStatus(),
    context.client.getSharedHostingStorage(),
    context.client.getServerStatus(),
  ]);

  return {
    status,
    storage,
    serverStatus: {
      status: serverStatus.status,
      version: serverStatus.version,
      memoryBytesUsed: serverStatus.memoryBytesUsed,
      uptimeSeconds: serverStatus.uptimeSeconds,
    },
    nodeName: String(context.node.name || 'Shared hosting pool'),
    measuredAt: new Date().toISOString(),
  };
}

export async function listSharedTenants(): Promise<RustTenant[]> {
  const { client } = await getSharedHostingContext();
  return client.listSharedTenants();
}

export interface SharedHostingConsistencyIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  nodeId?: string;
  tenantId?: string;
  allocationId?: string;
  message: string;
}

export interface SharedHostingConsistencyReport {
  checkedAt: string;
  nodesChecked: number;
  allocationsChecked: number;
  issues: SharedHostingConsistencyIssue[];
}

/**
 * Read-only Dashboard/Rust mapping inspection. This intentionally never
 * creates, updates, deletes, rotates, or reprovisions any resource.
 */
export async function inspectSharedHostingConsistency(): Promise<SharedHostingConsistencyReport> {
  await connectToDatabase();
  const [nodes, records] = await Promise.all([
    HostingNode.find({
      allocationMode: 'SHARED',
      status: { $nin: ['DISABLED', 'MAINTENANCE'] },
    }).lean<IHostingNode[]>(),
    ManagedDatabase.find({
      $or: [{ type: 'shared' }, { planId: FREE_SHARED_PLAN_ID }],
      status: { $nin: ['TERMINATED', 'DELETED'] },
    }).lean(),
  ]);
  const issues: SharedHostingConsistencyIssue[] = [];
  const nodeById = new Map(nodes.map((node) => [node._id.toString(), node]));
  const recordsByTenant = new Map<string, IManagedDatabase[]>();

  for (const record of records) {
    const allocationId = record._id.toString();
    const tenantId = getManagedSharedTenantId(record);
    const nodeId = record.hostingNodeId?.toString();
    if (!tenantId) {
      issues.push({
        code: 'DASHBOARD_TENANT_ID_MISSING',
        severity: 'ERROR',
        allocationId,
        message: 'Dashboard shared allocation has no immutable Rust tenant ID.',
      });
    } else {
      const existing = recordsByTenant.get(tenantId) || [];
      existing.push(record);
      recordsByTenant.set(tenantId, existing);
    }
    if (!nodeId || !nodeById.has(nodeId)) {
      issues.push({
        code: 'DASHBOARD_SHARED_SERVER_MAPPING_MISSING',
        severity: 'ERROR',
        allocationId,
        tenantId,
        message: 'Dashboard shared allocation is not mapped to a known shared hosting server.',
      });
    } else if (nodeById.get(nodeId)?.allocationMode !== 'SHARED') {
      issues.push({
        code: 'DASHBOARD_SHARED_SERVER_MAPPING_INVALID',
        severity: 'ERROR',
        allocationId,
        tenantId,
        nodeId,
        message: 'Dashboard shared allocation points to a non-shared hosting server.',
      });
    }
    if (!record.encryptedControlPlaneCredential || !record.encryptedConnectionUri) {
      issues.push({
        code: 'DASHBOARD_CREDENTIAL_STATE_INCOMPLETE',
        severity: 'WARNING',
        allocationId,
        tenantId,
        message: 'Dashboard allocation is missing an encrypted credential or connection reference.',
      });
    }
  }

  for (const [tenantId, tenantRecords] of recordsByTenant) {
    if (tenantRecords.length > 1) {
      issues.push({
        code: 'DUPLICATE_DASHBOARD_TENANT_MAPPING',
        severity: 'ERROR',
        tenantId,
        message: 'Multiple Dashboard allocations reference the same Rust tenant ID.',
      });
    }
  }

  const seenRustTenants = new Map<string, string>();
  for (const node of nodes) {
    const nodeId = node._id.toString();
    const client = createSharedHostingClient(node);
    let tenants: RustTenant[];
    try {
      tenants = await client.listSharedTenants();
    } catch (error: unknown) {
      issues.push({
        code: 'RUST_TENANT_REGISTRY_UNAVAILABLE',
        severity: 'ERROR',
        nodeId,
        message: error instanceof LioranDBAdminError && error.statusCode >= 500
          ? 'Rust tenant registry could not be read for this shared hosting server.'
          : 'Rust tenant registry read failed for this shared hosting server.',
      });
      continue;
    }

    for (const tenant of tenants) {
      const previousNodeId = seenRustTenants.get(tenant.tenant_id);
      if (previousNodeId && previousNodeId !== nodeId) {
        issues.push({
          code: 'DUPLICATE_RUST_TENANT_ID',
          severity: 'ERROR',
          nodeId,
          tenantId: tenant.tenant_id,
          message: 'The same Rust tenant ID was returned by multiple shared hosting servers.',
        });
      }
      seenRustTenants.set(tenant.tenant_id, nodeId);

      const tenantRecords = recordsByTenant.get(tenant.tenant_id) || [];
      if (tenantRecords.length === 0) {
        issues.push({
          code: 'RUST_TENANT_WITHOUT_DASHBOARD_MAPPING',
          severity: 'ERROR',
          nodeId,
          tenantId: tenant.tenant_id,
          message: 'Rust has a tenant allocation with no Dashboard allocation mapping.',
        });
        continue;
      }

      for (const record of tenantRecords) {
        const allocationId = record._id.toString();
        const localOwner = record.customerId.toString();
        if (tenant.external_owner_id !== localOwner && tenant.external_owner_id !== record.userId?.toString()) {
          issues.push({
            code: 'TENANT_OWNER_MISMATCH',
            severity: 'ERROR',
            nodeId,
            tenantId: tenant.tenant_id,
            allocationId,
            message: 'Rust tenant owner does not match the Dashboard allocation owner.',
          });
        }
        if (record.hostingNodeId?.toString() !== nodeId) {
          issues.push({
            code: 'TENANT_SHARED_SERVER_MISMATCH',
            severity: 'ERROR',
            nodeId,
            tenantId: tenant.tenant_id,
            allocationId,
            message: 'Dashboard allocation points to a different shared hosting server.',
          });
        }
        try {
          const logicalName = getSharedTenantLogicalDatabaseName(tenant, record.name);
          const dashboardLogicalName = getSharedRecordLogicalDatabaseName(record);
          if (logicalName !== dashboardLogicalName) {
            issues.push({
              code: 'LOGICAL_DATABASE_MAPPING_MISMATCH',
              severity: 'ERROR',
              nodeId,
              tenantId: tenant.tenant_id,
              allocationId,
              message: 'Dashboard and Rust disagree on the assigned logical database name.',
            });
          }
        } catch {
          issues.push({
            code: 'LOGICAL_DATABASE_MAPPING_UNAVAILABLE',
            severity: 'ERROR',
            nodeId,
            tenantId: tenant.tenant_id,
            allocationId,
            message: 'The logical database mapping could not be resolved safely.',
          });
        }
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    nodesChecked: nodes.length,
    allocationsChecked: records.length,
    issues,
  };
}

export async function listOwnedSharedTenants(ownerId: string, includeUsage = false): Promise<OwnedSharedTenant[]> {
  const contexts = await getSharedHostingContexts();
  const tenantContexts = (await Promise.all(contexts.map(async (context) => ({ context, tenants: await context.client.listSharedTenants() })))).flatMap(({ context, tenants }) =>
    tenants.filter((tenant) => tenant.external_owner_id === ownerId).map((tenant) => ({ context, tenant }))
  );
  await connectToDatabase();

  const records = await ManagedDatabase.find({
    $and: [
      {
        $or: [
          { sharedTenantId: { $in: tenantContexts.map(({ tenant }) => tenant.tenant_id) } },
          { providerDeploymentId: { $in: tenantContexts.map(({ tenant }) => tenant.tenant_id) } },
        ],
      },
      { $or: [{ customerId: ownerId }, { userId: ownerId }] },
    ],
  }).lean();
  const recordByTenant = new Map(records.map((record) => [getManagedSharedTenantId(record), record]));

  return Promise.all(
    tenantContexts.map(async ({ tenant, context }) => {
      const record = recordByTenant.get(tenant.tenant_id);
      const synchronizedRecord = record
        ? await upsertManagedDatabaseForTenant(context.node, { tenant }, ownerId, record.allocationToken)
        : undefined;
      const usage = includeUsage ? await getVerifiedTenantUsage(context.client, tenant.tenant_id) : undefined;
      return { tenant, usage, database: synchronizedRecord ? databaseView(synchronizedRecord) : undefined };
    })
  );
}

export async function getOwnedSharedTenant(ownerId: string, tenantId: string, includeUsage = true): Promise<OwnedSharedTenant> {
  await connectToDatabase();
  const record = await ManagedDatabase.findOne({
    $and: [
      { $or: [{ sharedTenantId: tenantId }, { providerDeploymentId: tenantId }] },
      { $or: [{ customerId: ownerId }, { userId: ownerId }] },
    ],
  }).lean();
  if (!record) {
    throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'shared-tenant-owner-check' });
  }
  const context = await getSharedHostingContextForRecord(record);
  const tenant = await getSharedTenantFromControlPlane(context, tenantId);
  assertTenantOwner(tenant, ownerId);
  const usage = includeUsage ? await getVerifiedTenantUsage(context.client, tenant.tenant_id) : undefined;
  const synchronizedRecord = await upsertManagedDatabaseForTenant(context.node, { tenant }, ownerId, record.allocationToken);
  return { tenant, usage, database: databaseView(synchronizedRecord) };
}

/**
 * Read usage without requiring the control-plane tenant detail response.
 * Some Rust deployments can serve tenant usage while the legacy tenant detail
 * serializer is unavailable. The local allocation ownership check remains
 * mandatory before the Rust request is made.
 */
export async function getOwnedSharedTenantUsage(ownerId: string, tenantId: string): Promise<RustTenantUsage> {
  await connectToDatabase();
  const record = await ManagedDatabase.findOne({
    $and: [
      { $or: [{ sharedTenantId: tenantId }, { providerDeploymentId: tenantId }] },
      { $or: [{ customerId: ownerId }, { userId: ownerId }] },
    ],
  }).lean();
  if (!record) {
    throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'shared-tenant-usage-owner-check' });
  }

  const context = await getSharedHostingContextForRecord(record);
  return getVerifiedTenantUsage(context.client, tenantId);
}

export async function provisionFreeSharedTenant(params: {
  ownerId: string;
  ownerEmail?: string;
  idempotencyKey?: string;
}): Promise<OwnedSharedTenant & { credentials?: { username: string; password: string } }> {
  await connectToDatabase();
  const requestKey = params.idempotencyKey || `cloud-${params.ownerId}-${generateSecureToken(18)}`;
  const existingRecord = await ManagedDatabase.findOne({
    $or: [{ customerId: params.ownerId }, { userId: params.ownerId }],
    planId: FREE_SHARED_PLAN_ID,
    status: { $nin: ['TERMINATED', 'DELETED'] },
  }).lean();
  if (existingRecord) {
    const existingTenantId = getManagedSharedTenantId(existingRecord);
    if (!existingTenantId) throw new Error('FREE_TIER_ALREADY_ALLOCATED');
    const context = await getSharedHostingContextForRecord(existingRecord);
    const tenant = await getSharedTenantFromControlPlane(context, existingTenantId);
    assertTenantOwner(tenant, params.ownerId);
    const record = await upsertManagedDatabaseForTenant(
      context.node,
      { tenant },
      params.ownerId,
      existingRecord.allocationToken,
      (await FreeInstanceNameReservation.findOne({ requestKey }).lean())?.name,
    );
    const pendingReservation = (await ensureHostingNodeAllocationReservations(context.node)).find(
      (item) => item.token === existingRecord.allocationToken && item.state === 'PENDING'
    );
    if (pendingReservation) {
      await finalizeHostingNodeSlot({ nodeId: String(context.node._id), token: pendingReservation.token, instanceId: existingRecord._id.toString() });
    }
    return { tenant, database: databaseView(record) };
  }

  const contexts = await getSharedHostingContexts();
  if (contexts.length === 0) throw new LioranDBNotFoundError('No healthy shared hosting node is configured.', { requestId: 'shared-hosting-node' });

  // An atomic per-customer claim prevents two distinct requests from creating
  // two free databases for the same customer while the Rust call is in flight.
  const lockClaim = await User.updateOne(
    {
      _id: params.ownerId,
      $or: [
        { freeSharedProvisioningKey: { $exists: false } },
        { freeSharedProvisioningKey: null },
        { freeSharedProvisioningKey: requestKey },
      ],
    },
    { $set: { freeSharedProvisioningKey: requestKey } }
  );
  if (lockClaim.matchedCount !== 1) throw new Error('FREE_TIER_ALREADY_ALLOCATED');

  try {
    for (const context of contexts) {
      const tenants = await context.client.listSharedTenants();
      const existing = tenants.find((tenant) => tenant.external_owner_id === params.ownerId && tenant.status !== 'DELETING');
      if (existing) {
        const reservedName = (await FreeInstanceNameReservation.findOne({ requestKey }).lean())?.name;
        const record = await upsertManagedDatabaseForTenant(context.node, { tenant: existing }, params.ownerId, undefined, reservedName);
        const pendingReservation = (await ensureHostingNodeAllocationReservations(context.node)).find((item) => item.idempotencyKey === requestKey && item.state === 'PENDING');
        if (pendingReservation) {
          await finalizeHostingNodeSlot({ nodeId: String(context.node._id), token: pendingReservation.token, instanceId: record._id.toString() });
        }
        await User.updateOne({ _id: params.ownerId, freeSharedProvisioningKey: requestKey }, { $set: { freeSharedTenantId: existing.tenant_id }, $unset: { freeSharedProvisioningKey: 1 } });
        return { tenant: existing, database: databaseView(record) };
      }

      const status = await context.client.getSharedHostingStatus();
      if (!status.enabled || status.available_slots < 1) continue;
      const reservation = await reserveHostingNodeSlot({
        nodeId: String(context.node._id),
        allocationMode: 'SHARED',
        customerId: params.ownerId,
        idempotencyKey: requestKey,
      });
      if (!reservation) continue;

      let instanceName = '';
      let rustResult: CreateTenantResult | undefined;
      let dashboardRecord: IManagedDatabase | undefined;
      try {
        instanceName = await reserveFreeInstanceName(params.ownerId, requestKey);
        const result: CreateTenantResult = await context.client.createSharedTenant(
          {
            external_owner_id: params.ownerId,
            plan: FREE_SHARED_PLAN_ID,
            database_name: instanceName,
            storage_quota_bytes: FREE_SHARED_STORAGE_BYTES,
          },
          requestKey
        );
        rustResult = result;
        const record = await upsertManagedDatabaseForTenant(
          context.node,
          result,
          params.ownerId,
          reservation.reservation.token,
          instanceName,
        );
        dashboardRecord = record;
        await finalizeHostingNodeSlot({
          nodeId: String(context.node._id),
          token: reservation.reservation.token,
          instanceId: record._id.toString(),
          serverVersion: context.node.serverVersion,
        });
        await User.updateOne({ _id: params.ownerId, freeSharedProvisioningKey: requestKey }, { $set: { freeSharedTenantId: result.tenant.tenant_id }, $unset: { freeSharedProvisioningKey: 1 } });
        await createAuditLog({
          actorId: params.ownerId,
          actorRole: 'customer',
          action: 'DATABASE_PROVISIONED',
          entityType: 'SharedTenant',
          entityId: result.tenant.tenant_id,
          metadata: {
            planId: FREE_SHARED_PLAN_ID,
            databaseName: getSharedTenantLogicalDatabaseName(result.tenant, instanceName),
            storageQuota: formatBytes(result.tenant.storage_quota_bytes),
            ownerEmail: params.ownerEmail,
          },
        });
        return { tenant: result.tenant, database: databaseView(record), credentials: result.credentials };
      } catch (error) {
        // Once Rust has created the tenant, retain the shared reservation and
        // leave a durable failed mapping for reconciliation. Releasing the
        // slot here could let another customer overbook the same pool while
        // this tenant still exists in Rust.
        const result = rustResult;
        if (result) {
          const failedRecord = dashboardRecord || await persistFailedSharedTenantRecord(
            context.node,
            result,
            params.ownerId,
            reservation.reservation.token,
            instanceName,
            error,
          );
          if (failedRecord) {
            await bindHostingReservationToInstance(
              String(context.node._id),
              reservation.reservation.token,
              failedRecord._id.toString(),
            );
            failedRecord.status = 'FAILED';
            failedRecord.provisioningStage = 'RUST_TENANT_CREATED_MAPPING_FAILED';
            failedRecord.lastProvisioningError = getSafeProvisioningFailureCode(error);
            await failedRecord.save();
          }
        } else {
          await releaseHostingNodeReservation(String(context.node._id), reservation.reservation.token);
        }
        throw error;
      }
    }
    throw new Error('SHARED_HOSTING_CAPACITY_EXHAUSTED');
  } catch (error) {
    await User.updateOne({ _id: params.ownerId, freeSharedProvisioningKey: requestKey }, { $unset: { freeSharedProvisioningKey: 1 } });
    throw error;
  }
}

export async function rotateOwnedSharedTenantCredentials(ownerId: string, tenantId: string): Promise<TenantCredentialRotation> {
  await connectToDatabase();
  const record = await ManagedDatabase.findOne({
    $and: [
      { $or: [{ sharedTenantId: tenantId }, { providerDeploymentId: tenantId }] },
      { $or: [{ customerId: ownerId }, { userId: ownerId }] },
    ],
  });
  if (!record) throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'shared-tenant-owner-check' });
  const context = await getSharedHostingContextForRecord(record);
  const tenant = await getSharedTenantFromControlPlane(context, tenantId);
  assertTenantOwner(tenant, ownerId);
  const rotated = await context.client.rotateSharedTenantCredentials(tenantId);
  if (record) {
    const connectionUri = buildSharedConnectionUri(
      rotated.credentials.username,
      rotated.credentials.password,
      context.node,
      getSharedTenantLogicalDatabaseName(tenant, record.sharedLogicalDatabaseName || record.name)
    );
    record.username = rotated.credentials.username;
    record.encryptedControlPlaneCredential = encrypt(rotated.credentials.password);
    record.encryptedConnectionUri = encrypt(connectionUri);
    record.lastCredentialRotationAt = new Date();
    record.credentialVersion = (record.credentialVersion || 1) + 1;
    record.databaseUsers = [
      {
        username: rotated.credentials.username,
        role: 'read_write',
        status: 'ACTIVE',
        encryptedPassword: encrypt(rotated.credentials.password),
        createdAt: new Date(),
      },
    ];
    await record.save();
  }

  await createAuditLog({
    actorId: ownerId,
    actorRole: 'customer',
    action: 'CREDENTIALS_ROTATED',
    entityType: 'SharedTenant',
    entityId: tenantId,
  });
  return rotated;
}

export async function adminSharedTenantAction(
  actorId: string,
  tenantId: string,
  action: 'suspend' | 'resume' | 'reset' | 'delete' | 'rotate' | 'quota',
  quotaBytes?: number
): Promise<RustTenant | TenantActionResult | TenantCredentialRotation> {
  await connectToDatabase();
  const existingRecord = await ManagedDatabase.findOne({
    $or: [{ sharedTenantId: tenantId }, { providerDeploymentId: tenantId }],
  }).lean();
  if (!existingRecord) {
    throw new LioranDBNotFoundError('Shared database mapping not found.', { requestId: 'shared-tenant-admin-mapping' });
  }
  const context = await getSharedHostingContextForRecord(existingRecord);
  let result: RustTenant | TenantActionResult | TenantCredentialRotation;
  if (action === 'suspend') result = await context.client.suspendSharedTenant(tenantId);
  else if (action === 'resume') result = await context.client.resumeSharedTenant(tenantId);
  else if (action === 'reset') result = await context.client.resetSharedTenant(tenantId);
  else if (action === 'delete') result = await context.client.deleteSharedTenant(tenantId);
  else if (action === 'rotate') result = await context.client.rotateSharedTenantCredentials(tenantId);
  else {
    if (!quotaBytes) throw new Error('Quota is required.');
    result = await context.client.updateSharedTenant(tenantId, { storage_quota_bytes: quotaBytes });
  }

  await syncManagedDatabaseRecord(tenantId, result);
  if (action === 'delete' && existingRecord.hostingNodeId) {
    await releaseHostingNodeAssignment(existingRecord.hostingNodeId.toString(), existingRecord._id.toString());
  }
  await createAuditLog({
    actorId,
    actorRole: 'admin',
    action: 'ADMIN_ACTION',
    entityType: 'SharedTenant',
    entityId: tenantId,
    metadata: { action, quotaBytes },
  });
  return result;
}

function assertTenantOwner(tenant: RustTenant, ownerId: string): void {
  if (tenant.external_owner_id !== ownerId) {
    throw new LioranDBAdminError('Shared tenant ownership does not match the Dashboard allocation.', {
      code: 'SHARED_TENANT_OWNERSHIP_MISMATCH',
      statusCode: 404,
      requestId: 'shared-tenant-owner-check',
    });
  }
}

function getSafeProvisioningFailureCode(error: unknown): string {
  return error instanceof LioranDBAdminError
    ? error.code
    : 'SHARED_PROVISIONING_MAPPING_FAILED';
}

async function persistFailedSharedTenantRecord(
  node: Partial<IHostingNode> & { _id?: unknown },
  result: CreateTenantResult,
  customerId: string,
  allocationToken: string,
  customerFacingName: string,
  error: unknown,
): Promise<IManagedDatabase | undefined> {
  const tenant = result.tenant;
  if (tenant.external_owner_id !== customerId || !node._id) return undefined;

  const existing = await ManagedDatabase.findOne({
    $or: [{ sharedTenantId: tenant.tenant_id }, { providerDeploymentId: tenant.tenant_id }],
  });
  if (existing && existing.customerId.toString() !== customerId && existing.userId?.toString() !== customerId) {
    throw new LioranDBNotFoundError('Shared database mapping belongs to another account.', { requestId: 'shared-tenant-record-owner-check' });
  }

  const logicalDatabaseName = getSharedTenantLogicalDatabaseName(tenant, customerFacingName);
  const physicalDatabaseName = getSharedTenantPhysicalDatabaseName(tenant);
  const username = result.credentials?.username || tenant.connection?.username || `tenant_${tenant.tenant_id.replace(/^tenant_/, '')}`;
  const password = result.credentials?.password || tenant.connection?.password;
  const fields: Record<string, unknown> = {
    customerId,
    userId: customerId,
    hostingNodeId: node._id,
    name: existing?.name || customerFacingName,
    type: 'shared',
    username,
    host: String(node.dbUrl || node.grpcUrl || 'shared-host'),
    port: Number(node.port || node.grpcPort || 27019),
    databaseName: tenant.database_name,
    sharedLogicalDatabaseName: logicalDatabaseName,
    sharedPhysicalDatabaseName: physicalDatabaseName,
    status: 'FAILED',
    planId: FREE_SHARED_PLAN_ID,
    planName: 'Free Shared',
    hourlyRatePaise: 0,
    backupMonthlyPaise: 0,
    backupEnabled: false,
    databaseUsers: password ? [{ username, role: 'read_write', status: 'ACTIVE', encryptedPassword: encrypt(password), createdAt: new Date() }] : [],
    providerDeploymentId: tenant.tenant_id,
    sharedTenantId: tenant.tenant_id,
    allocationToken,
    storageQuotaBytes: tenant.storage_quota_bytes,
    storageUsedBytes: tenant.storage_used_bytes,
    provisionedAt: tenant.created_at ? new Date(tenant.created_at) : new Date(),
    provisioningStage: 'RUST_TENANT_CREATED_MAPPING_FAILED',
    lastProvisioningError: getSafeProvisioningFailureCode(error),
  };
  if (password) {
    fields.encryptedControlPlaneCredential = encrypt(password);
    fields.encryptedConnectionUri = encrypt(buildSharedConnectionUri(username, password, node, logicalDatabaseName));
  }

  if (existing) {
    Object.assign(existing, fields);
    await existing.save();
    return existing;
  }
  return ManagedDatabase.create(fields as unknown as Partial<IManagedDatabase>);
}

async function getVerifiedTenantUsage(
  client: ReturnType<typeof createSharedHostingClient>,
  tenantId: string,
): Promise<RustTenantUsage> {
  let usage: RustTenantUsage;
  try {
    usage = await client.getSharedTenantUsage(tenantId);
  } catch (error: unknown) {
    if (error instanceof LioranDBAdminError && error.statusCode === 404) {
      throw new LioranDBAdminError('The Dashboard allocation is not present in the Rust tenant registry.', {
        code: 'SHARED_TENANT_REGISTRY_MISSING',
        statusCode: 409,
        requestId: error.requestId,
      });
    }
    if (error instanceof LioranDBAdminError && error.statusCode >= 500) {
      throw new LioranDBAdminError('Rust tenant storage accounting is temporarily unavailable.', {
        code: 'SHARED_TENANT_USAGE_UNAVAILABLE',
        statusCode: 503,
        requestId: error.requestId,
      });
    }
    throw error;
  }
  if (usage.tenant_id !== tenantId) {
    throw new LioranDBAdminError('Control plane returned usage for an unexpected tenant.', {
      code: 'TENANT_USAGE_ID_MISMATCH',
      statusCode: 502,
    });
  }
  return usage;
}

async function upsertManagedDatabaseForTenant(
  node: Partial<IHostingNode> & { _id?: unknown },
  result: CreateTenantResult,
  customerId: string,
  allocationToken?: string,
  customerFacingName?: string,
): Promise<IManagedDatabase> {
  await connectToDatabase();
  const tenant = result.tenant;
  if (tenant.external_owner_id !== customerId) {
    throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'shared-tenant-owner-check' });
  }

  // The Rust tenant ID is the stable allocation identity. Never create a second
  // Dashboard record for that ID under another customer if local data is stale.
  const existingByTenant = await ManagedDatabase.findOne({
    $or: [{ sharedTenantId: tenant.tenant_id }, { providerDeploymentId: tenant.tenant_id }],
  });
  if (existingByTenant && existingByTenant.customerId.toString() !== customerId && existingByTenant.userId?.toString() !== customerId) {
    throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'shared-tenant-record-owner-check' });
  }
  const existing = existingByTenant || await ManagedDatabase.findOne({
    // sharedTenantId is the canonical immutable Rust allocation identity.
    // providerDeploymentId remains populated for compatibility with existing
    // Dashboard records and older routes.
    sharedTenantId: tenant.tenant_id,
    providerDeploymentId: tenant.tenant_id,
    $or: [{ customerId }, { userId: customerId }],
  });
  const logicalDatabaseName = getSharedTenantLogicalDatabaseName(
    tenant,
    customerFacingName || existing?.sharedLogicalDatabaseName || existing?.name,
  );
  const physicalDatabaseName = getSharedTenantPhysicalDatabaseName(tenant) || existing?.sharedPhysicalDatabaseName;
  const duplicateDatabase = physicalDatabaseName
    ? await ManagedDatabase.findOne({
        hostingNodeId: node._id,
        type: 'shared',
        sharedPhysicalDatabaseName: physicalDatabaseName,
        providerDeploymentId: { $ne: tenant.tenant_id },
        status: { $nin: ['TERMINATED', 'DELETED', 'FAILED'] },
      })
    : null;
  if (duplicateDatabase && duplicateDatabase.customerId.toString() !== customerId && duplicateDatabase.userId?.toString() !== customerId) {
    throw new Error('SHARED_DATABASE_NAME_CONFLICT');
  }
  const connection = result.tenant.connection;
  const username = result.credentials?.username || connection?.username || `tenant_${tenant.tenant_id.replace(/^tenant_/, '')}`;
  const password = result.credentials?.password || connection?.password;
  // Free/shared instances are client-facing through the database endpoint.
  // Build the URI from the node's dbUrl so a control-plane response cannot
  // accidentally expose the internal .grpc endpoint to the customer.
  let connectionUri = password
    ? buildSharedConnectionUri(username, password, node, logicalDatabaseName)
    : connection?.uri;
  if (!connectionUri && existing?.encryptedConnectionUri) {
    connectionUri = rewriteSharedConnectionUri(existing, node, logicalDatabaseName);
  }
  const resolvedUsername = password || connection?.username ? username : existing?.username || username;
  const sharedFields: Record<string, unknown> = {
    customerId,
    userId: customerId,
    hostingNodeId: node._id,
    // Keep the customer-facing instance label separate from Rust's authoritative
    // database name. New free allocations use the reserved generated name;
    // later reconciliation never replaces an existing customer-facing label.
    name: existing?.name || customerFacingName || logicalDatabaseName,
    type: 'shared' as const,
    username: resolvedUsername,
    host: String(node.dbUrl || node.grpcUrl || 'shared-host'),
    port: Number(node.port || node.grpcPort || 27019),
    databaseName: tenant.database_name,
    sharedLogicalDatabaseName: logicalDatabaseName,
    sharedPhysicalDatabaseName: physicalDatabaseName,
    status: mapTenantStatus(tenant.status),
    planId: FREE_SHARED_PLAN_ID,
    planName: 'Free Shared',
    hourlyRatePaise: 0,
    backupMonthlyPaise: 0,
    backupEnabled: false,
    opsPerSecondLimit: 10,
    memoryMb: undefined,
    cpu: `Shared pool (${FREE_SHARED_CPU_CORES} vCPU / ${FREE_SHARED_MEMORY_BYTES / (1024 * 1024)} MiB)`,
    region: node.region || undefined,
    providerDeploymentId: tenant.tenant_id,
    allocationToken: allocationToken || existing?.allocationToken,
    storageQuotaBytes: tenant.storage_quota_bytes,
    storageUsedBytes: tenant.storage_used_bytes,
    provisionedAt: tenant.created_at ? new Date(tenant.created_at) : new Date(),
    credentialVersion: existing?.credentialVersion || 1,
  };

  if (connectionUri) {
    sharedFields.encryptedConnectionUri = encrypt(connectionUri);
  }
  if (password) {
    sharedFields.encryptedControlPlaneCredential = encrypt(password);
    sharedFields.databaseUsers = [{ username, role: 'read_write', status: 'ACTIVE' as const, encryptedPassword: encrypt(password), createdAt: new Date() }];
    sharedFields.credentialVersion = (existing?.credentialVersion || 0) + 1;
  }

  if (existing) {
    Object.assign(existing, sharedFields);
    await existing.save();
    return existing;
  }
  return ManagedDatabase.create(sharedFields as unknown as Partial<IManagedDatabase>);
}

async function syncManagedDatabaseRecord(tenantId: string, result: RustTenant | TenantActionResult | TenantCredentialRotation): Promise<void> {
  await connectToDatabase();
  const record = await ManagedDatabase.findOne({
    $or: [{ sharedTenantId: tenantId }, { providerDeploymentId: tenantId }],
  });
  if (!record) return;
  if ('deleted' in result && result.deleted) {
    record.status = 'DELETED';
    record.terminatedAt = new Date();
    await record.save();
    return;
  }
  if ('credentials' in result && result.credentials) {
    const credentials = result.credentials;
    record.username = credentials.username;
    record.encryptedControlPlaneCredential = encrypt(credentials.password);
    record.encryptedConnectionUri = encrypt(buildSharedConnectionUri(
      credentials.username,
      credentials.password,
      { dbUrl: record.host, port: record.port },
      getSharedRecordLogicalDatabaseName(record),
    ));
    record.lastCredentialRotationAt = new Date();
    record.databaseUsers = [{
      username: credentials.username,
      role: 'read_write',
      status: 'ACTIVE',
      encryptedPassword: encrypt(credentials.password),
      createdAt: new Date(),
    }];
  }
  if ('status' in result && result.status) record.status = mapTenantStatus(result.status);
  const tenant = 'tenant' in result && result.tenant ? result.tenant : isRustTenant(result) ? result : undefined;
  if (tenant) {
    record.sharedTenantId = tenant.tenant_id;
    record.providerDeploymentId = tenant.tenant_id;
    record.databaseName = tenant.database_name;
    record.sharedLogicalDatabaseName = getSharedTenantLogicalDatabaseName(tenant, record.sharedLogicalDatabaseName || record.name);
    record.sharedPhysicalDatabaseName = getSharedTenantPhysicalDatabaseName(tenant) || record.sharedPhysicalDatabaseName;
    record.status = mapTenantStatus(tenant.status);
    record.storageQuotaBytes = tenant.storage_quota_bytes;
    record.storageUsedBytes = tenant.storage_used_bytes;
    if (record.encryptedConnectionUri && !('credentials' in result)) {
      const node = record.hostingNodeId ? await HostingNode.findById(record.hostingNodeId).lean() : null;
      const rewritten = rewriteSharedConnectionUri(
        record,
        node || { dbUrl: record.host, port: record.port },
        record.sharedLogicalDatabaseName || getSharedRecordLogicalDatabaseName(record),
      );
      if (rewritten) record.encryptedConnectionUri = encrypt(rewritten);
    }
  }
  await record.save();
}

function isRustTenant(result: RustTenant | TenantActionResult | TenantCredentialRotation): result is RustTenant {
  return 'database_name' in result && typeof result.database_name === 'string';
}

function databaseView(record: IManagedDatabase): OwnedSharedTenant['database'] {
  let connectionUri: string | undefined;
  if (record.encryptedConnectionUri) {
    try {
      connectionUri = decrypt(record.encryptedConnectionUri);
    } catch {
      connectionUri = undefined;
    }
  }
  const logicalDatabaseName = getSharedRecordLogicalDatabaseName(record);
  if (connectionUri) {
    try {
      connectionUri = rewriteSharedConnectionUri(record, { dbUrl: record.host, port: record.port }, logicalDatabaseName);
    } catch {
      connectionUri = undefined;
    }
  }
  return {
    id: record._id.toString(),
    name: record.name,
    databaseName: logicalDatabaseName,
    status: record.status,
    host: record.host,
    port: record.port,
    region: record.region,
    connectionUri,
    storageQuotaBytes: record.storageQuotaBytes,
    storageUsedBytes: record.storageUsedBytes,
  };
}

function mapTenantStatus(status: RustTenant['status']): IManagedDatabase['status'] {
  if (status === 'ACTIVE') return 'ACTIVE';
  if (status === 'PROVISIONING') return 'PROVISIONING';
  if (status === 'DELETING') return 'DELETING';
  if (status === 'FAILED') return 'FAILED';
  return 'SUSPENDED';
}

function buildSharedConnectionUri(
  username: string,
  password: string,
  node: Partial<IHostingNode>,
  logicalDatabaseName: string
): string {
  const endpoint = String(node.dbUrl || node.grpcUrl || 'localhost');
  const port = node.port || node.grpcPort || 27019;
  return buildLioranDBConnectionUri({
    scheme: 'grpc',
    username,
    password,
    host: endpoint,
    port,
    database: logicalDatabaseName,
    tls: true,
    transport: 'grpc',
    allowHttpFallback: false,
  });
}

function rewriteSharedConnectionUri(
  record: Pick<IManagedDatabase, 'encryptedConnectionUri' | 'host' | 'port'>,
  node: Partial<IHostingNode>,
  logicalDatabaseName: string,
): string | undefined {
  if (!record.encryptedConnectionUri) return undefined;
  try {
    const parsed = parseLioranDBConnectionUri(decrypt(record.encryptedConnectionUri));
    if (!parsed.username || parsed.password === undefined) return undefined;
    return buildLioranDBConnectionUri({
      scheme: parsed.scheme,
      username: parsed.username,
      password: parsed.password,
      host: String(node.dbUrl || record.host),
      port: Number(node.port || record.port),
      database: logicalDatabaseName,
      tls: parsed.tls,
      transport: parsed.transport,
      allowHttpFallback: parsed.allowHttpFallback,
      appName: parsed.appName,
      authSource: parsed.authSource,
    });
  } catch {
    return undefined;
  }
}
