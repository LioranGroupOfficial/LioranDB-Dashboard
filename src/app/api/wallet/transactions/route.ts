import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, WalletTransaction } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    await connectToDatabase();

    const transactions = await WalletTransaction.find({
      userId: sessionUser.userId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formatted = transactions.map((t) => ({
      id: t._id.toString(),
      type: t.type,
      category: t.category,
      amountPaise: t.amountPaise,
      amountRupees: t.amountPaise / 100,
      balanceBeforePaise: t.balanceBeforePaise,
      balanceBeforeRupees: t.balanceBeforePaise / 100,
      balanceAfterPaise: t.balanceAfterPaise,
      balanceAfterRupees: t.balanceAfterPaise / 100,
      description: t.description,
      razorpayPaymentId: t.razorpayPaymentId,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({ transactions: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

