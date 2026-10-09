import { Document, Model, Schema, model, models, Types } from '../adapter';

export interface IPolicyAcceptance extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  policyId: Types.ObjectId;
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
    acceptedAt: { type: Date, required: true, default: () => new Date() },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: false }
);

PolicyAcceptanceSchema.index({ userId: 1, policySlug: 1, policyVersion: 1 });

const PolicyAcceptance: Model<IPolicyAcceptance> =
  models.PolicyAcceptance ||
  model<IPolicyAcceptance>('PolicyAcceptance', PolicyAcceptanceSchema);

export default PolicyAcceptance;
