import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createApiError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;

    await connectToDatabase();
    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return Response.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    if (ticket.userId.toString() !== sessionUser.userId && sessionUser.role === 'customer') {
      return Response.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    await SupportTicket.findByIdAndUpdate(id, {
      status: 'CLOSED',
      closedAt: new Date(),
    });

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'TICKET_STATUS_CHANGED',
      entityType: 'SupportTicket',
      entityId: id,
      metadata: { newStatus: 'CLOSED', closedByCustomer: sessionUser.role === 'customer' },
    });

    return Response.json({ success: true });
  } catch (error) {
    return createApiError(error);
  }
}

