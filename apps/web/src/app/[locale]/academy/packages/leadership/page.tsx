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
      ? 'منهجك القيادي — الباقة الشاملة للقادة والمديرين | أكاديمية كُن'
      : 'Leadership Methodology Package — Complete Path for Leaders & Executives | Kun Academy',
    description: isAr
      ? 'رحلة متكاملة +125 ساعة من STI إلى STGC مع جلستين حصريتين لبناء النموذج القيادي الشخصي'
      : 'Complete 125+ hour journey from STI to STGC with 2 exclusive sessions to build your personal leadership model',
    alternates: {
      canonical: `/${locale}/academy/packages/leadership/`,
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
    descAr: 'نقطة انطلاقك — استكشاف الجسد كأداة قيادية قبل أي قرار أو حوار',
    descEn: 'Your starting point — exploring the body as a leadership tool before any decision or dialogue',
  },
  {
    code: 'STIC',
    nameAr: 'أساسيات الكوتشينج الفردي',
    nameEn: 'Individual Coaching Foundations',
    hoursAr: '69 ساعة',
    hoursEn: '69 hrs',
    descAr: 'القلب — بناء حضورك القيادي ومهارات الإنصات والحوار على أسس التفكير الحسّي',
    descEn: 'The core — building your leadership presence and listening and dialogue skills on Somatic Thinking foundations',
  },
  {
    code: 'YPI',
    nameAr: 'هويّتك',
    nameEn: 'Your Identity',
    hoursAr: '10 ساعات',
    hoursEn: '10 hrs',
    descAr: 'توطيد هويّتك القيادية — من أنت كقائد وما القيم التي تحكم قراراتك؟',
    descEn: 'Consolidating your leadership identity — who are you as a leader and what values govern your decisions?',
  },
  {
    code: 'STGC',
    nameAr: 'كوتشينج المجموعات',
    nameEn: 'Group Coaching',
    hoursAr: '40 ساعة',
    hoursEn: '40 hrs',
    descAr: 'التخصّص — قيادة الفرق بأسلوب التفكير الحسّي في جلسات وحوارات جماعية',
    descEn: 'Specialization — leading teams using Somatic Thinking in group sessions and dialogues',
  },
  {
    code: '★',
    nameAr: 'جلسة بناء النموذج القيادي الشخصي',
    nameEn: 'Personal Leadership Model Building Session',
    hoursAr: 'حصرية',
    hoursEn: 'Exclusive',
    descAr: 'جلسة فردية مع سامر حسن لتصميم نموذجك القيادي الخاص — القيم، المبادئ، الأسلوب',
    descEn: 'Individual session with Samer Hassan to design your personal leadership model — values, principles, style',
    isExclusive: true,
  },
  {
    code: '★',
    nameAr: 'جلسة مراجعة وإشراف على التطبيق',
    nameEn: 'Review & Application Supervision Session',
    hoursAr: 'حصرية',
    hoursEn: 'Exclusive',
    descAr: 'متابعة تطبيقك القيادي الأول مع ملاحظات وإرشادات مباشرة من مرشد كُن',
    descEn: 'Follow-up on your first leadership application with direct feedback from a Kun guide',
    isExclusive: true,
  },
];

const PERSONAS = [
  {
    ar: 'قائد أو مدير عام يريد تحوّلًا حقيقيًا في أسلوبه القيادي',
    en: 'A leader or GM wanting real transformation in their leadership style',
  },
  {
    ar: 'كوتش يعمل مع القادة ويريد تعميق أثره في جلساته',
    en: 'A coach working with leaders wanting to deepen their impact in sessions',
  },
  {
    ar: 'مسؤول تنفيذي يسعى لقيادة فريقه بأسلوب أكثر إنسانية وعمقًا',
    en: 'An executive wanting to lead their team with a more human and deeper approach',
  },
  {
    ar: 'شخص في منتصف مسيرته يريد إعادة تعريف هويّته القيادية',
    en: 'A mid-career professional wanting to redefine their leadership identity',
  },
];

const FAQS = [
  {
    qAr: 'هل الباقة مناسبة لمن لم يدرس الكوتشينج من قبل؟',
    qEn: 'Is this package suitable for someone who has never studied coaching?',
    aAr: 'نعم — الباقة تبدأ من STI (مدخل التفكير الحسّي) الذي لا يشترط أي خلفية كوتشينج.',
    aEn: 'Yes — the package starts with STI (Somatic Thinking Intro) which requires no coaching background.',
  },
  {
    qAr: 'ما الفرق بين هذه الباقة وباقة التدريب؟',
    qEn: 'What is the difference between this package and the Training package?',
    aAr: 'الباقتان تتشاركان المسار الأساسي نفسه وينتهيان بـ STGC، لكن تختلفان في التوجّه: هنا التركيز على التحوّل القيادي الشخصي وبناء نموذج قيادي، بينما التدريب يركّز على بناء المنهج التدريبي المهني.',
    aEn: 'Both packages share the same core path and end with STGC, but differ in orientation: here the focus is on personal leadership transformation and building a leadership model, while Training focuses on building a professional training methodology.',
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
    aAr: 'تحصل على شهادة STL3 (تخصّص كوتشينج المجموعات) من أكاديمية كُن المعتمدة من ICF.',
    aEn: 'You receive the STL3 (Group Coaching Specialization) certificate from Kun Academy, ICF-accredited.',
  },
];

export default async function LeadershipPackagePage({ params }: { params: Promise<{ locale: string }> }) {
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
            name: isAr ? 'منهجك القيادي — الباقة الشاملة' : 'Leadership Methodology — Complete Package',
            description: isAr
              ? 'رحلة متكاملة +125 ساعة للقادة والمديرين العامّين يريدون تحوّلًا قياديًا حقيقيًا'
              : 'Complete 125+ hour journey for leaders and GMs seeking real leadership transformation',
            slug: 'academy/packages/leadership',
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
            { name: isAr ? 'منهجك القيادي' : 'Leadership Methodology', path: '/academy/packages/leadership' },
          ])),
        }}
      />

      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #7a2900 100%)' }}
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
            {isAr ? 'منهجك القيادي' : 'Leadership Methodology'}
          </h1>
          <p className="mt-4 text-white/60 text-lg max-w-2xl mx-auto">
            {isAr
              ? 'رحلة متكاملة +125 ساعة من الصفر إلى بناء نموذجك القيادي الشخصي'
              : 'A complete 125+ hour journey from zero to building your personal leadership model'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="text-white/50">◆</span>
              {isAr ? '+125 ساعة تعليمية' : '125+ learning hours'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-white/50">◆</span>
              {isAr ? '4 مستويات + جلستان حصريتان' : '4 levels + 2 exclusive sessions'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-white/50">◆</span>
              {isAr ? 'شهادة STL3' : 'STL3 Certificate'}
            </span>
          </div>
          <div className="mt-8">
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[var(--color-accent)] min-h-[52px] hover:bg-white/90 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
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
            <div className="absolute start-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--color-accent)] via-[var(--color-accent-400)] to-[var(--color-primary)] opacity-30" />
            <div className="space-y-6">
              {JOURNEY.map((step, i) => (
                <div key={i} className="relative flex gap-6 items-start">
                  <div
                    className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${step.isExclusive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-accent)]'}`}
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.isExclusive ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'bg-[var(--color-accent-50)] text-[var(--color-accent)]'}`}>
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
            {isAr ? 'ماذا يشمل منهجك القيادي؟' : "What's Included in Leadership Methodology?"}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { ar: '+125 ساعة تعليمية عبر 4 مستويات متكاملة', en: '125+ learning hours across 4 integrated levels' },
              { ar: 'جلسة بناء النموذج القيادي الشخصي (حصرية)', en: 'Personal leadership model building session (exclusive)' },
              { ar: 'جلسة مراجعة وإشراف على التطبيق (حصرية)', en: 'Review & application supervision session (exclusive)' },
              { ar: 'شهادة STL3 — تخصّص كوتشينج المجموعات', en: 'STL3 Certificate — Group Coaching Specialization' },
              { ar: 'الانضمام لمجتمع كوتشز كُن الخرّيجين', en: 'Access to Kun Coaches alumni community' },
              { ar: 'مواد التعلّم الرقمية لكل مستوى', en: 'Digital learning materials for each level' },
              { ar: 'أولوية التسجيل في المجموعات القادمة', en: 'Priority enrollment in upcoming cohorts' },
              { ar: 'دعم مستمر بين المستويات من فريق كُن', en: 'Ongoing support between levels from the Kun team' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-[0_2px_8px_rgba(71,64,153,0.04)]">
                <span className="text-[var(--color-accent)] mt-0.5 shrink-0 text-lg">✓</span>
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
                titleAr: 'جلسة بناء النموذج القيادي الشخصي',
                titleEn: 'Personal Leadership Model Building',
                descAr: 'جلسة فردية مع سامر حسن تحوّل تجربتك القيادية إلى نموذج واضح — قيمك، أسلوبك، وطريقتك في التأثير.',
                descEn: 'A one-on-one session with Samer Hassan transforming your leadership experience into a clear model — your values, style, and way of influencing.',
              },
              {
                titleAr: 'جلسة مراجعة وإشراف على التطبيق',
                titleEn: 'Review & Application Supervision',
                descAr: 'بعد تطبيقك القيادي الأول، مرشد كُن يراجع معك التجربة بالتفصيل ويقدّم ملاحظات مباشرة لتعميق أثرك.',
                descEn: 'After your first leadership application, a Kun guide reviews the experience in detail and provides direct feedback to deepen your impact.',
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
                <span className="text-[var(--color-accent)] text-xl shrink-0 mt-0.5">◈</span>
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
        style={{ background: 'linear-gradient(160deg, var(--color-accent-700) 0%, #3d1500 100%)' }}
      >
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-white"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ابدأ رحلتك القيادية اليوم' : 'Start Your Leadership Journey Today'}
          </h2>
          <p className="mt-4 text-white/60 max-w-lg mx-auto">
            {isAr
              ? 'تحدّث مع مرشد كُن لمعرفة التواريخ المتاحة ووضع خطة رحلتك القيادية'
              : 'Talk to a Kun guide to learn available dates and plan your leadership journey'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[var(--color-accent)] min-h-[52px] hover:bg-white/90 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
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
