import type {
  LpComposition,
  LpLeadCaptureConfig,
  LpAnalyticsConfig,
  LpSection,
} from '@/lib/lp/composition-types';
import { LpLeadForm } from '../lp-lead-form';
import './gps-sales.css';
import {
  GpsHero,
  GpsMirrorSection,
  GpsReframeSection,
  GpsDescriptionSection,
  GpsBenefitsSection,
  GpsCarryOutSection,
  GpsWhoForSection,
  GpsWhoNotForSection,
  GpsFormatSection,
  GpsPriceSection,
  GpsGroupAlumniSection,
  GpsCredibilitySection,
  GpsObjectionsSection,
  GpsFaqSection,
  GpsCtaSection,
  GpsCustomSection,
  type SectionProps,
} from '../sections/gps-sales';

interface LpGpsSalesRendererProps {
  slug: string;
  locale: string;
  composition: LpComposition;
  leadCaptureConfig?: LpLeadCaptureConfig | null;
  analyticsConfig?: LpAnalyticsConfig | null;
}

/**
 * GPS-Sales theme renderer — mirrors Hakawati's GPS-of-Life sales-pack PDF
 * design for web. 16 section types, midnight-navy + gold palette.
 *
 * Source: /Users/samer/Claude Code/Workspace/CCD/output/GPS-of-Life-sales-pack/GPS-AR-Egypt.html
 *
 * Wave 15 Phase 2 Session 1 (2026-04-25): refactored from a single 822-LOC
 * monolith into per-section files at `apps/web/src/components/lp/sections/
 * gps-sales/{type}.tsx`. This file is now the thin theme dispatcher only.
 *
 * Activation: composition.theme === 'gps-sales'. Every rule in gps-sales.css
 * is scoped under [data-lp-theme="gps-sales"] so this theme cannot leak.
 *
 * Per-variant font routing via [data-lp-variant]:
 *   - 'egypt' → Cairo
 *   - 'gulf'  → Tajawal
 *   - (EN)    → DM Sans / DM Serif Display (auto via [lang="en"])
 *
 * Font loading: Google Fonts link is injected on the page via next/font or
 * <link> at layout level. This renderer does NOT import fonts itself — it
 * declares them in CSS via the `--lp-font-*` custom properties.
 */
export function LpGpsSalesRenderer({
  slug,
  locale,
  composition,
  leadCaptureConfig,
  analyticsConfig,
}: LpGpsSalesRendererProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const variant = composition.variant || (isAr ? 'egypt' : 'default');
  const conversionEventName = analyticsConfig?.conversion_event_name || 'lp_lead_submit';

  return (
    <>
      {/* Google Fonts — loaded inline since this theme needs variant-specific
          families the site-wide layout doesn't ship. preconnect via `<link>`
          inside main is safe in Next.js App Router. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href={
          isAr
            ? 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;900&family=Tajawal:wght@300;400;500;700;900&display=swap'
            : 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=DM+Serif+Display:ital@0;1&display=swap'
        }
      />
      <main
        dir={dir}
        lang={isAr ? 'ar' : 'en'}
        data-lp-theme="gps-sales"
        data-lp-variant={variant}
      >
        {composition.hero && <GpsHero hero={composition.hero} isAr={isAr} />}

        {composition.sections?.map((section, i) => (
          <GpsSection
            key={`gps-section-${i}`}
            section={section}
            isAr={isAr}
            slug={slug}
            locale={locale}
            leadCaptureConfig={leadCaptureConfig ?? null}
            conversionEventName={conversionEventName}
          />
        ))}

        {leadCaptureConfig?.enabled &&
          !composition.sections?.some((s) => s.anchor_id === 'lead-form') && (
            <section id="lead-form" className="gps-lead-form-wrap">
              <div className="gps-lead-form-inner">
                <h2>{isAr ? 'سجّل اهتمامك' : 'Register your interest'}</h2>
                <LpLeadForm
                  slug={slug}
                  locale={locale}
                  config={leadCaptureConfig}
                  conversionEventName={conversionEventName}
                />
              </div>
            </section>
          )}
      </main>
    </>
  );
}

// ── Section dispatcher ────────────────────────────────────────────────────
function GpsSection({
  section,
  isAr,
  slug,
  locale,
  leadCaptureConfig,
  conversionEventName,
}: {
  section: LpSection;
  isAr: boolean;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
}) {
  const Comp = SECTION_COMPONENTS[section.type] ?? GpsCustomSection;
  return (
    <Comp
      section={section}
      isAr={isAr}
      slug={slug}
      locale={locale}
      leadCaptureConfig={leadCaptureConfig}
      conversionEventName={conversionEventName}
    />
  );
}

// ── Section type → component map ──────────────────────────────────────────
const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionProps>> = {
  mirror: GpsMirrorSection,
  reframe: GpsReframeSection,
  description: GpsDescriptionSection,
  benefits: GpsBenefitsSection,
  carry_out: GpsCarryOutSection,
  who_for: GpsWhoForSection,
  who_not_for: GpsWhoNotForSection,
  format: GpsFormatSection,
  price: GpsPriceSection,
  group_alumni: GpsGroupAlumniSection,
  credibility: GpsCredibilitySection,
  objections: GpsObjectionsSection,
  faq: GpsFaqSection,
  cta: GpsCtaSection,
  custom: GpsCustomSection,
};
