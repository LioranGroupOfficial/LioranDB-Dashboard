import mongoose, { Document, Model, Schema } from 'mongoose';

export type DatabaseStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'RUNNING'
  | 'STOPPED'
  | 'SUSPENDED'
  | 'RESETTING'
  | 'FAILED'
  | 'DELETING'
  | 'TERMINATED'
  | 'DELETED';

export type DatabaseType = 'shared' | 'dedicated';

export interface IDatabaseUser {
  username: string;
  role?: string;
  status?: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt?: Date;
}

export interface IManagedDatabase extends Document {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name: string;
  slug?: string;
  type?: DatabaseType;
  username: string;
  rootUsername?: string;
  rootRotatedAt?: Date;
  lastCredentialRotationAt?: Date;
  encryptedControlPlaneCredential?: string;
  controlPlaneEndpoint?: string;
  credentialVersion?: number;
  serverVersion?: string;
  serverHealth?: string;
  encryptedConnectionUri?: string;
  host: string;
  port: number;
  databaseName: string;
  status: DatabaseStatus;
  planId: string;
  planName?: string;
  hourlyRatePaise: number;
  backupMonthlyPaise: number;
  backupEnabled: boolean;
  backupStartedAt?: Date;
  backupStoppedAt?: Date;
  billingStartedAt?: Date;
  billingStoppedAt?: Date;
  couponCode?: string;
  couponDiscountPercentage?: number;
  databaseUsers: IDatabaseUser[];
  opsPerSecondLimit?: number;
  documentLimit?: number;
  cpu?: string;
  memoryMb?: number;
  region?: string;
  provisionedAt?: Date;
  suspendedAt?: Date;
  suspensionReason?: string;
  terminatedAt?: Date;
  terminationReason?: string;
  adminNotes?: string;
  providerDeploymentId?: string;
  hostingNodeId?: mongoose.Types.ObjectId;
  grpcUrl?: string;
  grpcPort?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DatabaseUserSchema = new Schema<IDatabaseUser>(
  {
    username: { type: String, required: true, trim: true },
    role: { type: String, default: 'readWrite', trim: true },
    status: { type: String, enum: ['ACTIVE', 'DISABLED'], default: 'ACTIVE' },
    createdAt: { type: Date, required: true, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ManagedDatabaseSchema = new Schema<IManagedDatabase>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    hostingNodeId: { type: Schema.Types.ObjectId, ref: 'HostingNode', index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    username: { type: String, trim: true, default: 'admin' },
    rootUsername: { type: String, trim: true, default: 'admin' },
    rootRotatedAt: { type: Date },
    lastCredentialRotationAt: { type: Date },
    encryptedControlPlaneCredential: { type: String },
    controlPlaneEndpoint: { type: String },
    grpcUrl: { type: String },
    grpcPort: { type: Number },
    credentialVersion: { type: Number, default: 1 },
    serverVersion: { type: String, default: 'LioranDB Engine v2.4.1' },
    serverHealth: { type: String, default: 'HEALTHY' },
    encryptedConnectionUri: { type: String },
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true, default: 27017 },
    databaseName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: [
        'PENDING',
        'PROVISIONING',
        'ACTIVE',
        'RUNNING',
        'STOPPED',
        'SUSPENDED',
        'RESETTING',
        'FAILED',
        'DELETING',
        'TERMINATED',
        'DELETED',
      ],
      default: 'PENDING',
    },
    planId: { type: String, required: true, default: 'shared' },
    planName: { type: String, default: 'Shared' },
    hourlyRatePaise: { type: Number, required: true, default: 100 },
    backupMonthlyPaise: { type: Number, required: true, default: 0 },
    backupEnabled: { type: Boolean, default: false },
    backupStartedAt: { type: Date },
    backupStoppedAt: { type: Date },
    billingStartedAt: { type: Date },
    billingStoppedAt: { type: Date },
    couponCode: { type: String, uppercase: true, trim: true },
    couponDiscountPercentage: { type: Number, default: 0 },
    databaseUsers: { type: [DatabaseUserSchema], default: [] },
    opsPerSecondLimit: { type: Number },
    documentLimit: { type: Number },
    cpu: { type: String },
    memoryMb: { type: Number },
    region: { type: String, default: 'ap-south-1 (Mumbai)' },
    provisionedAt: { type: Date },
    suspendedAt: { type: Date },
    suspensionReason: { type: String },
    terminatedAt: { type: Date },
    terminationReason: { type: String },
    adminNotes: { type: String },
    providerDeploymentId: { type: String },
  },
  { timestamps: true }
);

ManagedDatabaseSchema.index({ customerId: 1, status: 1 });
ManagedDatabaseSchema.index({ userId: 1, status: 1 });

const ManagedDatabase: Model<IManagedDatabase> =
  mongoose.models.ManagedDatabase ||
  mongoose.model<IManagedDatabase>('ManagedDatabase', ManagedDatabaseSchema);

export default ManagedDatabase;
