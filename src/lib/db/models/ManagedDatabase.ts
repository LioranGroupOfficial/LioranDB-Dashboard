import mongoose, { Document, Model, Schema } from 'mongoose';

export type DatabaseStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'RUNNING'
  | 'STOPPED'
  | 'SUSPENDED'
  | 'FAILED'
  | 'DELETING'
  | 'TERMINATED'
  | 'DELETED';

export type DatabaseType = 'shared' | 'dedicated';

export interface IManagedDatabase extends Document {
  customerId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name: string;
  slug?: string;
  type?: DatabaseType;
  username: string;
  encryptedConnectionUri?: string;
  host: string;
  port: number;
  databaseName: string;
  status: DatabaseStatus;
  planId: string;
  cpu?: string;
  memoryMb?: number;
  documentLimit?: number;
  backupEnabled?: boolean;
  region?: string;
  monthlyPricePaise?: number;
  subscriptionId?: mongoose.Types.ObjectId;
  provisionedAt?: Date;
  suspendedAt?: Date;
  suspensionReason?: string;
  temporaryCredentialExpiresAt?: Date;
  passwordChangeRequired: boolean;
  adminNotes?: string;
  providerDeploymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ManagedDatabaseSchema = new Schema<IManagedDatabase>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    type: { type: String, enum: ['shared', 'dedicated'], default: 'dedicated' },
    username: { type: String, required: true, trim: true },
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
        'FAILED',
        'DELETING',
        'TERMINATED',
        'DELETED',
      ],
      default: 'PENDING',
    },
    planId: { type: String, required: true, default: 'starter' },
    cpu: { type: String },
    memoryMb: { type: Number },
    documentLimit: { type: Number },
    backupEnabled: { type: Boolean, default: false },
    region: { type: String, default: 'ap-south-1 (Mumbai)' },
    monthlyPricePaise: { type: Number },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    provisionedAt: { type: Date },
    suspendedAt: { type: Date },
    suspensionReason: { type: String },
    temporaryCredentialExpiresAt: { type: Date },
    passwordChangeRequired: { type: Boolean, default: false },
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
