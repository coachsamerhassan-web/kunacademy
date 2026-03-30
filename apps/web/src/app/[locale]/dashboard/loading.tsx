export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 py-8">
      <div className="h-8 w-48 bg-[var(--color-neutral-100)] rounded mb-8 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-neutral-100)] p-6">
            <div className="h-4 w-24 bg-[var(--color-neutral-100)] rounded mb-3 animate-pulse" />
            <div className="h-8 w-16 bg-[var(--color-neutral-100)] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-neutral-100)] p-5 flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-[var(--color-neutral-100)] shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[var(--color-neutral-100)] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
