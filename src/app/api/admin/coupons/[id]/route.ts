import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, Coupon } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;
    const body = await req.json();

    await connectToDatabase();
    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    if (typeof body.enabled === 'boolean') {
      coupon.enabled = body.enabled;
    }
    if (typeof body.maxRedemptions === 'number' || body.maxRedemptions === null) {
      coupon.maxRedemptions = body.maxRedemptions || undefined;
    }
    if (body.expiresAt !== undefined) {
      coupon.expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    }

    await coupon.save();

    await createAuditLog({
      userId: admin.userId,
      action: 'COUPON_UPDATED',
      entityType: 'COUPON',
      entityId: coupon._id.toString(),
      metadata: { code: coupon.code, enabled: coupon.enabled },
    });

    return NextResponse.json({ success: true, coupon });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update coupon';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminAPI();
    const { id } = await params;

    await connectToDatabase();
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    await createAuditLog({
      userId: admin.userId,
      action: 'COUPON_DELETED',
      entityType: 'COUPON',
      entityId: id,
      metadata: { code: coupon.code },
    });

    return NextResponse.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete coupon';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

