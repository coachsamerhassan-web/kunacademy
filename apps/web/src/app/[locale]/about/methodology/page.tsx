import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import { methodologyFaqs } from '@/data/faqs';
import { FlipCard } from '@/components/flip-card';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'التفكير الحسّي® | منهجية كُن للكوتشينج' : 'Somatic Thinking® | Kun Coaching Methodology',
    description: isAr
      ? 'منهجية التفكير الحسّي® — وُلدت من ثلاثين عامًا من الجمع بين الحكمة الشرقية والممارسة الغربية. أول منهجية كوتشينج عربية معتمدة من ICF. الجسد يعرف قبل العقل.'
      : 'Somatic Thinking® — born from 30 years of bridging Eastern wisdom and Western practice. The first Arabic coaching methodology accredited by ICF. The body knows before the mind.',
  };
}

/* ── Pillar Icons — minimalistic line style, 1.5px stroke, brand purple ── */
const iconProps = {
  width: 24, height: 24, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
  className: 'w-6 h-6',
  style: { color: 'var(--color-primary)' },
};

const IconSomaticSignals = (
  <svg {...iconProps}>
    <circle cx="12" cy="15" r="1.2" />
    <path d="M12 16.2v4" />
    <path d="M9.5 20.2h5" />
    <path d="M9.5 13a3.5 3.5 0 0 1 5 0" />
    <path d="M7.5 11a6.5 6.5 0 0 1 9 0" />
    <path d="M5.5 9a9.5 9.5 0 0 1 13 0" />
  </svg>
);

const IconPresence = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="12" y1="4" x2="12" y2="5.5" />
    <line x1="12" y1="18.5" x2="12" y2="20" />
    <line x1="4" y1="12" x2="5.5" y2="12" />
    <line x1="18.5" y1="12" x2="20" y2="12" />
    <circle cx="12" cy="10" r="1" />
    <line x1="12" y1="11.5" x2="12" y2="15.5" />
  </svg>
);

const IconPartnership = (
  <svg {...iconProps}>
    <path d="M4 12c0-2 1-3.5 2.5-3.5.5-1.5 2-2.5 3.5-2.5" />
    <path d="M4 12c0 2 1 3.5 2.5 3.5.5 1.5 2 2.5 3.5 2.5" />
    <path d="M10 6c.8-.3 1.5 0 1.5 1" />
    <path d="M10 18c.8.3 1.5 0 1.5-1" />
    <line x1="11.5" y1="12" x2="14.5" y2="12" />
    <circle cx="18" cy="8" r="1.5" />
    <path d="M18 9.5v5" />
    <path d="M15.5 12h5" />
    <path d="M18 14.5l-2 3.5" />
    <path d="M18 14.5l2 3.5" />
  </svg>
);

const IconExperience = (
  <svg {...iconProps}>
    <path d="M12 22c-3 0-5-1.5-5-4v-5" />
    <path d="M7 13v-2.5a1 1 0 0 1 2 0V13" />
    <path d="M9 10.5V7a1 1 0 0 1 2 0v6" />
    <path d="M11 7V5.5a1 1 0 0 1 2 0V13" />
    <path d="M13 7.5V7a1 1 0 0 1 2 0v4" />
    <path d="M15 11v-1a1 1 0 0 1 1.5.5l.5 1.5c.5 2 0 4-2 5" />
    <path d="M9 20c1.5.7 3.5.7 5 0" />
  </svg>
);

const pillarsData = [
  {
    icon: IconSomaticSignals,
    titleAr: 'الإشارات الحسّية الجسدية',
    titleEn: 'Somatic Signals',
    descAr: 'الجسد يُرسل بيانات قابلة للقراءة والفهم في كل لحظة — انقباضات، توسّعات، توتّرات، إيقاعات. هذه ليست حدسًا غامضًا. إنها إشارات حسّية جسدية: لغة الجسد الأولى. التفكير الحسّي يعلّمك قراءة هذه اللغة وتفسيرها والاستجابة لها — في نفسك وفي من تُدرّبهم.',
    descEn: 'The body sends readable, understandable data every moment — contractions, expansions, tensions, rhythms. These are not vague intuitions. They are somatic signals: the body\'s primary language. Somatic Thinking teaches you to read, interpret, and respond to this language — in yourself and in those you coach.',
  },
  {
    icon: IconPresence,
    titleAr: 'الحضور',
    titleEn: 'Presence',
    descAr: 'الحضور ليس تجربة استثنائية أو إنجازًا نادرًا. إنه الحالة الطبيعية — الحالة حيث يتواصل العقل والجسد والعالم الداخلي والعالم الخارجي بحرية. المنهجية مصمّمة لتجعل الحضور حالتك الافتراضية، لا طموحك.',
    descEn: 'Presence is not a peak experience or a rare achievement. It is the natural state — the state where mind, body, inner world, and outer world communicate freely. The methodology is designed to make presence your default, not your aspiration.',
  },
  {
    icon: IconPartnership,
    titleAr: 'الشراكة بين الجسد والعقل',
    titleEn: 'Body-Mind Partnership',
    descAr: 'الجسد ليس تابعًا للعقل. والعقل ليس سيّدًا على الجسد. هما شريكان — كل منهما يساهم بذكاء لا يستطيع الآخر الوصول إليه وحده. حين تُستعاد هذه الشراكة، يتحوّل اتخاذ القرارات والوعي بالذات والقيادة.',
    descEn: 'The body is not subordinate to the mind. The mind is not master of the body. They are partners — each contributing intelligence the other cannot access alone. When this partnership is restored, decision-making, self-awareness, and leadership transform.',
  },
  {
    icon: IconExperience,
    titleAr: 'التجربة لا النظرية',
    titleEn: 'Experience, Not Theory',
    descAr: 'التفكير الحسّي لا يُتعلّم من كتاب. كل مفهوم يُختبر من خلال الجسد أولاً، ويفهمه العقل ثانيًا. هذا ليس اختيارًا تعليميًا — إنه القناعة الجوهرية للمنهجية: التحوّل يُعاش، لا يُفكَّر فيه.',
    descEn: 'Somatic Thinking cannot be learned from a textbook. Every concept is experienced through the body first, understood by the mind second. This is not a pedagogical choice — it is the methodology\'s core conviction: transformation is lived, not thought about.',
  },
];

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : 'inherit';

  return (
    <main dir={dir}>
      {/* ── Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'عنّا' : 'About', path: '/about' },
          { name: isAr ? 'التفكير الحسّي' : 'Somatic Thinking', path: '/about/methodology' },
        ])) }}
      />

      {/* ═══════════════════════════════════════
          SECTION 1 — HERO
      ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden py-20 md:py-32" aria-label={isAr ? 'مقدمة' : 'Hero'}>
        {/* Dark gradient background */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 60%, #0D0B1E 100%)' }}
        />
        <GeometricPattern pattern="flower-of-life" opacity={0.05} fade="both" />

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            {/* Logo/Visual */}
            <div className="shrink-0 md:order-2 flex justify-center">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full blur-3xl opacity-25"
                  style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 70%)' }}
                />
                <img
                  src="/images/programs/logos/somatic-thinking-methodology.png"
                  alt=""
                  className="relative h-44 w-44 md:h-72 md:w-72 object-contain drop-shadow-[0_0_40px_rgba(212,168,83,0.35)]"
                />
              </div>
            </div>

            {/* Text */}
            <div className="md:order-1 flex-1 text-center md:text-start animate-fade-up">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-accent)] mb-4">
                {isAr ? 'المنهجية' : 'The Methodology'}
              </p>

              {/* Bilingual title display */}
              <div className="mb-2">
                <h1
                  className="text-[2.75rem] md:text-[4.5rem] font-bold text-[#FFF5E9] leading-[1.05]"
                  style={{ fontFamily: headingFont }}
                >
                  {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
                </h1>
                <p className="mt-1 text-[var(--color-accent)] font-medium text-lg md:text-xl opacity-80">
                  {isAr ? 'Somatic Thinking®' : 'التفكير الحسّي®'}
                </p>
              </div>

              <p className="mt-6 text-white/75 max-w-xl text-base md:text-lg leading-relaxed" style={{ fontFamily: bodyFont }}>
                {isAr
                  ? 'منهجية كوتشينج أصيلة وُلدت من ثلاثين عامًا من الجمع بين الحكمة الشرقية والممارسة الغربية — مبنية على قناعة واحدة: الجسد يعرف قبل العقل.'
                  : 'An original coaching methodology born from 30 years of bridging Eastern wisdom and Western practice — built on one conviction: the body knows before the mind.'}
              </p>

              {/* Quick stats */}
              <div className="mt-10 flex flex-wrap justify-center md:justify-start gap-8">
                {[
                  { value: isAr ? '١٥+' : '15+', label: isAr ? 'سنة بحث وممارسة' : 'Years of research' },
                  { value: isAr ? '١٣' : '13', label: isAr ? 'دولة' : 'Countries' },
                  { value: 'ICF', label: isAr ? 'معتمد دولياً' : 'Accredited' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-[var(--color-accent)]" style={{ fontFamily: headingFont }}>
                      {stat.value}
                    </div>
                    <div className="text-white/50 text-xs mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 2 — VIDEO EMBED
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? 'الفيديو التعريفي' : 'Introduction'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'اسمعها من المؤسّس' : 'Hear It From The Founder'}
          </h2>
          <p className="text-[var(--color-neutral-600)] text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10" style={{ fontFamily: bodyFont }}>
            {isAr
              ? 'قبل أن تقرأ عن التفكير الحسّي، اختبره — بصوت وحضور الشخص الذي بناه.'
              : 'Before you read about Somatic Thinking, experience it — in the voice and presence of the person who built it.'}
          </p>

          {/* Video placeholder — replace src with actual YouTube embed ID when available */}
          {/* {PLACEHOLDER} — Samer records 3-5 min video explaining ST */}
          <div className="relative w-full rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(71,64,153,0.15)] bg-[#0D0B1E]" style={{ aspectRatio: '16/9' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
              {/* Animated play button */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[var(--color-primary)] opacity-20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)] shadow-[0_8px_30px_rgba(71,64,153,0.5)]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <p className="text-white/60 text-sm text-center" style={{ fontFamily: bodyFont }}>
                {isAr ? 'الفيديو قيد الإنتاج — قريبًا' : 'Video coming soon'}
              </p>
              <p className="text-white/40 text-xs text-center max-w-sm" style={{ fontFamily: bodyFont }}>
                {isAr
                  ? 'سيشرح سامر حسن التفكير الحسّي بصوته في فيديو من ٣-٥ دقائق'
                  : 'Samer Hassan will explain Somatic Thinking in his own voice in a 3-5 minute video'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[var(--color-neutral-400)] text-xs" style={{ fontFamily: bodyFont }}>
            {isAr ? 'النص الكامل متوفّر بالعربية والإنجليزية' : 'Full transcript available in English and Arabic'}
          </p>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          SECTION 3 — ORIGIN STORY
      ═══════════════════════════════════════ */}
      <section
        className="py-16 md:py-24"
        style={{ background: 'var(--color-surface, #F8F7FC)' }}
        aria-label={isAr ? 'قصة البداية' : 'Origin Story'}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'البداية' : 'The Beginning'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-10"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'السؤال الذي بدأ منه كل شيء' : 'The Question That Started It All'}
            </h2>

            <div className="space-y-6 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed" style={{ fontFamily: bodyFont, lineHeight: '1.9' }}>
              {isAr ? (
                <>
                  <p>كل منهجية تبدأ بسؤال لم يستطع مؤسسها التوقف عن طرحه.</p>
                  <p>بالنسبة لي، وصل هذا السؤال بعد أن شاهدت شيئاً مؤلماً. كنت قد أمضيت سنوات أُعلّم الفنون القتالية والعلاجية في أكاديميتي في مصر — أصبّ كل ما أعرفه في طلابي. حين انتقلت إلى كندا، شاهدت معظمهم يتراجعون. فقدوا التوازن، الانضباط، الدافع. توقفوا تدريجياً عن الممارسة.</p>
                  <p>استطلعت آراءهم. تأملت. ووصلت إلى إدراك غيّر مسار حياتي:</p>
                </>
              ) : (
                <>
                  <p>Every methodology begins with a question its founder couldn&apos;t stop asking.</p>
                  <p>For me, that question arrived after watching something painful. I had spent years teaching martial and healing arts at my academy in Egypt — pouring everything I knew into my students. When I moved to Canada, I watched most of them regress. They lost balance, discipline, motivation. They gradually stopped practicing.</p>
                  <p>I surveyed them. I reflected. And I arrived at a realization that changed the course of my life:</p>
                </>
              )}
            </div>

            {/* Pull quote */}
            <div
              className="my-10 border-s-4 ps-6"
              style={{ borderColor: 'var(--color-accent)' }}
            >
              <p
                className="text-xl md:text-2xl font-semibold italic text-[var(--text-primary)] leading-snug"
                style={{ fontFamily: headingFont }}
              >
                {isAr
                  ? '«كنتُ أنا مصدر دافعهم — لا هم.»'
                  : '"I had been the source of their motivation — not them."'}
              </p>
            </div>

            <div className="space-y-6 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed" style={{ fontFamily: bodyFont, lineHeight: '1.9' }}>
              {isAr ? (
                <>
                  <p>في غيابي، اختفى الدافع. كنت أمنحهم مهارات، لكنني لم أساعدهم في الوصول إلى شيء أعمق: مصدرهم الداخلي الخاص للنمو.</p>
                  <p>من تلك اللحظة، سؤال واحد قاد كل ما بنيته:</p>
                </>
              ) : (
                <>
                  <p>In my absence, the motivation disappeared. I had given them skills, but I hadn&apos;t helped them access something deeper: their own inner source of growth.</p>
                  <p>From that moment, one question drove everything I built:</p>
                </>
              )}
            </div>

            {/* Central question */}
            <div className="my-10 rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }}>
              <p className="text-white/90 text-lg md:text-xl italic leading-relaxed" style={{ fontFamily: bodyFont }}>
                {isAr
                  ? '«كيف أخلق مساحة يختبر فيها الناس الحضور بتصميم — لا بالصدفة، ولا بالاعتماد على معلّم، بل بتجربتهم المباشرة؟»'
                  : '"How can I create space for people to experience presence by design — not by accident, not by dependence on a teacher, but by their own direct experience?"'}
              </p>
              <p className="mt-4 text-[var(--color-accent)] text-sm font-medium" style={{ fontFamily: bodyFont }}>
                {isAr ? 'هذا السؤال أصبح التفكير الحسّي.' : 'That question became Somatic Thinking.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 4 — FORMAL DEFINITION
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? 'التعريف' : 'Definition'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'ما هو التفكير الحسّي®؟' : 'What Is Somatic Thinking®?'}
          </h2>

          <div className="space-y-5 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed" style={{ fontFamily: bodyFont, lineHeight: '1.85' }}>
            {isAr ? (
              <>
                <p>
                  التفكير الحسّي® هو فلسفة ومنهجية كوتشينج بهدف واحد: <strong className="text-[var(--text-primary)]">خلق مساحة يختبر فيها الإنسان حالة الحضور ويتبنّاها كحالته السائدة في الحياة.</strong>
                </p>
                <p>
                  كلمة «سوماتيك» مشتقة من اليونانية <em>سوما</em> وتعني الجسد. الإنسان كائن يصنع المعنى — يتفاعل مع الحياة من خلال شكل مادي هو الجسد، يستقبل ويُرسل إشارات حسّية في كل لحظة. حين يُدرك العقل هذه المحفّزات، نُفسّرها، نُكوّن أفكارًا، نتّخذ قرارات، ونتصرّف.
                </p>
              </>
            ) : (
              <>
                <p>
                  Somatic Thinking® is a coaching philosophy and methodology with one purpose: <strong className="text-[var(--text-primary)]">creating space for people to experience the state of presence and adopt it as their predominant way of being in the world.</strong>
                </p>
                <p>
                  The word &ldquo;somatic&rdquo; comes from the Greek <em>soma</em>, meaning body. The body is a meaning-making instrument — it interacts with life through physical form, receiving and sending sensory information every moment. Once the mind perceives these stimuli, we interpret them, form ideas, make decisions, and act.
                </p>
              </>
            )}
          </div>

          {/* HIC diagram — circular flow */}
          <div className="mt-12 mb-8">
            <h3
              className="text-center text-base font-semibold text-[var(--color-neutral-600)] mb-8 uppercase tracking-wider"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'دورة التفاعل الإنساني' : 'The Human Interaction Cycle'}
            </h3>
            <div className="relative flex flex-wrap justify-center items-center gap-0">
              {(isAr
                ? [
                    { label: 'أفعال', sub: 'Actions', color: 'var(--color-primary)' },
                    { label: 'أحاسيس', sub: 'Sensations', color: '#6A5FF0' },
                    { label: 'مشاعر', sub: 'Feelings', color: '#8B5CF6' },
                    { label: 'أفكار', sub: 'Thoughts', color: '#A855F7' },
                    { label: 'صيرورة', sub: 'Becoming', color: 'var(--color-accent)' },
                  ]
                : [
                    { label: 'Actions', sub: 'أفعال', color: 'var(--color-primary)' },
                    { label: 'Sensations', sub: 'أحاسيس', color: '#6A5FF0' },
                    { label: 'Feelings', sub: 'مشاعر', color: '#8B5CF6' },
                    { label: 'Thoughts', sub: 'أفكار', color: '#A855F7' },
                    { label: 'Becoming', sub: 'صيرورة', color: 'var(--color-accent)' },
                  ]
              ).map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full text-white font-bold text-xs md:text-sm shadow-lg"
                      style={{ background: step.color }}
                    >
                      <div>
                        <div>{step.label}</div>
                        <div className="opacity-70 text-[10px] mt-0.5">{step.sub}</div>
                      </div>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mx-1 md:mx-2 text-[var(--color-neutral-300)] text-lg md:text-xl select-none">
                      {isAr ? '←' : '→'}
                    </div>
                  )}
                </div>
              ))}
              {/* Loopback indicator */}
              <div className="w-full text-center mt-3 text-[var(--color-accent)] text-sm font-medium" style={{ fontFamily: bodyFont }}>
                {isAr ? '↩ الدورة تتكرّر باستمرار' : '↩ The cycle repeats continuously'}
              </div>
            </div>
          </div>

          {/* Formal definition box */}
          <div
            className="rounded-2xl p-8 border"
            style={{ background: 'var(--color-primary-50, #F0EFFE)', borderColor: 'var(--color-primary-200, #C4BCFB)' }}
          >
            <p className="text-xs font-semibold tracking-widest uppercase text-[var(--color-primary)] mb-3" style={{ fontFamily: bodyFont }}>
              {isAr ? 'التعريف الرسمي' : 'Formal Definition'}
            </p>
            <p className="text-[var(--text-primary)] text-base md:text-lg leading-relaxed italic" style={{ fontFamily: bodyFont }}>
              {isAr
                ? '«التفكير الحسّي® هو عيش الحياة في شراكة مع الجسد من أجل الحضور والوعي الشامل، بحيث يصبح الرضا والسهولة الحالة السائدة للكينونة.»'
                : '"Somatic Thinking® is experiencing life in partnership with the body for presence and holistic awareness, making fulfilment and ease the prevalent state of being."'}
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          SECTION 5 — HOW IT WAS BORN
      ═══════════════════════════════════════ */}
      <section
        className="py-16 md:py-24"
        style={{ background: 'var(--color-surface, #F8F7FC)' }}
        aria-label={isAr ? 'كيف وُلد التفكير الحسّي' : 'How It Was Born'}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'التاريخ' : 'History'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-12"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'كيف وُلد التفكير الحسّي' : 'How Somatic Thinking Was Born'}
            </h2>

            {/* Timeline */}
            <div className="space-y-10">
              {(isAr ? [
                {
                  era: 'ثلاثون عامًا من الممارسة',
                  text: 'على مدى ثلاثة عقود، مارست وعلّمت الفنون القتالية والعلاجية. بعد إتمام دراساتي العليا في الصين، عدت إلى مصر وأسّست «أكاديمية التنين» — مركز للفنون العلاجية والقتالية. كان عملي مزدهرًا.',
                },
                {
                  era: 'لحظة حقيقة',
                  text: 'كانت زوجتي ماريا ميكيلا حاملاً بابنتي. عملي كان مُتطلّبًا، وساعاته طويلة بشكل مستحيل. في لحظة صدق مع النَّفْس، سألت نفسي: هل قرّرت تكوين أسرة لتستمتع المربيات بأطفالي بدلاً مني؟ هذا السؤال قاد إلى قرار — سننتقل إلى كندا.',
                },
                {
                  era: 'الاكتشاف المؤلم',
                  text: 'في كندا، شاهدت طلابي في مصر يتراجعون. استطلعتهم واكتشفت أمرين: ما كان يدفعهم كانا محفّزين خارجيين — أمان المجتمع، ومعلّم يحفّزهم دائمًا. أدركت أنني لا أريد أن أكون مصدر دافع أي شخص. أردت أن أصبح رفيقاً يُلهم الناس لاستلهام دافعهم من داخلهم.',
                },
                {
                  era: 'اكتشاف الكوتشينج',
                  text: 'حين استيقظت هذه الرسالة بداخلي، عرّفتني باميلا بريتشارد على الكوتشينج المهني. تدرّبت في مدرستي كوتشينج في أمريكا الشمالية. الأولى وسّعت وعيي بالمنهج الغربي. الثانية أكّدت ما كنت أحسّه: لا تزال هناك فجوة بين الشرق والغرب.',
                },
                {
                  era: 'سدّ الفجوة',
                  text: 'سلّمت نفسي للرحلة — سنوات من العمل ككوتش محترف، أمزج الحكمتين، وأترك مساحة لما يريد أن ينكشف. بعد سنوات، تمكّنت أخيراً من تسمية القدرة الوحيدة التي تسدّ الفجوة: الحضور.',
                },
                {
                  era: 'الولادة',
                  text: 'من هناك، وُلد التفكير الحسّي — مصمَّم كفلسفة ومنهجية كوتشينج بهدف وحيد: خلق مساحة يختبر فيها الإنسان الحضور ويتبنّاه كحالته السائدة في الحياة.',
                },
              ] : [
                {
                  era: '30 Years of Practice',
                  text: 'For three decades, I practiced and taught martial and healing arts. After completing my master\'s studies in China, I returned to Egypt and founded the Dragon Academy — a centre for healing and martial arts. My work was thriving.',
                },
                {
                  era: 'A Moment of Truth',
                  text: 'My wife Maria Michela was pregnant with our daughter. My work was demanding, the hours impossibly long. In a moment of truth, I asked myself: did I decide to have a family so the nannies would enjoy my children instead of me? That question led to a decision — we would move to Canada.',
                },
                {
                  era: 'The Painful Discovery',
                  text: 'In Canada, I watched my students back home regress. I surveyed them and discovered: what had kept them going were external motivators — the safety of community, and a teacher who always pushed them. I realized I didn\'t want to be anyone\'s source of motivation. I wanted to become a companion, inspiring people to source their motivation from within.',
                },
                {
                  era: 'The Discovery of Coaching',
                  text: 'Once this vocation awakened in me, I was introduced to professional coaching by Pamela Pritchard. I trained with two coaching schools across North America. The first expanded my awareness about Western approaches. The second confirmed what I had sensed: there was still a gap between the Western and Eastern approaches.',
                },
                {
                  era: 'Bridging the Gap',
                  text: 'I gave myself to the journey — years of working as a professional coach, blending both wisdoms, holding space for what wanted to unfold. After years, I was finally able to name the one ability that bridges the gap: presence.',
                },
                {
                  era: 'The Birth',
                  text: 'From there, Somatic Thinking was born — designed as a philosophy and coaching methodology with the sole purpose of creating space for people to experience presence and adopt it as their predominant state of being.',
                },
              ]).map((item, i) => (
                <div key={i} className="flex gap-5">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold shrink-0"
                      style={{ background: 'var(--color-primary)' }}
                    >
                      {i + 1}
                    </div>
                    {i < 5 && <div className="mt-2 w-px flex-1 min-h-[32px]" style={{ background: 'var(--color-primary-200, #C4BCFB)' }} />}
                  </div>
                  <div className="pb-8">
                    <h3 className="font-bold text-[var(--text-primary)] mb-2" style={{ fontFamily: headingFont }}>{item.era}</h3>
                    <p className="text-[var(--color-neutral-700)] leading-relaxed text-base" style={{ fontFamily: bodyFont }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 6 — A NEW KIND OF COACH
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? 'الفلسفة' : 'The Philosophy'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-10"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'نوع جديد من الكوتش' : 'A New Kind of Coach'}
          </h2>

          {/* Three kinds of coaches */}
          <div className="space-y-6 mb-12">
            {(isAr ? [
              {
                num: '01',
                title: 'كوتشز مبنيون على الهدف',
                desc: 'نيّتهم مساعدة العملاء على تحقيق أهدافهم. لا يقودون عملاءهم، لكن العمل يدور حول الهدف. حين يتحقّق الهدف، تنتهي العلاقة. القيمة قابلة للقياس، لكن العمق محدود.',
                level: 'base',
              },
              {
                num: '02',
                title: 'كوتشز الشخص والهدف',
                desc: 'كوتشز خبراء يركّزون على الشخص والهدف معًا. يساعدون العملاء على توسيع الوعي الذاتي أثناء السعي وراء الأهداف. لكنهم يواجهون تحديًا فريدًا: التوتر بين خدمة النمو وخدمة الإنجاز.',
                level: 'mid',
              },
              {
                num: '03',
                title: 'كوتشز مبنيون على الإنسان',
                desc: 'نيّتهم مساعدة العملاء على رؤية أنفسهم في حياتهم والنمو أبعد من أهدافهم. تركيزهم الأساسي واحد: أن يكونوا حاضرين كلياً مع العميل، يستقبلون كل ما يُبثّ دون تحيّز، ويعكسونه — ممكّنين العميل من رؤية كيف يُشكّل عالمه الداخلي عالمه الخارجي.',
                level: 'elevated',
              },
            ] : [
              {
                num: '01',
                title: 'Objective-Based Coaches',
                desc: 'Their intention is to help clients achieve their objectives. They don\'t lead their clients, but the work revolves around the goal. When the goal is met, the engagement ends. The value delivered is measurable, but the depth is limited.',
                level: 'base',
              },
              {
                num: '02',
                title: 'Who-and-What Coaches',
                desc: 'Experienced, masterful coaches who focus on both the person and the objective. They help clients expand self-awareness while pursuing goals. But they face a unique challenge: as the client\'s awareness grows, objectives change — and the tension between growth and achievement can feel unresolvable.',
                level: 'mid',
              },
              {
                num: '03',
                title: 'Human-Based Coaches',
                desc: 'Their intention is to help clients see themselves in their lives and grow beyond their objectives. Their cardinal focus is singular: to be fully present with the client, to receive all that is being transmitted without bias, and to reflect it back — enabling the client to see how their inner world shapes their outer world.',
                level: 'elevated',
              },
            ]).map((coach) => (
              <div
                key={coach.num}
                className={`rounded-2xl p-6 border transition-all duration-300 ${
                  coach.level === 'elevated'
                    ? 'shadow-[0_8px_32px_rgba(71,64,153,0.12)]'
                    : 'border-[var(--color-neutral-200)]'
                }`}
                style={coach.level === 'elevated' ? {
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)',
                  border: 'none',
                } : {
                  background: 'var(--color-surface, #F8F7FC)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 text-xs font-bold tabular-nums pt-0.5"
                    style={{ color: coach.level === 'elevated' ? 'var(--color-accent)' : 'var(--color-neutral-400)' }}
                  >
                    {coach.num}
                  </div>
                  <div>
                    <h3
                      className={`font-bold mb-2 ${coach.level === 'elevated' ? 'text-white' : 'text-[var(--text-primary)]'}`}
                      style={{ fontFamily: headingFont }}
                    >
                      {coach.title}
                    </h3>
                    <p
                      className={`text-sm leading-relaxed ${coach.level === 'elevated' ? 'text-white/80' : 'text-[var(--color-neutral-600)]'}`}
                      style={{ fontFamily: bodyFont }}
                    >
                      {coach.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* The tagline pull-quote */}
          <div
            className="rounded-2xl p-8 border-s-4"
            style={{
              background: 'var(--color-primary-50, #F0EFFE)',
              borderColor: 'var(--color-primary)',
            }}
          >
            <p
              className="text-[var(--text-primary)] text-base md:text-lg leading-relaxed italic mb-3"
              style={{ fontFamily: bodyFont }}
            >
              {isAr
                ? '«نعمل مع إنسان لديه هدف، بالتركيز على الإنسان — لا الهدف. نصبح مرآة في يدك تُريك نفسك من الداخل والخارج. حين تستطيع أن ترى، ستعرف ما يجب فعله.»'
                : '"We work with a human who has an objective, by focusing on the human — not the objective. We become a mirror in your hand that shows you yourself from the inside and outside. Once you can see, you will know what needs to be done."'}
            </p>
            <p className="text-[var(--color-neutral-500)] text-sm" style={{ fontFamily: bodyFont }}>
              — {isAr ? 'سامر حسن، المؤسّس' : 'Samer Hassan, Founder'}
            </p>
          </div>

          <p className="mt-6 text-[var(--color-neutral-600)] text-base leading-relaxed" style={{ fontFamily: bodyFont }}>
            {isAr
              ? 'هذا ليس مجرد أسلوب مختلف. إنها علاقة مختلفة مع الكوتشينج ذاته. بالنسبة لنا، الكوتشينج طريقة تفكير وأسلوب حياة — ليس مهنة.'
              : 'This is not just a different technique. It is a different relationship to coaching itself. For us, coaching is a way of thinking and a lifestyle — not a profession.'}
          </p>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          SECTION 7 — FOUR PILLARS
      ═══════════════════════════════════════ */}
      <section
        className="py-16 md:py-24"
        style={{ background: 'var(--color-surface, #F8F7FC)' }}
        aria-label={isAr ? 'الأركان الأربعة' : 'Four Pillars'}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'المبادئ' : 'Principles'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'الأركان الأربعة' : 'The Four Pillars'}
            </h2>
            <p className="mt-4 text-[var(--color-neutral-600)] max-w-xl mx-auto text-base" style={{ fontFamily: bodyFont }}>
              {isAr
                ? 'اقلب البطاقة لتعرف أكثر عن كل ركن'
                : 'Flip each card to explore the pillar in depth'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {pillarsData.map((pillar, i) => (
              <FlipCard
                key={i}
                icon={pillar.icon}
                title={isAr ? pillar.titleAr : pillar.titleEn}
                description={isAr ? pillar.descAr : pillar.descEn}
                locale={locale}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 8 — HUMAN INTERACTION CYCLE (expanded)
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? 'الآلية الأساسية' : 'Core Mechanism'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-8"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'دورة التفاعل الإنساني' : 'The Human Interaction Cycle'}
          </h2>

          <div className="space-y-5 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed mb-10" style={{ fontFamily: bodyFont, lineHeight: '1.85' }}>
            {isAr ? (
              <>
                <p>في قلب التفكير الحسّي ملاحظة بسيطة حول كيفية تفاعل الإنسان مع الحياة:</p>
                <p>
                  كل فعل نقوم به يُنتج أحاسيس جسدية. تلك الأحاسيس تُولّد مشاعر. المشاعر تُنتج أفكارًا. والأفكار — المتراكمة عبر الزمن — تُشكّل من نصبح. هذه الدورة تتكرّر باستمرار، مكوّنةً قيمنا ومعتقداتنا وهُويتنا وسلوكنا.
                </p>
                <p>
                  معظم مناهج الكوتشينج تتدخّل على مستوى الفكر: <em>غيّر تفكيرك، تتغيّر حياتك.</em> التفكير الحسّي يتدخّل أبكر — على مستوى الإحساس. لأنه إذا كانت إشارات الجسد تُتجاهل أو تُكبت أو تُقرأ خطأً، فإن كل فكر يتبعها مبني على معلومات ناقصة.
                </p>
                <p>
                  حين يتعلّم العميل قراءة إشاراته الحسّية بدقة، تتحوّل الدورة بأكملها. لا يُفكّر بشكل مختلف فحسب — بل يُحسّ بشكل مختلف، ويشعر بشكل مختلف، ويصبح في النهاية مختلفًا. <strong>لا بالجهد، بل بالوعي.</strong>
                </p>
              </>
            ) : (
              <>
                <p>At the heart of Somatic Thinking is a simple observation about how human beings interact with life:</p>
                <p>
                  Every action we take produces physical sensations. Those sensations generate feelings. Feelings produce thoughts. And thoughts — accumulated over time — shape who we become. This cycle repeats continuously, forming our values, beliefs, identity, and behavior.
                </p>
                <p>
                  Most approaches to coaching intervene at the level of thought: <em>change your thinking, change your life.</em> Somatic Thinking intervenes earlier — at the level of sensation. Because if the body&apos;s signals are being ignored, suppressed, or misread, every thought that follows is built on incomplete information.
                </p>
                <p>
                  When a client learns to read their somatic signals accurately, the entire cycle shifts. They don&apos;t just think differently — they sense differently, feel differently, and ultimately become different. <strong>Not through effort, but through awareness.</strong>
                </p>
              </>
            )}
          </div>

          {/* Visual intervention point highlight */}
          <div
            className="rounded-2xl p-6 flex items-start gap-4"
            style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }}
          >
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-lg">
              ↓
            </div>
            <div>
              <p className="text-white font-semibold mb-1" style={{ fontFamily: headingFont }}>
                {isAr ? 'نقطة التدخّل' : 'The Intervention Point'}
              </p>
              <p className="text-white/75 text-sm leading-relaxed" style={{ fontFamily: bodyFont }}>
                {isAr
                  ? 'بينما الكوتشينج التقليدي يتدخّل عند مستوى الأفكار، التفكير الحسّي يتدخّل أبكر — عند مستوى الأحاسيس. هذا هو الفارق الجوهري.'
                  : 'While traditional coaching intervenes at the level of thoughts, Somatic Thinking intervenes earlier — at the level of sensations. This is the fundamental difference.'}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          SECTION 9 — INTELLECTUAL ROOTS
      ═══════════════════════════════════════ */}
      <section
        className="py-16 md:py-24"
        style={{ background: 'var(--color-surface, #F8F7FC)' }}
        aria-label={isAr ? 'الجذور الفكرية' : 'Intellectual Roots'}
      >
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'الجذور' : 'Roots'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'من أين يأتي التفكير الحسّي' : 'Where Somatic Thinking Comes From'}
            </h2>
            <p className="mt-4 text-[var(--color-neutral-600)] max-w-xl mx-auto text-base" style={{ fontFamily: bodyFont }}>
              {isAr
                ? 'التفكير الحسّي ليس اختراعاً من الصفر — إنه ترتيب جديد لحكمة من تقاليد متعددة.'
                : 'Somatic Thinking is not an invention from scratch — it is a new arrangement of wisdom from multiple traditions.'}
            </p>
          </div>

          {/* Three roots cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
            {(isAr ? [
              {
                source: 'من الشرق',
                icon: '☯',
                content: 'ثلاثون عامًا من الفنون القتالية والعلاجية. التقاليد الشرقية تُعلّم أن الجسد هو أداة الوعي الأولى — أن المهارة والتوازن والتحوّل ينبثقون من الممارسة لا النظرية. الحضور هو جوهر كل مسار روحاني وعلاجي.',
              },
              {
                source: 'من الغرب',
                icon: '🧠',
                content: 'مفهوم الإدراك المتجسّد راسخ في العلاج النفسي (فيلهلم رايخ)، والفينومينولوجيا (ميرلو-بونتي)، وعلوم الطاقة الحيوية (ألكسندر لوين)، وأبحاث الكوتشينج (دوغ سيلسبي، باميلا ماكلين، لورا ديفاين).',
              },
              {
                source: 'من التراث الإسلامي',
                icon: '◇',
                content: 'فهم النَّفْس وطبقاتها — النَّفْس الأمّارة، اللوّامة، المطمئنّة — وعملية التزكية والمراقبة — هي أسلاف ما يسمّيه الكوتشينج الحديث الوعي الذاتي. التفكير الحسّي مبني على فلسفة توحيدية: الإنسان كيان واحد متكامل.',
              },
            ] : [
              {
                source: 'From the East',
                icon: '☯',
                content: 'Thirty years of martial and healing arts. The Eastern traditions teach that the body is the primary instrument of awareness — that skill, balance, and transformation emerge through practice, not theory. Presence is the core of every spiritual and healing path.',
              },
              {
                source: 'From the West',
                icon: '🧠',
                content: 'The concept of embodied cognition is established in psychotherapy (Wilhelm Reich), phenomenology (Merleau-Ponty), bioenergetic science (Alexander Lowen), and coaching scholarship (Doug Silsbee, Pamela McLean, Laura Divine). Body-mind partnership is mainstream science.',
              },
              {
                source: 'From Islamic Heritage',
                icon: '◇',
                content: 'The understanding of the self (النَّفْس) and its layers — the nafs, tazkiyah (purification), muraqabah (self-observation) — are the ancestors of what modern coaching calls self-awareness. Somatic Thinking is built on a Tawhidi philosophy: the human is one integrated being.',
              },
            ]).map((root) => (
              <div
                key={root.source}
                className="rounded-2xl p-7 bg-white shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_8px_32px_rgba(71,64,153,0.1)] hover:-translate-y-0.5 transition-all duration-500"
              >
                <div className="text-3xl mb-4">{root.icon}</div>
                <h3 className="font-bold text-[var(--text-primary)] mb-3" style={{ fontFamily: headingFont }}>
                  {root.source}
                </h3>
                <p className="text-[var(--color-neutral-600)] text-sm leading-relaxed" style={{ fontFamily: bodyFont }}>
                  {root.content}
                </p>
              </div>
            ))}
          </div>

          {/* Bridge statement */}
          <div className="max-w-3xl mx-auto">
            <div
              className="rounded-2xl p-8 text-center border"
              style={{ background: 'var(--color-primary-50, #F0EFFE)', borderColor: 'var(--color-primary-200, #C4BCFB)' }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase text-[var(--color-primary)] mb-4" style={{ fontFamily: bodyFont }}>
                {isAr ? 'الجسر' : 'The Bridge'}
              </p>
              <p className="text-[var(--text-primary)] text-base md:text-lg leading-relaxed" style={{ fontFamily: bodyFont }}>
                {isAr
                  ? 'ما يقدّمه التفكير الحسّي هو إطار يُعيد تنظيم هذه الموروثات في شيء عملي، سهل الوصول، وعالمي ثقافيًا. إنها أول منهجية كوتشينج وُلدت بالعربية حصلت على اعتماد ICF — ليس كترجمة لنماذج غربية، بل كمساهمة أصيلة في ميدان الكوتشينج العالمي.'
                  : 'What Somatic Thinking offers is a framework that reorganizes these inheritances into something practical, accessible, and culturally universal. It is the first coaching methodology born in Arabic that has earned ICF accreditation — not as a translation of Western models, but as an original contribution to the global coaching field.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 10 — WHAT DISTINGUISHES ST
      ═══════════════════════════════════════ */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
            {isAr ? 'التمييز' : 'Distinction'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-10"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'ما الذي يميّز التفكير الحسّي؟' : 'What Distinguishes Somatic Thinking?'}
          </h2>

          <div className="space-y-6">
            {(isAr ? [
              {
                title: 'ليس الكوتشينج الجسدي الغربي',
                body: 'التفكير الحسّي® منهجية مستقلة — ليس ترجمة أو تكييفًا أو فرعًا من أي منهج سوماتيكي غربي. نشأ من تربة ثقافية مختلفة، بجذور فلسفية مختلفة، ويصل إلى الحضور عبر مسار مختلف.',
              },
              {
                title: 'لا يستخدم لغة «الطاقة»',
                body: 'نستخدم مصطلح «إشارات حسّية جسدية» — لأن العلم يؤكّد أن الجسد يُرسل بيانات قابلة للقراءة والقياس. نتجنّب مصطلحات مثل «الطاقة» و«الشاكرات» و«الذبذبات» التي تطمس الحدود بين الكوتشينج وممارسات خارج نطاقنا.',
              },
              {
                title: 'يتحدّث مع الجسد، لا عنه',
                body: 'كثير من المنهجيات تصف دور الجسد فكرياً. التفكير الحسّي يُشرك الجسد مباشرة — كل جلسة، كل تمرين، كل لحظة تعلّم تبدأ بتجربة جسدية حقيقية. الفهم يتبع؛ لا يقود.',
              },
              {
                title: 'مبني على فلسفة توحيدية',
                body: 'الإنسان كيان واحد متكامل — الجسد والعقل والنَّفْس ليسوا أنظمة منفصلة تُدار، بل أبعاد لكلّ واحد يُختبر. هذا الأساس الفلسفي يجعل المنهجية متوافقة بشكل طبيعي مع الرؤى الإسلامية والروحانية والعلمانية على حد سواء.',
              },
              {
                title: 'يرى الكوتشينج طريقة حياة، لا مهنة',
                body: 'بالنسبة لنا، الكوتشينج ليس ما تفعله — بل من تكون حين تكون حاضرًا كلياً. هذا التمييز يُشكّل كل شيء: كيف ندرّب الكوتشز، كيف نقيس النمو، وما نؤمن أنه يجعل الكوتشينج يستحق العمل.',
              },
            ] : [
              {
                title: 'It is not Western Somatic Coaching',
                body: 'Somatic Thinking® is an independent methodology — not a translation, adaptation, or branch of any Western somatic approach. It emerged from a different cultural soil, with different philosophical roots, and arrives at presence through a different path.',
              },
              {
                title: 'It does not use the language of "energy"',
                body: 'We use the term "somatic signals" (إشارات حسّية جسدية) — because science confirms the body sends readable, measurable data. We avoid terms like "energy," "chakras," or "vibrations" that blur the line between coaching and practices that fall outside our scope.',
              },
              {
                title: 'It talks with the body, not about it',
                body: 'Many methodologies describe the body\'s role intellectually. Somatic Thinking engages the body directly — every session, every exercise, every learning moment begins with a real physical experience. The understanding follows; it doesn\'t lead.',
              },
              {
                title: 'It is built on a Tawhidi philosophy',
                body: 'The human being is one integrated entity — body, mind, and self (النَّفْس) are not separate systems to be managed, but dimensions of one whole to be experienced. This philosophical foundation makes the methodology naturally compatible with Islamic, spiritual, and secular worldviews alike.',
              },
              {
                title: 'It holds coaching as a way of being, not a profession',
                body: 'For us, coaching is not what you do — it is who you are when you are fully present. This distinction shapes everything: how we train coaches, how we measure growth, and what we believe makes coaching worth doing.',
              },
            ]).map((item, i) => (
              <div
                key={i}
                className="flex gap-5 rounded-2xl p-6 border border-[var(--color-neutral-200)] hover:border-[var(--color-primary-300)] transition-all duration-300"
                style={{ background: 'var(--color-surface, #F8F7FC)' }}
              >
                <div
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-white text-sm font-bold"
                  style={{ background: 'var(--color-primary)' }}
                >
                  ✓
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-1.5" style={{ fontFamily: headingFont }}>
                    {item.title}
                  </h3>
                  <p className="text-[var(--color-neutral-600)] text-sm leading-relaxed" style={{ fontFamily: bodyFont }}>
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
          FAQ
      ═══════════════════════════════════════ */}
      <section className="py-16 md:py-20" style={{ background: 'var(--color-surface, #F8F7FC)' }}>
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <FAQSection items={methodologyFaqs} locale={locale} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(methodologyFaqs, locale)) }}
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SECTION 11 — MULTI-PATHWAY CTA
      ═══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        aria-label={isAr ? 'ابدأ تجربتك' : 'Begin Your Experience'}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }}
        />
        <GeometricPattern pattern="eight-star" opacity={0.06} fade="both" />

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-3">
              {isAr ? 'البداية' : 'Begin'}
            </p>
            <h2
              className="text-2xl md:text-3xl font-bold text-white mb-4"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'ابدأ تجربتك' : 'Begin Your Experience'}
            </h2>
            <p className="text-white/70 text-base max-w-xl mx-auto" style={{ fontFamily: bodyFont }}>
              {isAr
                ? 'التفكير الحسّي يُعاش، لا يُشرَح. اختر نقطة دخولك:'
                : 'Somatic Thinking is experienced, not explained. Choose your entry point:'}
            </p>
          </div>

          {/* Pathway cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mb-12">
            {(isAr ? [
              {
                icon: '🎧',
                title: '٩٠ دقيقة مع نفسك',
                desc: 'تجربة مصغّرة مجانية',
                href: `/${locale}/courses/90-minutes`,
                primary: false,
              },
              {
                icon: '🎓',
                title: 'برنامج STCE',
                desc: 'معتمد من ICF · ٢٤٠ ساعة',
                href: `/${locale}/academy/certifications/stce`,
                primary: true,
              },
              {
                icon: '🪞',
                title: 'جلسة كوتشينج فردية',
                desc: 'كوتشينج بمنهج التفكير الحسّي',
                href: `/${locale}/coaching/individual`,
                primary: false,
              },
              {
                icon: '📚',
                title: 'برنامج منهجك',
                desc: 'عمّق منهجيتك الحالية',
                href: `/${locale}/academy/certifications/manhajak`,
                primary: false,
              },
              {
                icon: '🏢',
                title: 'البرامج المؤسسية',
                desc: 'أدخل التفكير الحسّي لمؤسستك',
                href: `/${locale}/coaching/corporate`,
                primary: false,
              },
            ] : [
              {
                icon: '🎧',
                title: '90 Minutes With Yourself',
                desc: 'Free micro-experience',
                href: `/${locale}/courses/90-minutes`,
                primary: false,
              },
              {
                icon: '🎓',
                title: 'STCE Program',
                desc: 'ICF-accredited · 240 hours',
                href: `/${locale}/academy/certifications/stce`,
                primary: true,
              },
              {
                icon: '🪞',
                title: 'Individual Coaching Session',
                desc: 'Coaching with this approach',
                href: `/${locale}/coaching/individual`,
                primary: false,
              },
              {
                icon: '📚',
                title: 'Manhajak Program',
                desc: 'Deepen your existing methodology',
                href: `/${locale}/academy/certifications/manhajak`,
                primary: false,
              },
              {
                icon: '🏢',
                title: 'Corporate Programs',
                desc: 'Bring this to your organization',
                href: `/${locale}/coaching/corporate`,
                primary: false,
              },
            ]).map((pathway) => (
              <a
                key={pathway.href}
                href={pathway.href}
                className={`group flex items-start gap-4 rounded-2xl p-6 transition-all duration-300 ${
                  pathway.primary
                    ? 'bg-[var(--color-accent)] text-white hover:bg-[#C49A42] shadow-[0_8px_30px_rgba(212,168,83,0.3)]'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                }`}
              >
                <span className="text-2xl shrink-0 mt-0.5">{pathway.icon}</span>
                <div>
                  <div className="font-semibold text-sm mb-0.5" style={{ fontFamily: headingFont }}>
                    {pathway.title}
                  </div>
                  <div className={`text-xs ${pathway.primary ? 'text-white/80' : 'text-white/60'}`} style={{ fontFamily: bodyFont }}>
                    {pathway.desc}
                  </div>
                </div>
                <span className="ms-auto text-lg opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200">
                  {isAr ? '←' : '→'}
                </span>
              </a>
            ))}
          </div>

          {/* Bottom note */}
          <p className="text-center text-white/40 text-xs" style={{ fontFamily: bodyFont }}>
            {isAr
              ? 'لا تعرف من أين تبدأ؟ تواصل معنا للاستشارة المجانية'
              : "Don't know where to start? Contact us for a free consultation"}{' '}
            <a
              href={`/${locale}/contact`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {isAr ? '← تواصل معنا' : '→ Contact us'}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
