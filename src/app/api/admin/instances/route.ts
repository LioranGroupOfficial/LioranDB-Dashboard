import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');
    const search = searchParams.get('search');

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (planId) query.planId = planId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { host: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const instances = await ManagedDatabase.find(query)
      .populate('customerId', 'email profile')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, instances });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch admin instances';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

