import { AdminTableSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return <div className="space-y-6"><div className="skeleton-ink h-8 w-48" /><AdminTableSkeleton rows={5} /></div>;
}
