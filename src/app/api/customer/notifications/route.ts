import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, Notification } from '@/lib/db';
import { markAllRead } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';

export async function GET() {
  try {
    const user = await requireUserAPI();
    await connectToDatabase();
    const notifications = await Notification.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return Response.json({ notifications });
  } catch (error) {
    return createApiError(error);
  }
}

export async function POST() {
  try {
    const user = await requireUserAPI();
    await markAllRead(user.userId);
    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}

