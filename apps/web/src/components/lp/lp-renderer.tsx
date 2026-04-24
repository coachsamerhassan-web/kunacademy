import { Section } from '@kunacademy/ui/section';
import { GeometricPattern } from '@kunacademy/ui/patterns';
import type {
  LpComposition,
  LpHero,
  LpSection,
  LpLeadCaptureConfig,
  LpAnalyticsConfig,
} from '@/lib/lp/composition-types';
import { LpLeadForm } from './lp-lead-form';
import { LpGpsSalesRenderer } from './themes/gps-sales-renderer';

interface LpRendererProps {
  slug: string;
  locale: string;
  composition: LpComposition;
  leadCaptureConfig?: LpLeadCaptureConfig | null;
  analyticsConfig?: LpAnalyticsConfig | null;
}

/**
 * Wave 14 LP-INFRA — landing-page renderer (theme dispatcher).
 *
 * Composes hero + sections from `LpComposition` (DB-driven JSONB). Delegates
 * to a theme-specific renderer based on `composition.theme`:
 *
 *   - undefined | 'default'  → renders with site-wide Kun brand tokens (this file)
 *   - 'gps-sales'            → renders with sales-pack design (themes/gps-sales-renderer.tsx)
 *
 * Server component. Client islands (lead form, analytics) imported directly.
 */
export function LpRenderer(props: LpRendererProps) {
  const theme = props.composition.theme || 'default';

  if (theme === 'gps-sales') {
    return <LpGpsSalesRenderer {...props} />;
  }

  return <LpDefaultRenderer {...props} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT THEME RENDERER (site-wide Kun brand — unchanged from V1)
// ═══════════════════════════════════════════════════════════════════════════

function LpDefaultRenderer({
  slug,
  locale,
  composition,
  leadCaptureConfig,
  analyticsConfig,
}: LpRendererProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const conversionEventName = analyticsConfig?.conversion_event_name || 'lp_lead_submit';

  return (
    <main dir={dir} data-lp-theme="default">
      {composition.hero && (
        <HeroBlock hero={composition.hero} isAr={isAr} headingFont={headingFont} />
      )}

      {composition.sections?.map((section, i) => (
        <SectionBlock
          key={`section-${i}`}
          section={section}
          isAr={isAr}
          headingFont={headingFont}
          slug={slug}
          locale={locale}
          leadCaptureConfig={leadCaptureConfig ?? null}
          conversionEventName={conversionEventName}
        />
      ))}

      {leadCaptureConfig?.enabled &&
        !composition.sections?.some((s) => s.anchor_id === 'lead-form') && (
          <Section variant="surface-low">
            <div id="lead-form" className="mx-auto max-w-xl">
              <h2
                className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-6 text-center"
                style={{ fontFamily: headingFont }}
              >
                {isAr ? 'تواصل معنا' : 'Get in touch'}
              </h2>
              <LpLeadForm
                slug={slug}
                locale={locale}
                config={leadCaptureConfig}
                conversionEventName={conversionEventName}
              />
            </div>
          </Section>
        )}
    </main>
  );
}

// ── Hero block (default theme) ──────────────────────────────────────────────
function HeroBlock({
  hero,
  isAr,
  headingFont,
}: {
  hero: LpHero;
  isAr: boolean;
  headingFont: string;
}) {
  const headline = isAr ? hero.headline_ar : hero.headline_en;
  const subheadline = isAr ? hero.subheadline_ar : hero.subheadline_en;
  const ctaLabel = isAr ? hero.cta_label_ar : hero.cta_label_en;
  const badge = isAr ? hero.badge_label_ar : hero.badge_label_en;
  const overlay = hero.background_overlay_color || 'rgba(30,27,75,0.85)';

  const bgStyle = hero.background_image_url
    ? {
        background: `linear-gradient(to bottom, ${overlay} 0%, ${overlay} 100%), url(${hero.background_image_url}) center/cover no-repeat`,
      }
    : {
        background:
          'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
      };

  return (
    <section className="relative overflow-hidden py-16 md:py-28" style={bgStyle}>
      <GeometricPattern pattern="flower-of-life" opacity={0.07} fade="both" />
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
        {badge && (
          <span className="inline-block mb-6 px-4 py-1 rounded-full bg-[var(--color-accent)]/90 text-white text-sm font-semibold backdrop-blur-sm">
            {badge}
          </span>
        )}
        {headline && (
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.15] max-w-4xl mx-auto"
            style={{ fontFamily: headingFont }}
          >
            {headline}
          </h1>
        )}
        {subheadline && (
          <p className="mt-5 text-white/80 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {subheadline}
          </p>
        )}
        {ctaLabel && hero.cta_anchor && (
          <a
            href={hero.cta_anchor}
            className="inline-flex items-center justify-center mt-8 rounded-xl bg-[var(--color-accent)] px-8 py-4 font-semibold text-white min-h-[48px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_8px_28px_rgba(228,96,30,0.35)] hover:scale-[1.02]"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}

// ── Section block (default theme, dispatches by type) ──────────────────────
function SectionBlock({
  section,
  isAr,
  headingFont,
  slug,
  locale,
  leadCaptureConfig,
  conversionEventName,
}: {
  section: LpSection;
  isAr: boolean;
  headingFont: string;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
}) {
  const variant = section.background || 'surface-low';
  const title = isAr ? section.title_ar : section.title_en;
  const body = isAr ? section.body_ar : section.body_en;
  const ctaLabel = isAr ? section.cta_label_ar : section.cta_label_en;

  const isListType =
    section.type === 'benefits' ||
    section.type === 'who_for' ||
    section.type === 'who_not_for' ||
    section.type === 'group_alumni' ||
    section.type === 'carry_out';
  const isObjectionType = section.type === 'objections';
  const isFaqType = section.type === 'faq';
  const isReframeType = section.type === 'reframe';
  const isCredibilityType = section.type === 'credibility';
  const isPriceType = section.type === 'price';
  const isFormatType = section.type === 'format';
  const isCtaType = section.type === 'cta';

  // CTA section short-circuits into a centered CTA band
  if (isCtaType) {
    const headline =
      (isAr ? section.cta_headline_ar : section.cta_headline_en) || title;
    const sub = isAr ? section.cta_sub_ar : section.cta_sub_en;
    const deadline = isAr ? section.cta_deadline_ar : section.cta_deadline_en;
    return (
      <Section variant="primary" id={section.anchor_id}>
        <div className="mx-auto max-w-2xl text-center">
          {headline && (
            <h2
              className="text-3xl md:text-5xl font-bold text-white leading-[1.2] mb-4"
              style={{ fontFamily: headingFont }}
            >
              {headline}
            </h2>
          )}
          {sub && <p className="text-white/75 text-lg md:text-xl mb-6 leading-relaxed">{sub}</p>}
          {deadline && (
            <p className="text-[var(--color-accent-300)] font-semibold mb-8 text-base">
              {deadline}
            </p>
          )}
          {ctaLabel && section.cta_anchor && (
            <a
              href={section.cta_anchor}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-10 py-4 font-bold text-white min-h-[52px] text-lg hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_8px_28px_rgba(228,96,30,0.4)] hover:scale-[1.02]"
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </Section>
    );
  }

  return (
    <Section
      variant={variant as 'white' | 'surface' | 'surface-low' | 'primary' | 'dark'}
      id={section.anchor_id}
    >
      <div className="mx-auto max-w-3xl">
        {title && (
          <h2
            className={`${isReframeType ? 'text-3xl md:text-5xl text-center' : 'text-2xl md:text-3xl'} font-bold text-[var(--text-primary)] mb-5 ${isReframeType ? 'leading-[1.2]' : ''}`}
            style={{ fontFamily: headingFont }}
          >
            {title}
          </h2>
        )}

        {body && (
          <div
            className={`text-[var(--color-neutral-700)] leading-loose ${isReframeType ? 'text-xl md:text-2xl text-center font-medium' : 'text-base md:text-lg'} space-y-4`}
          >
            {body.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {isListType && section.items && section.items.length > 0 && (
          <ul className="mt-6 space-y-3">
            {section.items.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const itemBody = isAr ? item.body_ar : item.body_en;
              const meta = isAr ? item.meta_ar : item.meta_en;
              const dotColor =
                section.type === 'who_not_for'
                  ? 'bg-[var(--color-neutral-400)]'
                  : 'bg-[var(--color-accent)]';
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[var(--color-neutral-700)] leading-relaxed text-base md:text-lg"
                >
                  {item.icon ? (
                    <span className="text-2xl mt-0.5 flex-shrink-0" aria-hidden>
                      {item.icon}
                    </span>
                  ) : (
                    <span
                      className={`mt-2.5 w-2 h-2 rounded-full ${dotColor} flex-shrink-0`}
                      aria-hidden
                    />
                  )}
                  <div>
                    {label && (
                      <span className="font-semibold text-[var(--text-primary)]">
                        {label}
                        {itemBody ? ' — ' : ''}
                      </span>
                    )}
                    {itemBody && <span>{itemBody}</span>}
                    {meta && (
                      <span className="block text-sm text-[var(--color-neutral-500)] mt-1">
                        {meta}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {(isFormatType || isPriceType) && section.items && section.items.length > 0 && (
          <div
            className={`mt-6 grid gap-4 ${section.items.length > 2 ? 'sm:grid-cols-2 md:grid-cols-3' : 'sm:grid-cols-2'}`}
          >
            {section.items.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const itemBody = isAr ? item.body_ar : item.body_en;
              const meta = isAr ? item.meta_ar : item.meta_en;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-primary-100)] bg-white p-5"
                >
                  {item.icon && (
                    <div className="text-3xl mb-3" aria-hidden>
                      {item.icon}
                    </div>
                  )}
                  {label && (
                    <p className="text-sm font-semibold text-[var(--color-neutral-500)] uppercase tracking-wide mb-1">
                      {label}
                    </p>
                  )}
                  {itemBody && (
                    <p
                      className={`text-[var(--text-primary)] ${isPriceType ? 'text-2xl md:text-3xl font-bold' : 'text-lg font-medium'}`}
                    >
                      {itemBody}
                    </p>
                  )}
                  {meta && (
                    <p className="text-sm text-[var(--color-neutral-500)] mt-1">{meta}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(isObjectionType || isFaqType) && section.items && section.items.length > 0 && (
          <div className="mt-6 space-y-4">
            {section.items.map((item, i) => {
              const q = isAr ? item.label_ar : item.label_en;
              const a = isAr ? item.body_ar : item.body_en;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-5"
                >
                  {q && (
                    <p
                      className="font-bold text-[var(--text-primary)] mb-2 text-base md:text-lg"
                      style={{ fontFamily: headingFont }}
                    >
                      {q}
                    </p>
                  )}
                  {a && (
                    <p className="text-[var(--color-neutral-700)] leading-relaxed">{a}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isCredibilityType && section.items && section.items.length > 0 && (
          <div className="mt-6 space-y-3">
            {section.items.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const itemBody = isAr ? item.body_ar : item.body_en;
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xl mt-0.5" aria-hidden>
                    {item.icon || '🏅'}
                  </span>
                  <div>
                    {label && (
                      <p className="font-semibold text-[var(--text-primary)]">{label}</p>
                    )}
                    {itemBody && (
                      <p className="text-[var(--color-neutral-600)] leading-relaxed">
                        {itemBody}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {ctaLabel && section.cta_anchor && (
          <div className="mt-8 text-center">
            <a
              href={section.cta_anchor}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-8 py-3.5 font-semibold text-white min-h-[48px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_4px_16px_rgba(228,96,30,0.25)] hover:scale-[1.02]"
            >
              {ctaLabel}
            </a>
          </div>
        )}

        {section.anchor_id === 'lead-form' && leadCaptureConfig?.enabled && (
          <div className="mt-8 max-w-xl mx-auto">
            <LpLeadForm
              slug={slug}
              locale={locale}
              config={leadCaptureConfig}
              conversionEventName={conversionEventName}
            />
          </div>
        )}
      </div>
    </Section>
  );
}
