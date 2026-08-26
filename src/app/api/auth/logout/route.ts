import { logoutUser } from '@/lib/services/auth.service';
import { createApiError } from '@/lib/errors';

export async function POST() {
  try {
    await logoutUser();
    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}
