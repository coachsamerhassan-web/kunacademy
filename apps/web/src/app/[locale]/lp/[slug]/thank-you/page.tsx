import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@kunacademy/db';
import { eq } from 'drizzle-orm';
import { landing_pages } from '@kunacademy/db/schema';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { isLpComposition, type LpComposition } from '@/lib/lp/composition-types';

/**
 * Wave 14 LP-INFRA — post-conversion thank-you page.
 *
 * Lives at /[locale]/lp/[slug]/thank-you. Honors LAUNCH_MODE=landing-only
 * by virtue of being under /lp/* (always-allowed prefix).
 *
 * Renders composition.thank_you when present; otherwise a default success
 * card. Bilingual.
 */
interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

async function loadThankYou(slug: string) {
  const [row] = await db
    .select({
      slug: landing_pages.slug,
      published: landing_pages.published,
      composition_json: landing_pages.composition_json,
    })
    .from(landing_pages)
    .where(eq(landing_pages.slug, slug))
    .limit(1);
  return row || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'شكرًا لك | أكاديمية كُن' : 'Thank you | Kun Academy',
    robots: { index: false, follow: false },
  };
}

export default async function LpThankYouPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const lp = await loadThankYou(slug);
  if (!lp || !lp.published) notFound();

  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const composition = isLpComposition(lp.composition_json)
    ? (lp.composition_json as LpComposition)
    : null;
  const thankYou = composition?.thank_you;

  const headline =
    (isAr ? thankYou?.headline_ar : thankYou?.headline_en) ||
    (isAr ? 'شكرًا لك' : 'Thank you');
  const body =
    (isAr ? thankYou?.body_ar : thankYou?.body_en) ||
    (isAr
      ? 'وصلتنا بياناتك. سنتواصل معك خلال ٢٤ ساعة.'
      : 'We received your details. We will be in touch within 24 hours.');
  const ctaLabel = isAr ? thankYou?.cta_label_ar : thankYou?.cta_label_en;
  const ctaUrl = thankYou?.cta_url;

  return (
    <main dir={dir}>
      <section
        className="relative overflow-hidden py-20 md:py-32"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
        }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.07} fade="both" />
        <div className="relative z-10 mx-auto max-w-2xl px-4 md:px-6 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1
            className="text-3xl md:text-5xl font-bold text-[#FFF5E9] leading-[1.2]"
            style={{ fontFamily: headingFont }}
          >
            {headline}
          </h1>
          <p className="mt-6 text-white/85 text-lg md:text-xl leading-relaxed max-w-xl mx-auto">
            {body}
          </p>
          {ctaLabel && ctaUrl && (
            <a
              href={ctaUrl}
              className="inline-flex items-center justify-center mt-10 rounded-xl bg-[var(--color-accent)] px-8 py-4 font-semibold text-white min-h-[48px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_8px_28px_rgba(228,96,30,0.35)] hover:scale-[1.02]"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </section>

      {/* Quiet footer — minimal, no nav back to wider site */}
      <Section variant="white">
        <p className="text-center text-sm text-[var(--color-neutral-500)]">
          {isAr
            ? '© ٢٠٢٦ أكاديمية كُن للكوتشينج'
            : '© 2026 Kun Coaching Academy'}
        </p>
      </Section>
    </main>
  );
}
