import { NextRequest, NextResponse } from 'next/server';
import { requireAccountVerifiedUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, HostingNode } from '@/lib/db';
import { getPlan, formatPaiseToRupees, formatPaiseToInr, PLANS } from '@/lib/plans';
import { validateCoupon, incrementCouponRedemption } from '@/lib/billing/coupons';
import { provisionInstance } from '@/lib/providers/provisioning';
import { reconcileHostingNodes } from '@/lib/providers/reconciliation';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { generateDatabasePassword, decrypt } from '@/lib/crypto';
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
    await reconcileHostingNodes();

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

    // Enforce 2 databases per user limit
    const MAX_DATABASES_PER_USER = 2;
    const activeDatabasesCount = await ManagedDatabase.countDocuments({
      $or: [{ customerId: user._id }, { userId: user._id }],
      status: { $nin: ['TERMINATED', 'DELETED'] },
    });

    if (user.role !== 'admin' && activeDatabasesCount >= MAX_DATABASES_PER_USER) {
      return NextResponse.json(
        {
          error: `Database limit reached: You can create a maximum of ${MAX_DATABASES_PER_USER} databases per account. Please terminate an existing database before creating a new one.`,
          code: 'DATABASE_LIMIT_EXCEEDED',
          limit: MAX_DATABASES_PER_USER,
          currentCount: activeDatabasesCount,
        },
        { status: 400 }
      );
    }

    // If 0 hosting nodes exist in total, automatically seed the default development node
    const totalNodesCount = await HostingNode.countDocuments();
    if (totalNodesCount === 0) {
      try {
        await HostingNode.create({
          name: 'Localhost Node (127.0.0.1)',
          slug: 'localhost-node-01',
          region: 'Localhost / Development',
          dbUrl: '127.0.0.1',
          port: 27018,
          protocol: 'http',
          httpPort: 27018,
          grpcUrl: '127.0.0.1',
          grpcPort: 27019,
          controlPlaneEndpoint: 'http://127.0.0.1:27018',
          allocationMode: 'DEDICATED',
          status: 'AVAILABLE',
          healthStatus: 'HEALTHY',
          maxCapacity: 1,
          currentAssignedCount: 0,
          defaultRootUsername: 'admin',
          isDefault: true,
          notes: 'Auto-seeded default development node',
        });
      } catch {
        // Ignore if concurrent create
      }
    }

    // Allocate a dedicated active hosting node (1 server per user / database instance)
    const activeInstances = await ManagedDatabase.find({
      status: { $nin: ['TERMINATED', 'DELETED'] },
      hostingNodeId: { $exists: true, $ne: null },
    })
      .select('hostingNodeId')
      .lean();

    const occupiedNodeIds = activeInstances
      .map((inst) => inst.hostingNodeId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));

    const availableNodes = await HostingNode.find({
      status: { $in: ['AVAILABLE', 'ACTIVE'] },
      _id: { $nin: occupiedNodeIds },
    }).lean();

    if (availableNodes.length === 0) {
      return NextResponse.json(
        {
          error: 'No dedicated database hosting servers are currently available. Please email support@liorandb.com for this query.',
          code: 'HOSTING_SERVERS_OCCUPIED',
          contactEmail: 'support@liorandb.com',
        },
        { status: 400 }
      );
    }

    // Select default unassigned node if available or the first available unassigned node
    const selectedNode = availableNodes.find((n) => n.isDefault) || availableNodes[0];

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
    const masterUsername = selectedNode.defaultRootUsername || 'admin';
    const controlPlaneEndpoint = `${selectedNode.protocol}://${selectedNode.dbUrl}:${selectedNode.httpPort}`;

    // Create ManagedDatabase assigned to the selected hosting node
    const instance = await ManagedDatabase.create({
      customerId: user._id,
      userId: user._id,
      hostingNodeId: selectedNode._id,
      name: name.trim().toLowerCase(),
      planId: plan.id,
      hourlyRatePaise: plan.hourlyRatePaise,
      backupEnabled: Boolean(backupEnabled),
      backupMonthlyPaise: backupEnabled ? 20000 : 0,
      couponCode: appliedCouponCode,
      couponDiscountPercentage,
      status: 'PROVISIONING',
      host: selectedNode.dbUrl,
      port: selectedNode.port,
      grpcUrl: selectedNode.grpcUrl,
      grpcPort: selectedNode.grpcPort,
      controlPlaneEndpoint,
      databaseName: name.trim().toLowerCase().replace(/-/g, '_'),
      username: masterUsername,
      rootUsername: masterUsername,
      databaseUsers: [
        {
          username: masterUsername,
          createdAt: new Date(),
        },
      ],
    });

    // Update node assigned count
    await HostingNode.findByIdAndUpdate(selectedNode._id, {
      $inc: { currentAssignedCount: 1 },
    });

    // Run provisioning pipeline
    try {
      await provisionInstance(instance, { customerEmail: user.email, initialPassword: masterPassword });
      if (appliedCouponCode) {
        await incrementCouponRedemption(appliedCouponCode);
      }
    } catch (provErr: unknown) {
      console.error('[Provisioning Error]', provErr);
      instance.status = 'FAILED';
      await instance.save();
      const errMessage = provErr instanceof Error ? provErr.message : 'Instance provisioning encountered an infrastructure error. Please try again or contact support.';
      const statusCode = errMessage.includes('No dedicated database hosting servers') ? 400 : 500;
      return NextResponse.json(
        { error: errMessage, contactEmail: 'support@liorandb.com' },
        { status: statusCode }
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

    // Decrypt the authoritative live password verified and set on the database instance
    let actualPassword = masterPassword;
    if (instance.encryptedControlPlaneCredential) {
      try {
        actualPassword = decrypt(instance.encryptedControlPlaneCredential);
      } catch {}
    }

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
        password: actualPassword, // returned strictly once upon creation
        hourlyRatePaise: instance.hourlyRatePaise,
        backupEnabled: instance.backupEnabled,
        billingStartedAt: instance.billingStartedAt,
      },
    });
  } catch (error: unknown) {
    return createApiError(error);
  }
}
