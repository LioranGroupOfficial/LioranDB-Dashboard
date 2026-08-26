import { NextRequest } from 'next/server';
import { requireAnyRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const StatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staffUser = await requireAnyRoleAPI(['admin', 'support']);
    const { id } = await params;
    const body = await req.json();
    const parsed = StatusSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { status } = parsed.data;

    await connectToDatabase();
    const updateData: Record<string, unknown> = { status };
    if (status === 'RESOLVED') updateData.resolvedAt = new Date();
    if (status === 'CLOSED') updateData.closedAt = new Date();

    await SupportTicket.findByIdAndUpdate(id, updateData);

    await createAuditLog({
      actorId: staffUser.userId,
      actorRole: staffUser.role,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'SupportTicket',
      entityId: id,
      metadata: { newStatus: status },
    });

    return Response.json({ success: true, status });
  } catch (error) {
    return createApiError(error);
  }
}

