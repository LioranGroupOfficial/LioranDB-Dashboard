import { AdminTableSkeleton, MetricCardsSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() { return <div className="space-y-8"><div className="skeleton-ink h-8 w-64" /><MetricCardsSkeleton /><AdminTableSkeleton rows={7} /></div>; }
