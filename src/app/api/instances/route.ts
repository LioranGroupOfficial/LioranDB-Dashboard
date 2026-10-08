import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';
import { getPlan, formatPaiseToRupees, formatPaiseToInr, PLANS } from '@/lib/plans';
import { validateCoupon, incrementCouponRedemption } from '@/lib/billing/coupons';
import { provisionInstance } from '@/lib/providers/provisioning';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { generateDatabasePassword } from '@/lib/crypto';
import { CreateInstanceSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import { createApiError } from '@/lib/errors';
import type { IManagedDatabase } from '@/lib/db/models/ManagedDatabase';

export async function GET() {
  try {
    const sessionUser = await requireAccountVerifiedUserAPI();
    await connectToDatabase();

    const instances = await ManagedDatabase.find({
      $or: [{ customerId: sessionUser.userId }, { userId: sessionUser.userId }],
      status: { $ne: 'TERMINATED' },
    })
      .sort({ createdAt: -1 })
      .lean();

    const period = getCurrentMonthPeriod();

    const enriched = instances.map((inst) => {
      const plan = PLANS[inst.planId] || { name: inst.planId, hourlyRatePaise: inst.hourlyRatePaise || 100 };
      const calc = calculateInstanceUsage(inst as unknown as IManagedDatabase, period);
      return {
        id: inst._id.toString(),
        name: inst.name,
        planId: inst.planId,
        planName: plan.name,
        hourlyRatePaise: inst.hourlyRatePaise || plan.hourlyRatePaise || 100,
        hourlyRateFormatted: formatPaiseToInr(inst.hourlyRatePaise || plan.hourlyRatePaise || 100) + '/hr',
        status: inst.status,
        host: inst.host,
        port: inst.port,
        databaseName: inst.databaseName,
        backupEnabled: Boolean(inst.backupEnabled),
        billingStartedAt: inst.billingStartedAt ? new Date(inst.billingStartedAt).toISOString() : null,
        currentEstimatedUsagePaise: calc.totalPaise,
        currentEstimatedHours: calc.billableHours,
        createdAt: inst.createdAt ? new Date(inst.createdAt).toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({ instances: enriched });
  } catch (error: unknown) {
    return createApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireAccountVerifiedUserAPI();
    await connectToDatabase();

    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = CreateInstanceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: getZodErrorMessage(parseResult.error) },
        { status: 400 }
      );
    }

    const { name, planId, backupEnabled, couponCode } = parseResult.data;

    // Check plan validity and self-service status
    const plan = getPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid database plan selected.' }, { status: 400 });
    }

    if (!plan.isSelfService) {
      return NextResponse.json(
        {
          error: `The ${plan.name} plan requires manual communication with LioranDB. Please contact ${plan.contactEmail || 'support@liorandb.com'}.`,
        },
        { status: 400 }
      );
    }

    // Check unique name for this customer
    const existing = await ManagedDatabase.findOne({
      customerId: user._id,
      name: name.trim().toLowerCase(),
      status: { $ne: 'TERMINATED' },
    });

    if (existing) {
      return NextResponse.json(
        { error: `You already have an active database instance named "${name}". Please choose another name.` },
        { status: 409 }
      );
    }

    // Validate coupon if provided
    let appliedCouponCode: string | undefined = undefined;
    let couponDiscountPercentage = 0;

    if (couponCode && couponCode.trim()) {
      const couponCheck = await validateCoupon({
        code: couponCode,
        customerId: user._id,
        planId: plan.id,
      });

      if (!couponCheck.valid) {
        return NextResponse.json(
          { error: couponCheck.error || 'Invalid coupon code.' },
          { status: 400 }
        );
      }

      appliedCouponCode = couponCheck.code;
      couponDiscountPercentage = couponCheck.discountPercentage;
    }

    // Generate initial master user password (returned only once)
    const masterPassword = generateDatabasePassword(24);
    const masterUsername = 'db_admin';

    // Create ManagedDatabase in PENDING status
    const instance = await ManagedDatabase.create({
      customerId: user._id,
      userId: user._id,
      name: name.trim().toLowerCase(),
      planId: plan.id,
      hourlyRatePaise: plan.hourlyRatePaise,
      backupEnabled: Boolean(backupEnabled),
      backupMonthlyPaise: backupEnabled ? 20000 : 0,
      couponCode: appliedCouponCode,
      couponDiscountPercentage,
      status: 'PROVISIONING',
      host: 'provisioning...',
      port: 27017,
      databaseName: name.trim().toLowerCase().replace(/-/g, '_'),
      username: masterUsername,
      databaseUsers: [
        {
          username: masterUsername,
          createdAt: new Date(),
        },
      ],
    });

    // Run provisioning pipeline
    try {
      await provisionInstance(instance);
      if (appliedCouponCode) {
        await incrementCouponRedemption(appliedCouponCode);
      }
    } catch (provErr) {
      console.error('[Provisioning Error]', provErr);
      instance.status = 'FAILED';
      await instance.save();
      return NextResponse.json(
        { error: 'Instance provisioning encountered an infrastructure error. Please try again or contact support.' },
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
        hourlyRatePaise: instance.hourlyRatePaise,
        backupEnabled: instance.backupEnabled,
        couponCode: appliedCouponCode,
      },
    });

    await createNotification({
      userId: user._id.toString(),
      type: 'PROVISIONING_COMPLETE',
      title: 'Database Instance Active',
      body: `Your database "${instance.name}" (${plan.name} at ${formatPaiseToRupees(instance.hourlyRatePaise || 100)}/hr) is now active and running.`,
      link: `/database/${instance._id.toString()}`,
    });

    return NextResponse.json({
      success: true,
      instance: {
        id: instance._id.toString(),
        name: instance.name,
        planId: instance.planId,
        planName: plan.name,
        status: instance.status,
        host: instance.host,
        port: instance.port,
        databaseName: instance.databaseName,
        username: masterUsername,
        password: masterPassword, // returned strictly once upon creation
        hourlyRatePaise: instance.hourlyRatePaise,
        backupEnabled: instance.backupEnabled,
        billingStartedAt: instance.billingStartedAt,
      },
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
