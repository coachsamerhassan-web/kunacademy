import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { courseJsonLd, breadcrumbJsonLd } from '@kunacademy/ui/structured-data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'منهجك المؤسسي — الباقة الشاملة للكوتشز المؤسسيين | أكاديمية كُن'
      : 'Organizational Methodology Package — Complete Path for Org Coaches | Kun Academy',
    description: isAr
      ? 'رحلة متكاملة 125 ساعة من STI إلى STOC مع جلستين حصريتين لتصميم برنامج مؤسسي'
      : 'Complete 125-hour journey from STI to STOC with 2 exclusive sessions to design an organizational program',
    alternates: {
      canonical: `/${locale}/academy/packages/organizational/`,
    },
  };
}

const JOURNEY = [
  {
    code: 'STI',
    nameAr: 'مدخل التفكير الحسّي',
    nameEn: 'Somatic Thinking Intro',
    hoursAr: '6 ساعات',
    hoursEn: '6 hrs',
    descAr: 'نقطة انطلاقك — تعرّف على أساسيات الإحساس الجسدي كأداة تفكير',
    descEn: 'Your starting point — discover bodily sensation as a thinking tool',
  },
  {
    code: 'STIC',
    nameAr: 'أساسيات الكوتشينج الفردي',
    nameEn: 'Individual Coaching Foundations',
    hoursAr: '69 ساعة',
    hoursEn: '69 hrs',
    descAr: 'القلب — بناء مهارات الكوتشينج الفردي كأساس للعمل المؤسسي',
    descEn: 'The core — building individual coaching skills as a foundation for organizational work',
  },
  {
    code: 'YPI',
    nameAr: 'هويّتك',
    nameEn: 'Your Identity',
    hoursAr: '10 ساعات',
    hoursEn: '10 hrs',
    descAr: 'توطيد هويّتك ككوتش مؤسسي — من تخدم وما الذي تقدّمه للمؤسسات؟',
    descEn: 'Consolidating your identity as an organizational coach — who do you serve and what do you offer organizations?',
  },
  {
    code: 'STOC',
    nameAr: 'كوتشينج المؤسسات',
    nameEn: 'Organizational Coaching',
    hoursAr: '36 ساعة',
    hoursEn: '36 hrs',
    descAr: 'التخصّص — تطبيق التفكير الحسّي في السياقات المؤسسية والفرق والتحوّل',
    descEn: 'Specialization — applying Somatic Thinking in organizational contexts, teams, and transformation',
  },
  {
    code: '★',
    nameAr: 'جلسة تصميم برنامج مؤسسي متكامل',
    nameEn: 'Integrated Organizational Program Design Session',
    hoursAr: 'حصرية',
    hoursEn: 'Exclusive',
    descAr: 'جلسة فردية مع سامر حسن لتصميم برنامجك المؤسسي الأول خطوة بخطوة',
    descEn: 'Individual session with Samer Hassan to design your first organizational program step by step',
    isExclusive: true,
  },
  {
    code: '★',
    nameAr: 'جلسة مراجعة وإشراف على التطبيق',
    nameEn: 'Review & Application Supervision Session',
    hoursAr: 'حصرية',
    hoursEn: 'Exclusive',
    descAr: 'متابعة تطبيقك المؤسسي الأول مع ملاحظات وإرشادات مباشرة من مرشد كُن',
    descEn: 'Follow-up on your first organizational application with direct feedback from a Kun guide',
    isExclusive: true,
  },
];

const PERSONAS = [
  {
    ar: 'كوتش يعمل مع فرق ومؤسسات ويريد تعميق أسلوبه',
    en: 'A coach working with teams and organizations wanting to deepen their approach',
  },
  {
    ar: 'مدير موارد بشرية أو تطوير يريد الارتقاء بأدواره وتأثيره',
    en: 'An HR or L&D manager wanting to elevate their role and impact',
  },
  {
    ar: 'استشاري يريد إضافة الكوتشينج المؤسسي إلى خدماته',
    en: 'A consultant wanting to add organizational coaching to their services',
  },
  {
    ar: 'مسؤول تطوير مؤسسي يسعى لمنهجية أكثر عمقًا وإنسانية',
    en: 'An organizational development professional seeking a deeper, more human methodology',
  },
];

const FAQS = [
  {
    qAr: 'هل يمكنني الالتحاق بالباقة إذا لم تكن لدي خبرة مؤسسية سابقة؟',
    qEn: 'Can I join the package with no prior organizational experience?',
    aAr: 'نعم — الباقة تبدأ من الصفر مع STI ثم تبني القدرات تدريجيًا حتى التخصّص المؤسسي.',
    aEn: 'Yes — the package starts from zero with STI, then builds capabilities gradually up to organizational specialization.',
  },
  {
    qAr: 'ما الفرق بين هذه الباقة وباقة القيادة؟',
    qEn: 'What is the difference between this package and the Leadership package?',
    aAr: 'باقة المؤسسات تنتهي بـ STOC (كوتشينج المؤسسات) وتركّز على العمل مع الفرق والأنظمة. باقة القيادة تنتهي بـ STGC وتركّز على التحوّل القيادي للأفراد.',
    aEn: 'The Organizational package ends with STOC and focuses on working with teams and systems. The Leadership package ends with STGC and focuses on individual leadership transformation.',
  },
  {
    qAr: 'هل يمكن إتمام الباقة على مراحل؟',
    qEn: 'Can I complete the package in stages?',
    aAr: 'نعم — المستويات تُنجز تتابعيًا وكل مستوى له جدوله المستقل. المرشد يساعدك في تنسيق الجدول الأنسب.',
    aEn: 'Yes — levels are completed sequentially, each with its own schedule. A Kun guide helps coordinate the best timeline for you.',
  },
  {
    qAr: 'ما الشهادة التي أحصل عليها عند إتمام الباقة؟',
    qEn: 'What certification do I receive upon completion?',
    aAr: 'تحصل على شهادة STL4 (تخصّص كوتشينج المؤسسات) من أكاديمية كُن المعتمدة من ICF.',
    aEn: 'You receive the STL4 (Organizational Coaching Specialization) certificate from Kun Academy, ICF-accredited.',
  },
];

export default async function OrganizationalPackagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(courseJsonLd({
            locale,
            name: isAr ? 'منهجك المؤسسي — الباقة الشاملة' : 'Organizational Methodology — Complete Package',
            description: isAr
              ? 'رحلة متكاملة 125 ساعة للكوتشز المؤسسيين ومتخصصي الموارد البشرية'
              : 'Complete 125-hour journey for organizational coaches and HR professionals',
            slug: 'academy/packages/organizational',
            hours: 125,
          })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(locale, [
            { name: isAr ? 'الرئيسية' : 'Home', path: '' },
            { name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' },
            { name: isAr ? 'الباقات' : 'Packages', path: '/academy/packages' },
            { name: isAr ? 'منهجك المؤسسي' : 'Organizational Methodology', path: '/academy/packages/organizational' },
          ])),
        }}
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'باقة منهجك' : 'Menhajak Package'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'منهجك المؤسسي' : 'Organizational Methodology'}
          </h1>
          <p className="mt-4 text-white/60 text-lg max-w-2xl mx-auto">
            {isAr
              ? 'رحلة متكاملة 125 ساعة من الصفر إلى التخصّص في الكوتشينج المؤسسي'
              : 'A complete 125-hour journey from zero to specialization in organizational coaching'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--color-accent-200)]">◆</span>
              {isAr ? '125 ساعة تعليمية' : '125 learning hours'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--color-accent-200)]">◆</span>
              {isAr ? '4 مستويات + جلستان حصريتان' : '4 levels + 2 exclusive sessions'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[var(--color-accent-200)]">◆</span>
              {isAr ? 'شهادة STL4' : 'STL4 Certificate'}
            </span>
          </div>
          <div className="mt-8">
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'تحدّث مع مرشد كُن' : 'Talk to a Kun Guide'}
            </a>
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] text-center mb-10"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'رحلتك خطوة بخطوة' : 'Your Journey Step by Step'}
          </h2>
          <div className="relative">
            <div className="absolute start-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--color-primary)] via-[var(--color-primary-500)] to-[var(--color-accent)] opacity-30" />
            <div className="space-y-6">
              {JOURNEY.map((step, i) => (
                <div key={i} className="relative flex gap-6 items-start">
                  <div
                    className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${step.isExclusive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-primary)]'}`}
                  >
                    {step.code}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3
                        className="font-bold text-[var(--color-neutral-900)]"
                        style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                      >
                        {isAr ? step.nameAr : step.nameEn}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.isExclusive ? 'bg-[var(--color-accent-50)] text-[var(--color-accent)]' : 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'}`}>
                        {isAr ? step.hoursAr : step.hoursEn}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-neutral-600)]">
                      {isAr ? step.descAr : step.descEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* What's Included */}
      <Section variant="surface">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] text-center mb-10"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ماذا يشمل منهجك المؤسسي؟' : "What's Included in Organizational Methodology?"}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { ar: '125 ساعة تعليمية عبر 4 مستويات متكاملة (121 تدريب + 4 إرشاد)', en: '125 learning hours across 4 integrated levels (121 training + 4 mentoring)' },
              { ar: 'جلسة تصميم برنامج مؤسسي متكامل (حصرية)', en: 'Integrated organizational program design session (exclusive)' },
              { ar: 'جلسة مراجعة وإشراف على التطبيق (حصرية)', en: 'Review & application supervision session (exclusive)' },
              { ar: 'شهادة STL4 — تخصّص كوتشينج المؤسسات', en: 'STL4 Certificate — Organizational Coaching Specialization' },
              { ar: 'الانضمام لمجتمع كوتشز كُن الخرّيجين', en: 'Access to Kun Coaches alumni community' },
              { ar: 'مواد التعلّم الرقمية لكل مستوى', en: 'Digital learning materials for each level' },
              { ar: 'أولوية التسجيل في المجموعات القادمة', en: 'Priority enrollment in upcoming cohorts' },
              { ar: 'دعم مستمر بين المستويات من فريق كُن', en: 'Ongoing support between levels from the Kun team' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_2px_8px_rgba(71,64,153,0.04)]">
                <span className="text-[var(--color-primary)] mt-0.5 shrink-0 text-lg">✓</span>
                <span className="text-sm text-[var(--color-neutral-700)]">
                  {isAr ? item.ar : item.en}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Exclusive Sessions Highlight */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] text-center mb-10"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'الجلسات الحصرية — ما لا تجده في أي مستوى منفرد' : 'Exclusive Sessions — What You Won\'t Find Elsewhere'}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                titleAr: 'جلسة تصميم برنامج مؤسسي متكامل',
                titleEn: 'Integrated Organizational Program Design',
                descAr: 'جلسة فردية مع سامر حسن لتصميم برنامجك المؤسسي الأول — الأهداف، الهيكل، الأدوات، والتسليم.',
                descEn: 'A one-on-one session with Samer Hassan to design your first organizational program — objectives, structure, tools, and delivery.',
              },
              {
                titleAr: 'جلسة مراجعة وإشراف على التطبيق',
                titleEn: 'Review & Application Supervision',
                descAr: 'بعد تطبيقك المؤسسي الأول، مرشد كُن يراجع معك التجربة بالتفصيل ويقدّم ملاحظات مباشرة لتطوير أدائك.',
                descEn: 'After your first organizational application, a Kun guide reviews the experience in detail and provides direct feedback to develop your performance.',
              },
            ].map((session, i) => (
              <div
                key={i}
                className="rounded-2xl border-2 border-[var(--color-accent-200)] bg-[var(--color-accent-50)] p-6"
              >
                <span className="text-2xl mb-3 block">★</span>
                <h3
                  className="font-bold text-[var(--color-accent-700)] mb-2"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? session.titleAr : session.titleEn}
                </h3>
                <p className="text-sm text-[var(--color-neutral-700)] leading-relaxed">
                  {isAr ? session.descAr : session.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* This Package Is For You If */}
      <Section variant="surface">
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] mb-10"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'هذه الباقة لك إذا...' : 'This Package Is For You If...'}
          </h2>
          <div className="space-y-4 text-start">
            {PERSONAS.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_2px_8px_rgba(71,64,153,0.04)]">
                <span className="text-[var(--color-primary)] text-xl shrink-0 mt-0.5">◈</span>
                <span className="text-[var(--color-neutral-700)]">{isAr ? item.ar : item.en}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section variant="white">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] text-center mb-10"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h2>
          <div className="space-y-5">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-[var(--color-neutral-200)] p-5">
                <h3 className="font-semibold text-[var(--color-neutral-900)] mb-2">
                  {isAr ? faq.qAr : faq.qEn}
                </h3>
                <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                  {isAr ? faq.aAr : faq.aEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section
        className="relative overflow-hidden py-16 md:py-20"
        style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-white"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ابدأ رحلتك اليوم' : 'Start Your Journey Today'}
          </h2>
          <p className="mt-4 text-white/60 max-w-lg mx-auto">
            {isAr
              ? 'تحدّث مع مرشد كُن لمعرفة التواريخ المتاحة ووضع خطة رحلتك'
              : 'Talk to a Kun guide to learn available dates and plan your journey'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
            >
              {isAr ? 'تحدّث مع مرشد كُن' : 'Talk to a Kun Guide'}
            </a>
            <a
              href={`/${locale}/academy/packages/`}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
            >
              {isAr ? 'قارن الباقات الأخرى' : 'Compare Other Packages'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
