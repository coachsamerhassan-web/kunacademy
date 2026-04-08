import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { breadcrumbJsonLd } from '@kunacademy/ui/structured-data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'كيف تصبح كوتش تفكير حسّي® | كُن للكوتشينج'
      : 'Become a Somatic Thinking® Coach | Kun Coaching',
    description: isAr
      ? 'مسار واضح من المستوى الأول (ACC) إلى التخصص (PCC) إلى الإتقان (MCC) — ابنِ مسيرة كوتشينج مبنية على منهجية التفكير الحسّي® المعتمدة من ICF.'
      : 'A clear pathway from Level One (ACC) to specialization (PCC) to mastery (MCC) — build a coaching career grounded in ICF-accredited Somatic Thinking® methodology.',
    alternates: {
      canonical: `/${locale}/about/methodology/coach-pathway`,
    },
  };
}

export default async function CoachPathwayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';
  const bodyFont = isAr ? 'var(--font-arabic-body)' : 'inherit';

  const steps = [
    {
      number: isAr ? '١' : '01',
      labelAr: 'الأساس',
      labelEn: 'Foundation',
      titleAr: 'شهادة المستوى الأول',
      titleEn: 'Level One Certification',
      programAr: 'STCE — أساسيات التفكير الحسّي للكوتشينج',
      programEn: 'STCE — Somatic Thinking Core Essentials',
      badgeAr: '١٢٥ ساعة | مؤهّل لـ ICF ACC',
      badgeEn: '125 Hours | ICF ACC-Eligible',
      contentAr: [
        'يبدأ كل كوتش تفكير حسّي® من هنا. برنامج STCE هو التدريب التأسيسي الذي يُرسّخ الأدوات الجوهرية للمنهجية — قراءة الإشارات الجسدية، الحضور الكامل، الشراكة بين الجسد والعقل، واستخدام التجسيد كتدخّل كوتشينج متعمّد.',
        'البرنامج مصمّم وفق متطلبات الاعتماد من الاتحاد الدولي للكوتشينج (ICF)، ويُؤهّل خرّيجيه للتقديم على بيانات اعتماد ACC. لكن المعيار الذي نقيس به النجاح ليس الساعات — بل التحوّل في الممارسة.',
      ],
      contentEn: [
        'Every Somatic Thinking® coach begins here. The STCE program is the foundational training that embeds the core tools of the methodology — reading somatic signals, full presence, body-mind partnership, and using embodiment as a deliberate coaching intervention.',
        'The program is designed to meet ICF accreditation requirements and qualifies graduates to apply for ACC credentials. But the measure of success we care about is not the hours — it is the transformation in practice.',
      ],
    },
    {
      number: isAr ? '٢' : '02',
      labelAr: 'التطور',
      labelEn: 'Growth',
      titleAr: 'التخصص في المستوى الثاني',
      titleEn: 'Level Two Specialization',
      programAr: 'STAIC أو مسار مَنهجك',
      programEn: 'STAIC or Manhajak Pathway',
      badgeAr: 'مؤهّل لـ ICF PCC',
      badgeEn: 'ICF PCC-Eligible',
      contentAr: [
        'بعد المستوى الأول، يختار الكوتش مسار تخصّصه. STAIC (المنهج التكاملي للتفكير الحسّي في الكوتشينج) يأخذ الممارس إلى عمق أكبر في تطبيقات التجسيد في الكوتشينج التنظيمي والقيادي. أما مَنهجك، فمسار يُركّز على تطوير أسلوب الكوتشينج الشخصي المتجسّد.',
        'كلا المسارين مصمّمان ليتراكما فوق أساس المستوى الأول، ويُؤهّلان الخرّيجين للتقديم على بيانات اعتماد PCC من ICF — مع ترك الباب مفتوحاً لمواصلة الرحلة نحو MCC.',
      ],
      contentEn: [
        'After Level One, the coach chooses their specialization pathway. STAIC (Somatic Thinking Advanced Integrated Coaching) takes the practitioner deeper into applications of embodiment in organizational and leadership coaching. Manhajak focuses on developing a personal embodied coaching style.',
        'Both pathways are designed to build on the Level One foundation and qualify graduates to apply for ICF PCC credentials — while leaving the door open to continue toward MCC.',
      ],
    },
    {
      number: isAr ? '٣' : '03',
      labelAr: 'الإتقان',
      labelEn: 'Mastery',
      titleAr: 'مسار المنتور كوتش',
      titleEn: 'The Mentor Coach Path',
      programAr: 'الإشراف المباشر مع سامر حسن',
      programEn: 'Direct Mentoring with Samer Hassan',
      badgeAr: 'مسار ICF MCC',
      badgeEn: 'ICF MCC Pathway',
      contentAr: [
        'يعمل سامر حسن — أول عربي يحمل شهادة MCC من ICF — مباشرة مع عدد محدود من الممارسين المتقدّمين الذين يسعون نحو مستوى الإتقان. هذا ليس برنامجاً بالمعنى التقليدي — إنه علاقة إتقان حرفي، تُبنى على الجلسات الفعلية، والتغذية الراجعة المباشرة، والتطوير المتعمّد لصوت الكوتش وأسلوبه.',
        'يتطلب هذا المسار أن يكون المتقدّم قد أتمّ مرحلة PCC وجمع ساعات كافية من الممارسة الفعلية. المعيار الذي يحكم الانتقاء ليس السيرة الذاتية فقط — بل الجاهزية.',
      ],
      contentEn: [
        'Samer Hassan — the first Arab to hold an ICF MCC credential — works directly with a small number of advanced practitioners pursuing the mastery level. This is not a program in the conventional sense — it is a master-apprentice relationship built on real sessions, direct feedback, and deliberate development of the coach\'s voice and style.',
        'This pathway requires applicants to have completed the PCC level and accumulated sufficient hours of real practice. The criterion governing selection is not only credentials — it is readiness.',
      ],
    },
  ];

  return (
    <main dir={dir}>
      {/* ── Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(locale, [
              { name: isAr ? 'الرئيسية' : 'Home', path: '' },
              { name: isAr ? 'عنّا' : 'About', path: '/about' },
              { name: isAr ? 'التفكير الحسّي' : 'Somatic Thinking', path: '/about/methodology' },
              {
                name: isAr ? 'كيف تصبح كوتش تفكير حسّي' : 'Become a Somatic Thinking Coach',
                path: '/about/methodology/coach-pathway',
              },
            ])
          ),
        }}
      />

      {/* ═══════════════════════════════════════
          HERO
      ═══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden py-20 md:py-32"
        aria-label={isAr ? 'مقدمة' : 'Hero'}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 60%, #0D0B1E 100%)' }}
        />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-accent)] mb-4">
              {isAr ? 'مسار التطوير المهني' : 'Professional Development Pathway'}
            </p>
            <h1
              className="text-[2.25rem] md:text-[3.75rem] font-bold text-[#FFF5E9] leading-[1.1] mb-6"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'كيف تصبح كوتش تفكير حسّي®' : 'Become a Somatic Thinking® Coach'}
            </h1>
            <p
              className="text-white/75 text-base md:text-lg leading-relaxed max-w-2xl mx-auto"
              style={{ fontFamily: bodyFont }}
            >
              {isAr
                ? 'مسار واضح من الأساس إلى الإتقان — مبني على منهجية معتمدة من ICF، ومُدرَّب من أول عربي يحمل شهادة MCC في العالم.'
                : 'A clear pathway from foundation to mastery — built on an ICF-accredited methodology, and mentored by the first Arab to hold the MCC credential worldwide.'}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          PATHWAY STEPS
      ═══════════════════════════════════════ */}
      {steps.map((step, index) => (
        <section
          key={step.number}
          className="py-16 md:py-24"
          style={{ background: index % 2 === 0 ? 'var(--color-surface, #F8F7FC)' : '#ffffff' }}
          aria-label={isAr ? step.labelAr : step.labelEn}
        >
          <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-8">
            <div className="max-w-3xl mx-auto">
              {/* Step header */}
              <div className="flex items-start gap-5 mb-8">
                <div
                  className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-sm"
                  style={{ background: 'var(--color-primary)', fontFamily: headingFont, minWidth: '48px' }}
                >
                  {step.number}
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--color-accent)] mb-1">
                    {isAr ? step.labelAr : step.labelEn}
                  </p>
                  <h2
                    className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]"
                    style={{ fontFamily: headingFont }}
                  >
                    {isAr ? step.titleAr : step.titleEn}
                  </h2>
                </div>
              </div>

              {/* Program badge */}
              <div className="flex flex-wrap gap-3 mb-8">
                <span
                  className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)]"
                  style={{ fontFamily: bodyFont }}
                >
                  {isAr ? step.programAr : step.programEn}
                </span>
                <span
                  className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-[var(--color-primary)] text-white"
                  style={{ fontFamily: bodyFont }}
                >
                  {isAr ? step.badgeAr : step.badgeEn}
                </span>
              </div>

              {/* Content */}
              <div
                className="space-y-5 text-[var(--color-neutral-700)] text-base md:text-lg leading-relaxed"
                style={{ fontFamily: bodyFont, lineHeight: '1.9' }}
              >
                {(isAr ? step.contentAr : step.contentEn).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ═══════════════════════════════════════
          SECTION 4 — YOUR NEXT STEP (CTA)
      ═══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        aria-label={isAr ? 'خطوتك القادمة' : 'Your Next Step'}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 60%, #0D0B1E 100%)' }}
        />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-accent)] mb-4">
            {isAr ? '٤' : '04'}
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[#FFF5E9] mb-6"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'خطوتك القادمة' : 'Your Next Step'}
          </h2>
          <p
            className="text-white/75 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ fontFamily: bodyFont }}
          >
            {isAr
              ? 'ابدأ باستكشاف البرامج المتاحة، أو تواصل مع فريق كُن لمساعدتك في اختيار المسار الأنسب لمرحلتك الحالية.'
              : 'Start by exploring available programs, or connect with the Kun team to help you choose the pathway that fits your current stage.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/${locale}/programs`}
              className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-full bg-[var(--color-accent)] text-[#1D1A3D] font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'استكشف البرامج' : 'Explore Programs'}
            </a>
            <a
              href={`/${locale}/coaching`}
              className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-full border border-white/40 text-white font-semibold text-sm transition-colors hover:border-white hover:bg-white/10"
              style={{ fontFamily: headingFont }}
            >
              {isAr ? 'تعرّف على الكوتشينج' : 'About Coaching'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
