import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAPI } from '@/lib/auth/guards';
import { adminAdjustWallet } from '@/lib/wallet';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRoleAPI('admin');
    const body = await req.json();
    const { targetUserId, amountRupees, amountPaise, isCredit, reason } = body;

    if (!targetUserId || !reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return NextResponse.json(
        { error: 'Target user ID and a valid reason (min 3 characters) are required.' },
        { status: 400 }
      );
    }

    const calculatedPaise =
      typeof amountPaise === 'number'
        ? Math.round(amountPaise)
        : typeof amountRupees === 'number'
        ? Math.round(amountRupees * 100)
        : 0;

    if (calculatedPaise <= 0) {
      return NextResponse.json(
        { error: 'Adjustment amount must be a positive number.' },
        { status: 400 }
      );
    }

    const { wallet, transaction } = await adminAdjustWallet({
      adminUserId: admin.userId,
      targetUserId,
      amountPaise: calculatedPaise,
      isCredit: Boolean(isCredit),
      reason,
    });

    await createAuditLog({
      actorId: admin.userId,
      actorRole: 'admin',
      action: 'ADMIN_ACTION',
      entityType: 'Wallet',
      entityId: wallet._id.toString(),
      metadata: {
        targetUserId,
        amountPaise: calculatedPaise,
        isCredit: Boolean(isCredit),
        reason: reason.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      newBalancePaise: wallet.balancePaise,
      newBalanceRupees: wallet.balancePaise / 100,
      transactionId: transaction._id.toString(),
      message: 'Admin wallet adjustment recorded successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Adjustment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

