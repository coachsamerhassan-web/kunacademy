import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lesson {
  title_ar: string;
  title_en: string;
  duration_min: number;
  locked: boolean;
}

interface MiniCourse {
  slug: string;
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
  duration_ar: string;
  duration_en: string;
  lang: 'ar' | 'en';
  lessons: Lesson[];
}

// ── Static course catalogue (board spec — 10 courses, not yet recorded) ───────

const MINI_COURSES: MiniCourse[] = [
  // ── Arabic (4) ──────────────────────────────────────────────────────────────
  {
    slug: '90-minutes-with-yourself',
    title_ar: '٩٠ دقيقة مع نفسك',
    title_en: '90 Minutes with Yourself',
    subtitle_ar: 'مساحة للحضور الداخلي',
    subtitle_en: 'A space for inner presence',
    duration_ar: '٩٠ دقيقة',
    duration_en: '90 min',
    lang: 'ar',
    lessons: [
      { title_ar: 'مقدمة: لماذا تحتاج ٩٠ دقيقة؟', title_en: 'Intro: Why 90 minutes?', duration_min: 8, locked: false },
      { title_ar: 'الاستماع للجسد', title_en: 'Listening to the body', duration_min: 22, locked: true },
      { title_ar: 'الصوت الداخلي', title_en: 'The inner voice', duration_min: 25, locked: true },
      { title_ar: 'الحضور الكامل', title_en: 'Full presence', duration_min: 30, locked: true },
    ],
  },
  {
    slug: 'leadership-in-fear',
    title_ar: 'القيادة وقت الخوف',
    title_en: 'Leadership in Fear',
    subtitle_ar: 'كيف تقود حين يهزّك الخوف',
    subtitle_en: 'How to lead when fear shakes you',
    duration_ar: '٦٠–١٢٠ دقيقة',
    duration_en: '60–120 min',
    lang: 'ar',
    lessons: [
      { title_ar: 'مقدمة: القيادة والخوف', title_en: 'Intro: Leadership & fear', duration_min: 10, locked: false },
      { title_ar: 'فسيولوجيا الخوف في القيادة', title_en: 'The physiology of fear in leadership', duration_min: 30, locked: true },
      { title_ar: 'أدوات التنظيم الذاتي', title_en: 'Self-regulation tools', duration_min: 35, locked: true },
      { title_ar: 'القرار تحت الضغط', title_en: 'Decision-making under pressure', duration_min: 35, locked: true },
    ],
  },
  {
    slug: 'presence-in-crisis',
    title_ar: 'حضورك في الأزمة',
    title_en: 'Your Presence in Crisis',
    subtitle_ar: 'الحضور الحسّي حين يضيق العالم',
    subtitle_en: 'Somatic presence when the world narrows',
    duration_ar: '٦٠–١٢٠ دقيقة',
    duration_en: '60–120 min',
    lang: 'ar',
    lessons: [
      { title_ar: 'مقدمة: الأزمة كمرآة', title_en: 'Intro: Crisis as a mirror', duration_min: 9, locked: false },
      { title_ar: 'الجسد في حالة الأزمة', title_en: 'The body in crisis', duration_min: 28, locked: true },
      { title_ar: 'تقنيات الحضور الفوري', title_en: 'Immediate presence techniques', duration_min: 32, locked: true },
      { title_ar: 'إعادة بناء الحضور', title_en: 'Rebuilding presence', duration_min: 31, locked: true },
    ],
  },
  {
    slug: 'coaching-in-wartime',
    title_ar: 'الكوتشينج في زمن الحرب',
    title_en: 'Coaching in Wartime',
    subtitle_ar: 'للكوتشينج الذي يعمل في بيئات الصراع',
    subtitle_en: 'For coaches working in conflict environments',
    duration_ar: '٦٠–١٢٠ دقيقة',
    duration_en: '60–120 min',
    lang: 'ar',
    lessons: [
      { title_ar: 'مقدمة: ماذا يعني الكوتشينج هنا؟', title_en: 'Intro: What does coaching mean here?', duration_min: 12, locked: false },
      { title_ar: 'الأخلاقيات في السياقات الصعبة', title_en: 'Ethics in difficult contexts', duration_min: 30, locked: true },
      { title_ar: 'أدوات الكوتشينج للأزمات', title_en: 'Coaching tools for crisis', duration_min: 38, locked: true },
      { title_ar: 'رعاية الكوتش نفسه', title_en: 'Self-care for the coach', duration_min: 30, locked: true },
    ],
  },

  // ── English (6) ─────────────────────────────────────────────────────────────
  {
    slug: 'quiet-burnout-reset',
    title_ar: 'إعادة ضبط الإرهاق الصامت',
    title_en: 'The Quiet Burnout Reset',
    subtitle_ar: 'حين يتعب الجسد قبل أن يدرك العقل',
    subtitle_en: 'When the body tires before the mind notices',
    duration_ar: '٦٠–٩٠ دقيقة',
    duration_en: '60–90 min',
    lang: 'en',
    lessons: [
      { title_ar: 'مقدمة: ما هو الإرهاق الصامت؟', title_en: 'Intro: What is quiet burnout?', duration_min: 10, locked: false },
      { title_ar: 'إشارات الجسد المبكرة', title_en: 'Early body signals', duration_min: 22, locked: true },
      { title_ar: 'بروتوكول الاسترداد الحسّي', title_en: 'Somatic recovery protocol', duration_min: 30, locked: true },
      { title_ar: 'بناء الحدود من الداخل', title_en: 'Building boundaries from within', duration_min: 25, locked: true },
    ],
  },
  {
    slug: 'coaching-manager-5-conversations',
    title_ar: 'المدير المتدرب: ٥ محادثات',
    title_en: 'The Coaching Manager: 5 Conversations',
    subtitle_ar: '٥ محادثات تحوّل قيادتك',
    subtitle_en: '5 conversations that transform your leadership',
    duration_ar: '٦٠–١٢٠ دقيقة',
    duration_en: '60–120 min',
    lang: 'en',
    lessons: [
      { title_ar: 'مقدمة: المدير كـمربّي', title_en: 'Intro: The manager as coach', duration_min: 10, locked: false },
      { title_ar: 'المحادثة ١: محادثة الأداء', title_en: 'Conversation 1: The performance talk', duration_min: 20, locked: true },
      { title_ar: 'المحادثة ٢: محادثة الإنصات', title_en: 'Conversation 2: The listening talk', duration_min: 20, locked: true },
      { title_ar: 'المحادثات ٣–٥', title_en: 'Conversations 3–5', duration_min: 50, locked: true },
    ],
  },
  {
    slug: 'human-edge-ai-era',
    title_ar: 'الميزة الإنسانية في عصر الذكاء الاصطناعي',
    title_en: 'The Human Edge: AI-Era Somatic Intelligence',
    subtitle_ar: 'ما الذي لا يستطيع الذكاء الاصطناعي محاكاته؟',
    subtitle_en: "What AI can't replicate — your somatic edge",
    duration_ar: '٦٠–٩٠ دقيقة',
    duration_en: '60–90 min',
    lang: 'en',
    lessons: [
      { title_ar: 'مقدمة: الإنسان بعد الأتمتة', title_en: 'Intro: The human after automation', duration_min: 10, locked: false },
      { title_ar: 'الذكاء الحسّي مقابل الذكاء الاصطناعي', title_en: 'Somatic intelligence vs AI', duration_min: 25, locked: true },
      { title_ar: 'تطوير الميزة الإنسانية', title_en: 'Developing your human edge', duration_min: 25, locked: true },
      { title_ar: 'التطبيق في بيئة العمل', title_en: 'Application in the workplace', duration_min: 25, locked: true },
    ],
  },
  {
    slug: 'leading-from-within-women',
    title_ar: 'القيادة من الداخل — المرأة القائدة',
    title_en: 'Leading from Within — Women Leaders',
    subtitle_ar: 'قيادة أصيلة ومُجسّدة',
    subtitle_en: 'Authentic, embodied leadership',
    duration_ar: '٦٠–٩٠ دقيقة',
    duration_en: '60–90 min',
    lang: 'en',
    lessons: [
      { title_ar: 'مقدمة: المرأة والقيادة الأصيلة', title_en: 'Intro: Women and authentic leadership', duration_min: 10, locked: false },
      { title_ar: 'الصوت والسلطة والجسد', title_en: 'Voice, authority & the body', duration_min: 25, locked: true },
      { title_ar: 'إعادة تعريف القوة', title_en: 'Redefining power', duration_min: 25, locked: true },
      { title_ar: 'ممارسات القيادة اليومية', title_en: 'Daily leadership practices', duration_min: 25, locked: true },
    ],
  },
  {
    slug: 'resilient-leadership-body-first',
    title_ar: 'القيادة المرنة: الجسد أولًا',
    title_en: 'Resilient Leadership: Body-First Recovery',
    subtitle_ar: 'المرونة تبدأ من الجسد لا من الذهن',
    subtitle_en: 'Resilience starts in the body, not the mind',
    duration_ar: '٦٠–٩٠ دقيقة',
    duration_en: '60–90 min',
    lang: 'en',
    lessons: [
      { title_ar: 'مقدمة: لماذا يفشل الاسترداد العقلي؟', title_en: 'Intro: Why mental recovery fails', duration_min: 10, locked: false },
      { title_ar: 'أساسيات الاسترداد الجسدي', title_en: 'The body-first recovery framework', duration_min: 25, locked: true },
      { title_ar: 'بروتوكولات القيادة المرنة', title_en: 'Resilient leadership protocols', duration_min: 25, locked: true },
      { title_ar: 'التطبيق في بيئات الضغط العالي', title_en: 'Application in high-pressure environments', duration_min: 25, locked: true },
    ],
  },
  {
    slug: 'the-saudi-coach',
    title_ar: 'الكوتش السعودي',
    title_en: 'The Saudi Coach',
    subtitle_ar: 'الكوتشينج في السياق السعودي',
    subtitle_en: 'Coaching in the Saudi context',
    duration_ar: '٦٠–١٢٠ دقيقة',
    duration_en: '60–120 min',
    lang: 'en',
    lessons: [
      { title_ar: 'مقدمة: السياق الثقافي السعودي', title_en: 'Intro: The Saudi cultural context', duration_min: 12, locked: false },
      { title_ar: 'التكيّف الثقافي في الكوتشينج', title_en: 'Cultural adaptation in coaching', duration_min: 30, locked: true },
      { title_ar: 'اللهجة والجسد والحضور', title_en: 'Dialect, body & presence', duration_min: 35, locked: true },
      { title_ar: 'بناء ممارسة محلية', title_en: 'Building a local practice', duration_min: 33, locked: true },
    ],
  },
];

const AR_COURSES = MINI_COURSES.filter((c) => c.lang === 'ar');
const EN_COURSES = MINI_COURSES.filter((c) => c.lang === 'en');

// ── Metadata ──────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'دورات مصغّرة | أكاديمية كُن' : 'Mini-Courses | Kun Academy',
    description: isAr
      ? 'تعلّم بوتيرتك — ١٠ دورات مصغّرة مبنية على منهجية التفكير الحسّي®'
      : 'Learn at your own pace — 10 mini-courses built on the Somatic Thinking® methodology',
  };
}

// ── Lock icon SVG ─────────────────────────────────────────────────────────────

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── Course Card ───────────────────────────────────────────────────────────────

function CourseCard({ course, isAr }: { course: MiniCourse; isAr: boolean }) {
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : undefined;
  const langLabel = course.lang === 'ar' ? (isAr ? 'عربي' : 'Arabic') : isAr ? 'إنجليزي' : 'English';
  const duration = isAr ? course.duration_ar : course.duration_en;
  const title = isAr ? course.title_ar : course.title_en;
  const subtitle = isAr ? course.subtitle_ar : course.subtitle_en;
  const langAccent = course.lang === 'ar' ? 'var(--color-accent)' : 'var(--color-primary)';

  return (
    <article
      className="flex flex-col rounded-2xl overflow-hidden bg-white border transition-shadow duration-300 hover:shadow-lg"
      style={{ borderColor: 'var(--color-neutral-100)' }}
      dir={isAr ? 'rtl' : 'ltr'}
      lang={course.lang}
    >
      {/* Top accent bar */}
      <div
        className="h-[3px] w-full"
        style={{ background: langAccent }}
        aria-hidden="true"
      />

      {/* Card header */}
      <div className="p-5 pb-3">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Language badge */}
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold tracking-wide uppercase"
            style={{ background: `color-mix(in srgb, ${langAccent} 12%, white)`, color: langAccent }}
          >
            {langLabel}
          </span>

          {/* Duration badge */}
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.65rem] font-medium"
            style={{
              background: 'var(--color-neutral-50)',
              color: 'var(--color-neutral-500)',
              border: '1px solid var(--color-neutral-100)',
            }}
          >
            <ClockIcon />
            {duration}
          </span>

          {/* Coming Soon badge */}
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold"
            style={{ background: 'rgba(251,191,36,0.12)', color: '#92400e' }}
          >
            {isAr ? 'قريبًا' : 'Coming Soon'}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-base font-bold leading-snug text-[var(--text-primary)] mb-1"
          style={{ fontFamily: headingFont }}
          dir={course.lang === 'ar' ? 'rtl' : 'ltr'}
        >
          {title}
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-muted)', fontFamily: bodyFont }}
            dir={course.lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Lesson list — LMS-style */}
      <div
        className="mx-5 mb-4 rounded-xl overflow-hidden flex flex-col gap-px"
        style={{ background: 'var(--color-neutral-50)', border: '1px solid var(--color-neutral-100)' }}
        role="list"
        aria-label={isAr ? 'قائمة الدروس' : 'Lesson list'}
      >
        {course.lessons.map((lesson, idx) => {
          const lessonTitle = course.lang === 'ar' ? lesson.title_ar : lesson.title_en;
          const mins = lesson.duration_min;

          return (
            <div
              key={idx}
              role="listitem"
              className="flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors duration-150"
              style={{
                background: lesson.locked ? 'transparent' : 'color-mix(in srgb, var(--color-primary) 5%, white)',
                color: lesson.locked ? 'var(--color-neutral-400)' : 'var(--text-primary)',
                cursor: lesson.locked ? 'default' : 'pointer',
              }}
            >
              {/* Play / Lock icon */}
              <span
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: lesson.locked
                    ? 'var(--color-neutral-100)'
                    : 'color-mix(in srgb, var(--color-primary) 15%, white)',
                  color: lesson.locked ? 'var(--color-neutral-400)' : 'var(--color-primary)',
                }}
                aria-hidden="true"
              >
                {lesson.locked ? <LockIcon size={11} /> : <PlayIcon size={10} />}
              </span>

              {/* Lesson title */}
              <span
                className="flex-1 text-xs leading-snug"
                style={{
                  fontFamily: course.lang === 'ar' ? 'var(--font-arabic-body)' : undefined,
                  fontWeight: lesson.locked ? 400 : 500,
                }}
                dir={course.lang === 'ar' ? 'rtl' : 'ltr'}
              >
                {lessonTitle}
              </span>

              {/* Duration */}
              <span
                className="shrink-0 text-[0.6rem] tabular-nums"
                style={{ color: 'var(--color-neutral-400)' }}
              >
                {mins}{isAr ? ' د' : 'm'}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 mt-auto">
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold cursor-not-allowed select-none"
          style={{
            background: 'var(--color-neutral-100)',
            color: 'var(--color-neutral-400)',
            border: '1px solid var(--color-neutral-100)',
          }}
          aria-disabled="true"
          title={isAr ? 'قيد الإعداد' : 'Coming soon'}
        >
          <PlayIcon size={13} />
          {isAr ? 'عرض الدرس التمهيدي' : 'Preview First Lesson'}
          <span
            className="ms-1 text-[0.6rem] font-normal opacity-70"
          >
            ({isAr ? 'قريبًا' : 'Coming Soon'})
          </span>
        </button>
      </div>
    </article>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionDivider({ label, isAr }: { label: string; isAr: boolean }) {
  return (
    <div
      className="flex items-center gap-4 mb-10"
      style={{ borderTop: '1px solid var(--color-neutral-200)', paddingTop: '2.5rem' }}
    >
      <h2
        className="text-xs tracking-[0.25em] uppercase font-semibold shrink-0"
        style={{
          color: 'var(--text-muted)',
          fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)',
        }}
      >
        {label}
      </h2>
      <div
        className="flex-1 h-px"
        style={{ background: 'var(--color-neutral-100)' }}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MiniCoursesHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : undefined;
  const dir = isAr ? 'rtl' : 'ltr';

  // When Arabic locale → show Arabic courses first; English locale → English first
  const primaryCourses = isAr ? AR_COURSES : EN_COURSES;
  const secondaryCourses = isAr ? EN_COURSES : AR_COURSES;
  const primaryLabel = isAr ? 'الدورات العربية' : 'English Courses';
  const secondaryLabel = isAr ? 'الدورات الإنجليزية' : 'Arabic Courses';

  return (
    <main dir={dir} style={bodyFont ? { fontFamily: bodyFont } : undefined}>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, #1a1040 0%, var(--color-primary) 55%, #2d1a60 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />

        {/* Warm bottom rule */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(255,245,233,0.3), transparent)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          {/* Overline */}
          <p
            className="text-xs tracking-[0.25em] uppercase mb-5 font-medium"
            style={{ color: 'rgba(255,245,233,0.55)' }}
          >
            {isAr ? 'كُن · أكاديمية الكوتشينج' : 'Kun Coaching Academy'}
          </p>

          <h1
            className="text-[2.5rem] md:text-[3.75rem] font-bold leading-[1.15] text-[#FFF5E9]"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'دورات مصغّرة' : 'Mini-Courses'}
          </h1>

          <p
            className="mt-5 text-lg md:text-xl max-w-xl mx-auto leading-relaxed"
            style={{ color: 'rgba(255,245,233,0.65)' }}
          >
            {isAr
              ? 'تعلّم بوتيرتك — دورات مركّزة مبنية على منهجية التفكير الحسّي®'
              : 'Learn at your own pace — focused courses built on the Somatic Thinking® methodology'}
          </p>

          {/* Stats row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8">
            {[
              { num: '10', label: isAr ? 'دورة مصغّرة' : 'Mini-Courses' },
              { num: isAr ? '٦٠–١٢٠' : '60–120', label: isAr ? 'دقيقة لكل دورة' : 'min per course' },
              { num: isAr ? '٤+٦' : '4+6', label: isAr ? 'عربي + إنجليزي' : 'Arabic + English' },
            ].map(({ num, label }) => (
              <div key={num} className="text-center">
                <p
                  className="text-3xl font-bold"
                  style={{ color: '#FFF5E9', fontFamily: headingFont }}
                >
                  {num}
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,245,233,0.5)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LANGUAGE TABS (static — JS-free section anchors) ──────────────── */}
      <div
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b"
        style={{ borderColor: 'var(--color-neutral-200)' }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <nav
            className="flex gap-6"
            aria-label={isAr ? 'تصفية حسب اللغة' : 'Filter by language'}
          >
            {[
              { href: `#${isAr ? 'ar-courses' : 'en-courses'}`, label: isAr ? 'عربي ٤' : 'English 6' },
              { href: `#${isAr ? 'en-courses' : 'ar-courses'}`, label: isAr ? 'إنجليزي ٦' : 'Arabic 4' },
              { href: '#all', label: isAr ? 'الكل' : 'All' },
            ].map(({ href, label }, i) => (
              <a
                key={href}
                href={href}
                className="relative py-3.5 text-sm font-medium transition-colors duration-200"
                style={{ color: i === 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}
              >
                {label}
                {i === 0 && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                    aria-hidden="true"
                  />
                )}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* ── COURSE SECTIONS ───────────────────────────────────────────────── */}
      <Section variant="white">
        <div className="mx-auto max-w-5xl px-6" id="all">

          {/* Primary language section (matches current locale) */}
          <div id={isAr ? 'ar-courses' : 'en-courses'}>
            <SectionDivider label={primaryLabel} isAr={isAr} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
              {primaryCourses.map((course) => (
                <CourseCard key={course.slug} course={course} isAr={isAr} />
              ))}
            </div>
          </div>

          {/* Secondary language section */}
          <div id={isAr ? 'en-courses' : 'ar-courses'} className="mt-12">
            <SectionDivider label={secondaryLabel} isAr={isAr} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
              {secondaryCourses.map((course) => (
                <CourseCard key={course.slug} course={course} isAr={isAr} />
              ))}
            </div>
          </div>

        </div>
      </Section>

      {/* ── COMING SOON NOTICE ────────────────────────────────────────────── */}
      <Section variant="surface">
        <div className="mx-auto max-w-3xl px-6 text-center py-8">
          <div
            className="mx-auto mb-6 w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(71,64,153,0.08)' }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: 'var(--color-primary)' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2
            className="text-lg md:text-xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: headingFont }}
          >
            {isAr
              ? 'هذه الدورات قيد التصوير والإنتاج'
              : 'These courses are currently in production'}
          </h2>
          <p
            className="text-sm leading-relaxed max-w-md mx-auto mb-6"
            style={{ color: 'var(--text-muted)' }}
          >
            {isAr
              ? 'نعمل على تصوير الدورات وإطلاقها تباعًا. ستُتاح للشراء فور الانتهاء من التسجيل.'
              : "We're filming and producing each course for release. They'll be available for purchase once recording is complete."}
          </p>
          <a
            href={`/${locale}/programs`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: 'var(--color-primary)',
              color: '#FFF5E9',
              fontFamily: headingFont,
            }}
          >
            {isAr ? 'استكشف برامجنا الكاملة' : 'Explore Full Programs'}
            <svg
              className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </Section>

    </main>
  );
}
