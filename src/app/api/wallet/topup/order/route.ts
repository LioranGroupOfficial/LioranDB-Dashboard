import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, Payment } from '@/lib/db';
import { createRazorpayOrder } from '@/lib/razorpay';
import { REGISTRATION_FEE_PAISE } from '@/lib/plans';

const MIN_TOPUP_PAISE = REGISTRATION_FEE_PAISE; // 10000 paise = ₹100
const MAX_TOPUP_PAISE = 10000000; // 10,000,000 paise = ₹1,00,000

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const body = await req.json();

    let amountPaise = 0;
    if (typeof body.amountPaise === 'number') {
      amountPaise = Math.round(body.amountPaise);
    } else if (typeof body.amountRupees === 'number') {
      amountPaise = Math.round(body.amountRupees * 100);
    } else {
      amountPaise = MIN_TOPUP_PAISE;
    }

    if (amountPaise < MIN_TOPUP_PAISE) {
      return NextResponse.json(
        {
          error: `Minimum credit top-up amount is ₹${(MIN_TOPUP_PAISE / 100).toFixed(
            0
          )}.`,
        },
        { status: 400 }
      );
    }

    if (amountPaise > MAX_TOPUP_PAISE) {
      return NextResponse.json(
        {
          error: `Maximum single credit top-up is ₹${(MAX_TOPUP_PAISE / 100).toLocaleString(
            'en-IN'
          )}.`,
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const order = await createRazorpayOrder({
      amountPaise,
      currency: 'INR',
      receipt: `topup_${user._id.toString().slice(-8)}_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        email: user.email,
        type: 'topup',
        amountPaise: String(amountPaise),
      },
    });

    await Payment.create({
      userId: user._id,
      amount: amountPaise / 100,
      amountPaise,
      currency: 'INR',
      status: 'PENDING',
      type: 'registration', // keep broad payment type for compatibility
      razorpayOrderId: order.id,
      notes: `LioranDB Credits Top-Up (₹${(amountPaise / 100).toLocaleString('en-IN')})`,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amountPaise,
      amountRupees: amountPaise / 100,
      currency: 'INR',
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.profile?.fullName || '',
        email: user.email,
        phone: user.profile?.phone || '',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create topup order';
    console.error('[Topup Order Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

