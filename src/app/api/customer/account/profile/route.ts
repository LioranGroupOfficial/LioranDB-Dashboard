import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, User } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const ProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  company: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  country: z.string().max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const body = await req.json();
    const parsed = ProfileSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    await connectToDatabase();
    const updateData: Record<string, string | undefined> = {};
    if (parsed.data.fullName !== undefined) updateData['profile.fullName'] = parsed.data.fullName;
    if (parsed.data.company !== undefined) updateData['profile.company'] = parsed.data.company;
    if (parsed.data.phone !== undefined) updateData['profile.phone'] = parsed.data.phone;
    if (parsed.data.country !== undefined) updateData['profile.country'] = parsed.data.country;

    await User.findByIdAndUpdate(sessionUser.userId, { $set: updateData });

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'ADMIN_ACTION',
      entityType: 'User',
      entityId: sessionUser.userId,
      metadata: { action: 'UPDATE_PROFILE' },
    });

    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}

