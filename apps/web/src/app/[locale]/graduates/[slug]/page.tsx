import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { GraduateProfileClient } from './graduate-profile-client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Certificate {
  program_slug:    string;
  program_name_ar: string;
  program_name_en: string;
  badge_slug:      string;
  badge_image_url: string | null;
  badge_label_ar:  string;
  badge_label_en:  string;
  graduation_date: string | null;
  icf_credential:  string | null;
  certificate_type: string;
  cohort_name:     string | null;
  verified:        boolean;
}

interface GraduateProfile {
  id:              string;
  slug:            string;
  name_ar:         string;
  name_en:         string;
  photo_url:       string | null;
  bio_ar:          string | null;
  bio_en:          string | null;
  country:         string | null;
  languages:       string[] | null;
  member_type:     string;
  coaching_status: string | null;
  certificates:    Certificate[];
}

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// ── Country flag helper ───────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  'UAE':          '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Egypt':        '🇪🇬',
  'Jordan':       '🇯🇴',
  'Kuwait':       '🇰🇼',
  'Qatar':        '🇶🇦',
  'Bahrain':      '🇧🇭',
  'Oman':         '🇴🇲',
  'Lebanon':      '🇱🇧',
  'Morocco':      '🇲🇦',
  'Tunisia':      '🇹🇳',
  'Libya':        '🇱🇾',
  'Iraq':         '🇮🇶',
  'Syria':        '🇸🇾',
  'Palestine':    '🇵🇸',
  'UK':           '🇬🇧',
  'USA':          '🇺🇸',
  'Germany':      '🇩🇪',
  'France':       '🇫🇷',
  'Canada':       '🇨🇦',
  'Australia':    '🇦🇺',
};

function getFlag(country: string | null): string {
  if (!country) return '';
  return COUNTRY_FLAGS[country] ?? '';
}

// ── Gradient palette for initials avatar ──────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-amber-400 to-orange-500',
  'from-yellow-400 to-amber-500',
  'from-orange-400 to-red-500',
  'from-amber-500 to-yellow-600',
  'from-yellow-500 to-orange-600',
];

function getGradient(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ── Server fetch helper ───────────────────────────────────────────────────────

async function fetchGraduate(slug: string): Promise<GraduateProfile | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXTAUTH_URL || 'http://localhost:3001';

    const res = await fetch(`${baseUrl}/api/graduates/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.graduate as GraduateProfile) ?? null;
  } catch {
    return null;
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const graduate = await fetchGraduate(slug);
  if (!graduate) return {};

  const isAr = locale === 'ar';
  const name = isAr ? graduate.name_ar : graduate.name_en;
  const bio  = isAr ? graduate.bio_ar  : graduate.bio_en;

  return {
    title: `${name} | ${isAr ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: bio?.slice(0, 160) || (isAr
      ? `خريج أكاديمية كُن — ${name}`
      : `Kun Academy graduate — ${name}`),
    openGraph: {
      title: name,
      description: bio?.slice(0, 160) || '',
      ...(graduate.photo_url ? { images: [{ url: graduate.photo_url }] } : {}),
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GraduateProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const graduate = await fetchGraduate(slug);
  if (!graduate) notFound();

  const name     = isAr ? graduate.name_ar : graduate.name_en;
  const bio      = isAr ? graduate.bio_ar  : graduate.bio_en;
  const initial  = (graduate.name_en || graduate.name_ar).charAt(0).toUpperCase();
  const gradient = getGradient(graduate.slug);
  const flag     = getFlag(graduate.country);

  const isCoach   = graduate.member_type === 'coach' || graduate.member_type === 'both';
  const isClaimed = !!graduate.photo_url; // rough proxy; could use claimed_at if passed

  // ── JSON-LD structured data ────────────────────────────────────────────────

  const jsonLd = {
    '@context':  'https://schema.org',
    '@type':     'Person',
    name,
    ...(bio ? { description: bio.slice(0, 300) } : {}),
    ...(graduate.photo_url ? { image: graduate.photo_url } : {}),
    url:         `https://kunacademy.com/${locale}/graduates/${slug}`,
    alumniOf:    { '@type': 'Organization', name: 'Kun Academy', url: 'https://kunacademy.com' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ── Hero / profile header ──────────────────────────────────────── */}
        <section className="relative overflow-hidden py-12 md:py-16">
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(146,104,48,0.9) 0%, rgba(29,26,61,0.95) 100%)',
              }}
            />
            <GeometricPattern pattern="girih" opacity={0.06} fade="both" />
          </div>

          <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
            {/* Back link */}
            <a
              href={`/${locale}/graduates`}
              className={`inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white/90 transition-colors mb-6 ${isAr ? 'flex-row-reverse' : ''}`}
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} aria-hidden="true" />
              {isAr ? 'العودة إلى الخريجين' : 'Back to graduates'}
            </a>

            <div className={`flex flex-col sm:flex-row gap-6 items-start sm:items-center ${isAr ? 'sm:flex-row-reverse text-right' : ''}`}>
              {/* Avatar */}
              <div className="relative shrink-0 h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden ring-4 ring-amber-400/40 shadow-xl">
                {graduate.photo_url ? (
                  <Image
                    src={graduate.photo_url}
                    alt={name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 96px, 112px"
                    priority
                  />
                ) : (
                  <div
                    className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${gradient} text-white text-4xl font-bold`}
                  >
                    {initial}
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <h1
                  className="text-2xl md:text-3xl font-bold text-[#FFF5E9] leading-tight"
                  style={{
                    fontFamily: isAr
                      ? 'var(--font-arabic-heading)'
                      : 'var(--font-english-heading)',
                  }}
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  {name}
                </h1>

                {/* Country + language */}
                <div className={`flex flex-wrap items-center gap-3 mt-2 ${isAr ? 'flex-row-reverse' : ''}`}>
                  {graduate.country && (
                    <span className="flex items-center gap-1.5 text-sm text-white/70">
                      {flag && <span className="text-base">{flag}</span>}
                      {graduate.country}
                    </span>
                  )}
                  {graduate.languages && graduate.languages.length > 0 && (
                    <span className="text-sm text-white/60">
                      {graduate.languages.join(' · ')}
                    </span>
                  )}
                </div>

                {/* Status badges */}
                <div className={`flex flex-wrap gap-2 mt-3 ${isAr ? 'flex-row-reverse' : ''}`}>
                  {isCoach && graduate.coaching_status === 'active' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30">
                      {isAr ? 'كوتش نشط' : 'Active Coach'}
                    </span>
                  )}
                  {isCoach && graduate.coaching_status === 'in_training' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                      {isAr ? 'قيد التدريب' : 'In Training'}
                    </span>
                  )}
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                    {isAr ? 'خريج كُن' : 'Kun Graduate'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Profile body ──────────────────────────────────────────────── */}
        <Section variant="white">
          <div className={`max-w-3xl ${isAr ? 'ml-auto text-right' : 'mr-auto'}`} dir={isAr ? 'rtl' : 'ltr'}>

            {/* Bio */}
            {bio && (
              <div className="mb-10">
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">
                  {isAr ? 'نبذة' : 'About'}
                </h2>
                <p className="text-[var(--color-neutral-600)] leading-relaxed text-sm md:text-base">
                  {bio}
                </p>
              </div>
            )}

            {/* Certificates section */}
            {graduate.certificates.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-5">
                  {isAr ? 'الشهادات والبرامج' : 'Certificates & Programs'}
                </h2>

                <GraduateProfileClient
                  certificates={graduate.certificates}
                  locale={locale}
                />
              </div>
            )}

            {/* Book a session CTA (coaches only) */}
            {isCoach && graduate.coaching_status === 'active' && (
              <div className={`rounded-2xl border border-[var(--color-neutral-100)] bg-[var(--color-surface-low)] p-6 mb-8 ${isAr ? 'text-right' : ''}`}>
                <h3 className="font-bold text-[var(--text-primary)] mb-1">
                  {isAr ? 'هل تريد جلسة كوتشينج؟' : 'Book a Coaching Session'}
                </h3>
                <p className="text-sm text-[var(--color-neutral-600)] mb-4">
                  {isAr
                    ? `${name} كوتش معتمد من أكاديمية كُن — احجز جلسة الآن`
                    : `${name} is a certified Kun Academy coach — book a session now`}
                </p>
                <a
                  href={`/${locale}/coaching/book`}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-500)] transition-colors duration-200 min-h-[40px]"
                >
                  {isAr ? 'احجز جلسة' : 'Book a Session'}
                </a>
              </div>
            )}

            {/* Unclaimed profile nudge */}
            {!isClaimed && (
              <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-5 ${isAr ? 'text-right' : ''}`}>
                <p className="text-sm text-amber-800">
                  {isAr ? (
                    <>
                      هل أنت {name}؟{' '}
                      <a
                        href={`/${locale}/auth/login?callbackUrl=/${locale}/dashboard/certificates`}
                        className="font-semibold underline underline-offset-2 hover:text-amber-700"
                      >
                        أطالب بملفك الشخصي
                      </a>{' '}
                      وأضف صورتك وسيرتك الذاتية.
                    </>
                  ) : (
                    <>
                      Are you {name}?{' '}
                      <a
                        href={`/${locale}/auth/login?callbackUrl=/${locale}/dashboard/certificates`}
                        className="font-semibold underline underline-offset-2 hover:text-amber-700"
                      >
                        Claim this profile
                      </a>{' '}
                      to add your photo and bio.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </Section>
      </main>
    </>
  );
}
