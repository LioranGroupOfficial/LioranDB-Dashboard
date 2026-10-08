import mongoose, { Document, Model, Schema } from 'mongoose';

export type HostingNodeStatus = 'ACTIVE' | 'DRAINING' | 'MAINTENANCE' | 'DISABLED';
export type HostingProtocol = 'http' | 'https';

export interface IHostingNode extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  region: string;
  dbUrl: string; // DB host or IP (e.g., db-mumbai-01.liorandb.net)
  port: number; // DB port (e.g., 27017)
  protocol: HostingProtocol; // http | https
  httpPort: number; // HTTP/REST API Port (e.g., 80, 443, 8080)
  grpcUrl: string; // gRPC endpoint (e.g., grpc.mumbai-01.liorandb.net)
  grpcPort: number; // gRPC port (e.g., 50051)
  defaultRootUsername: string; // default root/admin username
  defaultRootPassword?: string;
  status: HostingNodeStatus;
  maxCapacity: number; // maximum instances that can be hosted on this node
  currentAssignedCount: number;
  notes?: string;
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
    port: { type: Number, required: true, default: 27017 },
    protocol: { type: String, enum: ['http', 'https'], default: 'https' },
    httpPort: { type: Number, required: true, default: 443 },
    grpcUrl: { type: String, required: true, trim: true },
    grpcPort: { type: Number, required: true, default: 50051 },
    defaultRootUsername: { type: String, required: true, default: 'admin', trim: true },
    defaultRootPassword: { type: String },
    status: {
      type: String,
      enum: ['ACTIVE', 'DRAINING', 'MAINTENANCE', 'DISABLED'],
      default: 'ACTIVE',
      index: true,
    },
    maxCapacity: { type: Number, required: true, default: 50 },
    currentAssignedCount: { type: Number, default: 0 },
    notes: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

HostingNodeSchema.index({ status: 1, currentAssignedCount: 1 });

if (mongoose.models.HostingNode) {
  delete (mongoose.models as Record<string, unknown>).HostingNode;
}

const HostingNode: Model<IHostingNode> = mongoose.model<IHostingNode>('HostingNode', HostingNodeSchema);

export default HostingNode;
