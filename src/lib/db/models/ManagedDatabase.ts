import mongoose, { Document, Model, Schema } from 'mongoose';

export type DatabaseStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'FAILED'
  | 'TERMINATED';

export interface IManagedDatabase extends Document {
  customerId: mongoose.Types.ObjectId;
  name: string;
  username: string;
  encryptedConnectionUri?: string;
  host: string;
  port: number;
  databaseName: string;
  status: DatabaseStatus;
  planId: string;
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
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    encryptedConnectionUri: { type: String },
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true, default: 27017 },
    databaseName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'FAILED', 'TERMINATED'],
      default: 'PENDING',
    },
    planId: { type: String, required: true, default: 'managed-v1' },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    provisionedAt: { type: Date },
    suspendedAt: { type: Date },
    suspensionReason: { type: String },
    temporaryCredentialExpiresAt: { type: Date },
    passwordChangeRequired: { type: Boolean, default: true },
    adminNotes: { type: String },
    providerDeploymentId: { type: String },
  },
  { timestamps: true }
);

ManagedDatabaseSchema.index({ customerId: 1, status: 1 });

const ManagedDatabase: Model<IManagedDatabase> =
  mongoose.models.ManagedDatabase ||
  mongoose.model<IManagedDatabase>('ManagedDatabase', ManagedDatabaseSchema);

export default ManagedDatabase;
