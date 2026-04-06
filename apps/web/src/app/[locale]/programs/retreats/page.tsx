import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { cms } from '@kunacademy/cms/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

export const revalidate = 300;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'إحياء النفس — رحلات الإحياء | أكاديمية كُن' : 'Ihya: Reviving the Self — Retreats | Kun Academy',
    description: isAr
      ? 'أربعة أيام من الانغماس العميق بمنهجية التفكير الحسّي® — مصر وإيطاليا. ليست ورش عمل. تجارب حياة كاملة.'
      : 'Four days of deep immersion through Somatic Thinking® — Egypt and Italy. Not workshops. Complete life experiences.',
    openGraph: {
      images: [{ url: '/images/programs/content/ihya-reviving-the-self--02-mountain-arrival-aerial.png' }],
    },
  };
}

const RETREAT_SLUGS = [
  'ihya-jun-2026',
  'ihya-aug-2026',
  'ihya-oct-2026',
  'ihya-dec-2026',
] as const;

const locationEmoji: Record<string, string> = {
  'ihya-jun-2026': '🇪🇬',
  'ihya-aug-2026': '🇮🇹',
  'ihya-oct-2026': '🇪🇬',
  'ihya-dec-2026': '🇪🇬',
};

const retreatImages: Record<string, string> = {
  'ihya-jun-2026': '/images/programs/content/ihya-reviving-the-self--01-car-night-recognition.png',
  'ihya-aug-2026': '/images/programs/content/ihya-reviving-the-self--02-mountain-arrival-aerial.png',
  'ihya-oct-2026': '/images/programs/content/ihya-reviving-the-self--03-stone-terrace-circle.png',
  'ihya-dec-2026': '/images/programs/content/ihya-reviving-the-self--01-car-night-recognition.png',
};

function formatDateRange(start: string, end?: string, locale = 'en'): string {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = end ? new Date(end + 'T00:00:00') : null;
  const localeStr = locale === 'ar' ? 'ar-SA' : 'en-US';

  const startStr = startDate.toLocaleDateString(localeStr, { month: 'long', day: 'numeric' });
  const endStr = endDate
    ? endDate.toLocaleDateString(localeStr, { month: 'long', day: 'numeric', year: 'numeric' })
    : startDate.toLocaleDateString(localeStr, { year: 'numeric' });

  return `${startStr} — ${endStr}`;
}

export default async function RetreatsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  // Fetch all 4 retreat events in parallel
  const retreatEvents = await Promise.all(
    RETREAT_SLUGS.map((slug) => cms.getEvent(slug))
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: '520px' }}>
        {/* Background image — Italy mountains */}
        <div className="absolute inset-0">
          <Image
            src="/images/programs/content/ihya-reviving-the-self--02-mountain-arrival-aerial.png"
            alt=""
            fill
            className="object-cover"
            style={{ filter: 'brightness(0.28)' }}
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(29,26,61,0.6)] via-transparent to-[rgba(29,26,61,0.85)]" />
        </div>
        <GeometricPattern pattern="eight-star" opacity={0.05} fade="both" />

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 py-20 md:py-28 flex flex-col items-center text-center">
          {/* Ihya logo mark */}
          <div className="mb-6">
            <Image
              src="/images/programs/logos/ihya-main-white.png"
              alt="Ihya"
              width={180}
              height={80}
              className="mx-auto object-contain"
              style={{ maxHeight: '80px', width: 'auto' }}
            />
          </div>

          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.1] animate-fade-up"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'إحياء النفس' : 'Ihya: Reviving the Self'}
          </h1>

          <p
            className="mt-4 text-white/70 max-w-2xl text-lg md:text-xl leading-relaxed animate-fade-up"
            style={{ animationDelay: '0.1s', fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'ليست ورش عمل. تجارب حياة كاملة في أماكن اختيرت بعناية.'
              : 'Not workshops. Complete life experiences in carefully chosen locations.'}
          </p>

          <div
            className="mt-3 text-white/50 max-w-xl text-sm md:text-base leading-relaxed animate-fade-up"
            style={{ animationDelay: '0.2s', fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'أربع رحلات في ٢٠٢٦ — مصر وإيطاليا'
              : '4 retreats in 2026 — Egypt & Italy'}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <a
              href="#retreats"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'اكتشف المواعيد' : 'View Dates'}
            </a>
            <a
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white/15 text-white font-semibold text-sm border border-white/30 hover:bg-white/25 transition-colors"
            >
              {isAr ? 'سجّل اهتمامك' : 'Express Interest'}
            </a>
          </div>
        </div>
      </section>

      {/* ── What is Ihya ─────────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-primary-50)] mb-6">
            <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2
            className="text-[1.75rem] md:text-[2.25rem] font-bold text-[var(--text-accent)] leading-[1.2]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ما هو الإحياء؟' : 'What is Ihya?'}
          </h2>
          <p
            className="mt-5 text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'إحياء النفس هو برنامج انغماس ثنائي الشهر مصمّم لمن يريد أن يخرج من روتين الحياة اليومية إلى فضاء آمن من الحضور الكامل. أربعة أيام بمنهجية التفكير الحسّي® — لا هاتف، لا جداول، لا أدوار. فقط أنت وجسدك وأشخاص يبحثون عن الشيء ذاته.'
              : 'Ihya: Reviving the Self is a bi-monthly immersion program designed for those who want to step out of daily routine into a safe space of full presence. Four days through Somatic Thinking® methodology — no phones, no schedules, no roles. Just you, your body, and people searching for the same thing.'}
          </p>
          <p
            className="mt-4 text-[var(--color-neutral-600)] leading-relaxed text-sm md:text-base"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'مفتوح للخرّيجين والجدد على حد سواء. كل رحلة مكتفية بذاتها — لا شرط مسبق. الشرط الوحيد: الرغبة في الحضور.'
              : 'Open to graduates and newcomers alike. Each retreat is self-contained — no prerequisite. The only requirement: the desire to be present.'}
          </p>
        </div>

        {/* 3 pillars */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
              title_ar: 'الجسد',
              title_en: 'Body',
              desc_ar: 'ممارسات جسدية تعيد الاتصال بالحضور الحسّي',
              desc_en: 'Somatic practices that restore connection to physical presence',
            },
            {
              icon: 'M12 3v1m0 16v1M4.22 4.22l.7.7m12.17 12.17l.7.7M1 12h1m18 0h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7',
              title_ar: 'الروح',
              title_en: 'Soul',
              desc_ar: 'فضاء داخلي للتأمل والمعنى والتجديد',
              desc_en: 'Inner space for reflection, meaning, and renewal',
            },
            {
              icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
              title_ar: 'المجتمع',
              title_en: 'Community',
              desc_ar: 'رفقاء يبحثون عن الشيء ذاته — صلة حقيقية',
              desc_en: 'Companions seeking the same — genuine connection',
            },
          ].map((pillar, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 text-center bg-[var(--color-primary-50)] border border-[var(--color-primary)]/10"
            >
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={pillar.icon} />
                </svg>
              </div>
              <h3
                className="font-bold text-[var(--text-primary)] text-lg mb-2"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? pillar.title_ar : pillar.title_en}
              </h3>
              <p
                className="text-sm text-[var(--color-neutral-600)] leading-relaxed"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {isAr ? pillar.desc_ar : pillar.desc_en}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2026 Retreats Timeline ────────────────────────────────────────── */}
      <Section variant="surface" id="retreats">
        <div className="text-center mb-10">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'رحلات ٢٠٢٦' : '2026 Retreats'}
          </h2>
          <p
            className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto text-sm md:text-base"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'أربع رحلات على مدار العام — اختر الموعد الذي يناسب رحلتك'
              : 'Four retreats throughout the year — choose the date that fits your journey'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto stagger-children">
          {retreatEvents.map((event, i) => {
            if (!event) return null;
            const slug = RETREAT_SLUGS[i];
            const title = isAr ? event.title_ar : event.title_en;
            const description = isAr ? event.description_ar : event.description_en;
            const location = isAr ? event.location_ar : event.location_en;
            const dateStr = formatDateRange(event.date_start, event.date_end, locale);
            const isPast = event.date_start < today;
            const isOpen = event.status === 'open' && !isPast;
            const imgSrc = event.image_url || retreatImages[slug] || '';
            const flag = locationEmoji[slug] || '';

            return (
              <a
                key={slug}
                href={`/${locale}/programs/retreats/${slug}`}
                className="group block rounded-2xl overflow-hidden bg-white shadow-[0_4px_24px_rgba(71,64,153,0.07)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.13)] hover:-translate-y-1 transition-all duration-500"
              >
                {/* Image */}
                {imgSrc && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={imgSrc}
                      alt={title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(29,26,61,0.5)] to-transparent" />
                    {/* Status badge */}
                    <span
                      className={`absolute top-3 ${isAr ? 'right-3' : 'left-3'} inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        isPast
                          ? 'bg-neutral-200 text-neutral-600'
                          : isOpen
                            ? 'bg-green-500 text-white'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isPast
                        ? (isAr ? 'انتهت' : 'Past')
                        : isOpen
                          ? (isAr ? 'مفتوح التسجيل' : 'Registration Open')
                          : (isAr ? 'قريبًا' : 'Coming Soon')}
                    </span>
                    {/* Location flag overlay */}
                    <div className={`absolute bottom-3 ${isAr ? 'left-3' : 'right-3'} text-2xl`}>
                      {flag}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-[var(--color-accent)] font-medium mb-2">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    {dateStr}
                  </div>

                  <h3
                    className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {title}
                  </h3>

                  {description && (
                    <p
                      className="mt-2 text-sm text-[var(--color-neutral-600)] line-clamp-2 leading-relaxed"
                      style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                    >
                      {description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-neutral-100)]">
                    {location && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-neutral-500)]">
                        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {location}
                      </div>
                    )}
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] group-hover:gap-2 transition-all duration-300">
                      {isAr ? 'التفاصيل' : 'Details'}
                      <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5" /></svg>
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </Section>

      {/* ── What's included ──────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.25rem] font-bold text-[var(--text-accent)] text-center mb-10"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ماذا تتضمن الرحلة؟' : "What's Included"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { ar: 'إقامة كاملة (٤ ليالٍ) في مكان مختار بعناية', en: 'Full accommodation (4 nights) in a carefully selected venue' },
              { ar: 'وجبات يومية مُعدّة خصيصًا', en: 'Daily meals prepared with care' },
              { ar: 'جلسات إحياء يومية بمنهجية التفكير الحسّي®', en: 'Daily revival sessions through Somatic Thinking®' },
              { ar: 'وقت صمت وتأمل مُهيكَل', en: 'Structured silence and reflection time' },
              { ar: 'تجارب جماعية موجّهة', en: 'Guided group experiences' },
              { ar: 'دعم ما بعد الرحلة', en: 'Post-retreat support' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-primary-50)] border border-[var(--color-primary)]/8">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </div>
                <span
                  className="text-sm text-[var(--color-neutral-700)] leading-relaxed"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
                >
                  {isAr ? item.ar : item.en}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Italy highlight ──────────────────────────────────────────────── */}
      <Section variant="surface">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
            <div className="relative min-h-[280px]">
              <Image
                src="/images/programs/content/ihya-reviving-the-self--02-mountain-arrival-aerial.png"
                alt={isAr ? 'رحلة إيطاليا — جبال إيطاليا' : 'Italy Mountain Retreat'}
                fill
                className="object-cover"
              />
            </div>
            <div
              className="p-8 md:p-10 flex flex-col justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
            >
              <span className="text-3xl mb-3">🇮🇹</span>
              <h3
                className="text-xl md:text-2xl font-bold text-[#FFF5E9] mb-3 leading-[1.2]"
                style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
              >
                {isAr ? 'الرحلة الدولية — جبال إيطاليا' : 'The International Retreat — Italy Mountains'}
              </h3>
              <p
                className="text-white/70 text-sm leading-relaxed mb-5"
                style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
              >
                {isAr
                  ? 'في أغسطس ٢٠٢٦، تأخذنا رحلة إحياء إلى قلب جبال إيطاليا الخلّابة. تجربة دولية موقّعة — طبيعة مختلفة، ثقافة مختلفة، أنت مختلف.'
                  : 'In August 2026, the Ihya retreat takes us to the heart of the breathtaking Italian mountains. A signature international experience — different nature, different culture, a different you.'}
              </p>
              <a
                href={`/${locale}/programs/retreats/ihya-aug-2026`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-5 py-2.5 w-fit"
              >
                {isAr ? 'تفاصيل الرحلة' : 'View Details'}
                <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5" /></svg>
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.07} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[#FFF5E9]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'هل أنت مستعد لرحلة الإحياء؟' : 'Ready for the Ihya journey?'}
          </h2>
          <p
            className="mt-4 text-white/60 max-w-lg mx-auto text-base"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr
              ? 'الأماكن محدودة. سجّل اهتمامك الآن وسيتواصل معك فريقنا لتأكيد المكان.'
              : 'Seats are limited. Express your interest now and our team will contact you to confirm your place.'}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'سجّل اهتمامك' : 'Express Interest'}
            </a>
            <a
              href={`/${locale}/programs/retreats/ihya-aug-2026`}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white/15 text-white font-semibold text-sm border border-white/30 hover:bg-white/25 transition-colors"
            >
              {isAr ? 'رحلة إيطاليا — أغسطس ٢٠٢٦' : 'Italy Retreat — Aug 2026'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
