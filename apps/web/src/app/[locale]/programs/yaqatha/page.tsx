import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'يقظة — ورشة الحضور الحسّي | أكاديمية كُن' : 'Yaqatha — Somatic Presence Workshop | Kun Academy',
    description: isAr ? 'ورشة يقظة — تجربة حسّية غامرة لاكتشاف ذاتك من خلال الجسد' : 'Yaqatha — an immersive somatic experience to discover yourself through the body',
  };
}

export default async function YaqathaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h1 className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'يقظة — الصحوة' : 'Yaqatha — Awakening'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr ? 'رحلة اكتشاف الذات من خلال التفكير الحسّي — تجربة تحوّلية عميقة' : 'A journey of self-discovery through Somatic Thinking — a deep transformative experience'}
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-3xl mx-auto text-center py-8">
          {/* Coming Soon badge */}
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6"
            style={{ background: 'rgba(71,64,153,0.08)', color: 'var(--color-primary)' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            {isAr ? 'قريبًا' : 'Coming Soon'}
          </span>

          <Heading level={2}>
            {isAr ? 'عن يقظة' : 'About Yaqatha'}
          </Heading>
          <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed max-w-xl mx-auto">
            {isAr
              ? 'يقظة هي تجربة غامرة تأخذك في رحلة اكتشاف الذات من خلال الإشارات الحسّية الجسدية. ليست دورة تقليدية — بل تجربة حياتية تمزج بين التفكير الحسّي والتأمّل العميق والممارسة الجسدية.'
              : 'Yaqatha is an immersive experience that takes you on a journey of self-discovery through somatic body signals. It\'s not a traditional course — it\'s a life experience that blends Somatic Thinking, deep reflection, and embodied practice.'}
          </p>

          <p
            className="mt-6 text-sm leading-relaxed max-w-lg mx-auto"
            style={{ color: 'var(--color-neutral-500)' }}
          >
            {isAr
              ? 'هذا البرنامج في مرحلة التطوير حاليًا. سجّل اهتمامك وسنعلمك فور الإطلاق.'
              : 'This programme is currently in development. Register your interest and we\'ll notify you at launch.'}
          </p>

          <Button variant="primary" size="lg" className="mt-8">
            {isAr ? 'سجّل اهتمامك' : 'Register Your Interest'}
          </Button>

          <div className="mt-8">
            <a
              href={`/${locale}/programs/`}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              {isAr ? '← استكشف البرامج الأخرى' : '← Explore Other Programmes'}
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
