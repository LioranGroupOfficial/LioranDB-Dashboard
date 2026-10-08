import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

interface PopulatedCustomer {
  _id: { toString(): string };
  email: string;
  profile?: { fullName?: string };
}

interface DatabaseQueryDoc {
  _id: { toString(): string };
  name: string;
  host: string;
  port: number;
  status: string;
  planId: string;
  planName?: string;
  hourlyRatePaise: number;
  backupEnabled?: boolean;
  backupMonthlyPaise?: number;
  billingStartedAt?: Date | string | null;
  billingStoppedAt?: Date | string | null;
  databaseUsers?: Array<{ username: string }>;
  customerId?: PopulatedCustomer | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const isLimited = await rateLimit(`admin:db:list:${admin.userId}`, 60, 60000);
    if (isLimited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim().toLowerCase();
    const status = searchParams.get('status')?.trim().toUpperCase();
    const plan = searchParams.get('plan')?.trim().toLowerCase();
    const customerId = searchParams.get('customerId')?.trim();

    const filter: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (plan && plan !== 'ALL') {
      filter.planId = plan;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    const rawInstances = await ManagedDatabase.find(filter)
      .populate('customerId', 'email profile')
      .sort({ createdAt: -1 })
      .lean();

    let instances = rawInstances as unknown as DatabaseQueryDoc[];

    if (q) {
      instances = instances.filter((inst) => {
        const nameMatch = inst.name?.toLowerCase().includes(q);
        const idMatch = inst._id.toString().toLowerCase().includes(q);
        const hostMatch = inst.host?.toLowerCase().includes(q);
        const customerEmailMatch = inst.customerId?.email?.toLowerCase().includes(q);
        const customerNameMatch = inst.customerId?.profile?.fullName?.toLowerCase().includes(q);
        return nameMatch || idMatch || hostMatch || customerEmailMatch || customerNameMatch;
      });
    }

    const safeInstances = instances.map((inst) => ({
      _id: inst._id.toString(),
      name: inst.name,
      host: inst.host,
      port: inst.port,
      status: inst.status,
      planId: inst.planId,
      planName: inst.planName || (inst.planId === 'dedicated' ? 'Dedicated' : 'Shared'),
      hourlyRatePaise: inst.hourlyRatePaise || 100,
      backupEnabled: Boolean(inst.backupEnabled),
      backupMonthlyPaise: inst.backupMonthlyPaise || 0,
      billingStartedAt: inst.billingStartedAt ? new Date(inst.billingStartedAt).toISOString() : null,
      billingStoppedAt: inst.billingStoppedAt ? new Date(inst.billingStoppedAt).toISOString() : null,
      databaseUsersCount: (inst.databaseUsers || []).length,
      customer: inst.customerId
        ? {
            _id: inst.customerId._id.toString(),
            email: inst.customerId.email,
            fullName: inst.customerId.profile?.fullName || '',
          }
        : null,
      createdAt: inst.createdAt ? new Date(inst.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: inst.updatedAt ? new Date(inst.updatedAt).toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      databases: safeInstances,
      total: safeInstances.length,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('[API Admin Databases List] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
