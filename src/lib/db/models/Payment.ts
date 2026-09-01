import mongoose, { Document, Model, Schema } from 'mongoose';

export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface IPayment extends Document {
  subscriptionId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  billingMonth?: string;
  razorpayPaymentLink?: string;
  periodStart?: Date;
  periodEnd?: Date;
  dueDate?: Date;
  paidAt?: Date;
  transactionReference?: string;
  submittedReference?: string;
  submittedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  verificationNotes?: string;
  notes?: string;
  recordedBy?: mongoose.Types.ObjectId;
  gatewayPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: false,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'INR' },
    status: {
      type: String,
      enum: ['PENDING', 'SUBMITTED', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
    },
    billingMonth: { type: String },
    razorpayPaymentLink: { type: String },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    dueDate: { type: Date },
    paidAt: { type: Date },
    transactionReference: { type: String },
    submittedReference: { type: String },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verificationNotes: { type: String },
    notes: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    gatewayPaymentId: { type: String },
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ subscriptionId: 1, createdAt: -1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;

