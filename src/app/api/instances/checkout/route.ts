import { NextRequest, NextResponse } from 'next/server';
import { requireRegisteredUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Payment } from '@/lib/db';
import { calculatePlanPrice, getPlan } from '@/lib/plans';
import { createRazorpayOrder } from '@/lib/razorpay';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireRegisteredUserAPI();
    const body = await req.json();
    const { name, planId, backupAddon, region } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide a valid database name (at least 2 characters).' },
        { status: 400 }
      );
    }

    const plan = getPlan(planId);
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan selected.' },
        { status: 400 }
      );
    }

    // Always calculate price server-side from centralized configuration
    const price = calculatePlanPrice(planId, !!backupAddon);

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const trimmedName = name.trim();
    const cleanSlug = trimmedName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);

    // Create preliminary instance record
    const instance = await ManagedDatabase.create({
      customerId: user._id,
      userId: user._id,
      name: trimmedName,
      slug: `${cleanSlug}-${Date.now().toString(36)}`,
      type: plan.type,
      planId: plan.id,
      status: 'PENDING',
      host: 'pending-allocation',
      port: 27017,
      databaseName: `db_${cleanSlug.slice(0, 16)}`,
      username: `usr_${Math.random().toString(36).slice(2, 8)}`,
      cpu: plan.cpu,
      memoryMb: plan.memoryMb,
      documentLimit: plan.documentLimit,
      backupEnabled: price.backupAddon,
      region: region || 'ap-south-1 (Mumbai)',
      monthlyPricePaise: price.totalPricePaise,
    });

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amountPaise: price.totalPricePaise,
      currency: 'INR',
      receipt: `inst_${instance._id.toString().slice(-8)}_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        instanceId: instance._id.toString(),
        planId: plan.id,
        backupAddon: String(price.backupAddon),
      },
    });

    // Create pending payment record
    await Payment.create({
      userId: user._id,
      instanceId: instance._id,
      planId: plan.id,
      backupAddon: price.backupAddon,
      amount: price.totalPriceRupees,
      amountPaise: price.totalPricePaise,
      currency: 'INR',
      status: 'PENDING',
      type: 'instance_subscription',
      razorpayOrderId: order.id,
      notes: `LioranDB Managed Instance - ${plan.name} (${trimmedName})`,
    });

    return NextResponse.json({
      success: true,
      instanceId: instance._id.toString(),
      orderId: order.id,
      amount: price.totalPricePaise,
      amountRupees: price.totalPriceRupees,
      currency: 'INR',
      planName: plan.name,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.profile?.fullName || '',
        email: user.email,
        phone: user.profile?.phone || '',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create instance checkout';
    console.error('[Instance Checkout Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

