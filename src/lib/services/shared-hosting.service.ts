import { connectToDatabase, HostingNode, ManagedDatabase, User } from '@/lib/db';
import type { IHostingNode } from '@/lib/db/models/HostingNode';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';
import { encrypt, decrypt, generateSecureToken } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { LioranDBNotFoundError } from '@/lib/liorandb-admin/errors';
import { createSharedHostingClient } from '@/lib/liorandb-admin/tenant-client';
import {
  FREE_SHARED_CPU_CORES,
  FREE_SHARED_MEMORY_BYTES,
  FREE_SHARED_PLAN_ID,
  FREE_SHARED_STORAGE_BYTES,
  formatBytes,
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
    status: string;
    host: string;
    port: number;
    region?: string;
    connectionUri?: string;
    storageQuotaBytes?: number;
    storageUsedBytes?: number;
  };
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

export async function listOwnedSharedTenants(ownerId: string, includeUsage = false): Promise<OwnedSharedTenant[]> {
  const contexts = await getSharedHostingContexts();
  const tenantContexts = (await Promise.all(contexts.map(async (context) => ({ context, tenants: await context.client.listSharedTenants() })))).flatMap(({ context, tenants }) =>
    tenants.filter((tenant) => tenant.external_owner_id === ownerId).map((tenant) => ({ context, tenant }))
  );
  await connectToDatabase();

  const records = await ManagedDatabase.find({
    providerDeploymentId: { $in: tenantContexts.map(({ tenant }) => tenant.tenant_id) },
    $or: [{ customerId: ownerId }, { userId: ownerId }],
  }).lean();
  const recordByTenant = new Map(records.map((record) => [record.providerDeploymentId, record]));

  return Promise.all(
    tenantContexts.map(async ({ tenant, context }) => {
      const record = recordByTenant.get(tenant.tenant_id);
      const usage = includeUsage ? await context.client.getSharedTenantUsage(tenant.tenant_id) : undefined;
      return { tenant, usage, database: record ? databaseView(record) : undefined };
    })
  );
}

export async function getOwnedSharedTenant(ownerId: string, tenantId: string, includeUsage = true): Promise<OwnedSharedTenant> {
  await connectToDatabase();
  const record = await ManagedDatabase.findOne({ providerDeploymentId: tenantId, $or: [{ customerId: ownerId }, { userId: ownerId }] }).lean();
  const existingNode = record?.hostingNodeId ? await HostingNode.findById(record.hostingNodeId).lean() : null;
  const context = existingNode
    ? {
        node: existingNode as Partial<IHostingNode> & { _id: unknown },
        client: createSharedHostingClient(existingNode as Partial<IHostingNode> & { _id: unknown }),
      }
    : await getSharedHostingContext();
  const tenant = await context.client.getSharedTenant(tenantId);
  assertTenantOwner(tenant, ownerId);
  const usage = includeUsage ? await context.client.getSharedTenantUsage(tenantId) : undefined;
  return { tenant, usage, database: record ? databaseView(record) : undefined };
}

export async function provisionFreeSharedTenant(params: {
  ownerId: string;
  ownerEmail?: string;
  databaseName: string;
  idempotencyKey?: string;
}): Promise<OwnedSharedTenant & { credentials?: { username: string; password: string } }> {
  await connectToDatabase();
  const requestKey = params.idempotencyKey || `cloud-${params.ownerId}-${generateSecureToken(18)}`;
  const existingRecord = await ManagedDatabase.findOne({
    $or: [{ customerId: params.ownerId }, { userId: params.ownerId }],
    planId: FREE_SHARED_PLAN_ID,
    status: { $nin: ['TERMINATED', 'DELETED', 'FAILED'] },
  }).lean();
  if (existingRecord) {
    if (!existingRecord.providerDeploymentId) throw new Error('FREE_TIER_ALREADY_ALLOCATED');
    const existingNode = existingRecord.hostingNodeId
      ? await HostingNode.findById(existingRecord.hostingNodeId).lean()
      : null;
    const context = existingNode
      ? {
          node: existingNode as Partial<IHostingNode> & { _id: unknown },
          client: createSharedHostingClient(existingNode as Partial<IHostingNode> & { _id: unknown }),
        }
      : await getSharedHostingContext();
    const tenant = await context.client.getSharedTenant(existingRecord.providerDeploymentId);
    const pendingReservation = (await ensureHostingNodeAllocationReservations(context.node)).find(
      (item) => item.token === existingRecord.allocationToken && item.state === 'PENDING'
    );
    if (pendingReservation) {
      await finalizeHostingNodeSlot({ nodeId: String(context.node._id), token: pendingReservation.token, instanceId: existingRecord._id.toString() });
    }
    return { tenant, database: databaseView(existingRecord) };
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
        const record = await upsertManagedDatabaseForTenant(context.node, { tenant: existing }, params.ownerId);
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

      try {
        const result: CreateTenantResult = await context.client.createSharedTenant(
          {
            external_owner_id: params.ownerId,
            plan: FREE_SHARED_PLAN_ID,
            database_name: params.databaseName,
            storage_quota_bytes: FREE_SHARED_STORAGE_BYTES,
          },
          requestKey
        );
        const record = await upsertManagedDatabaseForTenant(context.node, result, params.ownerId, reservation.reservation.token);
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
            databaseName: result.tenant.database_name,
            storageQuota: formatBytes(result.tenant.storage_quota_bytes),
            ownerEmail: params.ownerEmail,
          },
        });
        return { tenant: result.tenant, database: databaseView(record), credentials: result.credentials };
      } catch (error) {
        await releaseHostingNodeReservation(String(context.node._id), reservation.reservation.token);
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
  const context = await getSharedHostingContext();
  const tenant = await context.client.getSharedTenant(tenantId);
  assertTenantOwner(tenant, ownerId);
  const rotated = await context.client.rotateSharedTenantCredentials(tenantId);

  await connectToDatabase();
  const record = await ManagedDatabase.findOne({ providerDeploymentId: tenantId, $or: [{ customerId: ownerId }, { userId: ownerId }] });
  if (record) {
    const connectionUri = buildSharedConnectionUri(
      rotated.credentials.username,
      rotated.credentials.password,
      context.node,
      tenant.database_name
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
  const existingRecord = await ManagedDatabase.findOne({ providerDeploymentId: tenantId }).lean();
  const existingNode = existingRecord?.hostingNodeId
    ? await HostingNode.findById(existingRecord.hostingNodeId).lean()
    : null;
  const context = existingNode
    ? {
        node: existingNode as Partial<IHostingNode> & { _id: unknown },
        client: createSharedHostingClient(existingNode as Partial<IHostingNode> & { _id: unknown }),
      }
    : await getSharedHostingContext();
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
  if (action === 'delete' && existingRecord?.hostingNodeId) {
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
    throw new LioranDBNotFoundError('Shared database not found.', { requestId: 'shared-tenant-owner-check' });
  }
}

async function upsertManagedDatabaseForTenant(
  node: Partial<IHostingNode> & { _id: unknown },
  result: CreateTenantResult,
  customerId: string,
  allocationToken?: string
): Promise<IManagedDatabase> {
  await connectToDatabase();
  const tenant = result.tenant;
  const connection = result.tenant.connection;
  const username = result.credentials?.username || connection?.username || `tenant_${tenant.tenant_id.replace(/^tenant_/, '')}`;
  const password = result.credentials?.password || connection?.password;
  const connectionUri = connection?.uri || (password ? buildSharedConnectionUri(username, password, node, tenant.database_name) : undefined);
  const sharedFields = {
    customerId,
    userId: customerId,
    hostingNodeId: node._id,
    name: tenant.database_name,
    type: 'shared' as const,
    username,
    host: String(node.dbUrl || node.grpcUrl || 'shared-host'),
    port: Number(node.grpcPort || node.port || 27019),
    databaseName: tenant.database_name,
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
    allocationToken,
    storageQuotaBytes: tenant.storage_quota_bytes,
    storageUsedBytes: tenant.storage_used_bytes,
    provisionedAt: tenant.created_at ? new Date(tenant.created_at) : new Date(),
    encryptedConnectionUri: connectionUri ? encrypt(connectionUri) : undefined,
    encryptedControlPlaneCredential: password ? encrypt(password) : undefined,
    credentialVersion: 1,
    databaseUsers: password
      ? [{ username, role: 'read_write', status: 'ACTIVE' as const, encryptedPassword: encrypt(password), createdAt: new Date() }]
      : [],
  };

  const existing = await ManagedDatabase.findOne({ providerDeploymentId: tenant.tenant_id, $or: [{ customerId }, { userId: customerId }] });
  if (existing) {
    Object.assign(existing, sharedFields);
    await existing.save();
    return existing;
  }
  return ManagedDatabase.create(sharedFields as unknown as Partial<IManagedDatabase>);
}

async function syncManagedDatabaseRecord(tenantId: string, result: RustTenant | TenantActionResult | TenantCredentialRotation): Promise<void> {
  await connectToDatabase();
  const record = await ManagedDatabase.findOne({ providerDeploymentId: tenantId });
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
  if ('tenant' in result && result.tenant?.status) {
    record.status = mapTenantStatus(result.tenant.status);
    record.storageQuotaBytes = result.tenant.storage_quota_bytes;
    record.storageUsedBytes = result.tenant.storage_used_bytes;
  }
  await record.save();
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
  return {
    id: record._id.toString(),
    name: record.name,
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
  databaseName: string
): string {
  const endpoint = String(node.grpcUrl || node.dbUrl || 'localhost');
  const host = endpoint.replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '');
  const port = node.grpcPort || node.port || 27019;
  return `grpc://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(databaseName)}?tls=true`;
}
