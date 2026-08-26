import { NextRequest } from 'next/server';
import { requireUserAPI } from '@/lib/auth/guards';
import { SupportTicketSchema, getZodErrorMessage } from '@/lib/validation/schemas';
import { connectToDatabase, SupportTicket, TicketMessage } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { createApiError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';

async function generateTicketNumber(): Promise<string> {
  const count = await SupportTicket.countDocuments();
  return `TKT-${String(count + 1).padStart(5, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUserAPI();
    await connectToDatabase();

    const tickets = await SupportTicket.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ tickets });
  } catch (error) {
    return createApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUserAPI();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const rl = checkRateLimit('ticket_create', sessionUser.userId);
    if (!rl.allowed) {
      return Response.json(
        { error: 'Too many tickets submitted. Please wait before creating another.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = SupportTicketSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;

    await connectToDatabase();

    const ticketNumber = await generateTicketNumber();

    const ticket = await SupportTicket.create({
      userId: sessionUser.userId,
      ticketNumber,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      status: 'OPEN',
      url: data.url || undefined,
      environment: data.environment || undefined,
    });

    // Create initial message from customer
    await TicketMessage.create({
      ticketId: ticket._id,
      authorId: sessionUser.userId,
      authorRole: sessionUser.role,
      body: data.description,
      isInternal: false,
    });

    await createAuditLog({
      actorId: sessionUser.userId,
      actorRole: sessionUser.role,
      action: 'TICKET_CREATED',
      entityType: 'SupportTicket',
      entityId: ticket._id.toString(),
      metadata: { ticketNumber, category: data.category, priority: data.priority },
      ip,
    });

    await createNotification({
      userId: sessionUser.userId,
      type: 'GENERAL',
      title: `Ticket ${ticketNumber} opened`,
      body: `Your support ticket has been received. We'll respond during support hours.`,
      link: `/support/${ticket._id.toString()}`,
    });

    return Response.json({
      success: true,
      ticketId: ticket._id.toString(),
      ticketNumber,
    });
  } catch (error) {
    return createApiError(error);
  }
}
