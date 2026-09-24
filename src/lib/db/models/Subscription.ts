import mongoose, { Document, Model, Schema } from 'mongoose';

export type SubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAYMENT_DUE'
  | 'GRACE_PERIOD'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  databaseId?: mongoose.Types.ObjectId;
  instanceId?: mongoose.Types.ObjectId;
  planId: string;
  planName: string;
  amount: number; // monthly amount in Rupees
  basePricePaise?: number;
  backupAddon?: boolean;
  backupPricePaise?: number;
  totalPricePaise?: number;
  monthlyPricePaise?: number;
  currency: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  startedAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  nextPaymentDate?: Date;
  nextBillingAt?: Date;
  lastChargedAt?: Date;
  gracePeriodEndsAt?: Date;
  cancelAtPeriodEnd?: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  gatewaySubscriptionId?: string;
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    databaseId: { type: Schema.Types.ObjectId, ref: 'ManagedDatabase' },
    instanceId: { type: Schema.Types.ObjectId, ref: 'ManagedDatabase' },
    planId: { type: String, required: true, default: 'starter' },
    planName: { type: String, required: true, default: 'Starter Dedicated' },
    amount: { type: Number, required: true, default: 1499 },
    basePricePaise: { type: Number },
    backupAddon: { type: Boolean, default: false },
    backupPricePaise: { type: Number, default: 0 },
    totalPricePaise: { type: Number },
    monthlyPricePaise: { type: Number },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ACTIVE',
        'PAYMENT_DUE',
        'GRACE_PERIOD',
        'PAST_DUE',
        'SUSPENDED',
        'CANCELLED',
      ],
      default: 'PENDING',
    },
    autoRenew: { type: Boolean, default: true },
    startedAt: { type: Date },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    nextPaymentDate: { type: Date },
    nextBillingAt: { type: Date },
    lastChargedAt: { type: Date },
    gracePeriodEndsAt: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    suspendedAt: { type: Date },
    suspensionReason: { type: String },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    gatewaySubscriptionId: { type: String },
    razorpaySubscriptionId: { type: String },
    razorpayPlanId: { type: String },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, nextPaymentDate: 1 });
SubscriptionSchema.index({ status: 1, nextBillingAt: 1 });
SubscriptionSchema.index({ status: 1, gracePeriodEndsAt: 1 });

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

export default Subscription;
