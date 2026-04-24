import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';

/**
 * Coming-soon page — rendered at /{locale}/coming-soon.
 *
 * Purpose: anonymous-visitor rewrite target for kuncoaching.me (staging).
 * Middleware on staging rewrites non-allowlisted paths to this page so the
 * URL stays unchanged (admins bookmarking /ar/admin/lp/<id> land here when
 * logged out, then after login the same URL resolves normally).
 *
 * Rules (locked 2026-04-24):
 *   - Kun institutional brand — uses existing site CSS variables, invents none
 *   - noindex + minimal OG (don't leak staging URLs into social)
 *   - No email capture (Samer explicitly ruled this out)
 *   - Bilingual: one paragraph AR, one paragraph EN
 *   - No launch-date claim — keep it quiet
 */

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'أكاديمية كُن — قريبًا' : 'Kun Coaching Academy — Coming Soon',
    description: isAr
      ? 'شيء جميل في الطريق. ابقَ على اتصال.'
      : 'Something beautiful is on the way. Stay tuned.',
    robots: { index: false, follow: false },
    openGraph: {
      title: isAr ? 'أكاديمية كُن — قريبًا' : 'Kun Coaching Academy — Coming Soon',
      description: isAr
        ? 'شيء جميل في الطريق. ابقَ على اتصال.'
        : 'Something beautiful is on the way. Stay tuned.',
      type: 'website',
      siteName: isAr ? 'أكاديمية كُن' : 'Kun Coaching Academy',
      locale,
    },
  };
}

export default async function ComingSoonPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  return (
    <main dir={dir} data-lp-theme="default">
      <section
        className="relative overflow-hidden min-h-[100vh] flex items-center justify-center px-6 py-16 md:py-24"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 60%, var(--color-primary-900) 100%)',
        }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <p
            className="text-sm md:text-base font-semibold text-[var(--color-accent-300)] uppercase tracking-[0.2em] mb-6"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'أكاديمية كُن للكوتشينج' : 'Kun Coaching Academy'}
          </p>
          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.15] mb-8"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'قريبًا' : 'Coming soon'}
          </h1>
          <p className="text-white/85 text-lg md:text-xl leading-relaxed max-w-xl mx-auto">
            {isAr
              ? 'شيء جميل في الطريق. ابقَ على اتصال.'
              : 'Something beautiful is on the way. Stay tuned.'}
          </p>
          <div
            className="mx-auto mt-10 w-16 h-px"
            style={{ background: 'var(--color-accent-300)', opacity: 0.6 }}
            aria-hidden
          />
          <p className="mt-6 text-white/45 text-xs">
            {isAr ? '© ٢٠٢٦ أكاديمية كُن للكوتشينج' : '© 2026 Kun Coaching Academy'}
          </p>
        </div>
      </section>
    </main>
  );
}
