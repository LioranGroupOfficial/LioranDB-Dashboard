import { NextRequest, NextResponse } from 'next/server';
import { requireRegisteredUserAPI, requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Subscription } from '@/lib/db';
import { calculatePlanPrice, getPlan, formatPaiseToRupees } from '@/lib/plans';
import { debitWallet, refundWallet, InsufficientBalanceError, getOrCreateWallet } from '@/lib/wallet';
import { provisionInstance } from '@/lib/providers/provisioning';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export async function GET() {
  try {
    const sessionUser = await requireUserAPI();
    await connectToDatabase();

    const instances = await ManagedDatabase.find({
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
      status: { $nin: ['DELETED', 'TERMINATED'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const enriched = instances.map((inst) => {
      const plan = getPlan(inst.planId);
      return {
        id: inst._id.toString(),
        name: inst.name,
        slug: inst.slug,
        type: inst.type || plan?.type || 'dedicated',
        status: inst.status,
        planId: inst.planId,
        planName: plan?.name || 'Managed Instance',
        region: inst.region || 'ap-south-1 (Mumbai)',
        cpu: inst.cpu || plan?.cpu || '1 vCPU',
        memoryMb: inst.memoryMb || plan?.memoryMb || 1024,
        documentLimit: inst.documentLimit || plan?.documentLimit || 100000,
        backupEnabled: inst.backupEnabled ?? false,
        host: inst.host,
        port: inst.port,
        databaseName: inst.databaseName,
        username: inst.username,
        monthlyPricePaise: inst.monthlyPricePaise || (plan?.pricePaise || 149900),
        provisionedAt: inst.provisionedAt,
        createdAt: inst.createdAt,
      };
    });

    return NextResponse.json({ instances: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch instances';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    // Authoritative server-side price calculation
    const price = calculatePlanPrice(planId, !!backupAddon);

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const trimmedName = name.trim();
    const cleanSlug = trimmedName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);

    // 1. Atomic Wallet Debit
    let debitResult;
    try {
      debitResult = await debitWallet({
        userId: user._id,
        amountPaise: price.totalPricePaise,
        category: 'instance_purchase',
        description: `Deploy LioranDB ${plan.name} (${trimmedName})`,
        metadata: {
          planId: plan.id,
          instanceName: trimmedName,
          backupAddon: price.backupAddon,
        },
      });
    } catch (err: unknown) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            message: err.message,
            requiredPaise: err.requiredPaise,
            availablePaise: err.availablePaise,
            shortfallPaise: err.shortfallPaise,
            requiredRupees: err.requiredPaise / 100,
            availableRupees: err.availablePaise / 100,
            shortfallRupees: err.shortfallPaise / 100,
          },
          { status: 400 }
        );
      }
      throw err;
    }

    // 2. Create Instance & Subscription Records
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const instance = await ManagedDatabase.create({
      customerId: user._id,
      userId: user._id,
      name: trimmedName,
      slug: `${cleanSlug}-${Date.now().toString(36)}`,
      type: plan.type,
      planId: plan.id,
      status: 'PROVISIONING',
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

    const subscription = await Subscription.create({
      userId: user._id,
      databaseId: instance._id,
      instanceId: instance._id,
      planId: plan.id,
      planName: plan.name,
      amount: price.totalPriceRupees,
      basePricePaise: price.basePricePaise,
      backupAddon: price.backupAddon,
      backupPricePaise: price.backupPricePaise,
      totalPricePaise: price.totalPricePaise,
      monthlyPricePaise: price.totalPricePaise,
      currency: 'INR',
      status: 'ACTIVE',
      autoRenew: true,
      startedAt: now,
      lastChargedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingAt: periodEnd,
      nextPaymentDate: periodEnd,
    });

    instance.subscriptionId = subscription._id;
    await instance.save();

    // 3. Trigger Automatic Provisioning with Compensation Safeguard
    let provisionedInstance;
    try {
      provisionedInstance = await provisionInstance(instance, user.email);
    } catch (provisionErr: unknown) {
      console.error('[Provisioning Error, Refunding Credits]', provisionErr);
      // Compensation mechanism: Refund the debited amount idempotently
      await refundWallet({
        userId: user._id,
        amountPaise: price.totalPricePaise,
        description: `Refund: Provisioning failed for ${trimmedName}`,
        instanceId: instance._id,
        idempotencyKey: `refund_prov_fail_${instance._id}`,
      });

      instance.status = 'FAILED';
      await instance.save();

      subscription.status = 'CANCELLED';
      subscription.cancellationReason = 'Provisioning infrastructure failure (Credits refunded)';
      await subscription.save();

      return NextResponse.json(
        {
          error: 'Instance provisioning encountered an infrastructure error. Your credits have been automatically refunded to your wallet.',
          instanceId: instance._id.toString(),
          status: 'FAILED',
        },
        { status: 500 }
      );
    }

    await createAuditLog({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'DATABASE_PROVISIONED',
      entityType: 'ManagedDatabase',
      entityId: instance._id.toString(),
      metadata: {
        planId: instance.planId,
        name: instance.name,
        backupAddon: price.backupAddon,
        creditsDebitedPaise: price.totalPricePaise,
      },
    });

    await createNotification({
      userId: user._id.toString(),
      type: 'PROVISIONING_COMPLETE',
      title: 'Database Instance Ready',
      body: `Your instance "${instance.name}" (${plan.name}) has been provisioned and is active. ${formatPaiseToRupees(
        price.totalPricePaise
      )} credits deducted.`,
      link: `/database/${instance._id}`,
    });

    return NextResponse.json({
      success: true,
      instanceId: provisionedInstance._id.toString(),
      status: provisionedInstance.status,
      host: provisionedInstance.host,
      port: provisionedInstance.port,
      databaseName: provisionedInstance.databaseName,
      remainingBalancePaise: debitResult.wallet.balancePaise,
      remainingBalanceRupees: debitResult.wallet.balancePaise / 100,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create instance';
    console.error('[Create Instance Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
