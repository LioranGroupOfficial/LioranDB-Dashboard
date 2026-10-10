import { Document, Model, Schema, model, models, Types } from '../adapter';

export type HostingNodeStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'PROVISIONING'
  | 'ASSIGNED'
  | 'DRAINING'
  | 'RESETTING'
  | 'FAILED'
  | 'QUARANTINED'
  | 'MAINTENANCE'
  | 'DISABLED'
  | 'ACTIVE'; // For backward compatibility with existing ACTIVE records

export type HostingNodeHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNREACHABLE'
  | 'AUTHENTICATION_FAILED'
  | 'UNKNOWN';

export type HostingNodeCleanStatus =
  | 'CLEAN'
  | 'DIRTY'
  | 'NOT_VERIFIED'
  | 'PENDING_VERIFICATION'
  | 'UNKNOWN';

export type HostingAllocationMode = 'DEDICATED' | 'SHARED';
export type HostingProtocol = 'http' | 'https';

export interface IHostingNode extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  region: string;
  dbUrl: string; // Customer-facing DB hostname / IP
  port: number; // Customer-facing DB port (default 27018)
  protocol: HostingProtocol; // http | https
  httpPort: number; // Customer-facing HTTP port (default 27018)
  grpcUrl: string; // Customer-facing gRPC endpoint
  grpcPort: number; // Customer-facing gRPC port (default 27019)
  controlPlaneEndpoint?: string; // Private management control plane URL (e.g. http://127.0.0.1:27018)
  encryptedControlPlaneToken?: string; // Per-server encrypted control plane token (AES-256-GCM)
  serverIdentity?: string; // Verified Rust server identity (e.g. "node-1")
  serverVersion?: string; // Verified Rust server version
  healthStatus: HostingNodeHealthStatus;
  cleanStatus: HostingNodeCleanStatus;
  allocationMode: HostingAllocationMode;
  status: HostingNodeStatus;
  maxCapacity?: number; // 1 server per user/database (DEDICATED model)
  currentAssignedCount: number;
  lastHealthCheckAt?: Date;
  lastCleanCheckAt?: Date;
  lastResetAt?: Date;
  lastCredentialRotationAt?: Date;
  lastCleanupAttemptAt?: Date;
  cleanupFailureReason?: string;
  quarantineReason?: string;
  encryptedDefaultRootPassword?: string;
  defaultRootUsername?: string;
  notes?: string;
  adminNotes?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HostingNodeSchema = new Schema<IHostingNode>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    region: { type: String, required: true, default: 'Asia (Mumbai)' },
    dbUrl: { type: String, required: true, trim: true },
    port: { type: Number, required: true, default: 27018 },
    protocol: { type: String, enum: ['http', 'https'], default: 'http' },
    httpPort: { type: Number, required: true, default: 27018 },
    grpcUrl: { type: String, required: true, trim: true },
    grpcPort: { type: Number, required: true, default: 27019 },
    controlPlaneEndpoint: { type: String, trim: true },
    encryptedControlPlaneToken: { type: String },
    serverIdentity: { type: String, trim: true },
    serverVersion: { type: String, default: '2.4.1' },
    healthStatus: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'UNREACHABLE', 'AUTHENTICATION_FAILED', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    cleanStatus: {
      type: String,
      enum: ['CLEAN', 'DIRTY', 'NOT_VERIFIED', 'PENDING_VERIFICATION', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    allocationMode: {
      type: String,
      enum: ['DEDICATED', 'SHARED'],
      default: 'DEDICATED',
    },
    status: {
      type: String,
      enum: [
        'AVAILABLE',
        'RESERVED',
        'PROVISIONING',
        'ASSIGNED',
        'DRAINING',
        'RESETTING',
        'FAILED',
        'QUARANTINED',
        'MAINTENANCE',
        'DISABLED',
        'ACTIVE',
      ],
      default: 'AVAILABLE',
      index: true,
    },
    maxCapacity: { type: Number, default: 1 },
    currentAssignedCount: { type: Number, default: 0 },
    lastHealthCheckAt: { type: Date },
    lastCleanCheckAt: { type: Date },
    lastResetAt: { type: Date },
    lastCredentialRotationAt: { type: Date },
    lastCleanupAttemptAt: { type: Date },
    cleanupFailureReason: { type: String },
    quarantineReason: { type: String },
    encryptedDefaultRootPassword: { type: String },
    defaultRootUsername: { type: String, default: 'admin', trim: true },
    notes: { type: String },
    adminNotes: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

HostingNodeSchema.index({ status: 1, allocationMode: 1, currentAssignedCount: 1 });
HostingNodeSchema.index({ status: 1, healthStatus: 1, cleanStatus: 1, currentAssignedCount: 1 });

/**
 * Validates strict allocation eligibility:
 * Node must be AVAILABLE, HEALTHY, verified CLEAN, not QUARANTINED, not RESETTING,
 * unassigned (within maxCapacity), and have valid connectivity.
 */
export function isNodeAllocatable(node: Partial<IHostingNode> | null | undefined): boolean {
  if (!node) return false;
  const isAvailableStatus = node.status === 'AVAILABLE' || node.status === 'ACTIVE';
  const isHealthy = node.healthStatus === 'HEALTHY';
  const isClean = node.cleanStatus === 'CLEAN';
  const hasCapacity = (node.currentAssignedCount || 0) < (node.maxCapacity || 1);
  const hasHost = Boolean(node.dbUrl && node.dbUrl.trim());

  return isAvailableStatus && isHealthy && isClean && hasCapacity && hasHost;
}

const HostingNode: Model<IHostingNode> =
  models.HostingNode ||
  model<IHostingNode>('HostingNode', HostingNodeSchema);

export default HostingNode;
