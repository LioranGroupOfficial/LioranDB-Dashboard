import { NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { getPlan } from '@/lib/plans';

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

