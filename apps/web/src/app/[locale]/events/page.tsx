import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="eight-star" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الفعاليات' : 'Events'}
          </h1>
          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {isAr
              ? 'ورش عمل، ندوات، ولقاءات مباشرة من أكاديمية كُن'
              : 'Workshops, webinars, and live gatherings from Kun Academy'}
          </p>
        </div>
      </section>

      {/* Empty state */}
      <Section variant="surface">
        <div className="text-center py-16">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[var(--color-accent-50)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'لا توجد فعاليات قادمة' : 'No Upcoming Events'}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md mx-auto">
            {isAr
              ? 'سنعلن عن فعاليات جديدة قريبًا. تابعنا على وسائل التواصل للبقاء على اطلاع.'
              : 'New events will be announced soon. Follow us on social media to stay updated.'}
          </p>
          <a
            href={`/${locale}/contact/`}
            className="inline-flex items-center justify-center mt-6 rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300"
          >
            {isAr ? 'أبلغني عند الإطلاق' : 'Notify Me'}
          </a>
        </div>
      </Section>
    </main>
  );
}
