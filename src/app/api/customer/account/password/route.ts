import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { ChangePasswordSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { connectToDatabase, User } from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { createAuditLog } from '@/lib/audit';
import { sendEmail, passwordChangedTemplate } from '@/lib/email';
import { createApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const body = await req.json();
    const parsed = ChangePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    await connectToDatabase();
    const user = await User.findById(sessionUser.userId);
    if (!user) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return Response.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await User.findByIdAndUpdate(user._id, { passwordHash });

    await createAuditLog({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user._id.toString(),
    });

    await sendEmail({
      to: user.email,
      subject: 'Your LioranDB password was changed',
      html: passwordChangedTemplate(),
    });

    return Response.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return createApiError(error);
  }
}

