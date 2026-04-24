import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms, AsyncDocRenderer } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Button } from '@kunacademy/ui/button';
import { SamersPick } from '@/components/conversion/samers-pick';
import { StickyMobileCTA } from '@/components/conversion/sticky-mobile-cta';
import { TrustBar } from '@/components/conversion/trust-bar';
import { AudienceTabs } from '@/components/audience-tabs';
import { buildGpsTabs, buildIeTabs } from '@/components/audience-tabs-data';
import { LeadCaptureForm } from '@/components/lead-capture-form';
import { getPricingRegion, getGeoPrice, shouldShowPrice, formatGeoPrice } from '@/lib/geo-pricing';
import { courseJsonLd } from '@kunacademy/ui/structured-data';
import { JsonLd } from '@/components/seo/JsonLd';

export const revalidate = 300;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const program = await cms.getProgram(slug);

  if (!program) {
    return {
      title: isAr ? 'البرنامج غير موجود | أكاديمية كُن' : 'Program Not Found | Kun Academy',
    };
  }

  const title = isAr
    ? (program.meta_title_ar || program.title_ar)
    : (program.meta_title_en || program.title_en);

  const description = isAr
    ? (program.meta_description_ar || program.description_ar || '')
    : (program.meta_description_en || program.description_en || '');

  return {
    title: isAr ? `${title} | أكاديمية كُن` : `${title} | Kun Academy`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: isAr ? 'أكاديمية كُن' : 'Kun Academy',
      locale,
      ...(program.og_image_url ? { images: [{ url: program.og_image_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(program.og_image_url ? { images: [program.og_image_url] } : {}),
    },
  };
}

// ── Static Params (ISR) ──────────────────────────────────────────────────────

export async function generateStaticParams() {
  const programs = await cms.getAllPrograms().catch(() => []);
  const locales = ['ar', 'en'];
  return locales.flatMap((locale) =>
    programs.map((p) => ({ locale, slug: p.slug }))
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBadge(format: string, isAr: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    online:     { ar: 'عبر الإنترنت',           en: 'Online' },
    'in-person':{ ar: 'حضوري',                  en: 'In-Person' },
    hybrid:     { ar: 'حضوري + عبر الإنترنت',  en: 'Hybrid' },
    recorded:   { ar: 'مسجّل',                  en: 'Recorded' },
  };
  return map[format]?.[isAr ? 'ar' : 'en'] ?? format;
}

/**
 * Translate a duration string to Arabic when locale is 'ar'.
 * Handles common patterns:
 *   "X hours"          → "X ساعة / ساعات"
 *   "X days"           → "يوم / يومان / X أيام"
 *   "X days (Y hours)" → "X أيام (Y ساعة)"
 * Western Arabic numerals are preserved throughout (no ٢ etc.).
 */
function localizeDuration(duration: string, isAr: boolean): string {
  if (!isAr) return duration;

  // "X days (Y hours)" — e.g. "2 days (10 hours)"
  const daysHours = duration.match(/^(\d+)\s+days?\s+\((\d+)\s+hours?\)$/i);
  if (daysHours) {
    const d = parseInt(daysHours[1], 10);
    const h = parseInt(daysHours[2], 10);
    const daysAr = d === 1 ? 'يوم' : d === 2 ? 'يومان' : `${d} أيام`;
    const hoursAr = h === 1 ? 'ساعة' : `${h} ساعة`;
    return `${daysAr} (${hoursAr})`;
  }

  // "X hours" — e.g. "40 hours"
  const hoursOnly = duration.match(/^(\d+)\s+hours?$/i);
  if (hoursOnly) {
    const h = parseInt(hoursOnly[1], 10);
    return h === 1 ? 'ساعة واحدة' : `${h} ساعة`;
  }

  // "X days" — e.g. "3 days"
  const daysOnly = duration.match(/^(\d+)\s+days?$/i);
  if (daysOnly) {
    const d = parseInt(daysOnly[1], 10);
    if (d === 1) return 'يوم واحد';
    if (d === 2) return 'يومان';
    return `${d} أيام`;
  }

  // Fallback: return as-is (won't break anything)
  return duration;
}

/**
 * Translate ICF level / certification strings to Arabic.
 * Matches common patterns found in icf_details and level badge fields.
 */
function localizeIcfDetails(text: string, isAr: boolean): string {
  if (!isAr || !text) return text;

  const replacements: Array<[RegExp, string]> = [
    [/ICF Level One/gi,   'المستوى الأوّل من ICF'],
    [/ICF Level 1/gi,     'المستوى الأوّل من ICF'],
    [/ICF Level Two/gi,   'المستوى الثاني من ICF'],
    [/ICF Level 2/gi,     'المستوى الثاني من ICF'],
    [/MCC pathway/gi,     'مسار MCC'],
    [/PCC pathway/gi,     'مسار PCC'],
    [/ACC pathway/gi,     'مسار ACC'],
    [/\bIn-Person\b/g,    'حضوري'],
    [/\bOnline\b/g,       'عبر الإنترنت'],
    [/\bHybrid\b/g,       'حضوري + عبر الإنترنت'],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Extract a numeric hour count from a duration string.
 * "40 hours" → 40 | "2 days (10 hours)" → 10 | "3 days" → 72 | fallback → 0
 */
function parseDurationHours(duration: string): number {
  // "X days (Y hours)"
  const daysHours = duration.match(/(\d+)\s+hours?/i);
  if (daysHours) return parseInt(daysHours[1], 10);
  // "X days" only — approximate as 8h/day
  const daysOnly = duration.match(/^(\d+)\s+days?$/i);
  if (daysOnly) return parseInt(daysOnly[1], 10) * 8;
  return 0;
}

function formatBadgeColor(format: string): string {
  const colors: Record<string, string> = {
    online: 'bg-blue-100 text-blue-800',
    'in-person': 'bg-green-100 text-green-800',
    hybrid: 'bg-purple-100 text-purple-800',
  };
  return colors[format] ?? 'bg-gray-100 text-gray-700';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ProgramDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const program = await cms.getProgram(slug);
  if (!program) notFound();

  const title = isAr ? program.title_ar : program.title_en;
  const subtitle = isAr ? program.subtitle_ar : program.subtitle_en;
  const description = isAr ? program.description_ar : program.description_en;

  // ── Canon W4 (migration 0051) — structured long-form content ─────────────
  // Populated for 6 Ihya variants; NULL for other programs (falls back to
  // short `description` block above). Template renders the full composition
  // from IHYA-LANDING-PAGES.md §1 when present.
  const longForm = isAr ? program.long_description_ar : program.long_description_en;
  const hasLongForm = !!(
    longForm &&
    (longForm.opening_invitation ||
      (longForm.who_for && longForm.who_for.length > 0) ||
      (longForm.benefits && longForm.benefits.length > 0) ||
      (longForm.impressions && longForm.impressions.length > 0))
  );

  // ── Geo-based pricing (Board rules) ──────────────────────────────────────
  // Egypt → EGP only | Gulf/Arab → AED only | World → EUR only
  // Tier rule: >4,000 AED → hide price, show CRM form (Manhajak, STAIC, etc.)
  // ≤4,000 AED → show geo price (GPS, IE, mini-courses, STIC/STGC/STOC/STFC)
  const pricingRegion = await getPricingRegion();
  const geoPrice = getGeoPrice(
    pricingRegion,
    program.price_aed ?? 0,
    program.price_egp ?? 0,
    program.price_eur ?? 0,
    program.early_bird_price_aed ?? undefined,
  );
  const hasPricing = (program.price_aed ?? 0) > 0;
  const pricingVisible = hasPricing && shouldShowPrice(program.price_aed ?? 0);
  // pricingHidden = program costs >4K AED → show CRM form instead
  const pricingHidden = hasPricing && !shouldShowPrice(program.price_aed ?? 0);

  // ── CTA href ──────────────────────────────────────────────────────────────
  const ctaHref = (pricingVisible && !program.is_free)
    ? `/${locale}/checkout?program=${slug}`
    : `/${locale}/contact`;
  const ctaLabel = (pricingVisible && !program.is_free)
    ? (isAr ? 'سجّل الآن' : 'Register Now')
    : (isAr ? 'تواصل معنا' : 'Contact Us');
  // ── Prerequisites ─────────────────────────────────────────────────────────
  const prerequisites = program.prerequisite_codes ?? [];

  return (
    <main dir={dir}>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-16 md:py-28"
        style={{
          background: program.hero_image_url
            ? `linear-gradient(to bottom, rgba(30,27,75,0.75) 0%, rgba(30,27,75,0.90) 100%), url(${program.hero_image_url}) center/cover no-repeat`
            : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
        }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.07} fade="both" />

        <div className={`relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 ${program.program_logo ? 'md:flex md:items-center md:gap-12' : 'text-center'}`}>

          {/* Logo — mobile: centered above title, desktop: side column */}
          {program.program_logo && (
            <div className="flex justify-center mb-8 md:mb-0 md:shrink-0 md:order-2">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-20"
                  style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 70%)' }}
                />
                <img
                  src={program.program_logo}
                  alt=""
                  className="relative h-40 w-40 md:h-64 md:w-64 object-contain drop-shadow-[0_0_30px_rgba(212,168,83,0.3)]"
                />
              </div>
            </div>
          )}

          {/* Text content */}
          <div className={program.program_logo ? 'text-center md:text-start md:flex-1 md:order-1' : 'text-center'}>
          {/* Program type badge */}
          {program.is_free && (
            <span className="inline-block mb-4 px-4 py-1 rounded-full text-sm font-semibold bg-[var(--color-accent)] text-white">
              {isAr ? 'مجاني' : 'Free'}
            </span>
          )}

          {/* Title */}
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.15] max-w-4xl mx-auto"
            style={{ fontFamily: headingFont }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="mt-4 text-white/75 max-w-2xl mx-auto text-lg md:text-xl">
              {subtitle}
            </p>
          )}

          {/* Key detail chips */}
          <div className={`mt-8 flex flex-wrap gap-3 ${program.program_logo ? 'justify-center md:justify-start' : 'justify-center'}`}>
            {/* Format badge */}
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-sm font-medium backdrop-blur-sm">
              <span aria-hidden>📍</span>
              {formatBadge(program.format, isAr)}
            </span>

            {/* Duration */}
            {program.duration && (
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-sm font-medium backdrop-blur-sm">
                <span aria-hidden>⏱</span>
                {localizeDuration(program.duration, isAr)}
              </span>
            )}

            {/* ICF badge */}
            {program.is_icf_accredited && (
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-accent)]/90 text-white text-sm font-semibold backdrop-blur-sm">
                <span aria-hidden>✓</span>
                {isAr ? 'معتمد ICF' : 'ICF Accredited'}
              </span>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* ── Audience Tabs (GPS of Life) ───────────────────────────────────── */}
      {slug === 'gps-of-life' && (
        <Section variant="surface-low">
          <div className="mx-auto max-w-3xl">
            <AudienceTabs
              tabs={buildGpsTabs(locale)}
              locale={locale}
              headingAr="لمن هذه الورشة؟"
              headingEn="Who Is This Workshop For?"
            />
          </div>
        </Section>
      )}

      {/* ── Audience Tabs (Impact Engineering) ───────────────────────────── */}
      {slug === 'impact-engineering' && (
        <Section variant="surface-low">
          <div className="mx-auto max-w-3xl">
            <AudienceTabs
              tabs={buildIeTabs(locale)}
              locale={locale}
              headingAr="لمن هذه الورشة؟"
              headingEn="Who Is This Workshop For?"
            />
          </div>
        </Section>
      )}

      {/* ── Canon W3-C: Wisal → STFC delivery network cross-link ─────────── */}
      {slug === 'wisal' && (
        <Section variant="surface-low">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-6 md:p-8">
              <h3
                className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
                style={{ fontFamily: headingFont }}
              >
                {isAr ? 'من يقدّم وِصال؟' : 'Who delivers Wisal?'}
              </h3>
              <p className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg">
                {isAr ? (
                  <>
                    يُقدَّم وِصال اليوم عبر <strong>سامر حسن MCC</strong>، وعلى المدى
                    الممتد عبر كوتشز كُن الحاصلين على شهادة{' '}
                    <a
                      href={`/${locale}/programs/stce-level-5-stfc`}
                      className="text-[var(--color-primary)] hover:underline font-semibold"
                    >
                      STCE Level 5 STFC
                    </a>
                    {' '}في كوتشينج الأسر والأزواج.
                  </>
                ) : (
                  <>
                    Wisal is delivered today by <strong>Samer Hassan MCC</strong> and,
                    over time, by Kun coaches who have earned{' '}
                    <a
                      href={`/${locale}/programs/stce-level-5-stfc`}
                      className="text-[var(--color-primary)] hover:underline font-semibold"
                    >
                      STCE Level 5 STFC
                    </a>
                    {' '}certification in Family &amp; Couples Coaching.
                  </>
                )}
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* ── Canon W3-C: STFC → Wisal delivery authorization cross-link ──── */}
      {slug === 'stce-level-5-stfc' && (
        <Section variant="surface-low">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-6 md:p-8">
              <h3
                className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
                style={{ fontFamily: headingFont }}
              >
                {isAr ? 'ماذا تمنحك هذه الشهادة؟' : 'What this certification unlocks'}
              </h3>
              <p className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg">
                {isAr ? (
                  <>
                    بعد الحصول على الشهادة، يحقّ لكوتشز STFC المرخَّصين تقديم
                    خدمة{' '}
                    <a
                      href={`/${locale}/programs/wisal`}
                      className="text-[var(--color-primary)] hover:underline font-semibold"
                    >
                      وِصال
                    </a>
                    {' '}للأسر والأزواج الذين نخدمهم.
                  </>
                ) : (
                  <>
                    After certification, STFC-licensed coaches are authorized to
                    deliver{' '}
                    <a
                      href={`/${locale}/programs/wisal`}
                      className="text-[var(--color-primary)] hover:underline font-semibold"
                    >
                      Wisal
                    </a>
                    {' '}engagements to the families and couples we serve.
                  </>
                )}
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="mx-auto max-w-3xl">

          {/* Google Doc rich content OR structured fallback */}
          {program.content_doc_id ? (
            <AsyncDocRenderer
              docId={program.content_doc_id}
              slug={slug}
              locale={locale as 'ar' | 'en'}
            />
          ) : (
            <div className="space-y-8">
              {/* Description — always shows as lead when present.
                  Canon W4: long-form structured content (if populated)
                  renders BELOW this intro, not in place of it. */}
              {description && (
                <div>
                  <h2
                    className="text-2xl font-bold text-[var(--text-primary)] mb-3"
                    style={{ fontFamily: headingFont }}
                  >
                    {isAr ? 'عن البرنامج' : 'About This Program'}
                  </h2>
                  <p className="text-[var(--color-neutral-600)] leading-relaxed text-lg">
                    {description}
                  </p>
                </div>
              )}

              {/* ── Canon W4 long-form composition ─────────────────────────
                  Renders the IHYA-LANDING-PAGES.md §1 composition when the
                  program has structured `long_description_{ar|en}` populated.
                  Gracefully handles missing sub-fields per variant (e.g.
                  `closing_invitation` only present on dated variants).
              */}
              {hasLongForm && longForm && (
                <div className="space-y-10 pt-4 border-t border-[var(--color-primary-100)]">
                  {/* Opening invitation (Composition §2) */}
                  {longForm.opening_invitation && (
                    <div>
                      <p className="text-[var(--color-neutral-700)] leading-loose text-lg md:text-xl font-medium">
                        {longForm.opening_invitation}
                      </p>
                    </div>
                  )}

                  {/* Who this is for / not for (Composition §3) */}
                  {((longForm.who_for && longForm.who_for.length > 0) ||
                    (longForm.who_not_for && longForm.who_not_for.length > 0)) && (
                    <div className="grid gap-6 md:grid-cols-2">
                      {longForm.who_for && longForm.who_for.length > 0 && (
                        <div className="rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-6">
                          <h3
                            className="text-xl font-bold text-[var(--text-primary)] mb-4"
                            style={{ fontFamily: headingFont }}
                          >
                            {isAr ? 'لمن هذه الرحلة' : 'Who this is for'}
                          </h3>
                          <ul className="space-y-2.5">
                            {longForm.who_for.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[var(--color-neutral-700)] leading-relaxed">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" aria-hidden />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {longForm.who_not_for && longForm.who_not_for.length > 0 && (
                        <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-6">
                          <h3
                            className="text-xl font-bold text-[var(--text-primary)] mb-4"
                            style={{ fontFamily: headingFont }}
                          >
                            {isAr ? 'ليست هذه الرحلة' : 'Who this is not for'}
                          </h3>
                          <ul className="space-y-2.5">
                            {longForm.who_not_for.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-[var(--color-neutral-700)] leading-relaxed">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--color-neutral-400)] flex-shrink-0" aria-hidden />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Benefits — what you'll leave with (Composition §4) */}
                  {longForm.benefits && longForm.benefits.length > 0 && (
                    <div>
                      <h3
                        className="text-2xl font-bold text-[var(--text-primary)] mb-4"
                        style={{ fontFamily: headingFont }}
                      >
                        {isAr ? 'ما ستخرج به' : "What you'll leave with"}
                      </h3>
                      <ul className="space-y-3">
                        {longForm.benefits.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg">
                            <span className="mt-2.5 w-2 h-2 rounded-full bg-[var(--color-accent)] flex-shrink-0" aria-hidden />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Impressions — the experience (Composition §5) */}
                  {longForm.impressions && longForm.impressions.length > 0 && (
                    <div>
                      <h3
                        className="text-2xl font-bold text-[var(--text-primary)] mb-4"
                        style={{ fontFamily: headingFont }}
                      >
                        {isAr ? 'التجربة' : 'The Experience'}
                      </h3>
                      <div className="space-y-5">
                        {longForm.impressions.map((para, i) => (
                          <p key={i} className="text-[var(--color-neutral-700)] leading-loose text-base md:text-lg">
                            {para}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Samer pull-quote */}
                  {longForm.pull_quote && (
                    <blockquote
                      className="relative rounded-2xl bg-[var(--color-primary-50)] border-s-4 border-[var(--color-primary)] p-6 md:p-8"
                    >
                      <p
                        className="text-[var(--color-primary-700)] text-xl md:text-2xl font-semibold leading-relaxed italic"
                        style={{ fontFamily: headingFont }}
                      >
                        {isAr ? '«' : '"'}{longForm.pull_quote}{isAr ? '»' : '"'}
                      </p>
                      <footer className="mt-3 text-sm text-[var(--color-neutral-500)]">
                        {isAr ? '— سامر حسن' : '— Samer Hassan'}
                      </footer>
                    </blockquote>
                  )}

                  {/* Closing invitation (Composition §9 — optional) */}
                  {longForm.closing_invitation && (
                    <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary-50)] to-[var(--color-accent)]/10 p-6 md:p-8 text-center">
                      <p className="text-[var(--color-neutral-800)] leading-loose text-base md:text-lg font-medium">
                        {longForm.closing_invitation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Duration */}
              {program.duration && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)]">
                  <span className="text-2xl" aria-hidden>⏱</span>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {isAr ? 'المدة' : 'Duration'}
                    </p>
                    <p className="text-[var(--color-neutral-600)]">{localizeDuration(program.duration, isAr)}</p>
                  </div>
                </div>
              )}

              {/* Format */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary-100)]">
                <span className="text-2xl" aria-hidden>📍</span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {isAr ? 'طريقة التنفيذ' : 'Format'}
                  </p>
                  <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-sm font-medium ${formatBadgeColor(program.format)}`}>
                    {formatBadge(program.format, isAr)}
                  </span>
                  {program.location && (
                    <p className="mt-1 text-sm text-[var(--color-neutral-500)]">{program.location}</p>
                  )}
                </div>
              </div>

              {/* Prerequisites */}
              {prerequisites.length > 0 && (
                <div>
                  <h3
                    className="text-xl font-bold text-[var(--text-primary)] mb-3"
                    style={{ fontFamily: headingFont }}
                  >
                    {isAr ? 'المتطلبات المسبقة' : 'Prerequisites'}
                  </h3>
                  <ul className="space-y-2">
                    {prerequisites.map((code) => (
                      <li key={code} className="flex items-center gap-2 text-[var(--color-neutral-600)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" aria-hidden />
                        <a
                          href={`/${locale}/programs/${code}`}
                          className="hover:text-[var(--color-primary)] hover:underline transition-colors"
                        >
                          {code}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ICF Accreditation details */}
              {program.is_icf_accredited && (
                <div className="p-5 rounded-xl border-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-hidden>🏅</span>
                    <div>
                      <p className="font-bold text-[var(--text-primary)] text-lg">
                        {isAr ? 'معتمد من ICF' : 'ICF Accredited Program'}
                      </p>
                      {program.icf_details && (
                        <p className="mt-1 text-[var(--color-neutral-600)] text-sm">
                          {localizeIcfDetails(program.icf_details, isAr)}
                        </p>
                      )}
                      {program.cce_units != null && program.cce_units > 0 && (
                        <p className="mt-1 text-sm font-medium text-[var(--color-accent)]">
                          {isAr ? `${program.cce_units} وحدة CCE` : `${program.cce_units} CCE Units`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── Gallery (Canon W3-A) ──────────────────────────────────────────── */}
      {program.gallery_json && program.gallery_json.length > 0 && (
        <Section variant="white">
          <div className="mx-auto max-w-[var(--max-content-width)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {program.gallery_json.map((img, idx) => {
                const alt = (isAr ? img.alt_ar : img.alt_en) || (isAr ? img.alt_en : img.alt_ar) || '';
                const caption = isAr ? img.caption_ar : img.caption_en;
                const crossAttribLabel = isAr
                  ? 'من مواسم إحياء السابقة'
                  : 'from previous Ihya seasons';
                const aspectClass =
                  img.aspect === 'landscape'
                    ? 'aspect-[16/9]'
                    : img.aspect === 'portrait'
                      ? 'aspect-[3/4]'
                      : 'aspect-square';
                return (
                  <figure
                    key={`${img.url}-${idx}`}
                    className="relative overflow-hidden rounded-2xl bg-[var(--color-neutral-100)] group"
                    style={
                      program.track_color
                        ? { boxShadow: `0 0 0 1px ${program.track_color}26` }
                        : undefined
                    }
                  >
                    <img
                      src={img.url}
                      alt={alt}
                      loading="lazy"
                      decoding="async"
                      className={`w-full ${aspectClass} object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
                    />
                    {(caption || img.cross_attrib) && (
                      <figcaption className="absolute bottom-0 start-0 end-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white text-sm">
                        {caption && <span>{caption}</span>}
                        {img.cross_attrib && (
                          <span className="block text-xs opacity-75 mt-0.5">
                            {crossAttribLabel}
                          </span>
                        )}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Trust Bar ────────────────────────────────────────────────────── */}
      <TrustBar locale={locale} variant="compact" />

      {/* ── Pricing & CTA ──────────────────────────────────────────────────── */}
      <Section
        variant="surface-low"
        className={program.closing_bg_url ? '!bg-transparent' : undefined}
        style={
          program.closing_bg_url
            ? {
                background: program.track_color
                  ? `linear-gradient(to bottom, ${program.track_color}26 0%, ${program.track_color}14 100%), url(${program.closing_bg_url}) center/cover no-repeat`
                  : `linear-gradient(to bottom, rgba(30,27,75,0.15) 0%, rgba(30,27,75,0.08) 100%), url(${program.closing_bg_url}) center/cover no-repeat`,
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-xl text-center">
          {program.is_free ? (
            /* Free program */
            <div>
              <span className="inline-block mb-4 text-4xl font-bold text-[var(--color-accent)]">
                {isAr ? 'مجاني تماماً' : '100% Free'}
              </span>
              <p className="text-[var(--color-neutral-500)] text-sm mb-6">
                {isAr ? 'لا تحتاج بطاقة ائتمان' : 'No credit card required'}
              </p>
            </div>
          ) : pricingHidden ? (
            /* >4,000 AED — hide price, show CRM inquiry form */
            <div className="text-start">
              <p className="text-center text-lg font-semibold text-[var(--text-primary)] mb-2">
                {isAr ? 'تواصل معنا للتسعير' : 'Contact us for pricing'}
              </p>
              <p className="text-center text-sm text-[var(--color-neutral-500)] mb-6">
                {isAr
                  ? 'يسعدنا مساعدتك في اختيار الباقة المناسبة'
                  : "We'll help you find the right package"}
              </p>
              <LeadCaptureForm
                locale={locale}
                programCode={slug}
                programName={isAr ? program.title_ar : program.title_en}
              />
            </div>
          ) : pricingVisible ? (
            /* Paid program ≤4,000 AED — show geo-appropriate price */
            <div className="mb-6">
              <p className="text-sm uppercase tracking-widest text-[var(--color-neutral-400)] mb-2 font-medium">
                {isAr ? 'الرسوم' : 'Investment'}
              </p>
              <p className="text-5xl font-bold text-[var(--text-primary)]" style={{ fontFamily: headingFont }}>
                {geoPrice.amount.toLocaleString('en-US')}
                <span className="text-2xl font-normal text-[var(--color-neutral-400)] ms-2">
                  {geoPrice.currency}
                </span>
              </p>
              {/* Early bird — show in same currency */}
              {geoPrice.earlyBird != null && geoPrice.earlyBird > 0 && (
                <p className="mt-2 text-sm text-[var(--color-accent)] font-medium">
                  {isAr ? 'سعر الحجز المبكر:' : 'Early bird:'}{' '}
                  {geoPrice.earlyBird.toLocaleString('en-US')} {geoPrice.currency}
                  {program.early_bird_deadline && (
                    <span className="text-[var(--color-neutral-400)] font-normal">
                      {' '}—{' '}
                      {new Date(program.early_bird_deadline).toLocaleDateString(
                        isAr ? 'ar-AE' : 'en-GB',
                        { day: 'numeric', month: 'long', year: 'numeric' }
                      )}
                    </span>
                  )}
                </p>
              )}
              {/* Installments */}
              {program.installment_enabled && (
                <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
                  {isAr ? '✓ متاح التقسيط عبر Tabby' : '✓ Installments available via Tabby'}
                </p>
              )}
            </div>
          ) : (
            /* No price on record */
            <div className="mb-6">
              <p className="text-xl text-[var(--color-neutral-500)]">
                {isAr ? 'للاستفسار عن الرسوم' : 'For pricing information'}
              </p>
            </div>
          )}

          {/* CTA — only shown when NOT using the inline CRM form */}
          {!pricingHidden && (
            <a
              href={ctaHref}
              className="inline-flex items-center justify-center h-14 px-10 text-lg font-semibold rounded-xl text-white bg-[var(--color-accent)] shadow-[0_4px_16px_rgba(244,126,66,0.30)] hover:bg-[var(--color-accent-500)] hover:shadow-[0_8px_24px_rgba(244,126,66,0.40)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              {ctaLabel}
            </a>
          )}

          {/* Next cohort date */}
          {program.next_start_date && (
            <p className="mt-5 text-sm text-[var(--color-neutral-400)]">
              {isAr ? 'يبدأ:' : 'Starts:'}{' '}
              <span className="font-medium text-[var(--text-primary)]">
                {new Date(program.next_start_date).toLocaleDateString(
                  isAr ? 'ar-AE' : 'en-GB',
                  { day: 'numeric', month: 'long', year: 'numeric' }
                )}
              </span>
            </p>
          )}

          {/* Enrollment deadline */}
          {program.enrollment_deadline && (
            <p className="mt-1 text-sm text-[var(--color-neutral-400)]">
              {isAr ? 'آخر موعد للتسجيل:' : 'Enrollment closes:'}{' '}
              <span className="font-medium text-red-500">
                {new Date(program.enrollment_deadline).toLocaleDateString(
                  isAr ? 'ar-AE' : 'en-GB',
                  { day: 'numeric', month: 'long', year: 'numeric' }
                )}
              </span>
            </p>
          )}
        </div>
      </Section>

      {/* ── Conversion: Samer's Pick badge (featured programs only) ── */}
      {program.is_featured && (
        <Section variant="white">
          <div className="mx-auto max-w-xl text-center">
            <SamersPick variant="featured" locale={locale} />
          </div>
        </Section>
      )}

      {/* ── Conversion: Sticky mobile CTA — only for visible-price programs ── */}
      {!program.is_free && pricingVisible && geoPrice.amount > 0 && (
        <StickyMobileCTA
          locale={locale}
          programName={isAr ? program.title_ar : program.title_en}
          price={formatGeoPrice(geoPrice, isAr)}
          ctaHref={`/${locale}/checkout?program=${program.slug}`}
        />
      )}

      {/* ── Structured Data: Course schema (JSON-LD) ─────────────────────── */}
      <JsonLd
        data={courseJsonLd({
          locale,
          name: isAr ? program.title_ar : program.title_en,
          description: (isAr ? program.description_ar : program.description_en) ?? '',
          slug: `programs/${slug}`,
          hours: parseDurationHours(program.duration ?? ''),
          // price_aed from CMS is in full AED units; courseJsonLd expects minor units (cents)
          ...(pricingVisible && !program.is_free && program.price_aed
            ? { priceAed: program.price_aed * 100, currency: 'AED' }
            : {}),
        })}
      />
    </main>
  );
}
