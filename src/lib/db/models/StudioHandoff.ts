import { Document, Model, Schema, model, models, Types } from '../adapter';

export interface IStudioHandoff extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  instanceId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const StudioHandoffSchema = new Schema<IStudioHandoff>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    instanceId: { type: Schema.Types.ObjectId, ref: 'ManagedDatabase', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

StudioHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const StudioHandoff: Model<IStudioHandoff> =
  models.StudioHandoff || model<IStudioHandoff>('StudioHandoff', StudioHandoffSchema);

export default StudioHandoff;
