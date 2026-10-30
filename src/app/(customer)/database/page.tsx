import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import DatabaseListData from '@/components/dashboard/widgets/DatabaseListData';
import { AdminTableSkeleton } from '@/components/dashboard/skeletons';

export const metadata = { title: 'Databases — LioranDB' };

export default async function DatabasePage() {
  const sessionUser = await requireVerifiedUser();
  return <div className="mx-auto max-w-6xl space-y-6 pb-12"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">Databases</h1><p className="mt-1 text-xs text-[var(--text-muted)]">Dedicated deployments and Free Shared databases in one view.</p></div><Link href="/database/create" className="btn-primary self-start text-xs sm:self-auto"><Plus className="h-3.5 w-3.5" />Create Database</Link></div><Suspense fallback={<AdminTableSkeleton rows={4} />}><DatabaseListData userId={sessionUser.userId} /></Suspense></div>;
}
