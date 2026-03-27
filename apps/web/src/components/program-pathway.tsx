'use client';

interface ProgramPathwayProps {
  locale: string;
}

const steps = {
  ar: [
    { label: 'مجاني', desc: 'اكتشف المنهجية', icon: '🌱', href: '/programs/free/' },
    { label: 'دورات', desc: 'تعلّم المهارات', icon: '📚', href: '/programs/courses/' },
    { label: 'شهادات', desc: 'اعتماد دولي ICF', icon: '🏆', href: '/programs/certifications/' },
    { label: 'المنصة', desc: 'مارس الكوتشينج', icon: '🎯', href: '/programs/coaching/' },
  ],
  en: [
    { label: 'Free', desc: 'Discover the methodology', icon: '🌱', href: '/programs/free/' },
    { label: 'Courses', desc: 'Learn the skills', icon: '📚', href: '/programs/courses/' },
    { label: 'Certifications', desc: 'ICF accredited', icon: '🏆', href: '/programs/certifications/' },
    { label: 'Platform', desc: 'Practice coaching', icon: '🎯', href: '/programs/coaching/' },
  ],
};

const stepColors = [
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-primary)',
  'var(--color-primary-700)',
];

export function ProgramPathway({ locale }: ProgramPathwayProps) {
  const isAr = locale === 'ar';
  const items = isAr ? steps.ar : steps.en;

  return (
    <section className="relative overflow-hidden py-[var(--section-padding-mobile)] md:py-[var(--section-padding)] bg-[var(--color-surface-high)]">
      <div className="relative mx-auto max-w-[var(--max-content-width)] px-4 md:px-6">
        {/* Section header */}
        <div className="text-center mb-12 animate-fade-up">
          <h2 className="text-[1.75rem] md:text-[2.5rem] font-bold text-[#474099]">
            {isAr ? 'مسار التطوّر' : 'Your Growth Pathway'}
          </h2>
          <p className="mt-4 text-[var(--color-neutral-600)] max-w-2xl mx-auto text-lg md:text-xl">
            {isAr
              ? 'من الاكتشاف المجاني إلى الشهادات المعتمدة — اختر المسار الذي يناسبك'
              : 'From free discovery to accredited certifications — choose the path that fits you'}
          </p>
        </div>

        {/* Progress connector line (desktop only) */}
        <div className="hidden md:block absolute top-[calc(50%+2rem)] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-[var(--color-secondary)] via-[var(--color-accent)] to-[var(--color-primary-700)] opacity-20 rounded-full" />

        {/* Steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 stagger-children">
          {items.map((step, i) => (
            <a
              key={i}
              href={`/${locale}${step.href}`}
              className="group relative rounded-2xl bg-white p-6 text-center shadow-[0_4px_24px_rgba(71,64,153,0.06)] hover:shadow-[0_12px_40px_rgba(71,64,153,0.12)] hover:-translate-y-1 transition-all duration-500"
            >
              {/* Step number circle */}
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white font-bold text-lg transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundColor: stepColors[i] }}
              >
                {i + 1}
              </div>
              <h3 className="text-lg md:text-xl font-bold">{step.label}</h3>
              <p className="text-sm text-[var(--color-neutral-600)] mt-1">{step.desc}</p>

              {/* Arrow connector (desktop) */}
              {i < 3 && (
                <div className="hidden md:flex absolute top-1/2 -end-3 z-10 items-center justify-center w-6 h-6 rounded-full bg-white shadow-sm text-[var(--color-neutral-300)]">
                  <svg aria-hidden="true" className="w-3 h-3 rtl:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 2l4 4-4 4" />
                  </svg>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
