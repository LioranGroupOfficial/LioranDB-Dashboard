import { Document, Model, Schema, model, models, Types } from '../adapter';

export interface IWallet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  balancePaise: number; // Integer paise, e.g. 10000 = ₹100
  lifetimeCreditsAddedPaise: number;
  lifetimeCreditsUsedPaise: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balancePaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lifetimeCreditsAddedPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lifetimeCreditsUsedPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

WalletSchema.index({ userId: 1 }, { unique: true });

const Wallet: Model<IWallet> = models.Wallet || model<IWallet>('Wallet', WalletSchema);

export default Wallet;
