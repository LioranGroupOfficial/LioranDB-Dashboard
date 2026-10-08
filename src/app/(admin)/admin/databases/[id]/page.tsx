import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase, AuditLog } from '@/lib/db';
import { notFound } from 'next/navigation';
import { LioranDBAdminClient } from '@/lib/liorandb-admin';
import { calculateInstanceUsage, getCurrentMonthPeriod } from '@/lib/billing';
import AdminDatabaseDetailClient, { DatabaseDetailData } from './AdminDatabaseDetailClient';
import type { IDatabaseUser } from '@/lib/db/models/ManagedDatabase';

export const metadata = { title: 'Manage Database — Admin Control Plane' };

interface PopulatedActor {
  _id: { toString(): string };
  email: string;
  profile?: { fullName?: string };
}

interface PopulatedAuditDoc {
  _id: { toString(): string };
  action: string;
  actorId?: PopulatedActor | null;
  actorRole?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: Date | string;
}

export default async function AdminDatabaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  await connectToDatabase();

  const instance = await ManagedDatabase.findById(id)
    .populate('customerId', 'email profile')
    .lean();

  if (!instance) {
    notFound();
  }

  const client = LioranDBAdminClient.forInstance(instance);
  const serverStatus = await client.getServerStatus();

  const currentPeriod = getCurrentMonthPeriod();
  const usage = calculateInstanceUsage(instance, currentPeriod);

  const rawAuditLogs = await AuditLog.find({
    $or: [
      { entityId: id },
      { 'metadata.instanceId': id },
      { 'metadata.databaseId': id },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('actorId', 'email profile')
    .lean();

  const auditLogs = rawAuditLogs as unknown as PopulatedAuditDoc[];

  const populatedCustomer = instance.customerId as unknown as PopulatedActor | null;

  const initialData: DatabaseDetailData = {
    _id: instance._id.toString(),
    name: instance.name,
    slug: instance.slug,
    host: instance.host,
    port: instance.port,
    databaseName: instance.databaseName,
    status: instance.status,
    planId: instance.planId,
    planName: instance.planName,
    hourlyRatePaise: instance.hourlyRatePaise || 100,
    backupEnabled: Boolean(instance.backupEnabled),
    backupMonthlyPaise: instance.backupMonthlyPaise || 0,
    billingStartedAt: instance.billingStartedAt ? new Date(instance.billingStartedAt).toISOString() : null,
    billingStoppedAt: instance.billingStoppedAt ? new Date(instance.billingStoppedAt).toISOString() : null,
    provisionedAt: instance.provisionedAt ? new Date(instance.provisionedAt).toISOString() : null,
    rootUsername: instance.rootUsername || instance.username || 'admin',
    rootRotatedAt: instance.rootRotatedAt ? new Date(instance.rootRotatedAt).toISOString() : null,
    lastCredentialRotationAt: instance.lastCredentialRotationAt ? new Date(instance.lastCredentialRotationAt).toISOString() : null,
    customer: populatedCustomer
      ? {
          _id: populatedCustomer._id.toString(),
          email: populatedCustomer.email,
          fullName: populatedCustomer.profile?.fullName,
        }
      : null,
    databaseUsers: (instance.databaseUsers || []).map((u: IDatabaseUser) => ({
      username: u.username,
      role: u.role || 'readWrite',
      status: (u.status as 'ACTIVE' | 'DISABLED') || 'ACTIVE',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
    })),
    serverStatus,
    estimate: {
      periodStart: currentPeriod.start.toISOString(),
      periodEnd: currentPeriod.end.toISOString(),
      billableSeconds: usage.billableSeconds,
      billableHours: usage.billableHours,
      computeChargesPaise: usage.usageAmountPaise,
      backupChargesPaise: usage.backupAmountPaise,
      totalPaise: usage.totalPaise,
    },
    auditLogs: auditLogs.map((log) => ({
      _id: log._id.toString(),
      action: log.action,
      actor: log.actorId
        ? {
            email: log.actorId.email,
            name: log.actorId.profile?.fullName || 'Admin',
          }
        : { email: 'System', name: 'Automated' },
      actorRole: log.actorRole || 'admin',
      metadata: log.metadata || {},
      ip: log.ip,
      createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
    })),
    createdAt: instance.createdAt ? new Date(instance.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: instance.updatedAt ? new Date(instance.updatedAt).toISOString() : new Date().toISOString(),
  };

  return <AdminDatabaseDetailClient initialData={initialData} />;
}
