import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPolicyAcceptance extends Document {
  userId: mongoose.Types.ObjectId;
  policyId: mongoose.Types.ObjectId;
  policySlug: string;
  policyVersion: string;
  acceptedAt: Date;
  ip?: string;
  userAgent?: string;
}

const PolicyAcceptanceSchema = new Schema<IPolicyAcceptance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'PolicyDocument', required: true },
    policySlug: { type: String, required: true },
    policyVersion: { type: String, required: true },
    acceptedAt: { type: Date, required: true, default: Date.now },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: false }
);

PolicyAcceptanceSchema.index({ userId: 1, policySlug: 1, policyVersion: 1 });

const PolicyAcceptance: Model<IPolicyAcceptance> =
  mongoose.models.PolicyAcceptance ||
  mongoose.model<IPolicyAcceptance>('PolicyAcceptance', PolicyAcceptanceSchema);

export default PolicyAcceptance;
