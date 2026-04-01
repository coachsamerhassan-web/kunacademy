import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import type { Metadata } from 'next';
import { FlipCard } from '@/components/flip-card';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'التفكير الحسّي® | أكاديمية كُن' : 'Somatic Thinking® | Kun Academy',
    description: isAr
      ? 'التفكير الحسّي® — منهجية كوتشينج عربية أصيلة معتمدة من ICF، تبدأ من الجسد وتُعيد العلاقة بين الجسد والعقل والحضور'
      : 'Somatic Thinking® — an original Arabic coaching methodology accredited by ICF, starting from the body to restore the relationship between body, mind, and presence',
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

/* 1. Somatic Signals — body silhouette transmitting Wi-Fi waves */
const IconSomaticSignals = (
  <svg {...iconProps}>
    {/* Simple body — head + torso */}
    <circle cx="12" cy="15" r="1.2" />
    <path d="M12 16.2v4" />
    <path d="M9.5 20.2h5" />
    {/* Wi-Fi arcs radiating outward from the body */}
    <path d="M9.5 13a3.5 3.5 0 0 1 5 0" />
    <path d="M7.5 11a6.5 6.5 0 0 1 9 0" />
    <path d="M5.5 9a9.5 9.5 0 0 1 13 0" />
  </svg>
);

/* 2. Presence — still figure inside analog watch (here & now) */
const IconPresence = (
  <svg {...iconProps}>
    {/* Watch case — circle */}
    <circle cx="12" cy="12" r="9" />
    {/* Watch lugs top + bottom */}
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    {/* Hour markers — 12, 3, 6, 9 */}
    <line x1="12" y1="4" x2="12" y2="5.5" />
    <line x1="12" y1="18.5" x2="12" y2="20" />
    <line x1="4" y1="12" x2="5.5" y2="12" />
    <line x1="18.5" y1="12" x2="20" y2="12" />
    {/* Still figure at center — dot head + line body */}
    <circle cx="12" cy="10" r="1" />
    <line x1="12" y1="11.5" x2="12" y2="15.5" />
  </svg>
);

/* 3. Body-Mind Partnership — brain outline + body outline connected */
const IconPartnership = (
  <svg {...iconProps}>
    {/* Brain — simplified outline on left */}
    <path d="M4 12c0-2 1-3.5 2.5-3.5.5-1.5 2-2.5 3.5-2.5" />
    <path d="M4 12c0 2 1 3.5 2.5 3.5.5 1.5 2 2.5 3.5 2.5" />
    <path d="M10 6c.8-.3 1.5 0 1.5 1" />
    <path d="M10 18c.8.3 1.5 0 1.5-1" />
    {/* Connecting line */}
    <line x1="11.5" y1="12" x2="14.5" y2="12" />
    {/* Body — simple figure on right */}
    <circle cx="18" cy="8" r="1.5" />
    <path d="M18 9.5v5" />
    <path d="M15.5 12h5" />
    <path d="M18 14.5l-2 3.5" />
    <path d="M18 14.5l2 3.5" />
  </svg>
);

/* 4. Experience Not Theory — open hand, hands-on symbolism */
const IconExperience = (
  <svg {...iconProps}>
    {/* Palm */}
    <path d="M12 22c-3 0-5-1.5-5-4v-5" />
    {/* Fingers */}
    <path d="M7 13v-2.5a1 1 0 0 1 2 0V13" />
    <path d="M9 10.5V7a1 1 0 0 1 2 0v6" />
    <path d="M11 7V5.5a1 1 0 0 1 2 0V13" />
    <path d="M13 7.5V7a1 1 0 0 1 2 0v4" />
    {/* Thumb */}
    <path d="M15 11v-1a1 1 0 0 1 1.5.5l.5 1.5c.5 2 0 4-2 5" />
    {/* Small touch ripple below */}
    <path d="M9 20c1.5.7 3.5.7 5 0" />
  </svg>
);

const pillarsData = [
  {
    icon: IconSomaticSignals,
    titleAr: 'الإشارات الحسّية الجسدية',
    titleEn: 'Somatic Signals',
    descAr: 'الجسد لا يكذب. كل شعور وكل قرار يبدأ كإشارة جسدية — التفكير الحسّي يُعلّمك قراءة هذه اللغة.',
    descEn: 'The body doesn\'t lie. Every feeling and every decision begins as a somatic signal — Somatic Thinking teaches you to read this language.',
  },
  {
    icon: IconPresence,
    titleAr: 'الحضور',
    titleEn: 'Presence',
    descAr: 'الحضور هو الحالة الطبيعية — لا الاستثناء. المنهجية تُعيد الإنسان إلى حالة الحضور الكامل مع الذات والآخر.',
    descEn: 'Presence is the natural state — not the exception. The methodology restores the human to full presence with self and other.',
  },
  {
    icon: IconPartnership,
    titleAr: 'الشراكة بين الجسد والعقل',
    titleEn: 'Body-Mind Partnership',
    descAr: 'ليس الجسد تابعًا للعقل، ولا العقل سيّدًا على الجسد. التفكير الحسّي يُعيد بناء هذه الشراكة.',
    descEn: 'The body is not subordinate to the mind, nor is the mind master of the body. Somatic Thinking rebuilds this partnership.',
  },
  {
    icon: IconExperience,
    titleAr: 'التجربة لا النظرية',
    titleEn: 'Experience, Not Theory',
    descAr: 'التفكير الحسّي يُعاش ولا يُشرَح. كل تمرين، كل جلسة، كل تعلّم يبدأ من تجربة حقيقية في الجسد.',
    descEn: 'Somatic Thinking is experienced, not explained. Every exercise, every session, every learning begins with a real experience in the body.',
  },
];

export default async function MethodologyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, [
          { name: isAr ? 'الرئيسية' : 'Home', path: '' },
          { name: isAr ? 'عنّا' : 'About', path: '/about' },
          { name: isAr ? 'التفكير الحسّي' : 'Somatic Thinking', path: '/about/methodology' },
        ])) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 animate-fade-up md:flex md:items-center md:gap-12">
          {/* Logo — mobile: centered above title, desktop: side column */}
          <div className="flex justify-center mb-8 md:mb-0 md:shrink-0 md:order-2">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-20"
                style={{ background: 'radial-gradient(circle, #D4A853 0%, transparent 70%)' }}
              />
              <img
                src="/images/programs/logos/somatic-thinking-methodology.png"
                alt=""
                className="relative h-40 w-40 md:h-64 md:w-64 lg:h-80 lg:w-80 object-contain drop-shadow-[0_0_30px_rgba(212,168,83,0.3)]"
              />
            </div>
          </div>
          {/* Text content */}
          <div className="text-center md:text-start md:flex-1 md:order-1">
            <p className="text-[var(--color-accent)] font-medium text-sm uppercase tracking-wider mb-4">
              {isAr ? 'المنهجية' : 'The Methodology'}
            </p>
            <h1
              className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
            </h1>
            <p className="mt-6 text-white/70 max-w-2xl text-lg md:text-xl leading-relaxed">
              {isAr
                ? 'منهجية كوتشينج عربية أصيلة تبدأ من الجسد — معتمدة من الاتحاد الدولي للكوتشينج (ICF)'
                : 'An original Arabic coaching methodology that starts from the body — accredited by the International Coaching Federation (ICF)'}
            </p>
          </div>
        </div>
      </section>

      {/* What is ST */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ما هو التفكير الحسّي®؟' : 'What is Somatic Thinking®?'}
          </h2>
          <div
            className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg space-y-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr ? (
              <>
                <p>
                  حين يسألني أحدهم «ما هو التفكير الحسّي؟» — أعرف أن الإجابة لن تكفيه. ليس لأنها معقّدة، بل لأنها تُعاش ولا تُشرَح.
                </p>
                <p>
                  تذكّر آخر مرة دخلت غرفة وشعرت أن شيئاً ليس على ما يرام — قبل أن يقول أحد كلمة. تذكّر لحظة اتخذت فيها قراراً «من بطنك» وكان صائباً. هذه ليست حدساً غامضاً. هذه إشارات حسّية جسدية — لغة يتحدّثها جسدك كل لحظة.
                </p>
                <p>
                  التفكير الحسّي® يُعيد فتح هذه القناة. المنهجية قائمة على مبدأ واحد: <strong>الحياة تُعاش في شراكة بين الجسد والعقل، بحيث يصبح الحضور هو الحالة السائدة — لا الاستثناء.</strong>
                </p>
              </>
            ) : (
              <>
                <p>
                  When someone asks me &ldquo;What is Somatic Thinking?&rdquo; — I know the answer won&apos;t be enough. Not because it&apos;s complex, but because it&apos;s experienced, not explained.
                </p>
                <p>
                  Remember the last time you walked into a room and felt something was off — before anyone said a word. Remember a moment you made a decision &ldquo;from your gut&rdquo; and it was right. These aren&apos;t vague intuitions. These are somatic signals — a language your body speaks every moment.
                </p>
                <p>
                  Somatic Thinking® reopens this channel. The methodology rests on one principle: <strong>Life is lived in partnership between body and mind, where presence becomes the prevailing state — not the exception.</strong>
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section variant="surface">
        <div className="text-center mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'أركان المنهجية' : 'Methodology Pillars'}
          </h2>
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
      </Section>

      {/* Distinction */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ما الذي يميّز التفكير الحسّي؟' : 'What Distinguishes Somatic Thinking?'}
          </h2>
          <div
            className="text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg space-y-4"
            style={{ fontFamily: isAr ? 'var(--font-arabic-body)' : 'inherit' }}
          >
            {isAr ? (
              <>
                <p>كثير من المناهج تتحدّث <em>عن</em> الجسد. التفكير الحسّي® لا يتحدّث عنه — بل يتحدّث <em>معه</em>.</p>
                <p>
                  نحن لا نستخدم مصطلح «الطاقة» ولا ندّعي أن الجسد يشفي نفسه بمعزل عن العقل.
                  نستخدم مصطلح <strong>«إشارات حسّية جسدية»</strong> — لأن العلم يُثبت أن الجسد يُرسل بيانات قابلة للقراءة والفهم،
                  وأن هذه البيانات أساسية لاتخاذ القرارات وللوعي بالذات وللقيادة.
                </p>
                <p>
                  المنهجية مبنية على فلسفة توحيدية — الإنسان كيان واحد متكامل، لا انفصال بين جسده وعقله ونَفْسه.
                </p>
              </>
            ) : (
              <>
                <p>Many methodologies talk <em>about</em> the body. Somatic Thinking® doesn&apos;t talk about it — it talks <em>with</em> it.</p>
                <p>
                  We don&apos;t use the term &ldquo;energy&rdquo; and we don&apos;t claim the body heals itself in isolation from the mind.
                  We use the term <strong>&ldquo;somatic signals&rdquo;</strong> — because science confirms the body sends readable, understandable data,
                  and this data is fundamental to decision-making, self-awareness, and leadership.
                </p>
                <p>
                  The methodology is built on a Tawhidi philosophy — the human is one integrated being, with no separation between body, mind, and self (النَّفْس).
                </p>
              </>
            )}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section variant="surface">
        <div className="text-center py-4">
          <h2
            className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ابدأ تجربتك' : 'Start Your Experience'}
          </h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-xl mx-auto">
            {isAr
              ? 'التفكير الحسّي يُعاش — ابدأ بالتعرّف من خلال دورة تمهيدية أو جلسة كوتشينج فردية'
              : 'Somatic Thinking is experienced — start through an introductory course or an individual coaching session'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={`/${locale}/academy/certifications/stce`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-[var(--color-primary-600)] transition-all duration-300"
            >
              {isAr ? 'برنامج STCE' : 'STCE Program'}
            </a>
            <a
              href={`/${locale}/coaching/individual`}
              className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-primary)] min-h-[48px] hover:bg-[var(--color-primary-50)] transition-all duration-300"
            >
              {isAr ? 'جلسة كوتشينج فردية' : 'Individual Coaching Session'}
            </a>
          </div>
        </div>
      </Section>
    </main>
  );
}
