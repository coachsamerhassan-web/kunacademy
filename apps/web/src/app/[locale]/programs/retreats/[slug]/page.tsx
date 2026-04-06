import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

export const revalidate = 300;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// ── Valid retreat slugs ──────────────────────────────────────────────────────

const RETREAT_SLUGS = [
  'ihya-jun-2026',
  'ihya-aug-2026',
  'ihya-oct-2026',
  'ihya-dec-2026',
] as const;

type RetreatSlug = typeof RETREAT_SLUGS[number];

// ── Retreat-specific static content ─────────────────────────────────────────

const retreatContent: Record<
  RetreatSlug,
  {
    image: string;
    flag: string;
    country_ar: string;
    country_en: string;
    schedule_ar: { day: string; title: string; desc: string }[];
    schedule_en: { day: string; title: string; desc: string }[];
    included_ar: string[];
    included_en: string[];
    bring_ar: string[];
    bring_en: string[];
    highlight_ar: string;
    highlight_en: string;
  }
> = {
  'ihya-jun-2026': {
    image: '/images/programs/content/ihya-reviving-the-self--01-car-night-recognition.png',
    flag: '🇪🇬',
    country_ar: 'مصر',
    country_en: 'Egypt',
    highlight_ar: 'رحلة الانطلاق — الجلسة الأولى من إحياء ٢٠٢٦ في قلب مصر.',
    highlight_en: 'The opening retreat — the first Ihya session of 2026 in the heart of Egypt.',
    schedule_ar: [
      { day: 'اليوم الأول', title: 'الوصول والانغماس', desc: 'استقبال، توجيه، وجلسة الحضور الأولى. إطلاق من كل ما جئت منه.' },
      { day: 'اليوم الثاني', title: 'الجسد يتكلّم', desc: 'ممارسات التفكير الحسّي® الجسدية — الحركة، التنفس، والاتصال الداخلي.' },
      { day: 'اليوم الثالث', title: 'دائرة المجتمع', desc: 'جلسات جماعية عميقة، مشاركة، وتجارب تبني الصلة الحقيقية.' },
      { day: 'اليوم الرابع', title: 'العودة بوعي', desc: 'تكامل التجربة وإعداد خطة الحضور للحياة اليومية.' },
    ],
    schedule_en: [
      { day: 'Day 1', title: 'Arrival & Immersion', desc: 'Welcome, orientation, and the first presence session. Release everything you came with.' },
      { day: 'Day 2', title: 'The Body Speaks', desc: 'Somatic Thinking® body practices — movement, breath, and inner connection.' },
      { day: 'Day 3', title: 'Community Circle', desc: 'Deep group sessions, sharing, and experiences that build genuine connection.' },
      { day: 'Day 4', title: 'Conscious Return', desc: 'Integration of the experience and building a presence plan for daily life.' },
    ],
    included_ar: [
      'إقامة كاملة في مكان مختار بعناية في مصر',
      'ثلاث وجبات يومية',
      'جلسات إحياء يومية بمنهجية التفكير الحسّي®',
      'وقت صمت وتأمل مُهيكَل',
      'تجارب جماعية موجّهة',
      'دعم ما بعد الرحلة لمدة أسبوعين',
    ],
    included_en: [
      'Full accommodation at a carefully selected Egyptian venue',
      'Three daily meals',
      'Daily revival sessions through Somatic Thinking®',
      'Structured silence and reflection time',
      'Guided group experiences',
      'Two weeks post-retreat support',
    ],
    bring_ar: [
      'ملابس مريحة (لا رسمية)',
      'دفتر ملاحظات للكتابة',
      'رغبة حقيقية في الحضور',
      'الحد الأدنى من الاتصال بالعالم الخارجي',
    ],
    bring_en: [
      'Comfortable clothes (no formal attire)',
      'A notebook for writing',
      'A genuine desire to be present',
      'Minimal external connectivity',
    ],
  },
  'ihya-aug-2026': {
    image: '/images/programs/content/ihya-reviving-the-self--02-mountain-arrival-aerial.png',
    flag: '🇮🇹',
    country_ar: 'جبال إيطاليا',
    country_en: 'Italy Mountains',
    highlight_ar: 'الرحلة الدولية الموقّعة — تجربة لا تتكرر في قلب جبال إيطاليا.',
    highlight_en: 'The signature international retreat — a once-in-a-lifetime experience in the heart of the Italian mountains.',
    schedule_ar: [
      { day: 'اليوم الأول', title: 'الوصول إلى الجبال', desc: 'استقبال في أجواء الطبيعة الجبلية الإيطالية. جلسة الانتقال من الصخب إلى الصمت.' },
      { day: 'اليوم الثاني', title: 'الصمت والطبيعة', desc: 'ممارسات التفكير الحسّي® في الهواء الطلق — المشي، الجلوس، والاستماع للطبيعة.' },
      { day: 'اليوم الثالث', title: 'التكامل الثقافي', desc: 'استكشاف كيف تلهمك بيئة مختلفة حضورًا مختلفًا. دائرة مشاركة دولية.' },
      { day: 'اليوم الرابع', title: 'الهدية للمنزل', desc: 'تكامل التجربة الدولية وكيف تحمل معك الصمت الجبلي.' },
    ],
    schedule_en: [
      { day: 'Day 1', title: 'Arrival in the Mountains', desc: 'Welcome amid the Italian mountain landscape. A session transitioning from noise to silence.' },
      { day: 'Day 2', title: 'Silence & Nature', desc: 'Somatic Thinking® practices outdoors — walking, sitting, listening to nature.' },
      { day: 'Day 3', title: 'Cultural Integration', desc: 'Exploring how a different environment opens different presence. International sharing circle.' },
      { day: 'Day 4', title: 'The Gift Home', desc: 'Integrating the international experience and how to carry the mountain silence with you.' },
    ],
    included_ar: [
      'إقامة كاملة في منتجع جبلي إيطالي مختار',
      'ثلاث وجبات يومية (مطبخ إيطالي وعالمي)',
      'جلسات إحياء يومية بمنهجية التفكير الحسّي®',
      'جولات في الطبيعة الجبلية',
      'تجارب جماعية دولية',
      'دعم ما بعد الرحلة لمدة شهر',
    ],
    included_en: [
      'Full accommodation at a selected Italian mountain retreat',
      'Three daily meals (Italian and international cuisine)',
      'Daily revival sessions through Somatic Thinking®',
      'Mountain nature walks',
      'International group experiences',
      'One month post-retreat support',
    ],
    bring_ar: [
      'ملابس مناسبة لمناخ جبلي (صيف — قد تكون باردة في الليل)',
      'حذاء مريح للمشي',
      'دفتر ملاحظات',
      'جواز سفر ساري',
      'استعداد للدهشة',
    ],
    bring_en: [
      'Clothes suitable for mountain climate (summer — can be cool at night)',
      'Comfortable walking shoes',
      'A notebook',
      'Valid passport',
      'Readiness for wonder',
    ],
  },
  'ihya-oct-2026': {
    image: '/images/programs/content/ihya-reviving-the-self--03-stone-terrace-circle.png',
    flag: '🇪🇬',
    country_ar: 'مصر',
    country_en: 'Egypt',
    highlight_ar: 'رحلة الخريف — بداية موسم الانعكاس والتجديد في مصر.',
    highlight_en: 'The autumn retreat — the season of reflection and renewal begins in Egypt.',
    schedule_ar: [
      { day: 'اليوم الأول', title: 'الوصول والانغماس', desc: 'استقبال، توجيه، وجلسة الحضور الأولى.' },
      { day: 'اليوم الثاني', title: 'الجسد في الخريف', desc: 'ممارسات جسدية تستجيب لطاقة التحوّل في الخريف.' },
      { day: 'اليوم الثالث', title: 'الدائرة والمشاركة', desc: 'جلسات جماعية عميقة وتجارب تبني الصلة الحقيقية.' },
      { day: 'اليوم الرابع', title: 'العودة بوعي', desc: 'تكامل التجربة وإعداد خطة الحضور.' },
    ],
    schedule_en: [
      { day: 'Day 1', title: 'Arrival & Immersion', desc: 'Welcome, orientation, and the first presence session.' },
      { day: 'Day 2', title: 'Body in Autumn', desc: 'Somatic practices responding to the energy of autumn transformation.' },
      { day: 'Day 3', title: 'Circle & Sharing', desc: 'Deep group sessions and experiences building genuine connection.' },
      { day: 'Day 4', title: 'Conscious Return', desc: 'Experience integration and building a presence plan.' },
    ],
    included_ar: [
      'إقامة كاملة في مصر',
      'ثلاث وجبات يومية',
      'جلسات إحياء يومية بمنهجية التفكير الحسّي®',
      'وقت صمت وتأمل',
      'تجارب جماعية موجّهة',
      'دعم ما بعد الرحلة',
    ],
    included_en: [
      'Full accommodation in Egypt',
      'Three daily meals',
      'Daily revival sessions through Somatic Thinking®',
      'Silence and reflection time',
      'Guided group experiences',
      'Post-retreat support',
    ],
    bring_ar: [
      'ملابس مريحة',
      'دفتر ملاحظات',
      'رغبة حقيقية في الحضور',
    ],
    bring_en: [
      'Comfortable clothes',
      'A notebook',
      'A genuine desire to be present',
    ],
  },
  'ihya-dec-2026': {
    image: '/images/programs/content/ihya-reviving-the-self--01-car-night-recognition.png',
    flag: '🇪🇬',
    country_ar: 'مصر',
    country_en: 'Egypt',
    highlight_ar: 'رحلة نهاية العام — أفضل هدية تمنحها لنفسك قبل استقبال عام جديد.',
    highlight_en: "The year-end retreat — the best gift you can give yourself before welcoming a new year.",
    schedule_ar: [
      { day: 'اليوم الأول', title: 'الوصول والانغماس', desc: 'استقبال وجلسة مراجعة العام — ما عشته، ما تركته، ما تحمله.' },
      { day: 'اليوم الثاني', title: 'تقطير العام', desc: 'ممارسات جسدية تساعدك على استخلاص جوهر رحلتك في هذا العام.' },
      { day: 'اليوم الثالث', title: 'النية والبذرة', desc: 'دائرة مشاركة وزرع نية الحضور للعام القادم.' },
      { day: 'اليوم الرابع', title: 'البداية الجديدة', desc: 'تكامل وجلسة الانطلاق نحو عام بحضور كامل.' },
    ],
    schedule_en: [
      { day: 'Day 1', title: 'Arrival & Immersion', desc: 'Welcome and a year-review session — what you lived, what you released, what you carry.' },
      { day: 'Day 2', title: 'Distilling the Year', desc: 'Somatic practices helping you extract the essence of your journey this year.' },
      { day: 'Day 3', title: 'Intention & Seed', desc: 'Sharing circle and planting a presence intention for the coming year.' },
      { day: 'Day 4', title: 'The New Beginning', desc: 'Integration and a launch session toward a year of full presence.' },
    ],
    included_ar: [
      'إقامة كاملة في مصر',
      'ثلاث وجبات يومية',
      'جلسات إحياء يومية بمنهجية التفكير الحسّي®',
      'وقت صمت وتأمل مُهيكَل',
      'تجارب جماعية موجّهة',
      'دعم ما بعد الرحلة',
    ],
    included_en: [
      'Full accommodation in Egypt',
      'Three daily meals',
      'Daily revival sessions through Somatic Thinking®',
      'Structured silence and reflection time',
      'Guided group experiences',
      'Post-retreat support',
    ],
    bring_ar: [
      'ملابس مريحة',
      'دفتر ملاحظات للمراجعة',
      'رغبة حقيقية في التجديد',
    ],
    bring_en: [
      'Comfortable clothes',
      'A review notebook',
      'A genuine desire for renewal',
    ],
  },
};

// ── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const locales = ['ar', 'en'];
  return locales.flatMap((locale) =>
    RETREAT_SLUGS.map((slug) => ({ locale, slug }))
  );
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const isAr = locale === 'ar';
  const event = await cms.getEvent(slug);

  if (!event) return {};

  const title = isAr ? event.title_ar : event.title_en;
  const description = isAr ? event.description_ar : event.description_en;
  const content = retreatContent[slug as RetreatSlug];

  return {
    title: `${title} | ${isAr ? 'أكاديمية كُن' : 'Kun Academy'}`,
    description: description?.slice(0, 160) || '',
    openGraph: {
      title,
      description: description?.slice(0, 160) || '',
      images: content ? [{ url: content.image }] : [],
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RetreatDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  if (!RETREAT_SLUGS.includes(slug as RetreatSlug)) notFound();

  // Try CMS first, fall back to inline data (retreat events may not be in Google Sheets yet)
  let event = await cms.getEvent(slug);
  if (!event) {
    const inlineEvents: Record<string, { title_ar: string; title_en: string; description_ar: string; description_en: string; date_start: string; date_end: string; location_ar: string; location_en: string; }> = {
      'ihya-jun-2026': { title_ar: 'إحياء النفس — مصر', title_en: 'Ihya: Reviving the Self — Egypt', description_ar: 'خلوة إحياء النفس بمنهجية التفكير الحسّي®', description_en: 'Ihya retreat through Somatic Thinking® methodology', date_start: '2026-06-18', date_end: '2026-06-21', location_ar: 'مصر', location_en: 'Egypt' },
      'ihya-aug-2026': { title_ar: 'إحياء النفس — إيطاليا', title_en: 'Ihya: Reviving the Self — Italy Mountains', description_ar: 'الخلوة الدولية المميزة في جبال إيطاليا', description_en: 'The signature international retreat in the Italian mountains', date_start: '2026-08-06', date_end: '2026-08-09', location_ar: 'جبال إيطاليا', location_en: 'Italy Mountains' },
      'ihya-oct-2026': { title_ar: 'إحياء النفس — مصر', title_en: 'Ihya: Reviving the Self — Egypt', description_ar: 'خلوة إحياء النفس الخريفية', description_en: 'Autumn Ihya retreat', date_start: '2026-10-08', date_end: '2026-10-11', location_ar: 'مصر', location_en: 'Egypt' },
      'ihya-dec-2026': { title_ar: 'إحياء النفس — مصر', title_en: 'Ihya: Reviving the Self — Egypt', description_ar: 'خلوة إحياء النفس لنهاية العام', description_en: 'Year-end Ihya retreat', date_start: '2026-12-10', date_end: '2026-12-13', location_ar: 'مصر', location_en: 'Egypt' },
    };
    const inline = inlineEvents[slug];
    if (!inline) notFound();
    event = { slug, ...inline, published: true } as any;
  }

  const content = retreatContent[slug as RetreatSlug];
  if (!content) notFound();

  const title = isAr ? event.title_ar : event.title_en;
  const description = isAr ? event.description_ar : event.description_en;
  const location = isAr ? event.location_ar : event.location_en;

  const startDate = new Date(event.date_start + 'T00:00:00');
  const endDate = event.date_end ? new Date(event.date_end + 'T00:00:00') : null;
  const today = new Date().toISOString().split('T')[0];
  const isPast = event.date_start < today;
  const isDeadlinePassed = event.registration_deadline && event.registration_deadline < today;
  const isOpen = event.status === 'open' && !isPast && !isDeadlinePassed;

  const dateRangeStr = (() => {
    const locStr = locale === 'ar' ? 'ar-SA' : 'en-US';
    const s = startDate.toLocaleDateString(locStr, { month: 'long', day: 'numeric' });
    const e = endDate
      ? endDate.toLocaleDateString(locStr, { month: 'long', day: 'numeric', year: 'numeric' })
      : startDate.toLocaleDateString(locStr, { year: 'numeric' });
    return `${s} — ${e}`;
  })();

  const schedule = isAr ? content.schedule_ar : content.schedule_en;
  const included = isAr ? content.included_ar : content.included_en;
  const bring = isAr ? content.bring_ar : content.bring_en;

  // Other retreats (excluding current)
  const otherSlugs = RETREAT_SLUGS.filter((s) => s !== slug);
  const otherEvents = await Promise.all(otherSlugs.map((s) => cms.getEvent(s)));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: description || '',
    startDate: event.date_start,
    ...(event.date_end ? { endDate: event.date_end } : {}),
    image: content.image,
    eventStatus: isPast
      ? 'https://schema.org/EventScheduled'
      : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: location || content.country_en, addressCountry: content.flag === '🇮🇹' ? 'IT' : 'EG' },
    organizer: { '@type': 'Organization', name: 'Kun Academy', url: 'https://kunacademy.com' },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: '480px' }}>
        <div className="absolute inset-0">
          <Image
            src={content.image}
            alt=""
            fill
            className="object-cover"
            style={{ filter: 'brightness(0.3)' }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(29,26,61,0.5)] via-transparent to-[rgba(29,26,61,0.9)]" />
        </div>
        <GeometricPattern pattern="eight-star" opacity={0.05} fade="both" />

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 py-20 md:py-28">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-white/50 text-sm">
            <a href={`/${locale}/programs/retreats`} className="hover:text-white/80 transition-colors">
              {isAr ? 'رحلات الإحياء' : 'Ihya Retreats'}
            </a>
            <span>/</span>
            <span className="text-white/70">{content.flag} {isAr ? content.country_ar : content.country_en}</span>
          </div>

          {/* Ihya logo */}
          <div className="mb-5">
            <Image
              src="/images/programs/logos/ihya-main-white.png"
              alt="Ihya"
              width={140}
              height={60}
              className="object-contain"
              style={{ maxHeight: '60px', width: 'auto' }}
            />
          </div>

          <h1
            className="text-[2rem] md:text-[3rem] font-bold text-[#FFF5E9] leading-[1.1] max-w-3xl"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {title}
          </h1>

          {/* Date + Location row */}
          <div className="flex flex-wrap items-center gap-4 mt-5 text-white/70">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {dateRangeStr}
            </div>
            {location && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {content.flag} {location}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {isAr ? '٤ أيام' : '4 days'}
            </div>
          </div>

          {/* Status + CTA inline */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                isPast
                  ? 'bg-neutral-500/40 text-white/70'
                  : isOpen
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-400/90 text-amber-900'
              }`}
            >
              {isPast
                ? (isAr ? 'انتهت هذه الرحلة' : 'This retreat has passed')
                : isOpen
                  ? (isAr ? 'التسجيل مفتوح' : 'Registration Open')
                  : (isAr ? 'قريبًا' : 'Coming Soon')}
            </span>
            {!isPast && (
              <a
                href={`/${locale}/contact`}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_4px_20px_rgba(228,96,30,0.4)]"
              >
                {isAr ? 'سجّل اهتمامك' : 'Express Interest'}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Content + Sidebar ─────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            {/* Highlight */}
            <div className="rounded-2xl bg-[var(--color-primary-50)] border border-[var(--color-primary)]/10 p-5 flex items-start gap-3">
              <div className="text-3xl shrink-0">{content.flag}</div>
              <p
                className="text-[var(--color-primary-700)] font-medium leading-relaxed text-sm md:text-base"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {isAr ? content.highlight_ar : content.highlight_en}
              </p>
            </div>

            {/* Description */}
            {description && (
              <div>
                <h2
                  className="text-xl font-bold text-[var(--text-primary)] mb-3"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? 'عن هذه الرحلة' : 'About This Retreat'}
                </h2>
                <p
                  className="text-[var(--color-neutral-700)] leading-relaxed text-base"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                >
                  {description}
                </p>
              </div>
            )}

            {/* Schedule */}
            <div>
              <h2
                className="text-xl font-bold text-[var(--text-primary)] mb-5"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'هيكل الرحلة' : 'Retreat Schedule'}
              </h2>
              <div className="space-y-3">
                {schedule.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-5 flex gap-4"
                  >
                    <div
                      className="min-w-[48px] h-12 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div
                        className="text-xs font-semibold text-[var(--color-accent)] mb-1 uppercase tracking-wide"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                      >
                        {item.day}
                      </div>
                      <h3
                        className="font-bold text-[var(--text-primary)] mb-1"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="text-sm text-[var(--color-neutral-600)] leading-relaxed"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What to bring */}
            <div>
              <h2
                className="text-xl font-bold text-[var(--text-primary)] mb-5"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'ماذا تُحضر معك؟' : 'What to Bring'}
              </h2>
              <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-5">
                <ul className="space-y-2.5">
                  {bring.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-1 w-4 h-4 rounded-full bg-[var(--color-accent-100)] flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-[var(--color-accent)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                      <span
                        className="text-sm text-[var(--color-neutral-700)] leading-relaxed"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Registration card */}
              <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-6 shadow-[0_4px_24px_rgba(71,64,153,0.07)]">
                <div className="text-center mb-5">
                  <div className="text-4xl mb-2">{content.flag}</div>
                  <div
                    className="text-sm text-[var(--color-neutral-500)]"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                  >
                    {isAr ? content.country_ar : content.country_en}
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-accent)] font-medium">{dateRangeStr}</div>
                </div>

                <div
                  className="text-center text-sm text-[var(--color-neutral-600)] mb-4 pb-4 border-b border-[var(--color-neutral-100)]"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                >
                  {isAr ? 'السعر يُحدَّد عند التسجيل' : 'Price confirmed upon registration'}
                </div>

                {isPast ? (
                  <div className="text-center py-3 rounded-xl bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] text-sm font-medium">
                    {isAr ? 'انتهت هذه الرحلة' : 'This retreat has passed'}
                  </div>
                ) : (
                  <>
                    <a
                      href={`/${locale}/contact`}
                      className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-sm hover:bg-[var(--color-primary-600)] transition-colors"
                    >
                      {isAr ? 'سجّل اهتمامك' : 'Express Interest'}
                    </a>
                    <p
                      className="mt-3 text-xs text-[var(--color-neutral-500)] text-center leading-relaxed"
                      style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                    >
                      {isAr
                        ? 'الأماكن محدودة — سيتواصل فريقنا معك لتأكيد المكان والسعر'
                        : 'Limited seats — our team will contact you to confirm your place and pricing'}
                    </p>
                  </>
                )}
              </div>

              {/* What's included — sidebar card */}
              <div className="rounded-2xl border border-[var(--color-neutral-200)] bg-white p-5">
                <h3
                  className="font-bold text-[var(--text-primary)] mb-4 text-sm"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? 'ما يشمله السعر' : "What's Included"}
                </h3>
                <ul className="space-y-2.5">
                  {included.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                      <span
                        className="text-xs text-[var(--color-neutral-700)] leading-relaxed"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Other Retreats ────────────────────────────────────────────────── */}
      <Section variant="surface">
        <h2
          className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-8 text-center"
          style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
        >
          {isAr ? 'رحلات أخرى في ٢٠٢٦' : 'Other 2026 Retreats'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {otherEvents.map((other, i) => {
            if (!other) return null;
            const otherSlug = otherSlugs[i];
            const otherContent = retreatContent[otherSlug];
            const otherTitle = isAr ? other.title_ar : other.title_en;
            const otherLocation = isAr ? other.location_ar : other.location_en;
            const otherDateStr = (() => {
              const locStr = locale === 'ar' ? 'ar-SA' : 'en-US';
              const s = new Date(other.date_start + 'T00:00:00');
              const e = other.date_end ? new Date(other.date_end + 'T00:00:00') : null;
              return `${s.toLocaleDateString(locStr, { month: 'short', day: 'numeric' })}${e ? ` — ${e.toLocaleDateString(locStr, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`;
            })();

            return (
              <a
                key={otherSlug}
                href={`/${locale}/programs/retreats/${otherSlug}`}
                className="group rounded-2xl overflow-hidden bg-white shadow-[0_2px_12px_rgba(71,64,153,0.06)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500 block"
              >
                {otherContent?.image && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={otherContent.image}
                      alt={otherTitle}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute bottom-2 right-2 text-xl">{otherContent?.flag}</div>
                  </div>
                )}
                <div className="p-4">
                  <div className="text-xs text-[var(--color-accent)] font-medium mb-1">{otherDateStr}</div>
                  <h3
                    className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {otherTitle}
                  </h3>
                  {otherLocation && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-neutral-500)]">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {otherLocation}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </Section>

      {/* ── Back link ─────────────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="text-center">
          <a
            href={`/${locale}/programs/retreats`}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline"
          >
            <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3l-5 5 5 5" /></svg>
            {isAr ? 'جميع رحلات الإحياء' : 'All Ihya Retreats'}
          </a>
        </div>
      </Section>
    </main>
  );
}
