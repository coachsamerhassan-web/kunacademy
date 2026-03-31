import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import { courseJsonLd, breadcrumbJsonLd } from '@kunacademy/ui/structured-data';
import type { Program } from '@kunacademy/cms';
import { getPricingRegion, getGeoPrice } from '@/lib/geo-pricing';
import { PromoVideo } from '@/components/promo-video';
import { LeadCaptureForm } from '@/components/lead-capture-form';

function parseHours(duration: string | undefined): number {
  if (!duration) return 0;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

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
  /** URL path for JSON-LD (e.g. 'academy/certifications/stce/level-1'). Defaults to program.slug */
  urlPath?: string;
  /** Hide price display and show contact CTA instead (for programs > 4,000 AED) */
  hidePrice?: boolean;
}

export async function ProgramDetail({
  program, locale,
  outcomesAr, outcomesEn,
  audienceAr, audienceEn,
  ctaHref,
  urlPath,
  hidePrice,
}: ProgramDetailProps) {
  const isAr = locale === 'ar';
  const title = isAr ? program.title_ar : program.title_en;
  const description = isAr ? program.description_ar : program.description_en;
  const subtitle = isAr ? program.subtitle_ar : program.subtitle_en;
  const outcomes = isAr ? outcomesAr : outcomesEn;
  const audience = isAr ? audienceAr : audienceEn;

  // Geo-based pricing — show only the visitor's regional price
  const region = await getPricingRegion();
  const price = getGeoPrice(
    region,
    program.price_aed as number,
    program.price_egp as number,
    program.price_eur as number,
    program.early_bird_price_aed as number,
  );

  const hours = parseHours(program.duration);
  const pagePath = urlPath || program.slug;

  // Build breadcrumb from URL path
  const breadcrumbItems: Array<{ name: string; path: string }> = [
    { name: isAr ? 'الرئيسية' : 'Home', path: '' },
  ];
  if (pagePath.startsWith('academy')) {
    breadcrumbItems.push({ name: isAr ? 'الأكاديمية' : 'Academy', path: '/academy' });
    if (pagePath.includes('certifications')) {
      breadcrumbItems.push({ name: isAr ? 'الشهادات' : 'Certifications', path: '/academy/certifications' });
      if (pagePath.includes('stce')) {
        breadcrumbItems.push({ name: 'STCE', path: '/academy/certifications/stce' });
      }
    } else if (pagePath.includes('courses')) {
      breadcrumbItems.push({ name: isAr ? 'الدورات' : 'Courses', path: '/academy/courses' });
    }
  }
  breadcrumbItems.push({ name: title, path: `/${pagePath}` });

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd({
          locale,
          name: isAr ? program.title_ar : program.title_en,
          description: (isAr ? program.description_ar : program.description_en) || '',
          slug: pagePath,
          hours,
          priceAed: program.price_aed as number | undefined,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(locale, breadcrumbItems)) }}
      />
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
                <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {program.duration}
              </span>
            )}
            {program.format && (
              <span className="flex items-center gap-1.5">
                <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                {program.format === 'online' ? (isAr ? 'أونلاين' : 'Online')
                  : program.format === 'hybrid' ? (isAr ? 'هجين' : 'Hybrid')
                  : (isAr ? 'حضوري' : 'In-Person')}
              </span>
            )}
            {program.is_icf_accredited && (
              <span className="flex items-center gap-1.5">
                <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                {program.icf_details || (isAr ? 'معتمد من ICF' : 'ICF Accredited')}
              </span>
            )}
          </div>
          {program.promo_video_url && (
            <div className="mt-8 flex justify-center">
              <PromoVideo url={program.promo_video_url} title={title} className="max-w-2xl w-full" />
            </div>
          )}
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
            {hidePrice
              ? (isAr ? 'ابدأ رحلتك' : 'Start Your Journey')
              : (isAr ? 'سجّل الآن' : 'Register Now')}
          </h2>

          {!hidePrice && price.amount > 0 && (
            <div className="mt-6">
              <div className="inline-block rounded-xl bg-white/10 border border-white/20 px-8 py-5">
                <p className="text-3xl font-bold text-white">
                  {price.amount.toLocaleString()} <span className="text-lg font-normal">{price.currency}</span>
                </p>
                {price.earlyBird && price.earlyBird > 0 && (
                  <p className="text-[var(--color-accent-200)] text-sm mt-2">
                    {isAr ? 'حجز مبكر:' : 'Early bird:'} {price.earlyBird.toLocaleString()} {price.currency}
                  </p>
                )}
              </div>
            </div>
          )}

          {!hidePrice && program.installment_enabled && (
            <p className="mt-4 text-white/50 text-sm">
              {isAr ? 'التقسيط متاح عبر Tabby' : 'Installments available via Tabby'}
            </p>
          )}

          {hidePrice ? (
            <div className="mt-6 max-w-md mx-auto">
              <LeadCaptureForm
                locale={locale}
                programCode={program.slug}
                programName={isAr ? program.title_ar : program.title_en}
              />
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href={ctaHref || `/${locale}/checkout/?program=${program.slug}`}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 text-base font-semibold text-white min-h-[52px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_24px_rgba(228,96,30,0.35)]"
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
          )}
        </div>
      </section>
    </main>
  );
}
