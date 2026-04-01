import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="relative overflow-hidden min-h-[60vh] flex items-center justify-center py-16">
      <div className="text-center px-4 max-w-lg mx-auto">
        <div className="text-8xl font-bold text-primary/20 leading-none mb-2">
          404
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-3 font-arabic">
          الصفحة غير موجودة
        </h1>
        <p className="text-stone-500 mb-1">
          Page not found
        </p>
        <p className="text-sm text-stone-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white min-h-[48px] min-w-[160px] hover:bg-primary/90 transition-colors"
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/academy/certifications"
            className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-900 min-h-[48px] min-w-[160px] hover:bg-stone-50 transition-colors"
          >
            تصفّح البرامج
          </Link>
        </div>
      </div>
    </section>
  );
}
