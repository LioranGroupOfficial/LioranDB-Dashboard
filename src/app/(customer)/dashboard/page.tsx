import { Suspense } from 'react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import { DashboardActions, BackupMetricWidget, BillingMetricWidget, DatabaseListWidget, InstanceMetricWidget, InvoiceMetricWidget, UnpaidInvoiceBanner } from '@/components/dashboard/widgets/CustomerDashboardWidgets';
import { DatabaseCardsSkeleton, ErrorWidget, MetricCardsSkeleton } from '@/components/dashboard/skeletons';

export const metadata = { title: 'Dashboard Overview — LioranDB', description: 'Manage LioranDB managed database instances and usage billing.' };

export default async function DashboardPage() {
  const sessionUser = await requireVerifiedUser();
  return <div className="mx-auto max-w-6xl space-y-8 pb-16"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)] sm:text-3xl">Dashboard Overview</h1><p className="mt-1 text-xs text-[var(--text-muted)]">Manage databases, storage, and connections from one place.</p></div><DashboardActions /></div><Suspense fallback={<ErrorWidget message="Invoice alerts are loading." />}><UnpaidInvoiceBanner userId={sessionUser.userId} /></Suspense><Suspense fallback={<MetricCardsSkeleton />}><div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Suspense fallback={<div className="card min-h-[116px]" />}><InstanceMetricWidget userId={sessionUser.userId} /></Suspense><Suspense fallback={<div className="card min-h-[116px]" />}><BillingMetricWidget userId={sessionUser.userId} /></Suspense><Suspense fallback={<div className="card min-h-[116px]" />}><InvoiceMetricWidget userId={sessionUser.userId} /></Suspense><Suspense fallback={<div className="card min-h-[116px]" />}><BackupMetricWidget userId={sessionUser.userId} /></Suspense></div></Suspense><Suspense fallback={<DatabaseCardsSkeleton />}><DatabaseListWidget userId={sessionUser.userId} /></Suspense></div>;
}
