import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUserAPI, isAccountVerified } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { createRazorpayOrder } from '@/lib/razorpay';
import { createAuditLog } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireVerifiedUserAPI();
    await connectToDatabase();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    const rl = checkRateLimit('create_order', sessionUser.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many order requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const dbUser = await User.findById(sessionUser.userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // Check if user is already verified
    if (isAccountVerified(dbUser)) {
      return NextResponse.json({
        verified: true,
        message: 'Account is already verified.',
      });
    }

    // Reuse existing pending order if created within the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingPayment = await Payment.findOne({
      userId: dbUser._id,
      type: 'account_verification',
      status: 'PENDING',
      createdAt: { $gte: fifteenMinutesAgo },
    }).sort({ createdAt: -1 });

    if (existingPayment && existingPayment.razorpayOrderId) {
      return NextResponse.json({
        orderId: existingPayment.razorpayOrderId,
        amountPaise: 3000,
        currency: 'INR',
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
        user: {
          name: dbUser.profile?.fullName || '',
          email: dbUser.email,
          phone: dbUser.profile?.phone || '',
        },
      });
    }

    // Create a new Razorpay order for exactly ₹30 (3000 paise)
    const order = await createRazorpayOrder({
      amountPaise: 3000,
      currency: 'INR',
      receipt: `act_ver_${dbUser._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: dbUser._id.toString(),
        userEmail: dbUser.email,
        type: 'ACCOUNT_VERIFICATION',
      },
    });

    // Record pending payment in MongoDB
    await Payment.create({
      userId: dbUser._id,
      amount: 30,
      amountPaise: 3000,
      currency: 'INR',
      status: 'PENDING',
      type: 'account_verification',
      razorpayOrderId: order.id,
      notes: 'One-time ₹30 mandatory account verification payment',
      metadata: {
        receipt: order.receipt,
        ip,
        userAgent,
      },
    });

    // Update user record with pending order ID and status
    await User.findByIdAndUpdate(dbUser._id, {
      $set: {
        'accountVerification.razorpayOrderId': order.id,
        'accountVerification.status': 'PENDING',
      },
    });

    await createAuditLog({
      userId: dbUser._id.toString(),
      actorId: dbUser._id.toString(),
      actorRole: 'customer',
      action: 'ACCOUNT_VERIFICATION_ORDER_CREATED',
      entityType: 'Payment',
      entityId: order.id,
      metadata: { orderId: order.id, amountPaise: 3000, currency: 'INR' },
      ip,
      userAgent,
    });

    return NextResponse.json({
      orderId: order.id,
      amountPaise: 3000,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      user: {
        name: dbUser.profile?.fullName || '',
        email: dbUser.email,
        phone: dbUser.profile?.phone || '',
      },
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
