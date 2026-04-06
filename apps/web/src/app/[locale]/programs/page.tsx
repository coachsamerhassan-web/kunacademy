import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { programsFaqs } from '@/data/faqs';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Metadata } from 'next';

const pathways = {
  ar: [
    { title: 'مجاني', desc: 'اكتشف منهجية التفكير الحسّي مع موارد مجانية', href: '/programs/free/', color: 'var(--color-secondary)', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { title: 'دورات قصيرة', desc: 'ورش عمل ودورات مكثفة لتطوير مهارات محددة', href: '/academy/courses/', color: 'var(--color-accent)', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { title: 'شهادات STCE', desc: 'شهادات معتمدة من ICF — ٥ مستويات من الأساسيات إلى الإتقان', href: '/academy/certifications/stce/', color: 'var(--color-primary)', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
    { title: 'حلول المؤسسات', desc: 'برامج مصمّمة خصيصًا للقادة والفرق والمؤسسات', href: '/programs/corporate/', color: 'var(--color-primary-700)', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { title: 'رحلات الإحياء', desc: 'تجارب حياة كاملة في أماكن اختيرت بعناية — مصر وإيطاليا', href: '/programs/retreats/', color: 'var(--color-secondary)', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { title: 'دورات مسجّلة', desc: 'تعلّم في وقتك — دورات قصيرة من التفكير الحسّي®', href: '/programs/micro-courses/', color: 'var(--color-accent)', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { title: 'الأسرة والشباب', desc: 'برامج SEEDS وويصال — للعائلات والشباب', href: '/programs/family/', color: 'var(--color-accent)', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { title: 'منصة الكوتشينج', desc: 'احجز جلسة كوتشينج مع كوتشز معتمدين', href: '/coaching/book/', color: 'var(--color-primary)', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  ],
  en: [
    { title: 'Free', desc: 'Discover Somatic Thinking with free resources', href: '/programs/free/', color: 'var(--color-secondary)', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { title: 'Short Courses', desc: 'Intensive workshops to develop specific skills', href: '/academy/courses/', color: 'var(--color-accent)', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { title: 'STCE Certifications', desc: 'ICF-accredited certifications — 5 levels from foundations to mastery', href: '/academy/certifications/stce/', color: 'var(--color-primary)', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
    { title: 'Corporate', desc: 'Programs designed for leaders, teams, and organizations', href: '/programs/corporate/', color: 'var(--color-primary-700)', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { title: 'Ihya Retreats', desc: 'Complete life experiences in carefully chosen locations — Egypt and Italy', href: '/programs/retreats/', color: 'var(--color-secondary)', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { title: 'Recorded Mini-Courses', desc: 'Learn at your pace — short courses from Somatic Thinking®', href: '/programs/micro-courses/', color: 'var(--color-accent)', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { title: 'Family & Youth', desc: 'SEEDS and Wisal programs for families and youth', href: '/programs/family/', color: 'var(--color-accent)', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { title: 'Coaching Platform', desc: 'Book a session with certified coaches', href: '/coaching/book/', color: 'var(--color-primary)', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  ],
};

interface Props { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'جميع البرامج | أكاديمية كُن' : 'All Programs | Kun Academy',
    description: isAr
      ? 'برامج كوتشينج وشهادات معتمدة من ICF وورش عمل في التفكير الحسّي® — من المجاني إلى الاحترافي'
      : 'Coaching programs, ICF-accredited certifications, and Somatic Thinking® workshops — from free to professional.',
  };
}

export default async function ProgramsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const items = isAr ? pathways.ar : pathways.en;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'برامجنا' : 'Our Programs'}
          </h1>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto text-lg md:text-xl">
            {isAr
              ? 'من الاكتشاف المجاني إلى الشهادات المعتمدة دوليًا — اختر المسار الذي يناسب رحلتك'
              : 'From free discovery to internationally accredited certifications — choose the path that fits your journey'}
          </p>
          <a
            href={`/${locale}/pathfinder/`}
            className="inline-flex items-center justify-center mt-8 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
          >
            {isAr ? 'اكتشف برنامجك المناسب' : 'Find Your Program'}
          </a>
        </div>
      </section>

      {/* Programs grid with icons */}
      <Section variant="surface">
        <div className="text-center mb-12 animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'مسارات التعلّم' : 'Learning Pathways'}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {items.map((item, i) => (
            <a
              key={i}
              href={`/${locale}${item.href}`}
              className="group rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500 block"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundColor: item.color + '15' }}
              >
                <svg className="w-6 h-6" style={{ color: item.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              </div>
              <h3 className="text-lg md:text-xl font-bold">{item.title}</h3>
              <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">{item.desc}</p>
              <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-[var(--color-primary)] group-hover:gap-2 transition-all duration-300">
                {isAr ? 'التفاصيل' : 'Learn more'}
                <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5" /></svg>
              </span>
            </a>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h2>
        </div>
        <FAQSection items={programsFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(programsFaqs, locale)) }}
        />
      </Section>

      {/* Academy Pathway Card */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto">
          <a href={`/${locale}/academy/`} className="group block">
            <div className="rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] group-hover:-translate-y-1 border border-[var(--color-primary)]/15 bg-[var(--color-primary-50)]">
              <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h2
                  className="text-xl font-bold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-2"
                  style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
                >
                  {isAr ? 'هل تريد أن تصبح كوتش معتمد؟' : 'Want to become a certified coach?'}
                </h2>
                <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed">
                  {isAr
                    ? 'اكتشف مسار الأكاديمية — من مدخل التفكير الحسّي إلى شهادات ICF المعتمدة'
                    : 'Explore the Academy pathway — from Somatic Thinking Intro to ICF-accredited certifications'}
                </p>
              </div>
              <svg className="w-5 h-5 text-[var(--color-primary)] rtl:rotate-180 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </div>
          </a>
        </div>
      </Section>

      {/* CTA */}
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}>
        <GeometricPattern pattern="eight-star" opacity={0.08} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'لا تعرف من أين تبدأ؟' : 'Not sure where to start?'}
          </h2>
          <p className="mt-4 text-white/60 max-w-xl mx-auto">
            {isAr
              ? 'أجب على بضعة أسئلة وسنرشدك إلى البرنامج المناسب لك'
              : 'Answer a few questions and we\'ll guide you to the right program'}
          </p>
          <a
            href={`/${locale}/pathfinder/`}
            className="inline-flex items-center justify-center mt-8 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
          >
            {isAr ? 'ابدأ اختبار تحديد المسار' : 'Take the Program Quiz'}
          </a>
        </div>
      </section>
    </main>
  );
}
