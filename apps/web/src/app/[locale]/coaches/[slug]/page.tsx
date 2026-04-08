import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms, AsyncDocRenderer } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { MarkdownContent } from '@/components/markdown-content';
import { ArrowLeft, ArrowRight, Calendar, MessageCircle, Quote } from 'lucide-react';
import type { Metadata } from 'next';
import type { TeamMember, Testimonial } from '@kunacademy/cms';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const coach = await cms.getTeamMember(slug);
  if (!coach) return {};

  const name = locale === 'ar' ? coach.name_ar : coach.name_en;
  const title = locale === 'ar' ? coach.title_ar : coach.title_en;
  const bio = locale === 'ar' ? coach.bio_ar : coach.bio_en;

  return {
    title: `${name}${title ? ` — ${title}` : ''} | ${locale === 'ar' ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: bio?.slice(0, 160) || '',
    openGraph: {
      title: name,
      description: bio?.slice(0, 160) || '',
      ...(coach.photo_url ? { images: [{ url: coach.photo_url }] } : {}),
    },
  };
}

// ── Coach level → Kun tier label & pricing ────────────────────────────────────

type CoachLevelKey = 'ACC' | 'PCC' | 'MCC' | 'instructor' | 'facilitator' | 'guest';

const LEVEL_META: Record<CoachLevelKey, {
  labelEn: string;
  labelAr: string;
  badgeClasses: string;
}> = {
  ACC: {
    labelEn: 'Associate Certified Coach',
    labelAr: 'مدرّب معتمد مشارك',
    badgeClasses: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  PCC: {
    labelEn: 'Professional Certified Coach',
    labelAr: 'مدرّب محترف معتمد',
    badgeClasses: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  MCC: {
    labelEn: 'Master Certified Coach',
    labelAr: 'مدرّب معتمد رئيسي',
    badgeClasses: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  instructor: {
    labelEn: 'Instructor',
    labelAr: 'مدرّب',
    badgeClasses: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  },
  facilitator: {
    labelEn: 'Facilitator',
    labelAr: 'ميسّر',
    badgeClasses: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  },
  guest: {
    labelEn: 'Guest Coach',
    labelAr: 'كوتش ضيف',
    badgeClasses: 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200',
  },
};

// ── Kun level → session price (AED) & booking service slug ───────────────────

const KUN_LEVEL_PRICE: Record<string, { priceAed: number; serviceSlug: string }> = {
  basic:        { priceAed: 250,  serviceSlug: 'individual-basic'        },
  professional: { priceAed: 400,  serviceSlug: 'individual-professional'  },
  expert:       { priceAed: 600,  serviceSlug: 'individual-expert'        },
  master:       { priceAed: 800,  serviceSlug: 'individual-master'        },
};

const KUN_LEVEL_META: Record<string, {
  labelEn: string;
  labelAr: string;
  badgeClasses: string;
}> = {
  basic:        { labelEn: 'Basic Coach',        labelAr: 'كوتش أساسي',  badgeClasses: 'bg-sky-100 text-sky-800' },
  professional: { labelEn: 'Professional Coach',  labelAr: 'كوتش محترف',  badgeClasses: 'bg-violet-100 text-violet-800' },
  expert:       { labelEn: 'Expert Coach',         labelAr: 'كوتش خبير',   badgeClasses: 'bg-amber-100 text-amber-800' },
  master:       { labelEn: 'Master Coach',         labelAr: 'كوتش ماستر',  badgeClasses: 'bg-emerald-100 text-emerald-800' },
};

// Language code → display name (flag emoji not used per icon rules — text labels only)
const LANG_LABELS: Record<string, { en: string; ar: string }> = {
  Arabic:  { en: 'Arabic',   ar: 'العربية'  },
  English: { en: 'English',  ar: 'الإنجليزية' },
  French:  { en: 'French',   ar: 'الفرنسية'  },
  Spanish: { en: 'Spanish',  ar: 'الإسبانية' },
  German:  { en: 'German',   ar: 'الألمانية'  },
  Italian: { en: 'Italian',  ar: 'الإيطالية' },
  Turkish: { en: 'Turkish',  ar: 'التركية'   },
};

function getLangLabel(lang: string, isAr: boolean): string {
  const entry = LANG_LABELS[lang];
  if (!entry) return lang;
  return isAr ? entry.ar : entry.en;
}

// ── Related-coaches algorithm ────────────────────────────────────────────────
// Match by specialties[0], exclude current coach, limit 3.
// Fall back to same coach_level if no specialty match.

function getRelatedCoaches(
  allCoaches: TeamMember[],
  current: TeamMember,
  limit = 3
): TeamMember[] {
  const others = allCoaches.filter(
    (c) => c.slug !== current.slug && c.is_bookable
  );

  const primarySpecialty = current.specialties?.[0];

  const bySpecialty = primarySpecialty
    ? others.filter((c) => c.specialties?.includes(primarySpecialty))
    : [];

  if (bySpecialty.length >= limit) return bySpecialty.slice(0, limit);

  // Pad with same level coaches (varying style)
  const byLevel = others.filter(
    (c) =>
      ((current.kun_level && c.kun_level === current.kun_level) ||
        (!current.kun_level && c.coach_level === current.coach_level)) &&
      !bySpecialty.some((b) => b.slug === c.slug)
  );

  return [...bySpecialty, ...byLevel].slice(0, limit);
}

export default async function CoachProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const [coach, allCoaches, coachTestimonials] = await Promise.all([
    cms.getTeamMember(slug),
    cms.getBookableCoaches(),
    cms.getTestimonialsByCoach(slug),
  ]);
  if (!coach) notFound();

  const name  = isAr ? coach.name_ar  : coach.name_en;
  const title = isAr ? coach.title_ar : coach.title_en;
  const bio   = isAr ? coach.bio_ar   : coach.bio_en;

  const levelMeta = coach.coach_level
    ? LEVEL_META[coach.coach_level as CoachLevelKey] ?? null
    : null;

  // Resolve pricing from kun_level (board-approved tiers)
  const kunLevelPrice = coach.kun_level
    ? KUN_LEVEL_PRICE[coach.kun_level] ?? null
    : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    ...(title ? { jobTitle: title } : {}),
    ...(bio ? { description: bio.slice(0, 300) } : {}),
    ...(coach.photo_url ? { image: coach.photo_url } : {}),
    url: `https://kunacademy.com/${locale}/coaches/${slug}`,
    worksFor: { '@type': 'Organization', name: 'Kun Academy', url: 'https://kunacademy.com' },
  };

  // ── Related coaches ────────────────────────────────────────────────────────
  const relatedCoaches = getRelatedCoaches(allCoaches, coach, 3);

  // ── Services list based on coach's kun_level (board-approved tiers) ─────────
  interface ServiceItem {
    slug: string;
    labelEn: string;
    labelAr: string;
    subtextEn?: string;
    subtextAr?: string;
    priceEn: string;
    priceAr: string;
    durationEn: string;
    durationAr: string;
    badgeEn?: string;
    badgeAr?: string;
  }

  const coachingServices: ServiceItem[] = [
    // 1. Discovery Session — always shown for bookable coaches
    {
      slug: 'discovery',
      labelEn: 'Discovery Session',
      labelAr: 'جلسة استكشافية',
      priceEn: 'FREE',
      priceAr: 'مجانًا',
      durationEn: '20 min',
      durationAr: '٢٠ دقيقة',
    },
    // 2. Individual Coaching — only if coach has a kun_level with a known price
    ...(kunLevelPrice != null
      ? [{
          slug: kunLevelPrice.serviceSlug,
          labelEn: 'Individual Coaching',
          labelAr: 'كوتشينج فردي',
          priceEn: `${kunLevelPrice.priceAed} AED`,
          priceAr: `${kunLevelPrice.priceAed} درهم`,
          durationEn: '60 min',
          durationAr: '٦٠ دقيقة',
        }]
      : []),
    // 3. 3-Session Package — only if coach has a priced tier (15% discount)
    ...(kunLevelPrice != null
      ? [{
          slug: '3-session-package',
          labelEn: '3-Session Package',
          labelAr: 'باقة ٣ جلسات',
          subtextEn: '3 × 60 min',
          subtextAr: '٣ × ٦٠ دقيقة',
          priceEn: `${Math.round(kunLevelPrice.priceAed * 3 * 0.85)} AED`,
          priceAr: `${Math.round(kunLevelPrice.priceAed * 3 * 0.85)} درهم`,
          durationEn: '3 sessions',
          durationAr: '٣ جلسات',
          badgeEn: '15% off',
          badgeAr: 'خصم ١٥٪',
        }]
      : []),
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--color-primary-800)] py-16 md:py-24">
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">

            {/* Photo — 384px wide on desktop, full-width card on mobile */}
            <div className="shrink-0 w-full md:w-96">
              <div className="relative w-48 h-48 md:w-96 md:h-[28rem] mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.4)]">
                {coach.photo_url ? (
                  <Image
                    src={coach.photo_url}
                    alt={name}
                    fill
                    className="object-cover object-top"
                    priority
                    sizes="(max-width: 768px) 192px, 384px"
                  />
                ) : (
                  <div
                    className="h-full w-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-300) 100%)' }}
                  >
                    <span
                      className="text-7xl font-bold text-white/80 select-none"
                      aria-hidden="true"
                    >
                      {name.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Identity block */}
            <div className="flex-1 text-center md:text-start pt-0 md:pt-4">
              {/* Credential + level badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                {/* Kun Level badge (primary) */}
                {coach.kun_level && KUN_LEVEL_META[coach.kun_level] && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${KUN_LEVEL_META[coach.kun_level].badgeClasses}`}>
                    {isAr ? KUN_LEVEL_META[coach.kun_level].labelAr : KUN_LEVEL_META[coach.kun_level].labelEn}
                  </span>
                )}

                {/* ICF Credential badge (secondary) */}
                {coach.coach_level && ['ACC', 'PCC', 'MCC'].includes(coach.coach_level) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-100)] text-[var(--color-primary-800)]">
                    ICF {coach.coach_level}
                  </span>
                )}

                {/* Fallback: if no kun_level yet, show coach_level as before */}
                {!coach.kun_level && coach.coach_level && levelMeta && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${levelMeta.badgeClasses}`}>
                    {isAr ? levelMeta.labelAr : levelMeta.labelEn}
                  </span>
                )}

                {coach.credentials && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80 ring-1 ring-white/20">
                    {coach.credentials}
                  </span>
                )}
              </div>

              {/* Name */}
              <h1
                className="text-4xl md:text-5xl font-bold text-[#FFF5E9] leading-[1.08] tracking-tight"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {name}
              </h1>

              {/* Title */}
              {title && (
                <p className="mt-3 text-lg md:text-xl text-white/65 leading-snug">
                  {title}
                </p>
              )}

              {/* Level description */}
              {coach.coach_level && levelMeta && (
                <p className="mt-2 text-sm text-white/50">
                  {isAr ? levelMeta.labelAr : levelMeta.labelEn}
                </p>
              )}

              {/* Divider */}
              <div className="mt-6 mb-5 w-12 h-px bg-white/20 mx-auto md:mx-0" aria-hidden="true" />

              {/* Languages */}
              {coach.languages.length > 0 && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <svg
                    className="w-4 h-4 text-white/40 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    <path d="M3.6 9h16.8M3.6 15h16.8" />
                    <path d="M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" />
                  </svg>
                  {coach.languages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-white/75 ring-1 ring-white/15"
                    >
                      {getLangLabel(lang, isAr)}
                    </span>
                  ))}
                </div>
              )}

              {/* Quick-book CTA (only in hero for bookable coaches) */}
              {coach.is_bookable && (
                <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <a
                    href={`/${locale}/coaching/book?coach=${slug}&service=discovery`}
                    className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors duration-200 shadow-[0_4px_20px_rgba(228,96,30,0.4)]"
                  >
                    {isAr ? 'احجز جلسة استكشافية' : 'Book a Free Session'}
                  </a>
                  <a
                    href={`/${locale}/coaches`}
                    className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white/90 transition-colors duration-200 min-h-[44px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                    {isAr ? 'جميع الكوتشز' : 'All Coaches'}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bio ──────────────────────────────────────────────────────────── */}
      {(coach.bio_doc_id || bio) && (
        <Section variant="white">
          <div className="max-w-3xl mx-auto">
            {/* Section label */}
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
              {isAr ? 'نبذة' : 'About'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)] mb-8 leading-snug"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? `تعرّف على ${coach.name_ar}` : `Meet ${coach.name_en}`}
            </h2>

            {/* Separator */}
            <div className="w-10 h-0.5 bg-[var(--color-primary-200)] mb-8" aria-hidden="true" />

            {coach.bio_doc_id ? (
              <AsyncDocRenderer docId={coach.bio_doc_id} locale={locale as 'ar' | 'en'} />
            ) : bio ? (
              <MarkdownContent content={bio} isAr={isAr} />
            ) : null}
          </div>
        </Section>
      )}

      {/* ── Specialties & Coaching Styles ────────────────────────────────── */}
      {(coach.specialties.length > 0 || coach.coaching_styles.length > 0) && (
        <Section variant="surface">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

              {/* Specialties */}
              {coach.specialties.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
                    {isAr ? 'التخصصات' : 'Specialties'}
                  </p>
                  <h3
                    className="text-lg font-bold text-[var(--text-primary)] mb-5"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? 'مجالات التخصص' : 'Areas of Focus'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.specialties.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-[var(--color-primary-50)] text-[var(--color-primary)] font-medium ring-1 ring-[var(--color-primary-100)]"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching Styles */}
              {coach.coaching_styles.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
                    {isAr ? 'أسلوب العمل' : 'Coaching Style'}
                  </p>
                  <h3
                    className="text-lg font-bold text-[var(--text-primary)] mb-5"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? 'أساليب الكوتشينج' : 'How I Coach'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {coach.coaching_styles.map((style) => (
                      <span
                        key={style}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-[var(--color-secondary-50)] text-[var(--color-secondary-600)] font-medium ring-1 ring-[var(--color-secondary-100)]"
                      >
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      {coachTestimonials.length > 0 && (
        <Section variant="white">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
              {isAr ? 'آراء العملاء' : 'Client Testimonials'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)] mb-8 leading-snug"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'ماذا يقول العملاء؟' : 'What Clients Say'}
            </h2>

            <div className="space-y-5">
              {coachTestimonials.map((t: Testimonial) => {
                const clientName = isAr ? t.name_ar : (t.name_en || t.name_ar);
                const content    = isAr ? t.content_ar : (t.content_en || t.content_ar);
                const role       = isAr ? t.role_ar : (t.role_en || t.role_ar);
                const location   = isAr ? t.location_ar : (t.location_en || t.location_ar);

                if (!content) return null;

                return (
                  <figure
                    key={t.id}
                    className="relative rounded-2xl border border-[var(--color-surface-highest)] bg-[var(--color-surface-low)] p-6"
                  >
                    {/* Decorative quote mark */}
                    <Quote
                      className="absolute top-4 end-4 w-6 h-6 text-[var(--color-primary-100)]"
                      aria-hidden="true"
                    />

                    {/* Content */}
                    <blockquote className="relative">
                      <p
                        className="text-[var(--text-secondary)] leading-relaxed text-sm md:text-base"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                      >
                        &ldquo;{content}&rdquo;
                      </p>
                    </blockquote>

                    {/* Attribution */}
                    <figcaption className="mt-4 flex items-center gap-3">
                      {/* Avatar initial */}
                      <div className="shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center text-sm font-bold text-[var(--color-primary)]">
                        {clientName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {clientName}
                        </p>
                        {(role || location) && (
                          <p className="text-xs text-[var(--color-neutral-500)] truncate">
                            {[role, location].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Services ─────────────────────────────────────────────────────── */}
      {coach.is_bookable && coachingServices.length > 0 && (
        <Section variant="white">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
              {isAr ? 'الخدمات' : 'Services'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)] mb-8 leading-snug"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'احجز جلستك' : 'Book a Session'}
            </h2>

            <div className="space-y-4">
              {coachingServices.map((svc) => (
                <div
                  key={svc.slug}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[var(--color-surface-highest)] bg-[var(--color-surface-low)] p-5 hover:border-[var(--color-primary-200)] hover:shadow-sm transition-all duration-200"
                >
                  {/* Service info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className="font-semibold text-[var(--text-primary)] text-base leading-snug"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'inherit' }}
                      >
                        {isAr ? svc.labelAr : svc.labelEn}
                      </p>
                      {/* Discount badge (e.g. 3-session pack) */}
                      {(isAr ? svc.badgeAr : svc.badgeEn) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 ring-1 ring-green-200">
                          {isAr ? svc.badgeAr : svc.badgeEn}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
                      {isAr
                        ? (svc.subtextAr ?? svc.durationAr)
                        : (svc.subtextEn ?? svc.durationEn)}
                    </p>
                  </div>

                  {/* Price + CTA */}
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-lg font-bold text-[var(--color-primary)]">
                      {isAr ? svc.priceAr : svc.priceEn}
                    </span>
                    <a
                      href={`/${locale}/coaching/book?coach=${slug}&service=${svc.slug}`}
                      className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors duration-200 shadow-[0_2px_12px_rgba(228,96,30,0.3)]"
                    >
                      {isAr ? 'احجز' : 'Book'}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-[var(--color-neutral-500)] text-center">
              {isAr
                ? 'جميع الجلسات عبر الإنترنت · بالدرهم الإماراتي'
                : 'All sessions online · Prices in AED'}
            </p>
          </div>
        </Section>
      )}

      {/* ── Group Coaching ───────────────────────────────────────────────── */}
      {coach.is_bookable && kunLevelPrice != null && (
        <Section variant="surface">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
              {isAr ? 'جماعي' : 'Group'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)] mb-8 leading-snug"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'جلسات كوتشينج جماعية' : 'Group Coaching Sessions'}
            </h2>

            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[var(--color-surface-highest)] bg-[var(--color-surface-low)] p-5 hover:border-[var(--color-primary-200)] hover:shadow-sm transition-all duration-200"
            >
              {/* Service info */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-[var(--text-primary)] text-base leading-snug"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'inherit' }}
                >
                  {isAr ? 'جلسات كوتشينج جماعية' : 'Group Coaching Sessions'}
                </p>
                <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
                  {isAr
                    ? 'جلسات جماعية صغيرة (٣-٥ مشاركين) للنمو المشترك والمساءلة · ٩٠ دقيقة'
                    : 'Small group sessions (3-5 participants) for shared growth and accountability · 90 min'}
                </p>
              </div>

              {/* Price + CTA */}
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-lg font-bold text-[var(--color-primary)]">
                  {isAr ? '١٥٠ درهم' : '150 AED'}
                </span>
                <a
                  href={`/${locale}/coaching/book?coach=${slug}&service=group-coaching-session&type=group`}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors duration-200 shadow-[0_2px_12px_rgba(228,96,30,0.3)]"
                >
                  {isAr ? 'احجز' : 'Book'}
                </a>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Availability Preview (1.7) ────────────────────────────────────── */}
      {coach.is_bookable && (
        <Section variant="surface">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
              {isAr ? 'المواعيد' : 'Availability'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)] mb-6 leading-snug"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'متى يمكنك الحجز؟' : 'When Can You Book?'}
            </h2>

            {/* Contact prompt — schedule data not available via public CMS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-5">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold text-[var(--text-primary)] leading-snug"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'inherit' }}
                >
                  {isAr ? 'تواصل لمعرفة المواعيد المتاحة' : 'Contact for available times'}
                </p>
                <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
                  {isAr
                    ? 'احجز جلستك الاستكشافية المجانية أولاً وسنتواصل معك لتحديد الموعد المناسب'
                    : 'Book your free discovery session and we will reach out to confirm a suitable time'}
                </p>
              </div>
              <a
                href={`/${locale}/coaching/book?coach=${slug}&service=discovery`}
                className="shrink-0 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-colors duration-200 shadow-[0_2px_12px_rgba(228,96,30,0.3)]"
              >
                <MessageCircle className="w-4 h-4 me-1.5" aria-hidden="true" />
                {isAr ? 'ابدأ الآن' : 'Get Started'}
              </a>
            </div>
          </div>
        </Section>
      )}

      {/* ── Related Coaches ───────────────────────────────────────────────── */}
      {relatedCoaches.length > 0 && (
        <Section variant="white">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)] mb-3">
              {isAr ? 'كوتشز مقترحون' : 'You Might Also Like'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-accent)] mb-8 leading-snug"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'كوتشز في نفس المجال' : 'Coaches in the Same Area'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedCoaches.map((rc) => {
                const rcName  = isAr ? rc.name_ar  : rc.name_en;
                const rcTitle = isAr ? rc.title_ar : rc.title_en;
                const rcLevel = rc.coach_level;

                const levelBadgeColors: Record<string, string> = {
                  MCC:         'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
                  PCC:         'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
                  ACC:         'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
                  instructor:  'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
                  facilitator: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
                };

                const rcLevelLabels: Record<string, { ar: string; en: string }> = {
                  ACC:         { ar: 'كوتش أساسي',   en: 'Basic Coach'       },
                  PCC:         { ar: 'كوتش محترف',    en: 'Professional Coach'},
                  MCC:         { ar: 'كوتش ماستر',    en: 'Master Coach'      },
                  instructor:  { ar: 'منتور',         en: 'Mentor'            },
                  facilitator: { ar: 'منتور متقدّم',  en: 'Advanced Mentor'   },
                };

                return (
                  <a
                    key={rc.slug}
                    href={`/${locale}/coaches/${rc.slug}`}
                    className="group flex flex-col rounded-2xl border border-[var(--color-neutral-100)] bg-[var(--color-surface-low)] p-5 hover:border-[var(--color-primary-200)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.1)] transition-all duration-300"
                  >
                    {/* Photo */}
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[var(--color-neutral-100)] mb-4 shrink-0">
                      {rc.photo_url ? (
                        <Image
                          src={rc.photo_url}
                          alt={rcName}
                          fill
                          className="object-cover object-top"
                          sizes="64px"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xl font-bold text-[var(--color-neutral-400)]">
                          {rcName.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors leading-snug">
                        {rcName}
                      </h3>
                      {rcTitle && (
                        <p className="mt-0.5 text-xs text-[var(--color-neutral-600)] line-clamp-2 leading-relaxed">
                          {rcTitle}
                        </p>
                      )}
                      {rcLevel && (
                        <span
                          className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${levelBadgeColors[rcLevel] ?? 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'}`}
                        >
                          {isAr
                            ? (rcLevelLabels[rcLevel]?.ar ?? rcLevel)
                            : (rcLevelLabels[rcLevel]?.en ?? rcLevel)}
                        </span>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="mt-4 pt-4 border-t border-[var(--color-neutral-100)] flex items-center gap-1 text-sm font-medium text-[var(--color-accent)] group-hover:text-[var(--color-accent-500)] transition-colors">
                      {isAr ? 'عرض الملف' : 'View Profile'}
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Back navigation ──────────────────────────────────────────────── */}
      <Section variant="surface">
        <div className="max-w-3xl mx-auto">
          <a
            href={`/${locale}/coaches`}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {isAr ? 'جميع الكوتشز' : 'All Coaches'}
          </a>
        </div>
      </Section>
    </main>
  );
}
