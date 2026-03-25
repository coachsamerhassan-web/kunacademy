import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-[var(--color-background)]">
        <GeometricPattern pattern="flower-of-life" opacity={0.3} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="max-w-2xl animate-fade-up">
            <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'المدوّنة' : 'Blog'}
            </p>
            <h1
              className="text-[2.25rem] md:text-[3.5rem] font-bold text-[var(--text-primary)] leading-tight"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'أفكار ورؤى من أكاديمية كُن' : 'Ideas & Insights from Kun Academy'}
            </h1>
            <p className="mt-4 text-[var(--text-muted)] text-lg md:text-xl">
              {isAr
                ? 'مقالات في التفكير الحسّي والكوتشينج والنمو المهني.'
                : 'Articles on Somatic Thinking, coaching, and professional growth.'}
            </p>
          </div>
        </div>
      </section>

      {/* Empty state */}
      <Section variant="white">
        <div className="text-center py-16">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'المقالات قادمة قريبًا' : 'Articles Coming Soon'}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md mx-auto">
            {isAr
              ? 'نعمل على إعداد محتوى قيّم حول التفكير الحسّي والكوتشينج. ترقّبوا!'
              : 'We\'re preparing valuable content on Somatic Thinking and coaching. Stay tuned!'}
          </p>
        </div>
      </Section>
    </main>
  );
}
