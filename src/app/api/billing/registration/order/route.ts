import { NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { createRazorpayOrder } from '@/lib/razorpay';
import { REGISTRATION_FEE_PAISE, REGISTRATION_FEE_RUPEES } from '@/lib/plans';

export async function POST() {
  try {
    const sessionUser = await requireUserAPI();
    if (!sessionUser.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email address before continuing.' },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.accountRegistrationPaid) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        message: 'Account registration fee is already paid.',
      });
    }

    const order = await createRazorpayOrder({
      amountPaise: REGISTRATION_FEE_PAISE,
      currency: 'INR',
      receipt: `reg_${user._id.toString().slice(-8)}_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        email: user.email,
        type: 'registration',
      },
    });

    // Record pending payment in database
    await Payment.create({
      userId: user._id,
      amount: REGISTRATION_FEE_RUPEES,
      amountPaise: REGISTRATION_FEE_PAISE,
      currency: 'INR',
      status: 'PENDING',
      type: 'registration',
      razorpayOrderId: order.id,
      notes: 'LioranDB Account Registration Fee (₹100)',
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: REGISTRATION_FEE_PAISE,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.profile?.fullName || '',
        email: user.email,
        phone: user.profile?.phone || '',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create registration order';
    console.error('[Registration Order Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

