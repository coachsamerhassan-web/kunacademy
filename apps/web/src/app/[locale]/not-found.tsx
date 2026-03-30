import Link from 'next/link';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default function NotFound() {
  return (
    <section className="relative overflow-hidden min-h-[60vh] flex items-center justify-center py-16">
      <GeometricPattern pattern="eight-star" opacity={0.04} fade="both" />
      <div className="relative z-10 text-center px-4 max-w-lg mx-auto">
        <div className="text-8xl font-bold text-[var(--color-primary)] opacity-20 mb-2">404</div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4"
          style={{ fontFamily: 'var(--font-arabic-heading)' }}
        >
          الصفحة غير موجودة
        </h1>
        <p className="text-[var(--color-neutral-500)] mb-2">
          Page not found
        </p>
        <p className="text-sm text-[var(--color-neutral-400)] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:opacity-90 transition-opacity"
          >
            Go Home
          </Link>
          <Link
            href="/academy/certifications"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--color-neutral-200)] bg-white px-6 py-3 text-sm font-semibold text-[var(--text-primary)] min-h-[48px] hover:bg-[var(--color-neutral-50)] transition-colors"
          >
            Browse Programs
          </Link>
        </div>
      </div>
    </section>
  );
}
