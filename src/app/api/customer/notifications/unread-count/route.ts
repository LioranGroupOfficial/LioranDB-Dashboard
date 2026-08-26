import { requireUserAPI } from '@/lib/auth/guards';
import { getUnreadCount } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';

export async function GET() {
  try {
    const user = await requireUserAPI();
    const count = await getUnreadCount(user.userId);
    return Response.json({ count });
  } catch (error) {
    return createApiError(error);
  }
}

