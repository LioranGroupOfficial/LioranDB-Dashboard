import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAPI } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, Invoice, SupportTicket } from '@/lib/db';
import { getCustomerMonthEstimate } from '@/lib/billing';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAPI();
    const { id } = await params;
    await connectToDatabase();

    const customer = await User.findById(id).select('-passwordHash').lean();
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const [instances, invoices, tickets, estimate] = await Promise.all([
      ManagedDatabase.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
      Invoice.find({ customerId: id }).sort({ createdAt: -1 }).lean(),
      SupportTicket.find({ userId: id }).sort({ createdAt: -1 }).lean(),
      getCustomerMonthEstimate(id),
    ]);

    const safeInstances = instances.map((inst) => {
      const copy = { ...inst };
      delete (copy as { encryptedConnectionUri?: string }).encryptedConnectionUri;
      return copy;
    });

    return NextResponse.json({
      success: true,
      customer,
      instances: safeInstances,
      invoices,
      tickets,
      estimate,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customer details';
    const status = message.includes('Unauthorized') || message.includes('Forbidden') || message.includes('Authentication') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

