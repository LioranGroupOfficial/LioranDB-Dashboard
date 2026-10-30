import { DatabaseCardsSkeleton, MetricCardsSkeleton } from '@/components/dashboard/skeletons';

export default function Loading() {
  return <div className="space-y-8"><div className="space-y-2"><div className="skeleton-ink h-8 w-64" /><div className="skeleton-ink h-4 w-80" /></div><MetricCardsSkeleton /><DatabaseCardsSkeleton /></div>;
}
