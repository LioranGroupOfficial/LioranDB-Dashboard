import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import AdminDatabasesClient, { AdminDatabaseItem } from './AdminDatabasesClient';

export const metadata = { title: 'Managed Databases — Admin Control Plane' };

interface PopulatedCustomer {
  _id: { toString(): string };
  email: string;
  profile?: { fullName?: string };
}

interface DatabaseDoc {
  _id: { toString(): string };
  name: string;
  host: string;
  port: number;
  status: string;
  planId: string;
  planName?: string;
  hourlyRatePaise?: number;
  backupEnabled?: boolean;
  backupMonthlyPaise?: number;
  couponCode?: string | null;
  couponDiscountPercentage?: number;
  billingStartedAt?: Date | string | null;
  billingStoppedAt?: Date | string | null;
  databaseUsers?: Array<{ username: string }>;
  customerId?: PopulatedCustomer | null;
  createdAt?: Date | string;
}

export default async function AdminDatabasesPage() {
  await requireAdmin();
  await connectToDatabase();

  const rawInstances = await ManagedDatabase.find()
    .populate('customerId', 'email profile')
    .sort({ createdAt: -1 })
    .lean();

  const instances = rawInstances as unknown as DatabaseDoc[];

  const formatted: AdminDatabaseItem[] = instances.map((inst) => ({
    _id: inst._id.toString(),
    name: inst.name,
    host: inst.host,
    port: inst.port,
    status: inst.status,
    planId: inst.planId,
    planName: inst.planName,
    hourlyRatePaise: inst.hourlyRatePaise || 100,
    backupEnabled: Boolean(inst.backupEnabled),
    backupMonthlyPaise: inst.backupMonthlyPaise || 0,
    couponCode: inst.couponCode || null,
    couponDiscountPercentage: inst.couponDiscountPercentage || 0,
    billingStartedAt: inst.billingStartedAt ? new Date(inst.billingStartedAt).toISOString() : null,
    billingStoppedAt: inst.billingStoppedAt ? new Date(inst.billingStoppedAt).toISOString() : null,
    databaseUsersCount: (inst.databaseUsers || []).length,
    customer: inst.customerId
      ? {
          _id: inst.customerId._id.toString(),
          email: inst.customerId.email,
          fullName: inst.customerId.profile?.fullName,
        }
      : null,
    createdAt: inst.createdAt ? new Date(inst.createdAt).toISOString() : new Date().toISOString(),
  }));

  return <AdminDatabasesClient initialDatabases={formatted} />;
}
