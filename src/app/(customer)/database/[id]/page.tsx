import { Suspense } from 'react';
import { requireVerifiedUser } from '@/lib/auth/guards';
import InstanceDetailsContent from '@/components/customer/InstanceDetailsContent';
import { DetailSkeleton } from '@/components/dashboard/skeletons';

export const metadata = { title: 'Instance Details — LioranDB' };

export default async function InstanceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await requireVerifiedUser();
  const { id } = await params;
  return <Suspense fallback={<DetailSkeleton />}><InstanceDetailsContent id={id} sessionUser={sessionUser} /></Suspense>;
}
