import mongoose, { ClientSession } from 'mongoose';
import { connectToDatabase, Wallet, WalletTransaction } from '../db';
import type { IWallet } from '../db/models/Wallet';
import type {
  IWalletTransaction,
  WalletTransactionCategory,
  WalletTransactionType,
} from '../db/models/WalletTransaction';

export class InsufficientBalanceError extends Error {
  public requiredPaise: number;
  public availablePaise: number;
  public shortfallPaise: number;

  constructor(requiredPaise: number, availablePaise: number) {
    const shortfall = Math.max(0, requiredPaise - availablePaise);
    super(
      `Insufficient wallet credits. Required: ₹${(requiredPaise / 100).toFixed(
        2
      )}, Available: ₹${(availablePaise / 100).toFixed(2)}, Shortfall: ₹${(
        shortfall / 100
      ).toFixed(2)}`
    );
    this.name = 'InsufficientBalanceError';
    this.requiredPaise = requiredPaise;
    this.availablePaise = availablePaise;
    this.shortfallPaise = shortfall;
  }
}

/**
 * Ensures a wallet document exists for the user.
 */
export async function getOrCreateWallet(
  userId: string | mongoose.Types.ObjectId,
  session?: ClientSession
): Promise<IWallet> {
  await connectToDatabase();
  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  let wallet = await Wallet.findOne({ userId: uid }).session(session || null);
  if (!wallet) {
    const created = await Wallet.create(
      [
        {
          userId: uid,
          balancePaise: 0,
          lifetimeCreditsAddedPaise: 0,
          lifetimeCreditsUsedPaise: 0,
        },
      ],
      { session }
    );
    wallet = created[0];
  }
  return wallet;
}

export interface CreditWalletParams {
  userId: string | mongoose.Types.ObjectId;
  amountPaise: number;
  category: WalletTransactionCategory;
  description: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  session?: ClientSession;
}

/**
 * Atomically credits user wallet and creates an immutable ledger entry.
 */
export async function creditWallet(params: CreditWalletParams): Promise<{
  wallet: IWallet;
  transaction: IWalletTransaction;
  alreadyProcessed?: boolean;
}> {
  await connectToDatabase();
  const {
    userId,
    amountPaise,
    category,
    description,
    razorpayPaymentId,
    razorpayOrderId,
    idempotencyKey,
    metadata,
    session,
  } = params;

  const integerPaise = Math.round(amountPaise);
  if (integerPaise <= 0 || !Number.isInteger(integerPaise)) {
    throw new Error('Credit amount must be a positive integer in paise.');
  }

  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  // Idempotency check: If an idempotencyKey is supplied, verify if it was already processed
  if (idempotencyKey) {
    const existingTx = await WalletTransaction.findOne({ idempotencyKey }).session(
      session || null
    );
    if (existingTx) {
      const currentWallet = await getOrCreateWallet(uid, session);
      return {
        wallet: currentWallet,
        transaction: existingTx,
        alreadyProcessed: true,
      };
    }
  }

  // Ensure wallet exists first
  await getOrCreateWallet(uid, session);

  // Atomically increment balance
  const updatedWallet = await Wallet.findOneAndUpdate(
    { userId: uid },
    {
      $inc: {
        balancePaise: integerPaise,
        lifetimeCreditsAddedPaise: integerPaise,
      },
    },
    { new: true, session: session || null }
  );

  if (!updatedWallet) {
    throw new Error('Failed to update wallet balance.');
  }

  const balanceBeforePaise = updatedWallet.balancePaise - integerPaise;
  const balanceAfterPaise = updatedWallet.balancePaise;

  const [transaction] = await WalletTransaction.create(
    [
      {
        userId: uid,
        walletId: updatedWallet._id,
        type: 'credit',
        category,
        amountPaise: integerPaise,
        balanceBeforePaise,
        balanceAfterPaise,
        description,
        razorpayPaymentId,
        razorpayOrderId,
        idempotencyKey,
        metadata,
      },
    ],
    { session: session || null }
  );

  return {
    wallet: updatedWallet,
    transaction,
  };
}

export interface DebitWalletParams {
  userId: string | mongoose.Types.ObjectId;
  amountPaise: number;
  category: WalletTransactionCategory;
  description: string;
  instanceId?: string | mongoose.Types.ObjectId;
  subscriptionId?: string | mongoose.Types.ObjectId;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  session?: ClientSession;
}

/**
 * Concurrency-safe atomic wallet debit.
 * Uses conditional atomic decrement `{ balancePaise: { $gte: amountPaise } }`
 * to guarantee balance never becomes negative even under concurrent requests.
 */
export async function debitWallet(params: DebitWalletParams): Promise<{
  wallet: IWallet;
  transaction: IWalletTransaction;
  alreadyProcessed?: boolean;
}> {
  await connectToDatabase();
  const {
    userId,
    amountPaise,
    category,
    description,
    instanceId,
    subscriptionId,
    idempotencyKey,
    metadata,
    session,
  } = params;

  const integerPaise = Math.round(amountPaise);
  if (integerPaise <= 0 || !Number.isInteger(integerPaise)) {
    throw new Error('Debit amount must be a positive integer in paise.');
  }

  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  // Idempotency check
  if (idempotencyKey) {
    const existingTx = await WalletTransaction.findOne({ idempotencyKey }).session(
      session || null
    );
    if (existingTx) {
      const currentWallet = await getOrCreateWallet(uid, session);
      return {
        wallet: currentWallet,
        transaction: existingTx,
        alreadyProcessed: true,
      };
    }
  }

  const currentWallet = await getOrCreateWallet(uid, session);
  if (currentWallet.balancePaise < integerPaise) {
    throw new InsufficientBalanceError(integerPaise, currentWallet.balancePaise);
  }

  // Atomic conditional update to prevent double-spending
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId: uid,
      balancePaise: { $gte: integerPaise },
    },
    {
      $inc: {
        balancePaise: -integerPaise,
        lifetimeCreditsUsedPaise: integerPaise,
      },
    },
    { new: true, session: session || null }
  );

  if (!updatedWallet) {
    // Re-check live balance to provide accurate error details
    const freshWallet = await Wallet.findOne({ userId: uid }).session(session || null);
    throw new InsufficientBalanceError(
      integerPaise,
      freshWallet ? freshWallet.balancePaise : 0
    );
  }

  const balanceBeforePaise = updatedWallet.balancePaise + integerPaise;
  const balanceAfterPaise = updatedWallet.balancePaise;

  const instObjectId =
    typeof instanceId === 'string'
      ? new mongoose.Types.ObjectId(instanceId)
      : instanceId;
  const subObjectId =
    typeof subscriptionId === 'string'
      ? new mongoose.Types.ObjectId(subscriptionId)
      : subscriptionId;

  const [transaction] = await WalletTransaction.create(
    [
      {
        userId: uid,
        walletId: updatedWallet._id,
        type: 'debit',
        category,
        amountPaise: integerPaise,
        balanceBeforePaise,
        balanceAfterPaise,
        description,
        instanceId: instObjectId,
        subscriptionId: subObjectId,
        idempotencyKey,
        metadata,
      },
    ],
    { session: session || null }
  );

  return {
    wallet: updatedWallet,
    transaction,
  };
}

export interface RefundWalletParams {
  userId: string | mongoose.Types.ObjectId;
  amountPaise: number;
  description: string;
  instanceId?: string | mongoose.Types.ObjectId;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  session?: ClientSession;
}

/**
 * Refunds credits back to user wallet (e.g., when instance provisioning permanently fails).
 */
export async function refundWallet(params: RefundWalletParams): Promise<{
  wallet: IWallet;
  transaction: IWalletTransaction;
  alreadyProcessed?: boolean;
}> {
  await connectToDatabase();
  const { userId, amountPaise, description, instanceId, idempotencyKey, metadata, session } =
    params;

  const integerPaise = Math.round(amountPaise);
  if (integerPaise <= 0) {
    throw new Error('Refund amount must be a positive integer in paise.');
  }

  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  if (idempotencyKey) {
    const existingTx = await WalletTransaction.findOne({ idempotencyKey }).session(
      session || null
    );
    if (existingTx) {
      const currentWallet = await getOrCreateWallet(uid, session);
      return {
        wallet: currentWallet,
        transaction: existingTx,
        alreadyProcessed: true,
      };
    }
  }

  await getOrCreateWallet(uid, session);

  const updatedWallet = await Wallet.findOneAndUpdate(
    { userId: uid },
    {
      $inc: {
        balancePaise: integerPaise,
        lifetimeCreditsUsedPaise: -integerPaise, // reduce used metric
      },
    },
    { new: true, session: session || null }
  );

  if (!updatedWallet) {
    throw new Error('Failed to refund wallet balance.');
  }

  const balanceBeforePaise = updatedWallet.balancePaise - integerPaise;
  const balanceAfterPaise = updatedWallet.balancePaise;

  const instObjectId =
    typeof instanceId === 'string'
      ? new mongoose.Types.ObjectId(instanceId)
      : instanceId;

  const [transaction] = await WalletTransaction.create(
    [
      {
        userId: uid,
        walletId: updatedWallet._id,
        type: 'refund',
        category: 'refund',
        amountPaise: integerPaise,
        balanceBeforePaise,
        balanceAfterPaise,
        description,
        instanceId: instObjectId,
        idempotencyKey,
        metadata,
      },
    ],
    { session: session || null }
  );

  return {
    wallet: updatedWallet,
    transaction,
  };
}

export interface AdminAdjustParams {
  adminUserId: string;
  targetUserId: string | mongoose.Types.ObjectId;
  amountPaise: number;
  isCredit: boolean;
  reason: string;
}

/**
 * Admin manual credit/debit adjustment with mandatory reason and immutable audit log.
 */
export async function adminAdjustWallet(params: AdminAdjustParams): Promise<{
  wallet: IWallet;
  transaction: IWalletTransaction;
}> {
  await connectToDatabase();
  const { adminUserId, targetUserId, amountPaise, isCredit, reason } = params;

  if (!reason || reason.trim().length < 3) {
    throw new Error('A valid reason is required for admin wallet adjustments.');
  }

  const integerPaise = Math.round(amountPaise);
  if (integerPaise <= 0) {
    throw new Error('Adjustment amount must be positive.');
  }

  const uid =
    typeof targetUserId === 'string'
      ? new mongoose.Types.ObjectId(targetUserId)
      : targetUserId;

  const currentWallet = await getOrCreateWallet(uid);

  if (!isCredit && currentWallet.balancePaise < integerPaise) {
    throw new InsufficientBalanceError(integerPaise, currentWallet.balancePaise);
  }

  const incBalance = isCredit ? integerPaise : -integerPaise;
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId: uid,
      ...(isCredit ? {} : { balancePaise: { $gte: integerPaise } }),
    },
    {
      $inc: {
        balancePaise: incBalance,
        ...(isCredit
          ? { lifetimeCreditsAddedPaise: integerPaise }
          : { lifetimeCreditsUsedPaise: integerPaise }),
      },
    },
    { new: true }
  );

  if (!updatedWallet) {
    throw new Error('Failed to execute admin wallet adjustment.');
  }

  const balanceBeforePaise = isCredit
    ? updatedWallet.balancePaise - integerPaise
    : updatedWallet.balancePaise + integerPaise;
  const balanceAfterPaise = updatedWallet.balancePaise;

  const [transaction] = await WalletTransaction.create([
    {
      userId: uid,
      walletId: updatedWallet._id,
      type: 'adjustment',
      category: 'admin_adjustment',
      amountPaise: integerPaise,
      balanceBeforePaise,
      balanceAfterPaise,
      description: `Admin adjustment: ${reason.trim()} (${isCredit ? '+Credit' : '-Debit'})`,
      metadata: {
        adjustedBy: adminUserId,
        reason: reason.trim(),
        isCredit,
      },
    },
  ]);

  return { wallet: updatedWallet, transaction };
}
