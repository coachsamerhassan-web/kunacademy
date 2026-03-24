import { setRequestLocale } from 'next-intl/server';
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
      <Section variant="surface" pattern="flower-of-life" hero>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
            {isAr ? 'فريقنا' : 'Our Team'}
          </p>
          <Heading level={1} className="!text-[var(--color-primary)] !leading-[1.15]">
            {isAr ? 'فريق الكوتشز' : 'Our Coaches'}
          </Heading>
          <p className="mt-6 text-lg text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'كوتشز أكاديمية كُن هم ممارسون معتمدون من ICF، تدرّبوا على منهجية التفكير الحسّي® وأتقنوا فن الإصغاء للنَّفْس والجسد معًا.'
              : 'Kun Academy coaches are ICF-certified practitioners trained in Somatic Thinking®, skilled in listening to both the self and the body.'}
          </p>
        </div>
      </Section>

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
