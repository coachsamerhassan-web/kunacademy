import { setRequestLocale } from 'next-intl/server';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';
import Link from 'next/link';

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'المُرشد | أكاديمية كُن' : 'Pathfinder | Kun Academy',
    description: isAr
      ? 'اكتشف المسار الأنسب لك في أكاديمية كُن — أجب على أسئلة بسيطة واحصل على خارطة طريق مخصصة'
      : 'Discover your ideal path at Kun Academy — answer a few questions and get a personalized roadmap',
  };
}

const benefits = [
  { iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', titleAr: 'توصيات مخصصة', titleEn: 'Personalized Recommendations', descAr: 'بناءً على احتياجاتك الفعلية', descEn: 'Based on your actual needs' },
  { iconPath: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', titleAr: 'خارطة طريق واضحة', titleEn: 'Clear Roadmap', descAr: 'مع معالم قابلة للقياس', descEn: 'With measurable milestones' },
  { iconPath: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', titleAr: 'تقرير قابل للتحميل', titleEn: 'Downloadable Report', descAr: 'احتفظ بالنتائج وشاركها', descEn: 'Keep and share your results' },
];

export default async function PathfinderPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #1D1A3D 100%)' }} />
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-[var(--color-accent)] font-medium text-sm uppercase tracking-wider mb-4">
            {isAr ? 'المُرشد' : 'Pathfinder'}
          </p>
          <h1
            className="text-[2.5rem] md:text-[4rem] font-bold text-[#FFF5E9] leading-[1.05]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'لا تختار بعد — خلّنا نفهمك أولاً' : "Don't Choose Yet — Let Us Understand You First"}
          </h1>
          <p className="mt-6 text-white/70 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {isAr
              ? 'في دقائق معدودة، سنتعرّف على وضعك الحالي وأهدافك، ونُعدّ لك خارطة طريق شخصية مع توصيات مبنية على خبرتنا في تدريب أكثر من ٥٠٠ كوتش'
              : "In just a few minutes, we'll learn about your current situation and goals, then prepare a personalized roadmap built on our experience training 500+ coaches"}
          </p>

          <Link
            href={`/${locale}/pathfinder/assess`}
            className="mt-10 inline-flex items-center justify-center rounded-2xl px-10 py-4 text-lg font-bold text-white min-h-[56px] transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_32px_rgba(228,96,30,0.3)]"
            style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #C44D12 100%)' }}
          >
            {isAr ? 'ابدأ رحلتك الآن' : 'Start Your Journey Now'}
            <svg className="w-5 h-5 ms-2 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>

          <p className="mt-4 text-white/40 text-sm">
            {isAr ? 'مجاني • ٣ دقائق • بدون تسجيل' : 'Free • 3 minutes • No signup required'}
          </p>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-16 md:py-24 bg-[#FFF5E9]">
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <h2
            className="text-2xl md:text-3xl font-bold text-center text-[var(--text-primary)] mb-12"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'ماذا ستحصل عليه؟' : 'What Will You Get?'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {benefits.map((b, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-primary-50)' }}>
                  <svg className="w-7 h-7 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={b.iconPath} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                  {isAr ? b.titleAr : b.titleEn}
                </h3>
                <p className="text-sm text-[var(--color-neutral-600)]">
                  {isAr ? b.descAr : b.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Still Unsure */}
      <section className="py-12 bg-white">
        <div className="text-center">
          <p className="text-[var(--color-neutral-600)] mb-4">
            {isAr ? 'تفضّل تتكلّم مع شخص؟' : 'Prefer to talk to someone?'}
          </p>
          <a
            href="https://wa.me/971501234567"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white min-h-[48px] hover:bg-green-700 transition-all duration-300"
          >
            {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
          </a>
        </div>
      </section>
    </main>
  );
}
