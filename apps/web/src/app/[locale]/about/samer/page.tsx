import { setRequestLocale } from 'next-intl/server';
import { Section } from '@kunacademy/ui/section';
import { Button } from '@kunacademy/ui/button';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export default async function FounderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === 'ar';

  return (
    <main>
      {/* Hero — Split layout with founder photo */}
      <section className="relative overflow-hidden min-h-[60vh] flex items-center">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-background)] via-[var(--color-background)] to-transparent md:w-[55%]" style={{ zIndex: 1 }} />
          <div className="absolute inset-y-0 end-0 w-full md:w-[60%]">
            <img
              src="/images/founder/samer-navy-headshot.png"
              alt={isAr ? 'سامر حسن' : 'Samer Hassan'}
              className="w-full h-full object-cover object-top"
              style={{ filter: 'brightness(0.95)' }}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-background)] via-[var(--color-background)]/60 to-transparent rtl:bg-gradient-to-l" />
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 w-full py-20">
          <div className="max-w-xl">
            <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent)] mb-4">
              {isAr ? 'المؤسس' : 'The Founder'}
            </p>
            <h1
              className="text-[2.25rem] md:text-[3.5rem] font-bold leading-tight text-[var(--text-primary)]"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'سامر حسن' : 'Samer Hassan'}
            </h1>
            <p className="mt-2 text-[var(--color-accent)] font-medium text-lg md:text-xl">
              {isAr
                ? 'أول عربي MCC | مؤسس التفكير الحسّي® | حائز جائزة ICF Young Leader 2019'
                : 'First Arab MCC | Founder of Somatic Thinking® | ICF Young Leader Award 2019'}
            </p>
            <p className="mt-6 text-[var(--color-neutral-700)] leading-relaxed max-w-lg">
              {isAr
                ? 'كوتش وميسّر ومدرّب كوتشز. أكثر من ١٠,٠٠٠ جلسة كوتشينج شخصية. إيطالي-مصري مقيم في دبي. أسس أكاديمية كُن ليجسّر بين الوعي الجسدي والتراث العربي الإسلامي.'
                : 'Coach, facilitator, and coach trainer. Over 10,000 personal coaching sessions. Italian-Egyptian based in Dubai. Founded Kun Academy to bridge somatic awareness with Arab-Islamic heritage.'}
            </p>
          </div>
        </div>
      </section>

      {/* Credentials band */}
      <section className="py-10 md:py-12" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)' }}>
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 text-white">
            {[
              { topAr: 'MCC', topEn: 'MCC', bottomAr: 'أول عربي — ICF', bottomEn: 'First Arab — ICF' },
              { topAr: '٢٠١٩', topEn: '2019', bottomAr: 'ICF Young Leader', bottomEn: 'ICF Young Leader' },
              { topAr: '٥٠٠+', topEn: '500+', bottomAr: 'كوتش تخرّجوا', bottomEn: 'Coaches Graduated' },
              { topAr: '١٠,٠٠٠+', topEn: '10,000+', bottomAr: 'جلسة كوتشينج', bottomEn: 'Coaching Sessions' },
              { topAr: '٤', topEn: '4', bottomAr: 'قارات', bottomEn: 'Continents' },
            ].map((stat) => (
              <div key={stat.bottomEn} className="text-center">
                <p className="text-2xl md:text-3xl font-bold">{isAr ? stat.topAr : stat.topEn}</p>
                <p className="text-xs text-white/65 mt-0.5">{isAr ? stat.bottomAr : stat.bottomEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
            {isAr ? 'القصة' : 'The Story'}
          </h2>
          <p className="text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'بدأت رحلتي مع الكوتشينج عام 2009 في إيطاليا. سرعان ما أدركت أن المنهجيات الغربية — رغم قوتها — تفتقر إلى بُعد جوهري: الجسد كمصدر للمعرفة. من هنا وُلد التفكير الحسّي® — منهجية تجمع بين العلم المعاصر والتراث العربي الإسلامي.'
              : 'My coaching journey began in 2009 in Italy. I quickly realized that Western methodologies — powerful as they are — were missing a fundamental dimension: the body as a source of knowledge. That\'s where Somatic Thinking® was born — a methodology that bridges contemporary science with Arab-Islamic heritage.'}
          </p>
          <p className="text-[var(--color-neutral-700)] leading-relaxed">
            {isAr
              ? 'أسست أكاديمية كُن عام 2014 لأنشر هذه المنهجية. اليوم، تخرّج أكثر من 500 كوتش من الأكاديمية عبر 4 قارات و3 لغات. حصلت على لقب Master Certified Coach (MCC) من ICF — أول عربي يحمل هذا اللقب.'
              : 'I founded Kun Academy in 2014 to spread this methodology. Today, over 500 coaches have graduated from the academy across 4 continents in 3 languages. I earned the Master Certified Coach (MCC) credential from ICF — the first Arab to hold this title.'}
          </p>
        </div>
      </Section>

      {/* Artistic portrait section */}
      <Section variant="surface-high">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-14">
          <div className="relative shrink-0">
            <div className="w-64 h-80 rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(71,64,153,0.12)]">
              <img
                src="/images/founder/samer-portrait-artistic.png"
                alt={isAr ? 'سامر حسن — بورتريه فني' : 'Samer Hassan — Artistic Portrait'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)]">
              {isAr ? 'التفكير الحسّي®' : 'Somatic Thinking®'}
            </h2>
            <p className="mt-4 text-[var(--color-neutral-700)] leading-relaxed">
              {isAr
                ? 'ليس مجرد أسلوب كوتشينج، بل منظومة متكاملة تبدأ من الإشارات الحسّية الجسدية. حين تستمع لجسدك، تسمع ما لا يقوله عقلك. هذه المعرفة الجسدية هي أساس كل تحوّل حقيقي.'
                : 'Not just a coaching style, but a complete framework that begins with somatic body signals. When you listen to your body, you hear what your mind doesn\'t say. This somatic knowledge is the foundation of every real transformation.'}
            </p>
            <a
              href={`/${locale}/methodology/`}
              className="inline-flex items-center gap-2 mt-6 text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-600)] transition-colors duration-300 group"
            >
              {isAr ? 'اكتشف المنهجية' : 'Discover the Methodology'}
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </a>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20" style={{ background: 'linear-gradient(160deg, var(--color-primary-800) 0%, var(--color-primary-900) 100%)' }}>
        <GeometricPattern pattern="eight-star" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-white" style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}>
            {isAr ? 'هل أنت مستعد للتعلّم من سامر مباشرة؟' : 'Ready to learn from Samer directly?'}
          </h2>
          <p className="mt-4 text-white/60 max-w-lg mx-auto">
            {isAr ? 'جلسات كوتشينج فردية وبرامج إرشاد MCC للكوتشز المتقدمين' : 'Individual coaching sessions and MCC mentoring for advanced coaches'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a href={`/${locale}/book/`} className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(244,126,66,0.35)]">
              {isAr ? 'احجز جلسة' : 'Book a Session'}
            </a>
            <a href={`/${locale}/contact/`} className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300">
              {isAr ? 'تواصل' : 'Contact'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
