import { connectToDatabase, HostingNode, ManagedDatabase } from '@/lib/db';
import type {
  HostingAllocationMode,
  IHostingAllocationReservation,
  IHostingNode,
} from '@/lib/db/models/HostingNode';
import { generateSecureToken } from '@/lib/crypto';

export const DEFAULT_DEDICATED_NODE_CAPACITY = 1;
export const DEFAULT_SHARED_NODE_CAPACITY = 10;
export const DEFAULT_HOSTING_NODE_CAPACITY_UPPER_BOUND = 1000;
export const HOSTING_RESERVATION_LEASE_MS = 120_000;

type HostingNodeWithRawReservations = {
  _id: unknown;
  allocationReservations?: unknown;
  allocationRevision?: unknown;
};

function isAllocationReservation(value: unknown): value is IHostingAllocationReservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reservation = value as Record<string, unknown>;
  return (
    typeof reservation.token === 'string' &&
    (reservation.state === 'PENDING' || reservation.state === 'ACTIVE')
  );
}

/**
 * Reads the reservation field defensively because remote documents are not
 * hydrated through a schema validator by the custom LioranDB adapter.
 *
 * Older/incorrectly serialized documents can contain a single reservation or
 * an object keyed by array indexes. Both are safe to canonicalize. Unknown
 * shapes are rejected so allocation cannot silently overbook a node.
 */
export function getHostingNodeAllocationReservations(node: HostingNodeWithRawReservations): IHostingAllocationReservation[] {
  const raw = node.allocationReservations;
  if (raw === undefined || raw === null) return [];

  if (Array.isArray(raw)) {
    const reservations = raw.filter(isAllocationReservation);
    if (reservations.length === raw.length) return reservations;
    throw new Error(`HOSTING_NODE_ALLOCATION_DATA_INVALID: node ${String(node._id)} contains an invalid allocationReservations item.`);
  }

  if (isAllocationReservation(raw)) return [raw];

  if (typeof raw === 'object') {
    const values = Object.values(raw as Record<string, unknown>);
    if (values.length === 0) return [];
    const reservations = values.filter(isAllocationReservation);
    if (reservations.length === values.length) return reservations;
  }

  throw new Error(`HOSTING_NODE_ALLOCATION_DATA_INVALID: node ${String(node._id)} allocationReservations is not an array.`);
}

export async function ensureHostingNodeAllocationReservations(
  node: HostingNodeWithRawReservations,
  repairAttempt = 0
): Promise<IHostingAllocationReservation[]> {
  const raw = node.allocationReservations;
  let reservations: IHostingAllocationReservation[];
  let needsRepair = raw !== undefined && !Array.isArray(raw);

  try {
    reservations = getHostingNodeAllocationReservations(node);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('HOSTING_NODE_ALLOCATION_DATA_INVALID:')) throw error;
    reservations = await rebuildHostingNodeAllocationReservations(node._id);
    needsRepair = true;
  }

  if (!needsRepair) return reservations;

  const repairFilter: Record<string, unknown> = { _id: node._id };
  repairFilter.allocationRevision = typeof node.allocationRevision === 'number'
    ? node.allocationRevision
    : { $exists: false };
  const repaired = await HostingNode.updateOne(
    repairFilter,
    { $set: { allocationReservations: reservations }, $inc: { allocationRevision: 1 } }
  );
  if (repaired.matchedCount === 1) return reservations;

  // Another request changed the node while the malformed value was being
  // repaired. Re-read it so we never overwrite a newer reservation snapshot.
  const latest = await HostingNode.findById(node._id).lean<IHostingNode>();
  if (!latest) return [];
  if (repairAttempt >= 2) {
    throw new Error(`HOSTING_NODE_ALLOCATION_REPAIR_CONFLICT: node ${String(node._id)} changed during reservation repair.`);
  }
  return ensureHostingNodeAllocationReservations(latest, repairAttempt + 1);
}

async function rebuildHostingNodeAllocationReservations(nodeId: unknown): Promise<IHostingAllocationReservation[]> {
  const occupiedStatuses = ['PENDING', 'PROVISIONING', 'ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'RESETTING', 'DELETING'];
  const records = await ManagedDatabase.find({
    hostingNodeId: nodeId,
    status: { $in: occupiedStatuses },
  }).select('_id customerId allocationToken status createdAt').lean();

  return records.flatMap((record) => {
    if (typeof record.allocationToken !== 'string' || !record.allocationToken) return [];
    return [{
      token: record.allocationToken,
      customerId: record.customerId ? String(record.customerId) : undefined,
      instanceId: String(record._id),
      state: ['PENDING', 'PROVISIONING', 'RESETTING', 'DELETING'].includes(record.status) ? 'PENDING' as const : 'ACTIVE' as const,
      createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
    }];
  });
}

export function getHostingNodeCapacityUpperBound(): number {
  const configured = Number(process.env.HOSTING_NODE_MAX_CAPACITY || DEFAULT_HOSTING_NODE_CAPACITY_UPPER_BOUND);
  return Number.isInteger(configured) && configured > 0 ? Math.min(configured, 100_000) : DEFAULT_HOSTING_NODE_CAPACITY_UPPER_BOUND;
}

export function normalizeHostingAllocationConfig(
  allocationMode: unknown,
  maxCapacity: unknown,
  options?: { existingMode?: HostingAllocationMode }
): { allocationMode: HostingAllocationMode; maxCapacity: number } {
  const mode = allocationMode === undefined || allocationMode === null || allocationMode === ''
    ? options?.existingMode || 'DEDICATED'
    : allocationMode;

  if (mode !== 'DEDICATED' && mode !== 'SHARED') {
    throw new Error('Allocation mode must be DEDICATED or SHARED.');
  }

  const defaultCapacity = mode === 'SHARED' ? DEFAULT_SHARED_NODE_CAPACITY : DEFAULT_DEDICATED_NODE_CAPACITY;
  const rawCapacity = maxCapacity === undefined || maxCapacity === null || maxCapacity === '' ? defaultCapacity : Number(maxCapacity);
  const upperBound = getHostingNodeCapacityUpperBound();

  if (!Number.isInteger(rawCapacity) || rawCapacity <= 0) {
    throw new Error('Maximum database allocations must be a positive integer.');
  }
  if (rawCapacity > upperBound) {
    throw new Error(`Maximum database allocations cannot exceed the administrative limit of ${upperBound}.`);
  }
  if (mode === 'DEDICATED' && rawCapacity !== 1) {
    throw new Error('Dedicated hosting nodes must have maximum capacity 1.');
  }

  return { allocationMode: mode, maxCapacity: rawCapacity };
}

export function getNodeMaxCapacity(node: Pick<IHostingNode, 'allocationMode' | 'maxCapacity'>): number {
  if (node.allocationMode === 'SHARED') return node.maxCapacity || DEFAULT_SHARED_NODE_CAPACITY;
  return DEFAULT_DEDICATED_NODE_CAPACITY;
}

export interface HostingAllocationSnapshot {
  currentAssignedCount: number;
  pendingReservations: number;
  availableCapacity: number;
  occupiedInstanceIds: string[];
}

const OCCUPIED_DATABASE_STATUSES = ['PENDING', 'PROVISIONING', 'ACTIVE', 'RUNNING', 'SUSPENDED', 'STOPPED', 'RESETTING', 'DELETING'] as const;

function reservationIsExpired(reservation: IHostingAllocationReservation, now = Date.now()): boolean {
  return reservation.state === 'PENDING' && Boolean(reservation.expiresAt) && new Date(reservation.expiresAt!).getTime() <= now;
}

export async function getHostingNodeAllocationSnapshot(
  nodeOrId: Pick<IHostingNode, '_id' | 'allocationMode' | 'maxCapacity' | 'allocationReservations'> | string
): Promise<HostingAllocationSnapshot> {
  await connectToDatabase();
  const node = typeof nodeOrId === 'string' ? await HostingNode.findById(nodeOrId).lean() : nodeOrId;
  if (!node) {
    return { currentAssignedCount: 0, pendingReservations: 0, availableCapacity: 0, occupiedInstanceIds: [] };
  }
  const reservations = await ensureHostingNodeAllocationReservations(node);

  const instances = await ManagedDatabase.find({
    hostingNodeId: node._id,
    status: { $in: OCCUPIED_DATABASE_STATUSES },
  }).select('_id status allocationToken').lean();

  const occupiedIds = new Set(instances.map((instance) => instance._id.toString()));
  const activeReservationKeys = new Set<string>();
  let pendingReservations = 0;
  const now = Date.now();

  for (const reservation of reservations) {
    if (reservationIsExpired(reservation, now)) continue;
    if (reservation.state === 'PENDING') pendingReservations++;
    const hasMatchingInstance = Boolean(
      reservation.instanceId && occupiedIds.has(String(reservation.instanceId))
    );
    if (!hasMatchingInstance) activeReservationKeys.add(reservation.token);
  }

  const currentAssignedCount = occupiedIds.size + activeReservationKeys.size;
  const maxCapacity = getNodeMaxCapacity(node);
  return {
    currentAssignedCount,
    pendingReservations,
    availableCapacity: Math.max(0, maxCapacity - currentAssignedCount),
    occupiedInstanceIds: [...occupiedIds],
  };
}

export async function reconcileHostingNodeAllocation(nodeId: string): Promise<HostingAllocationSnapshot> {
  await connectToDatabase();
  const node = await HostingNode.findById(nodeId).lean();
  if (!node) return { currentAssignedCount: 0, pendingReservations: 0, availableCapacity: 0, occupiedInstanceIds: [] };

  const reservations = await ensureHostingNodeAllocationReservations(node);
  const snapshot = await getHostingNodeAllocationSnapshot({ ...node, allocationReservations: reservations });
  // Do not overwrite a live reservation's counter. Atomic reservations own the counter while pending.
  if ((node.pendingReservations || 0) === 0 && reservations.every((item) => item.state === 'ACTIVE')) {
    await HostingNode.updateOne(
      { _id: node._id, $or: [{ allocationRevision: node.allocationRevision || 0 }, { allocationRevision: { $exists: false } }] },
      {
        $set: {
          currentAssignedCount: snapshot.currentAssignedCount,
          pendingReservations: snapshot.pendingReservations,
          capacityRemaining: snapshot.availableCapacity,
        },
        $inc: { allocationRevision: 1 },
      }
    );
  }
  return snapshot;
}

export interface ReservedHostingNode {
  node: IHostingNode;
  reservation: IHostingAllocationReservation;
  reused: boolean;
}

export async function reserveHostingNodeSlot(params: {
  nodeId?: string;
  allocationMode: HostingAllocationMode;
  customerId?: string;
  instanceId?: string;
  idempotencyKey: string;
}): Promise<ReservedHostingNode | null> {
  await connectToDatabase();
  const candidates = await HostingNode.find({
    ...(params.nodeId ? { _id: params.nodeId } : {}),
    allocationMode: params.allocationMode,
    status: { $in: ['AVAILABLE', 'ACTIVE'] },
    healthStatus: 'HEALTHY',
  }).sort({ isDefault: -1, createdAt: 1 }).lean<IHostingNode[]>();

  for (const candidate of candidates) {
    const reservations = await ensureHostingNodeAllocationReservations(candidate);
    const existing = reservations.find(
      (reservation) => reservation.idempotencyKey === params.idempotencyKey && !reservationIsExpired(reservation)
    );
    if (existing) return { node: candidate, reservation: existing, reused: true };

    // Legacy nodes did not have the derived capacity counter. Initialize it once before using atomic reservations.
    if (candidate.capacityRemaining === undefined) {
      const legacyCapacity = Math.max(0, getNodeMaxCapacity(candidate) - (candidate.currentAssignedCount || 0));
      await HostingNode.updateOne(
        { _id: candidate._id, capacityRemaining: { $exists: false } },
        { $set: { capacityRemaining: legacyCapacity, pendingReservations: candidate.pendingReservations || 0, allocationReservations: reservations } }
      );
    }

    const token = `alloc_${Date.now()}_${generateSecureToken(12)}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + HOSTING_RESERVATION_LEASE_MS);
    const reservation: IHostingAllocationReservation = {
      token,
      idempotencyKey: params.idempotencyKey,
      customerId: params.customerId,
      instanceId: params.instanceId,
      state: 'PENDING',
      createdAt: now,
      expiresAt,
    };

    const update: Record<string, unknown> = {
      $inc: { currentAssignedCount: 1, pendingReservations: 1, capacityRemaining: -1, allocationRevision: 1 },
      $push: { allocationReservations: reservation },
    };
    const set: Record<string, unknown> = {};
    if (params.allocationMode === 'DEDICATED') {
      set.status = 'PROVISIONING';
      set.currentAllocationId = token;
      set.allocationExpiresAt = expiresAt;
      if (params.instanceId) set.assignedInstanceId = params.instanceId;
    }
    if (Object.keys(set).length > 0) (update as any).$set = set;

    const result = await HostingNode.updateOne(
      {
        _id: candidate._id,
        allocationMode: params.allocationMode,
        status: { $in: ['AVAILABLE', 'ACTIVE'] },
        healthStatus: 'HEALTHY',
        capacityRemaining: { $gt: 0 },
        'allocationReservations.idempotencyKey': { $ne: params.idempotencyKey },
      },
      update
    );
    if (result.matchedCount !== 1) continue;

    const reservedNode = await HostingNode.findById(candidate._id).lean<IHostingNode>();
    if (!reservedNode) return null;
    return { node: reservedNode, reservation, reused: false };
  }
  return null;
}

export async function bindHostingReservationToInstance(nodeId: string, token: string, instanceId: string): Promise<void> {
  const node = await HostingNode.findById(nodeId).lean<IHostingNode>();
  if (!node) return;
  const reservations = await ensureHostingNodeAllocationReservations(node);
  const reservation = reservations.find((item) => item.token === token);
  if (!reservation) return;
  await HostingNode.updateOne(
    { _id: nodeId, 'allocationReservations.token': token },
    { $set: { 'allocationReservations.$.instanceId': instanceId }, $inc: { allocationRevision: 1 } }
  );
}

export async function finalizeHostingNodeSlot(params: {
  nodeId: string;
  token: string;
  instanceId: string;
  serverVersion?: string;
}): Promise<void> {
  const node = await HostingNode.findById(params.nodeId).lean<IHostingNode>();
  if (!node) return;
  const reservations = await ensureHostingNodeAllocationReservations(node);
  const pending = reservations.find((item) => item.token === params.token);
  if (!pending) return;
  const set: Record<string, unknown> = {
    'allocationReservations.$.instanceId': params.instanceId,
    'allocationReservations.$.state': 'ACTIVE',
  };
  if (params.serverVersion) set.serverVersion = params.serverVersion;
  if (node.allocationMode === 'DEDICATED') {
    set.status = 'ASSIGNED';
    set.assignedInstanceId = params.instanceId;
  }
  await HostingNode.updateOne(
    { _id: params.nodeId, 'allocationReservations.token': params.token },
    { $set: set, $inc: { pendingReservations: -1, allocationRevision: 1 }, $unset: { currentAllocationId: 1, allocationExpiresAt: 1, 'allocationReservations.$.expiresAt': 1 } }
  );
}

export async function releaseHostingNodeReservation(nodeId: string, token: string): Promise<boolean> {
  const node = await HostingNode.findById(nodeId).lean<IHostingNode>();
  if (!node) return false;
  const reservations = await ensureHostingNodeAllocationReservations(node);
  const reservation = reservations.find((item) => item.token === token && item.state === 'PENDING');
  if (!reservation) return false;
  const set: Record<string, unknown> = {};
  if (node.allocationMode === 'DEDICATED') set.status = 'AVAILABLE';
  const result = await HostingNode.updateOne(
    { _id: nodeId, 'allocationReservations.token': token, 'allocationReservations.state': 'PENDING' },
    {
      $inc: { currentAssignedCount: -1, pendingReservations: -1, capacityRemaining: 1, allocationRevision: 1 },
      $set: set,
      $pull: { allocationReservations: { token } },
      $unset: { currentAllocationId: 1, allocationExpiresAt: 1, assignedInstanceId: 1 },
    }
  );
  return result.matchedCount === 1;
}

export async function releaseHostingNodeAssignment(nodeId: string, instanceId: string): Promise<boolean> {
  const node = await HostingNode.findById(nodeId).lean<IHostingNode>();
  if (!node) return false;
  const reservations = await ensureHostingNodeAllocationReservations(node);
  const reservation = reservations.find(
    (item) => item.state === 'ACTIVE' && item.instanceId === instanceId
  );
  if (!reservation) return false;
  const set: Record<string, unknown> = {};
  if (node.allocationMode === 'DEDICATED') set.status = 'AVAILABLE';
  const result = await HostingNode.updateOne(
    { _id: nodeId, 'allocationReservations.instanceId': instanceId, 'allocationReservations.state': 'ACTIVE' },
    {
      $inc: { currentAssignedCount: -1, capacityRemaining: 1, allocationRevision: 1 },
      $set: set,
      $pull: { allocationReservations: { instanceId, state: 'ACTIVE' } },
      $unset: { assignedInstanceId: 1 },
    }
  );
  return result.matchedCount === 1;
}

export async function clearHostingNodeAssignment(nodeId: string, instanceId: string): Promise<boolean> {
  const node = await HostingNode.findById(nodeId).lean<IHostingNode>();
  if (!node) return false;
  const result = await HostingNode.updateOne(
    { _id: nodeId, 'allocationReservations.instanceId': instanceId },
    {
      $set: {
        currentAssignedCount: 0,
        pendingReservations: 0,
        capacityRemaining: getNodeMaxCapacity(node),
      },
      $inc: { allocationRevision: 1 },
      $pull: { allocationReservations: { instanceId } },
      $unset: { assignedInstanceId: 1, currentAllocationId: 1, allocationExpiresAt: 1 },
    }
  );
  return result.matchedCount === 1;
}

export async function clearExpiredHostingReservations(nodeId: string): Promise<void> {
  const node = await HostingNode.findById(nodeId).lean<IHostingNode>();
  if (!node) return;
  for (const reservation of await ensureHostingNodeAllocationReservations(node)) {
    if (reservationIsExpired(reservation)) {
      const linkedInstance = reservation.instanceId
        ? await ManagedDatabase.findById(reservation.instanceId).select('status').lean()
        : null;
      if (!linkedInstance || ['FAILED', 'TERMINATED', 'DELETED'].includes(linkedInstance.status)) {
        await releaseHostingNodeReservation(nodeId, reservation.token);
      }
    }
  }
}
