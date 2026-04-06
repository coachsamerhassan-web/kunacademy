import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Webinar {
  month: number;
  segment_ar: string;
  segment_en: string;
  topic_ar: string;
  topic_en: string;
  date: string;
  status: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const WEBINARS: Webinar[] = [
  { month: 4,  segment_ar: 'رياديون',         segment_en: 'Entrepreneurs',     topic_ar: 'القيادة الحسّية في بيئة العمل',      topic_en: 'Somatic Leadership in the Workplace',    date: '2026-04-17', status: 'upcoming' },
  { month: 5,  segment_ar: 'كوتشز',            segment_en: 'Coaches',           topic_ar: 'بناء ممارسة كوتشينج مستدامة',        topic_en: 'Building a Sustainable Coaching Practice', date: '2026-05-15', status: 'upcoming' },
  { month: 5,  segment_ar: 'أولياء أمور',      segment_en: 'Parents',           topic_ar: 'التواصل الحسّي مع الأبناء',          topic_en: 'Somatic Communication with Children',   date: '2026-05-29', status: 'upcoming' },
  { month: 6,  segment_ar: 'طلاب جامعيون',    segment_en: 'University Students', topic_ar: 'اكتشاف المسار المهني',              topic_en: 'Career Path Discovery',                 date: '2026-06-12', status: 'upcoming' },
  { month: 7,  segment_ar: 'قيادات مؤسسية',   segment_en: 'Corporate Leaders',  topic_ar: 'هندسة ثقافة الفريق',                topic_en: 'Engineering Team Culture',              date: '2026-07-10', status: 'upcoming' },
  { month: 8,  segment_ar: 'أزواج',            segment_en: 'Couples',           topic_ar: 'لغة الجسد في العلاقة',               topic_en: 'Body Language in Relationships',        date: '2026-08-14', status: 'upcoming' },
  { month: 9,  segment_ar: 'كوتشز متقدمون',   segment_en: 'Advanced Coaches',   topic_ar: 'التفكير الحسّي® في جلسات PCC',      topic_en: 'Somatic Thinking® in PCC Sessions',     date: '2026-09-11', status: 'upcoming' },
  { month: 10, segment_ar: 'معلمون ومربّون',   segment_en: 'Educators',         topic_ar: 'الوعي الجسدي في التعليم',            topic_en: 'Body Awareness in Education',           date: '2026-10-09', status: 'upcoming' },
  { month: 11, segment_ar: 'الجميع',           segment_en: 'Everyone',          topic_ar: 'GPS الحياة — نسخة مصغّرة',           topic_en: 'GPS of Life — Mini Edition',            date: '2026-11-13', status: 'upcoming' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES_AR = [
  '', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const MONTH_NAMES_EN = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(dateStr: string, isAr: boolean): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (isAr) {
    return `${day} ${MONTH_NAMES_AR[month]} ${year}`;
  }
  return `${MONTH_NAMES_EN[month]} ${day}, ${year}`;
}

// Segment color palette — cycles through design tokens
const SEGMENT_COLORS = [
  { bg: 'rgba(71,64,153,0.10)', text: 'var(--color-primary)' },
  { bg: 'rgba(228,96,30,0.10)', text: 'var(--color-accent)' },
  { bg: 'rgba(71,64,153,0.06)', text: 'var(--color-primary-700)' },
  { bg: 'rgba(16,185,129,0.10)', text: '#065f46' },
  { bg: 'rgba(245,158,11,0.12)', text: '#92400e' },
  { bg: 'rgba(139,92,246,0.10)', text: '#5b21b6' },
  { bg: 'rgba(59,130,246,0.10)', text: '#1d4ed8' },
  { bg: 'rgba(228,96,30,0.08)', text: '#9a3412' },
  { bg: 'rgba(71,64,153,0.13)', text: 'var(--color-primary)' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ locale: string }>;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'الندوات القادمة | أكاديمية كُن' : 'Upcoming Webinars | Kun Academy',
    description: isAr
      ? 'ندوات مباشرة شهرية من أكاديمية كُن — كل ندوة تستهدف شريحة مختلفة'
      : 'Monthly live webinars from Kun Academy — each targeting a different audience segment',
  };
}

export const revalidate = 300;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WebinarsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : undefined;

  return (
    <main dir={dir} style={bodyFont ? { fontFamily: bodyFont } : undefined}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          {/* Overline */}
          <p
            className="text-xs tracking-[0.2em] uppercase font-medium mb-5"
            style={{ color: 'rgba(255,245,233,0.55)', fontFamily: headingFont }}
          >
            {isAr ? 'كُن · أكاديمية الكوتشينج' : 'Kun Coaching Academy'}
          </p>

          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'الندوات القادمة' : 'Upcoming Webinars'}
          </h1>

          <p
            className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed"
            style={{ fontFamily: bodyFont }}
          >
            {isAr
              ? 'ندوات مباشرة شهرية — كل ندوة تستهدف شريحة مختلفة وتعالج موضوعًا من منهجية التفكير الحسّي®'
              : 'Monthly live sessions — each targeting a different audience segment through the Somatic Thinking® methodology'}
          </p>

          {/* Stats row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {[
              { num: isAr ? '٩' : '9',  label: isAr ? 'ندوة مجدولة' : 'Scheduled Webinars' },
              { num: isAr ? '٩'  : '9', label: isAr ? 'شرائح مستهدفة' : 'Audience Segments' },
              { num: isAr ? 'مجاني' : 'Free', label: isAr ? 'للتسجيل' : 'to Attend' },
            ].map(({ num, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-[#FFF5E9]" style={{ fontFamily: headingFont }}>{num}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,245,233,0.5)' }}>{label}</p>
              </div>
            ))}
          </div>

          <a
            href="#webinars"
            className="inline-flex items-center justify-center mt-10 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'اكتشف المواعيد' : 'View Schedule'}
          </a>
        </div>
      </section>

      {/* ── Webinar Grid ─────────────────────────────────────────────────── */}
      <Section variant="surface" id="webinars">
        <div className="text-center mb-12 animate-fade-up">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'جدول الندوات ٢٠٢٦' : '2026 Webinar Schedule'}
          </h2>
          <p
            className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto text-sm md:text-base"
            style={{ fontFamily: bodyFont }}
          >
            {isAr
              ? 'كل ندوة مدتها ٩٠ دقيقة — عبر الإنترنت — مجانية'
              : '90 minutes each — online — free to attend'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children" id="webinars-grid">
          {WEBINARS.map((webinar, i) => {
            const segmentColor = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
            const topic = isAr ? webinar.topic_ar : webinar.topic_en;
            const segment = isAr ? webinar.segment_ar : webinar.segment_en;
            const dateLabel = formatDate(webinar.date, isAr);
            const monthName = isAr ? MONTH_NAMES_AR[webinar.month] : MONTH_NAMES_EN[webinar.month];

            return (
              <article
                key={i}
                className="group flex flex-col rounded-xl bg-white shadow-[0_4px_24px_rgba(71,64,153,0.07)] border border-[var(--color-neutral-100)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.13)] hover:-translate-y-1 transition-all duration-500 overflow-hidden"
              >
                {/* Month accent bar */}
                <div
                  className="h-[3px] w-full"
                  style={{ background: `linear-gradient(to ${isAr ? 'left' : 'right'}, var(--color-primary), var(--color-accent))` }}
                  aria-hidden="true"
                />

                <div className="flex flex-col flex-1 p-5">
                  {/* Top row: month badge + segment chip */}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {/* Month badge */}
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold tracking-wide uppercase"
                      style={{ background: 'var(--color-primary)', color: '#FFF5E9' }}
                    >
                      {monthName}
                    </span>

                    {/* Segment chip */}
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold"
                      style={{ background: segmentColor.bg, color: segmentColor.text }}
                    >
                      {segment}
                    </span>
                  </div>

                  {/* Topic title */}
                  <h3
                    className="text-base md:text-[1.05rem] font-bold leading-snug text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors duration-300 flex-1"
                    style={{ fontFamily: headingFont }}
                  >
                    {topic}
                  </h3>

                  {/* Date row */}
                  <div className="flex items-center gap-1.5 mt-4 text-sm text-[var(--text-muted)]">
                    <svg
                      className="w-4 h-4 shrink-0 text-[var(--color-accent)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    <time dateTime={webinar.date} style={{ fontFamily: bodyFont }}>
                      {dateLabel}
                    </time>
                  </div>

                  {/* CTA button */}
                  <a
                    href={`/${locale}/contact`}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all duration-300 hover:opacity-90 hover:shadow-[0_4px_16px_rgba(228,96,30,0.25)]"
                    style={{
                      background: 'var(--color-accent)',
                      color: '#fff',
                      fontFamily: headingFont,
                    }}
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {isAr ? 'سجّل اهتمامك' : 'Register Interest'}
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      {/* ── What to expect ───────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.25rem] font-bold text-[var(--text-accent)] text-center mb-10"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'ماذا تتوقع في كل ندوة؟' : 'What to Expect in Each Webinar'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { ar: '٩٠ دقيقة مباشرة عبر الإنترنت', en: '90 minutes live online' },
              { ar: 'موضوع مرتبط بمنهجية التفكير الحسّي®', en: 'Topic grounded in Somatic Thinking®' },
              { ar: 'جلسة أسئلة وأجوبة مباشرة مع سامر حسن', en: 'Live Q&A session with Samer Hassan' },
              { ar: 'تسجيل متاح للمسجّلين بعد الانتهاء', en: 'Recording available to registrants after the session' },
              { ar: 'مجاني للجميع — لا خبرة سابقة مطلوبة', en: 'Free for everyone — no prior experience required' },
              { ar: 'محتوى يمكن تطبيقه فورًا في حياتك', en: 'Content you can apply immediately in your life' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl border"
                style={{
                  background: 'var(--color-primary-50)',
                  borderColor: 'rgba(71,64,153,0.08)',
                }}
              >
                <div
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </div>
                <span
                  className="text-sm text-[var(--color-neutral-700)] leading-relaxed"
                  style={{ fontFamily: bodyFont }}
                >
                  {isAr ? item.ar : item.en}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Bottom CTA — email signup ─────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}
      >
        <GeometricPattern pattern="eight-star" opacity={0.08} fade="both" />

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          {/* Icon */}
          <div
            className="mx-auto mb-6 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,245,233,0.12)' }}
          >
            <svg
              className="w-7 h-7 text-[#FFF5E9]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
            </svg>
          </div>

          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[#FFF5E9]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'لا تفوّت أي ندوة' : "Don't Miss Any Webinar"}
          </h2>

          <p
            className="mt-4 text-white/60 max-w-lg mx-auto text-base leading-relaxed"
            style={{ fontFamily: bodyFont }}
          >
            {isAr
              ? 'سجّل اهتمامك وسيصلك تنبيه قبل كل ندوة مباشرة على بريدك الإلكتروني أو واتساب'
              : 'Register your interest and receive a reminder before each webinar — by email or WhatsApp'}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[var(--color-accent)] text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'أبلغني بالندوات القادمة' : 'Notify Me of Upcoming Webinars'}
            </a>
            <a
              href={`/${locale}/programs`}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white/15 text-white font-semibold text-sm border border-white/30 hover:bg-white/25 transition-colors"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'استكشف كل برامجنا' : 'Explore All Programs'}
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
