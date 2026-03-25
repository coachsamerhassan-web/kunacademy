'use client';

interface FounderSectionProps {
  locale: string;
}

export function FounderSection({ locale }: FounderSectionProps) {
  const isAr = locale === 'ar';

  return (
    <section className="relative overflow-hidden py-[var(--section-padding-mobile)] md:py-[var(--section-padding)] bg-[var(--color-surface-low)]">
      <div className="relative mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-14">
          {/* Photo with geometric backdrop */}
          <div className="relative shrink-0">
            {/* Geometric accent */}
            <div
              className="absolute -inset-6 opacity-[0.04] rounded-3xl"
              style={{
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><path d='M40 0l11.18 28.82L80 40 51.18 51.18 40 80 28.82 51.18 0 40l28.82-11.18z' fill='#474099'/></svg>")}")`,
                backgroundSize: '40px 40px',
              }}
              aria-hidden="true"
            />
            {/* Arch-shaped photo */}
            <div
              className="relative w-52 h-64 md:w-60 md:h-72 overflow-hidden shadow-[0_12px_40px_rgba(71,64,153,0.15)] rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-700)] p-1"
            >
              <div className="w-full h-full rounded-xl overflow-hidden">
              <img
                src="/images/founder/samer-stage-icf-authority.jpg"
                alt={isAr ? 'سامر حسن' : 'Samer Hassan'}
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
              </div>
            </div>
            {/* Floating credential badge */}
            <div className="absolute -bottom-2 -end-4 bg-white rounded-xl px-4 py-2 shadow-[0_4px_20px_rgba(71,64,153,0.12)] animate-float" style={{ animationDelay: '1s' }}>
              <p className="text-xs font-bold text-[var(--color-primary)]">ICF MCC</p>
              <p className="text-[10px] text-[var(--color-neutral-500)]">{isAr ? 'أول عربي' : 'First Arab'}</p>
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 text-center md:text-start">
            <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[#2C2C2D]">
              {isAr ? 'سامر حسن' : 'Samer Hassan'}
            </h2>
            <p className="text-[var(--color-accent)] font-medium mt-1.5 text-lg md:text-xl">
              {isAr ? 'مؤسس التفكير الحسّي® | أول عربي MCC' : 'Founder of Somatic Thinking® | First Arab MCC'}
            </p>
            <p className="mt-5 text-[var(--color-neutral-700)] leading-relaxed max-w-xl">
              {isAr
                ? 'أكثر من ١٠,٠٠٠ جلسة كوتشينج شخصية. ٥٠٠+ كوتش تخرّجوا من أكاديمية كُن عبر ٤ قارات. حائز على جائزة ICF Young Leader 2019. يقود حركة تربوية معاصرة تربط الوعي الذاتي بالتراث العربي الإسلامي.'
                : 'Over 10,000 personal coaching sessions. 500+ coaches graduated from Kun Academy across 4 continents. ICF Young Leader Award 2019. Leading a contemporary educational movement connecting self-awareness with Arab-Islamic heritage.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center md:justify-start">
              <a
                href={`/${locale}/about/founder/`}
                className="inline-flex items-center gap-2 text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-600)] transition-colors duration-300 group"
              >
                {isAr ? 'اعرف المزيد عن سامر' : 'Learn More About Samer'}
                <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
