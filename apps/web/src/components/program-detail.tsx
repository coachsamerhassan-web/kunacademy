import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type { Program } from '@kunacademy/cms';

interface ProgramDetailProps {
  program: Program;
  locale: string;
  /** Optional learning outcomes list */
  outcomesAr?: string[];
  outcomesEn?: string[];
  /** Optional audience targeting */
  audienceAr?: string;
  audienceEn?: string;
  /** CTA link override (defaults to /checkout) */
  ctaHref?: string;
}

function formatPrice(amount: number, currency: string): string {
  if (!amount) return '';
  return `${amount.toLocaleString()} ${currency}`;
}

export function ProgramDetail({
  program, locale,
  outcomesAr, outcomesEn,
  audienceAr, audienceEn,
  ctaHref,
}: ProgramDetailProps) {
  const isAr = locale === 'ar';
  const title = isAr ? program.title_ar : program.title_en;
  const description = isAr ? program.description_ar : program.description_en;
  const subtitle = isAr ? program.subtitle_ar : program.subtitle_en;
  const outcomes = isAr ? outcomesAr : outcomesEn;
  const audience = isAr ? audienceAr : audienceEn;
  const priceAed = program.price_aed as number;
  const priceEgp = program.price_egp as number;

  return (
    <main>
      {/* Hero */}
      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 100%)' }}
      >
        <GeometricPattern pattern="girih" opacity={0.1} fade="both" />
        <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center animate-fade-up">
          {subtitle && (
            <p className="text-sm font-medium tracking-[0.15em] uppercase text-[var(--color-accent-200)] mb-4">
              {subtitle}
            </p>
          )}
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.1]"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {title}
          </h1>
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-white/70 text-sm">
            {program.duration && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {program.duration}
              </span>
            )}
            {program.format && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                {program.format === 'online' ? (isAr ? 'أونلاين' : 'Online')
                  : program.format === 'hybrid' ? (isAr ? 'هجين' : 'Hybrid')
                  : (isAr ? 'حضوري' : 'In-Person')}
              </span>
            )}
            {program.is_icf_accredited && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                {program.icf_details || (isAr ? 'معتمد من ICF' : 'ICF Accredited')}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Description */}
      <Section variant="white">
        <div className="max-w-3xl mx-auto animate-fade-up">
          <h2
            className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] mb-6"
            style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
          >
            {isAr ? 'عن البرنامج' : 'About This Program'}
          </h2>
          <p className="text-[var(--color-neutral-700)] leading-relaxed text-lg">
            {description}
          </p>

          {audience && (
            <div className="mt-8 rounded-xl bg-[var(--color-primary-50)] p-6">
              <h3 className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-2">
                {isAr ? 'مناسب لـ' : 'Who Is This For'}
              </h3>
              <p className="text-[var(--color-neutral-700)]">{audience}</p>
            </div>
          )}
        </div>
      </Section>

      {/* Learning Outcomes */}
      {outcomes && outcomes.length > 0 && (
        <Section variant="surface">
          <div className="max-w-3xl mx-auto">
            <h2
              className="text-[1.75rem] md:text-[2.5rem] font-bold text-[var(--text-accent)] mb-8"
              style={{ fontFamily: isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)' }}
            >
              {isAr ? 'ماذا ستتعلّم' : "What You'll Learn"}
            </h2>
            <ul className="space-y-4">
              {outcomes.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-[var(--color-primary)] mt-1 shrink-0">&#10003;</span>
                  <span className="text-[var(--color-neutral-700)]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* Pricing + CTA */}
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
            {isAr ? 'سجّل الآن' : 'Register Now'}
          </h2>

          {(priceAed > 0 || priceEgp > 0) && (
            <div className="mt-6 flex flex-wrap justify-center gap-6">
              {priceAed > 0 && (
                <div className="rounded-xl bg-white/10 border border-white/20 px-6 py-4">
                  <p className="text-white/60 text-sm">{isAr ? 'الخليج' : 'Gulf'}</p>
                  <p className="text-2xl font-bold text-white">{priceAed.toLocaleString()} <span className="text-base font-normal">AED</span></p>
                  {(program.early_bird_price_aed as number) > 0 && (
                    <p className="text-[var(--color-accent-200)] text-sm mt-1">
                      {isAr ? 'حجز مبكر:' : 'Early bird:'} {(program.early_bird_price_aed as number).toLocaleString()} AED
                    </p>
                  )}
                </div>
              )}
              {priceEgp > 0 && (
                <div className="rounded-xl bg-white/10 border border-white/20 px-6 py-4">
                  <p className="text-white/60 text-sm">{isAr ? 'مصر' : 'Egypt'}</p>
                  <p className="text-2xl font-bold text-white">{priceEgp.toLocaleString()} <span className="text-base font-normal">EGP</span></p>
                </div>
              )}
            </div>
          )}

          {program.installment_enabled && (
            <p className="mt-4 text-white/50 text-sm">
              {isAr ? 'التقسيط متاح عبر Tabby' : 'Installments available via Tabby'}
            </p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={ctaHref || `/${locale}/checkout/?program=${program.slug}`}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(244,126,66,0.35)]"
            >
              {isAr ? 'سجّل الآن' : 'Register Now'}
            </a>
            <a
              href={`/${locale}/contact/`}
              className="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 px-8 py-3.5 text-base font-medium text-white min-h-[52px] hover:bg-white/20 transition-all duration-300"
            >
              {isAr ? 'استفسر أولاً' : 'Ask First'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
