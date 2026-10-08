import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, User, ManagedDatabase, IUser, IManagedDatabase } from '@/lib/db';
import AdminCustomersClient, { CustomerListItem } from './AdminCustomersClient';

export const metadata = { title: 'Customers — Admin Control Plane' };

export default async function AdminCustomersPage() {
  await requireAdmin();
  await connectToDatabase();

  const [users, instances] = await Promise.all([
    User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean<IUser[]>(),
    ManagedDatabase.find({ status: { $nin: ['DELETED', 'TERMINATED'] } }).lean<IManagedDatabase[]>(),
  ]);

  const customerItems: CustomerListItem[] = users.map((u) => {
    const userInstances = instances.filter(
      (i) =>
        i.customerId?.toString() === u._id.toString() ||
        i.userId?.toString() === u._id.toString()
    );

    return {
      id: u._id.toString(),
      name: u.profile?.fullName || u.email.split('@')[0],
      email: u.email,
      emailVerified: Boolean(u.emailVerified),
      emailVerifiedAt: u.emailVerifiedAt ? new Date(u.emailVerifiedAt).toISOString() : null,
      accountVerification: u.accountVerification || {
        feePaid: Boolean(u.accountRegistrationPaid),
        amountPaid: u.accountRegistrationPaid ? 30 : 0,
        currency: 'INR',
        paidAt: u.accountRegistrationPaidAt ? new Date(u.accountRegistrationPaidAt) : null,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        verificationMethod: u.accountRegistrationPaid ? 'RAZORPAY' : null,
        status: u.accountRegistrationPaid ? 'VERIFIED' : 'UNPAID',
      },
      accountRegistrationPaid: Boolean(u.accountRegistrationPaid),
      activeInstancesCount: userInstances.length,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  return <AdminCustomersClient customers={customerItems} />;
}
