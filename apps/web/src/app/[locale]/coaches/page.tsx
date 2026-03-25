import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default async function CoachesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero with community hands image */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0">
          <img
            src="/images/community/hands-circle-gulf.png"
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'saturate(0.5) brightness(0.35)' }}
            loading="eager"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(71,64,153,0.85) 0%, rgba(29,26,61,0.9) 100%)' }} />
          <GeometricPattern pattern="girih" opacity={0.08} fade="both" />
        </div>
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'فريق الكوتشينج' : 'Our Coaches'}
          </h1>
          <p className="mt-4 text-white/65 max-w-lg mx-auto text-lg md:text-xl">
            {isAr
              ? 'كوتشز معتمدون تدرّبوا في أكاديمية كُن — كل واحد منهم يحمل منهجية التفكير الحسّي'
              : 'Certified coaches trained at Kun Academy — each carrying the Somatic Thinking methodology'}
          </p>
        </div>
      </section>

      {/* Coach directory placeholder */}
      <Section variant="surface">
        <div className="text-center py-12">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-[var(--color-primary-50)] flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">
            {isAr ? 'دليل الكوتشز قادم قريبًا' : 'Coach Directory Coming Soon'}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md mx-auto">
            {isAr
              ? 'نعمل على إعداد دليل شامل لكوتشز أكاديمية كُن المعتمدين'
              : 'We\'re preparing a comprehensive directory of certified Kun Academy coaches'}
          </p>
          <a
            href={`/${locale}/book/`}
            className="inline-flex items-center justify-center mt-6 rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300"
          >
            {isAr ? 'احجز جلسة كوتشينج' : 'Book a Coaching Session'}
          </a>
        </div>
      </Section>
    </main>
  );
}
