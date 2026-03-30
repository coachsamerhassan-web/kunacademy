export default function BlogLoading() {
  return (
    <main>
      {/* Hero skeleton */}
      <section className="py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <div className="h-10 w-48 bg-white/10 rounded-lg mx-auto animate-pulse" />
          <div className="mt-4 h-5 w-80 bg-white/10 rounded mx-auto animate-pulse" />
        </div>
      </section>

      {/* Cards skeleton */}
      <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--color-neutral-100)] overflow-hidden">
              <div className="aspect-[16/9] bg-[var(--color-neutral-100)] animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-20 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-[var(--color-neutral-100)] rounded animate-pulse" />
                <div className="h-4 w-full bg-[var(--color-neutral-100)] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
