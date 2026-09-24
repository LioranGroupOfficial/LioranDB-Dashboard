import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IWallet extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
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

WalletSchema.index({ userId: 1 });

const Wallet: Model<IWallet> =
  mongoose.models.Wallet || mongoose.model<IWallet>('Wallet', WalletSchema);

export default Wallet;

