import { Document, Model, Schema, model, models, Types } from '../adapter';

export type CouponScope = 'all' | 'plan' | 'customer' | 'instance' | 'ALL' | 'PLAN' | 'CUSTOMER' | 'INSTANCE';

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  discountPercentage: number;
  description?: string;
  enabled: boolean;
  scope: CouponScope;
  planIds?: string[];
  customerId?: Types.ObjectId;
  instanceId?: Types.ObjectId;
  expiresAt?: Date;
  maxRedemptions?: number;
  redemptionCount: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    description: { type: String, trim: true },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ['all', 'plan', 'customer', 'instance', 'ALL', 'PLAN', 'CUSTOMER', 'INSTANCE'],
      default: 'ALL',
    },
    planIds: [{ type: String, trim: true }],
    customerId: { type: Schema.Types.ObjectId, ref: 'User' },
    instanceId: { type: Schema.Types.ObjectId, ref: 'ManagedDatabase' },
    expiresAt: { type: Date },
    maxRedemptions: { type: Number },
    redemptionCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CouponSchema.index({ enabled: 1, expiresAt: 1 });

const Coupon: Model<ICoupon> = models.Coupon || model<ICoupon>('Coupon', CouponSchema);

export default Coupon;
