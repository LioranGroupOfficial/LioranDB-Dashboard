import mongoose, { Document, Model, Schema } from 'mongoose';

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

export type HostingAllocationMode = 'DEDICATED' | 'SHARED';
export type HostingProtocol = 'http' | 'https';

export interface IHostingNode extends Document {
  _id: mongoose.Types.ObjectId;
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
  allocationMode: HostingAllocationMode;
  status: HostingNodeStatus;
  maxCapacity?: number; // 1 server per user/database (DEDICATED model)
  currentAssignedCount: number;
  lastHealthCheckAt?: Date;
  lastResetAt?: Date;
  lastCredentialRotationAt?: Date;
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
    lastResetAt: { type: Date },
    lastCredentialRotationAt: { type: Date },
    defaultRootUsername: { type: String, default: 'admin', trim: true },
    notes: { type: String },
    adminNotes: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

HostingNodeSchema.index({ status: 1, allocationMode: 1, currentAssignedCount: 1 });

if (mongoose.models.HostingNode) {
  delete (mongoose.models as Record<string, unknown>).HostingNode;
}

const HostingNode: Model<IHostingNode> = mongoose.model<IHostingNode>('HostingNode', HostingNodeSchema);

export default HostingNode;
