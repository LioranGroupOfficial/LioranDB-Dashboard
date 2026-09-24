import { NextRequest, NextResponse } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, User } from '@/lib/db';
import { provisionInstance } from '@/lib/providers/provisioning';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;

    await connectToDatabase();
    const instance = await ManagedDatabase.findById(id);

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found.' }, { status: 404 });
    }

    if (
      sessionUser.role !== 'admin' &&
      instance.customerId.toString() !== sessionUser.userId &&
      instance.userId?.toString() !== sessionUser.userId
    ) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const user = await User.findById(sessionUser.userId);
    instance.status = 'PROVISIONING';
    await instance.save();

    const provisioned = await provisionInstance(instance, user?.email);

    return NextResponse.json({
      success: true,
      instanceId: provisioned._id.toString(),
      status: provisioned.status,
      host: provisioned.host,
      port: provisioned.port,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Retry provisioning failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

