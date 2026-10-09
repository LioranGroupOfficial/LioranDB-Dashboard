import { Document, Model, Schema, model, models, Types } from '../adapter';

export type WalletTransactionType = 'credit' | 'debit' | 'refund' | 'adjustment';

export type WalletTransactionCategory =
  | 'topup'
  | 'instance_purchase'
  | 'subscription_renewal'
  | 'backup'
  | 'refund'
  | 'admin_adjustment';

export interface IWalletTransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  type: WalletTransactionType;
  category: WalletTransactionCategory;
  amountPaise: number; // Always positive integer paise
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  description: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  instanceId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit', 'refund', 'adjustment'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'topup',
        'instance_purchase',
        'subscription_renewal',
        'backup',
        'refund',
        'admin_adjustment',
      ],
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    balanceBeforePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfterPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      index: true,
    },
    instanceId: {
      type: Schema.Types.ObjectId,
      ref: 'ManagedDatabase',
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });

const WalletTransaction: Model<IWalletTransaction> =
  models.WalletTransaction ||
  model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);

export default WalletTransaction;
