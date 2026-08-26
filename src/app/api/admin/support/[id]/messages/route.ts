import { NextRequest } from 'next/server';
import { requireAnyRoleAPI } from '@/lib/auth/guards';
import { connectToDatabase, SupportTicket, TicketMessage } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, supportReplyTemplate } from '@/lib/email';
import { getZodErrorMessage } from '@/lib/validation/schemas';
import { createApiError } from '@/lib/errors';
import { z } from 'zod';

const StaffMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staffUser = await requireAnyRoleAPI(['admin', 'support']);
    const { id } = await params;
    const body = await req.json();
    const parsed = StaffMessageSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { body: msgBody, isInternal } = parsed.data;

    await connectToDatabase();
    const ticket = await SupportTicket.findById(id).populate('userId');
    if (!ticket) {
      return Response.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    const customer = ticket.userId as unknown as { _id: string; email: string; profile?: { fullName?: string } };

    const message = await TicketMessage.create({
      ticketId: ticket._id,
      authorId: staffUser.userId,
      authorRole: staffUser.role,
      body: msgBody,
      isInternal,
    });

    if (!isInternal) {
      // Transition ticket status to WAITING_FOR_CUSTOMER
      await SupportTicket.findByIdAndUpdate(id, {
        status: 'WAITING_FOR_CUSTOMER',
      });

      // In-app notification & email for customer
      await createNotification({
        userId: customer._id.toString(),
        type: 'SUPPORT_REPLY',
        title: `Reply on Ticket #${ticket.ticketNumber}`,
        body: msgBody.length > 80 ? `${msgBody.slice(0, 80)}...` : msgBody,
        link: `/support/${ticket._id.toString()}`,
      });

      const APP_URL = process.env.APP_URL || 'https://app.liorandb.com';
      await sendEmail({
        to: customer.email,
        subject: `New reply on ticket #${ticket.ticketNumber} — LioranDB Support`,
        html: supportReplyTemplate(
          customer.profile?.fullName || customer.email,
          ticket.subject,
          msgBody,
          `${APP_URL}/support/${ticket._id.toString()}`
        ),
      });
    }

    await createAuditLog({
      actorId: staffUser.userId,
      actorRole: staffUser.role,
      action: 'ADMIN_ACTION',
      entityType: 'SupportTicket',
      entityId: id,
      metadata: { action: isInternal ? 'INTERNAL_NOTE' : 'STAFF_REPLY' },
    });

    return Response.json({ success: true, message });
  } catch (error) {
    return createApiError(error);
  }
}

