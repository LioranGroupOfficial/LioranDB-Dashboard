export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-ink block ${className}`} />;
}

export function DatabaseCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading databases" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card min-h-[224px] space-y-4 p-5">
          <div className="flex items-start justify-between gap-3"><SkeletonBlock className="h-5 w-36" /><SkeletonBlock className="h-5 w-20" /></div>
          <SkeletonBlock className="h-3 w-28" />
          <div className="space-y-2 border-t border-[var(--border)] pt-3"><SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-4/5" /><SkeletonBlock className="h-3 w-3/5" /></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-3"><SkeletonBlock className="h-3 w-20" /><SkeletonBlock className="h-8 w-20" /></div>
        </div>
      ))}
    </div>
  );
}

export function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return <div aria-busy="true" aria-label="Loading metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: count }, (_, index) => <div key={index} className="card min-h-[116px] space-y-3 p-5"><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-8 w-16" /><SkeletonBlock className="h-3 w-28" /></div>)}</div>;
}

export function StorageWidgetSkeleton() {
  return <div aria-busy="true" aria-label="Loading storage usage" className="card min-h-[164px] space-y-4 p-5"><div className="flex justify-between"><SkeletonBlock className="h-4 w-28" /><SkeletonBlock className="h-4 w-16" /></div><SkeletonBlock className="h-3 w-full" /><div className="flex justify-between"><SkeletonBlock className="h-3 w-28" /><SkeletonBlock className="h-3 w-28" /></div></div>;
}

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div aria-busy="true" aria-label="Loading tenants" className="card overflow-hidden p-0"><div className="space-y-3 p-4">{Array.from({ length: rows }, (_, index) => <div key={index} className="grid grid-cols-4 gap-4 border-b border-[var(--border)] py-4 last:border-0"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="h-4 w-24" /><SkeletonBlock className="h-4 w-20" /><SkeletonBlock className="ml-auto h-8 w-20" /></div>)}</div></div>;
}

export function DetailSkeleton() {
  return <div aria-busy="true" aria-label="Loading database details" className="space-y-4"><div className="card min-h-[180px] space-y-4 p-6"><SkeletonBlock className="h-8 w-64" /><SkeletonBlock className="h-4 w-40" /><SkeletonBlock className="h-3 w-full" /><SkeletonBlock className="h-3 w-4/5" /></div><div className="grid gap-4 md:grid-cols-2"><StorageWidgetSkeleton /><StorageWidgetSkeleton /></div></div>;
}

export function ErrorWidget({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="status" className="card border-dashed p-5 text-sm"><p className="font-semibold text-[var(--text-strong)]">Information temporarily unavailable</p><p className="mt-1 text-xs text-[var(--text-muted)]">{message}</p>{onRetry ? <button type="button" onClick={onRetry} className="btn-secondary mt-3 min-h-[34px] px-3 py-1.5 text-xs">Retry</button> : null}</div>;
}
