import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import { PathwayDoors } from '@/components/pathway-doors';
import { PathwayTree } from '@/components/pathway-tree';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'المسار التعليمي — اختر طريقك | أكاديمية كُن'
      : 'Learning Pathway — Choose Your Path | Kun Academy',
    description: isAr
      ? 'اكتشف مسارك التعليمي في التفكير الحسّي — من المدخل إلى التخصّص'
      : 'Discover your learning path in Somatic Thinking — from introduction to specialization',
  };
}

export default async function PathwayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(locale, [
              { name: isAr ? 'الرئيسية' : 'Home', path: '' },
              { name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' },
              { name: isAr ? 'المسار التعليمي' : 'Learning Pathway', path: '/academy/pathway' },
            ])
          ),
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'اختر طريقك' : 'Choose Your Path'}
          </h1>
          <p
            className="mt-3 text-[1.1rem] md:text-[1.35rem] font-medium text-white/80"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr
              ? 'المسار التعليمي في أكاديمية كُن'
              : 'Learning Journey at Kun Academy'}
          </p>
          <p className="mt-5 text-white/60 text-base max-w-xl mx-auto leading-relaxed">
            {isAr
              ? 'سواء أردت أن تصبح كوتشاً محترفاً، أو تطوّر فريقك، أو تنمو شخصياً — هنا تبدأ رحلتك.'
              : 'Whether you want to become a professional coach, develop your team, or grow personally — your journey starts here.'}
          </p>
        </div>
      </section>

      {/* ── Three Doors ──────────────────────────────────────── */}
      <Section variant="surface">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.25rem] font-bold text-[var(--text-accent)] text-center mb-2"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ما الذي تبحث عنه؟' : 'What are you looking for?'}
          </h2>
          <p className="text-center text-[var(--color-neutral-500)] text-sm mb-8">
            {isAr ? 'اختر الباب الذي يعبّر عن هدفك' : 'Select the door that matches your goal'}
          </p>
          <PathwayDoors locale={locale} />
        </div>
      </Section>

      {/* ── Full Pathway Tree ─────────────────────────────────── */}
      <Section variant="white">
        <h2
          className="text-[1.75rem] md:text-[2.25rem] font-bold text-[var(--text-accent)] text-center mb-2"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? 'خريطة المسارات الكاملة' : 'Full Pathway Map'}
        </h2>
        <p className="text-center text-[var(--color-neutral-500)] text-sm mb-10">
          {isAr
            ? 'كل مسار يبدأ من نقطة واحدة — ثم يتفرّع حسب رؤيتك'
            : 'Every path starts from one point — then branches according to your vision'}
        </p>
        <PathwayTree locale={locale} />
      </Section>

      {/* ── Bottom CTA ───────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-white"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}
          </h2>
          <p className="mt-4 text-white/60 text-base max-w-lg mx-auto">
            {isAr
              ? 'أول خطوة في أي مسار هي مدخل التفكير الحسّي — ست ساعات تغيّر زاوية نظرتك للأبد.'
              : 'The first step in any path is the Somatic Thinking Intro — six hours that shift your perspective forever.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`/${locale}/academy/intro/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'ابدأ هنا' : 'Start Here'}
            </a>
            <a
              href={`/${locale}/pathfinder/`}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
            >
              {isAr ? 'لا تعرف؟ اكتشف مسارك' : "Not sure? Use the Pathfinder"}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
