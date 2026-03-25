import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { Card } from '@kunacademy/ui/card';

export default async function CoachesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'فريقنا' : 'Our Team'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'فريقنا' : 'Our Team'}
          </p>
        </div>
      </section>

      {/* ── COACH DIRECTORY ── */}
      <Section variant="white">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card accent className="p-8 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-[var(--color-primary-100)] to-[var(--color-primary-200)] flex items-center justify-center">
              <span className="text-3xl text-[var(--color-primary-400)]">?</span>
            </div>
            <p className="mt-4 font-semibold text-[var(--color-neutral-800)]">
              {isAr ? 'قريبًا' : 'Coming Soon'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
              {isAr ? 'دليل الكوتشز قيد الإعداد' : 'Coach directory under development'}
            </p>
          </Card>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section variant="dark" pattern="girih">
        <div className="text-center py-8">
          <Heading level={2} className="!text-white">
            {isAr ? 'هل أنت كوتش معتمد؟' : 'Are You a Certified Coach?'}
          </Heading>
          <p className="mt-4 text-white/75 max-w-xl mx-auto">
            {isAr
              ? 'انضم إلى منصة أكاديمية كُن للكوتشنغ وابدأ باستقبال عملائك'
              : 'Join the Kun Academy coaching platform and start receiving clients'}
          </p>
          <div className="mt-8">
            <Button variant="primary" size="lg">
              {isAr ? 'سجّل ككوتش' : 'Register as a Coach'}
            </Button>
          </div>
        </div>
      </Section>
    </main>
  );
}
