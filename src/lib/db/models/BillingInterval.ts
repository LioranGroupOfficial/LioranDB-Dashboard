import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IBillingInterval extends Document {
  _id: mongoose.Types.ObjectId;
  instanceId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  hourlyRatePaise: number;
  backupMonthlyPaise: number;
  backupEnabled: boolean;
  planId: string;
  planName: string;
  couponCode?: string;
  couponDiscountPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BillingIntervalSchema = new Schema<IBillingInterval>(
  {
    instanceId: {
      type: Schema.Types.ObjectId,
      ref: 'ManagedDatabase',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true, default: () => new Date() },
    endedAt: { type: Date },
    hourlyRatePaise: { type: Number, required: true },
    backupMonthlyPaise: { type: Number, required: true, default: 0 },
    backupEnabled: { type: Boolean, default: false },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    couponCode: { type: String, uppercase: true, trim: true },
    couponDiscountPercentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BillingIntervalSchema.index({ instanceId: 1, startedAt: 1 });
BillingIntervalSchema.index({ customerId: 1, startedAt: 1 });

const BillingInterval: Model<IBillingInterval> =
  mongoose.models.BillingInterval ||
  mongoose.model<IBillingInterval>('BillingInterval', BillingIntervalSchema);

export default BillingInterval;
