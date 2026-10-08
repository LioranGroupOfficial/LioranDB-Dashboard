import mongoose, { Document, Model, Schema } from 'mongoose';

export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentType = 'invoice' | 'instance_subscription' | 'backup_addon' | 'account_verification';

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  invoiceId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number; // in Rupees
  amountPaise: number; // in integer paise (e.g., 70592 for ₹705.92)
  currency: string;
  status: PaymentStatus;
  type?: PaymentType;
  planId?: string;
  instanceId?: mongoose.Types.ObjectId;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  razorpaySignatureVerified?: boolean;
  billingMonth?: string;
  periodStart?: Date;
  periodEnd?: Date;
  dueDate?: Date;
  paidAt?: Date;
  transactionReference?: string;
  notes?: string;
  recordedBy?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: ['PENDING', 'SUBMITTED', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    type: {
      type: String,
      enum: ['invoice', 'instance_subscription', 'backup_addon', 'account_verification'],
      default: 'invoice',
      index: true,
    },
    planId: { type: String },
    instanceId: { type: Schema.Types.ObjectId, ref: 'ManagedDatabase', index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    razorpaySignatureVerified: { type: Boolean, default: false },
    billingMonth: { type: String },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    dueDate: { type: Date },
    paidAt: { type: Date },
    transactionReference: { type: String },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ userId: 1, type: 1, status: 1 });
PaymentSchema.index({ invoiceId: 1, createdAt: -1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;
