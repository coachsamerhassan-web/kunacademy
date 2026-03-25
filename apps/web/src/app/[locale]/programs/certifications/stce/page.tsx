import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Button } from '@kunacademy/ui/button';
import { FAQSection } from '@kunacademy/ui/faq-section';
import { faqJsonLd } from '@kunacademy/ui/faq-jsonld';
import { stceFaqs } from '@/data/faqs';
import { GeometricPattern } from '@kunacademy/ui/patterns';

const levels = {
  ar: [
    { num: 1, name: 'STIC', title: 'مقدمة في التفكير الحسّي', hours: 79, href: '/programs/certifications/stce/level-1', desc: 'الأساسيات والمهارات الجوهرية للكوتشينج الحسّي', icfLevel: 'ICF Level 1' },
    { num: 2, name: 'STAIC', title: 'التفكير الحسّي المتقدم', hours: 106, href: '/programs/certifications/stce/level-2', desc: 'التعمّق في منهجية التفكير الحسّي وأدواته المتقدمة', icfLevel: 'ICF Level 2' },
    { num: 3, name: 'STGC', title: 'كوتشينج المجموعات', hours: 34, href: '/programs/certifications/stce/level-3', desc: 'تيسير جلسات الكوتشينج الجماعي بمنهجية التفكير الحسّي', icfLevel: 'CCE' },
    { num: 4, name: 'STOC', title: 'الإشراف على الكوتشينج', hours: 37, href: '/programs/certifications/stce/level-4', desc: 'الإشراف والمنتورينج للكوتشز المتدربين', icfLevel: 'CCE' },
  ],
  en: [
    { num: 1, name: 'STIC', title: 'Somatic Thinking Introduction to Coaching', hours: 79, href: '/programs/certifications/stce/level-1', desc: 'Foundational skills in somatic coaching methodology', icfLevel: 'ICF Level 1' },
    { num: 2, name: 'STAIC', title: 'Somatic Thinking Advanced Integrated Coaching', hours: 106, href: '/programs/certifications/stce/level-2', desc: 'Deep dive into advanced Somatic Thinking tools and techniques', icfLevel: 'ICF Level 2' },
    { num: 3, name: 'STGC', title: 'Somatic Thinking Group Coaching', hours: 34, href: '/programs/certifications/stce/level-3', desc: 'Facilitating group coaching sessions using Somatic Thinking', icfLevel: 'CCE' },
    { num: 4, name: 'STOC', title: 'Somatic Thinking Oversight of Coaching', hours: 37, href: '/programs/certifications/stce/level-4', desc: 'Supervising and mentoring trainee coaches', icfLevel: 'CCE' },
  ],
};

const levelColors = [
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-primary)',
  'var(--color-primary-700)',
];

export default async function STCEPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';
  const items = isAr ? levels.ar : levels.en;
  const totalHours = items.reduce((sum, l) => sum + l.hours, 0);

  return (
    <main>
      {/* Hero with gradient + pattern */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}>
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
            {isAr ? 'الشهادة الرئيسية' : 'Flagship Certification'}
          </p>
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'شهادة التفكير الحسّي في الكوتشينج' : 'Somatic Thinking Coaching Education'}
          </h1>
          <p className="text-white/50 text-lg font-medium mt-2">STCE</p>
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-white/70 text-sm">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {isAr ? `${totalHours} ساعة` : `${totalHours} hours`}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              {isAr ? '٤ مستويات' : '4 Levels'}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              {isAr ? 'معتمد من ICF' : 'ICF Accredited'}
            </span>
          </div>
        </div>
      </section>

      {/* Levels grid with visual progression */}
      <Section variant="surface">
        <div className="text-center mb-12 animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'المستويات الأربعة' : 'The Four Levels'}
          </h2>
          <p className="mt-3 text-[var(--text-muted)] max-w-lg mx-auto">
            {isAr ? 'كل مستوى يبني على سابقه — من الأساسيات إلى الإتقان' : 'Each level builds upon the previous — from foundations to mastery'}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 stagger-children">
          {items.map((level, i) => (
            <a
              key={level.num}
              href={`/${locale}${level.href}`}
              className="group rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500 block"
            >
              <div className="flex items-start gap-4">
                {/* Level number with color accent */}
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white font-bold text-xl transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundColor: levelColors[i] }}
                >
                  {level.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg md:text-xl font-bold">{level.name}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                      {level.icfLevel}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--color-neutral-700)] mb-2">{level.title}</h4>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{level.desc}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-neutral-500)]">
                    <span>{level.hours} {isAr ? 'ساعة' : 'hours'}</span>
                    <span className="text-[var(--color-primary)] font-medium group-hover:underline">
                      {isAr ? 'التفاصيل' : 'Details'} →
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </Section>

      {/* Packages CTA */}
      <Section variant="surface-high" pattern="eight-star">
        <div className="text-center animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'الباقات' : 'Packages'}
          </h2>
          <p className="mt-4 text-[var(--color-neutral-700)] max-w-2xl mx-auto">
            {isAr
              ? 'وفّر أكثر مع باقاتنا المجمّعة — الباقة المهنية أو باقة الإتقان'
              : 'Save more with our bundled packages — Professional or Mastery'}
          </p>
          <a
            href={`/${locale}/programs/certifications/stce/packages/`}
            className="inline-flex items-center justify-center mt-6 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[44px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_16px_rgba(244,126,66,0.25)]"
          >
            {isAr ? 'استعرض الباقات' : 'View Packages'}
          </a>
        </div>
      </Section>

      {/* FAQ */}
      <Section variant="white">
        <div className="text-center mb-10">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h2>
        </div>
        <FAQSection items={stceFaqs} locale={locale} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(stceFaqs, locale)) }}
        />
      </Section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}>
        <GeometricPattern pattern="flower-of-life" opacity={0.06} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'ابدأ رحلتك في الكوتشينج الحسّي' : 'Begin Your Somatic Coaching Journey'}
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href={`/${locale}/pathfinder/`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(244,126,66,0.35)]">
              {isAr ? 'اختر مستواك' : 'Choose Your Level'}
            </a>
            <a href={`/${locale}/contact/`} className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300">
              {isAr ? 'تواصل معنا' : 'Contact Us'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
