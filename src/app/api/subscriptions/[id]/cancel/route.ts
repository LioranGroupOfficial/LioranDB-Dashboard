import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Subscription, ManagedDatabase } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;

    await connectToDatabase();
    const subscription = await Subscription.findById(id);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found.' }, { status: 404 });
    }

    if (
      sessionUser.role !== 'admin' &&
      subscription.userId.toString() !== sessionUser.userId
    ) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    subscription.autoRenew = false;
    subscription.cancelAtPeriodEnd = true;
    subscription.status = 'CANCELLED';
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = 'Cancelled by user';
    await subscription.save();

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'Subscription',
      entityId: subscription._id.toString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled. Instance will remain active until end of period.',
      subscription: {
        id: subscription._id.toString(),
        status: subscription.status,
        autoRenew: subscription.autoRenew,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cancel subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

