import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';

interface ComingSoonProps {
  locale: string;
  titleAr: string;
  titleEn: string;
  descAr?: string;
  descEn?: string;
}

export function ComingSoon({ locale, titleAr, titleEn, descAr, descEn }: ComingSoonProps) {
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'قريبًا' : 'Coming Soon'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? titleAr : titleEn}
          </h1>
          {(descAr || descEn) && (
            <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
              {isAr ? descAr : descEn}
            </p>
          )}
        </div>
      </section>

      {/* Content placeholder */}
      <Section variant="surface">
        <div className="max-w-md mx-auto text-center py-12">
          {/* Decorative element */}
          <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6v6l4 2M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-[#2C2C2D]">
            {isAr ? 'نعمل على هذا المحتوى' : 'We\'re working on this'}
          </h2>
          <p className="mt-3 text-[#6B6B6C] text-sm leading-relaxed">
            {isAr
              ? 'هذه الصفحة قيد الإعداد وستكون جاهزة قريبًا. سجّل في القائمة البريدية ليصلك إشعار عند الإطلاق.'
              : 'This page is being prepared and will be ready soon. Join our mailing list to be notified at launch.'}
          </p>

          {/* Email signup */}
          <form className="mt-8 flex gap-2 max-w-sm mx-auto">
            <input
              type="email"
              placeholder={isAr ? 'بريدك الإلكتروني' : 'Your email'}
              className="flex-1 rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-50)] transition-all min-w-0"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--color-accent-500)] transition-all duration-300 min-h-[44px]"
            >
              {isAr ? 'أبلغني' : 'Notify Me'}
            </button>
          </form>

          {/* Back link */}
          <a
            href={`/${locale}/`}
            className="inline-flex items-center gap-2 mt-8 text-sm text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-600)] transition-colors"
          >
            <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 3L5 8l5 5" />
            </svg>
            {isAr ? 'العودة للرئيسية' : 'Back to Home'}
          </a>
        </div>
      </Section>
    </main>
  );
}
