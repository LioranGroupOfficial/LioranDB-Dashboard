import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const query: Record<string, unknown> = { role: 'customer' };
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { 'profile.fullName': { $regex: search, $options: 'i' } },
        { 'profile.company': { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await User.find(query).sort({ createdAt: -1 }).lean();

    const customerIds = customers.map((c) => c._id);
    const instanceCounts = await ManagedDatabase.aggregate([
      { $match: { customerId: { $in: customerIds }, status: { $ne: 'TERMINATED' } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    instanceCounts.forEach((ic) => {
      countMap[ic._id.toString()] = ic.count;
    });

    const data = customers.map((c) => ({
      _id: c._id,
      email: c.email,
      fullName: c.profile?.fullName || '—',
      company: c.profile?.company || '—',
      emailVerified: c.emailVerified,
      activeInstances: countMap[c._id.toString()] || 0,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ success: true, customers: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customers';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
