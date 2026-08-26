import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, TicketMessage } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const MessageSchema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(5000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireUserAPI();
    const { id } = await params;
    const json = await req.json();
    const parsed = MessageSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    await connectToDatabase();
    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return Response.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    // Customer can only reply to their own tickets
    if (ticket.userId.toString() !== sessionUser.userId && sessionUser.role === 'customer') {
      return Response.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    if (ticket.status === 'CLOSED') {
      return Response.json({ error: 'This ticket is closed and cannot receive replies.' }, { status: 400 });
    }

    const message = await TicketMessage.create({
      ticketId: ticket._id,
      authorId: sessionUser.userId,
      authorRole: sessionUser.role,
      body: parsed.data.body,
      isInternal: false,
    });

    // If customer replied, move ticket to OPEN / IN_PROGRESS
    if (sessionUser.role === 'customer') {
      await SupportTicket.findByIdAndUpdate(ticket._id, { status: 'OPEN' });
    }

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'ADMIN_ACTION',
      entityType: 'SupportTicket',
      entityId: ticket._id.toString(),
      metadata: { action: 'REPLY_TICKET', messageId: message._id.toString() },
    });

    return Response.json({ success: true, message });
  } catch (error) {
    return createApiError(error);
  }
}

