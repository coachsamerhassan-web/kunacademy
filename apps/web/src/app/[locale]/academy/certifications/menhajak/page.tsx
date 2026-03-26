import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { Section } from '@kunacademy/ui/section';
import { cms } from '@kunacademy/cms';
import { getPricingRegion, getGeoPrice } from '@/lib/geo-pricing';

const PACKAGE_SLUGS = [
  'menhajak-training',
  'menhajak-organizational',
  'menhajak-leadership',
] as const;

const PATHWAYS: Record<string, { ar: string; en: string }[]> = {
  'menhajak-training': [
    { ar: 'مدخل التفكير الحسّي (STL0)', en: 'Somatic Thinking Intro (STL0)' },
    { ar: 'أساسيات كوتشينج الأفراد (STL1)', en: 'Individual Coaching Foundations (STL1)' },
    { ar: 'هويّتك (STL1.5)', en: 'Your Identity (STL1.5)' },
    { ar: 'كوتشينج المجموعات (STL3)', en: 'Group Coaching (STL3)' },
    { ar: '+ جلستان حصريتان لبناء منهجك التدريبي', en: '+ 2 exclusive sessions: Training Methodology' },
  ],
  'menhajak-organizational': [
    { ar: 'مدخل التفكير الحسّي (STL0)', en: 'Somatic Thinking Intro (STL0)' },
    { ar: 'أساسيات كوتشينج الأفراد (STL1)', en: 'Individual Coaching Foundations (STL1)' },
    { ar: 'هويّتك (STL1.5)', en: 'Your Identity (STL1.5)' },
    { ar: 'كوتشينج المؤسسات (STL4)', en: 'Organizational Coaching (STL4)' },
    { ar: '+ جلستان حصريتان للسياق المؤسسي', en: '+ 2 exclusive sessions: Organizational Context' },
  ],
  'menhajak-leadership': [
    { ar: 'مدخل التفكير الحسّي (STL0)', en: 'Somatic Thinking Intro (STL0)' },
    { ar: 'أساسيات كوتشينج الأفراد (STL1)', en: 'Individual Coaching Foundations (STL1)' },
    { ar: 'هويّتك (STL1.5)', en: 'Your Identity (STL1.5)' },
    { ar: 'كوتشينج المجموعات (STL3)', en: 'Group Coaching (STL3)' },
    { ar: '+ جلستان حصريتان للسياق القيادي', en: '+ 2 exclusive sessions: Leadership Context' },
  ],
};

const cardColors = [
  'var(--color-secondary)',
  'var(--color-primary)',
  'var(--color-accent)',
];

export default async function MenhajakPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  const allPrograms = await cms.getAllPrograms();
  const packages = PACKAGE_SLUGS
    .map((slug) => allPrograms.find((p) => p.slug === slug))
    .filter(Boolean);

  const region = await getPricingRegion();

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'باقات متكاملة' : 'Complete Packages'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'منهجك' : 'Menhajak'}
          </h1>
          <p className="mt-4 text-white/60 text-lg max-w-2xl mx-auto">
            {isAr
              ? 'ثلاث رحلات متكاملة من الصفر إلى التخصّص — اختر المسار الذي يناسب رؤيتك'
              : 'Three complete journeys from zero to specialization — choose the path that fits your vision'}
          </p>
        </div>
      </section>

      {/* Package Cards */}
      <Section variant="surface">
        <div className="grid md:grid-cols-3 gap-6 stagger-children">
          {packages.map((pkg, i) => {
            const price = getGeoPrice(
              region,
              pkg!.price_aed as number,
              pkg!.price_egp as number,
              pkg!.price_eur as number,
              pkg!.early_bird_price_aed as number,
            );
            const pathway = PATHWAYS[pkg!.slug] || [];

            return (
              <div
                key={pkg!.slug}
                className="rounded-2xl bg-white shadow-[0_4px_24px_rgba(71,64,153,0.06)] overflow-hidden flex flex-col"
              >
                {/* Card header */}
                <div
                  className="px-6 py-5 text-white text-center"
                  style={{ backgroundColor: cardColors[i] }}
                >
                  <h2
                    className="text-xl md:text-2xl font-bold"
                    style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                  >
                    {isAr ? pkg!.title_ar : pkg!.title_en}
                  </h2>
                  <p className="text-white/70 text-sm mt-1">{pkg!.duration}</p>
                </div>

                {/* Description */}
                <div className="px-6 pt-5 pb-3">
                  <p className="text-[var(--color-neutral-700)] text-sm leading-relaxed">
                    {isAr ? pkg!.description_ar : pkg!.description_en}
                  </p>
                </div>

                {/* Pathway */}
                <div className="px-6 pb-4 flex-1">
                  <h3 className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-3">
                    {isAr ? 'المسار' : 'Pathway'}
                  </h3>
                  <ul className="space-y-2">
                    {pathway.map((step, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span className="text-[var(--color-primary)] mt-0.5 shrink-0">
                          {j < pathway.length - 1 ? `${j + 1}.` : '★'}
                        </span>
                        <span className="text-[var(--color-neutral-600)]">
                          {isAr ? step.ar : step.en}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price + CTA */}
                <div className="px-6 py-5 border-t border-[var(--color-neutral-100)] text-center">
                  <p className="text-2xl font-bold text-[var(--text-accent)]">
                    {price.amount.toLocaleString()} <span className="text-sm font-normal">{price.currency}</span>
                  </p>
                  {price.earlyBird && price.earlyBird > 0 && (
                    <p className="text-[var(--color-primary)] text-sm mt-1">
                      {isAr ? 'حجز مبكر:' : 'Early bird:'} {price.earlyBird.toLocaleString()} {price.currency}
                    </p>
                  )}
                  <a
                    href={`/${locale}/checkout/?program=${pkg!.slug}`}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_16px_rgba(244,126,66,0.25)] w-full"
                  >
                    {isAr ? 'سجّل الآن' : 'Register Now'}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Why Packages */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'لماذا الباقة؟' : 'Why a Package?'}
          </h2>
          <div className="mt-8 grid md:grid-cols-3 gap-6 text-start">
            {[
              { ar: 'توفير مادي', en: 'Save Money', descAr: 'الباقة أوفر من التسجيل في كل مستوى على حدة', descEn: 'The package costs less than enrolling in each level separately' },
              { ar: 'مسار واضح', en: 'Clear Path', descAr: 'لا حيرة — المسار محدّد من البداية إلى التخصّص', descEn: 'No confusion — the path is defined from start to specialization' },
              { ar: 'جلسات حصرية', en: 'Exclusive Sessions', descAr: 'جلستان إضافيتان لا تتوفران خارج الباقة', descEn: '2 additional sessions not available outside the package' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl bg-[var(--color-primary-50)] p-5">
                <h3 className="font-bold text-[var(--color-primary)]">{isAr ? item.ar : item.en}</h3>
                <p className="mt-2 text-sm text-[var(--color-neutral-700)]">{isAr ? item.descAr : item.descEn}</p>
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
            {isAr ? 'لا تعرف أي باقة تناسبك؟' : "Not sure which package fits?"}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={`/${locale}/pathfinder/`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(244,126,66,0.35)]"
            >
              {isAr ? 'استخدم المُرشد' : 'Use the Pathfinder'}
            </a>
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
            >
              {isAr ? 'استشرنا' : 'Consult Us'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
