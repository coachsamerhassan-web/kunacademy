import { Section } from '@kunacademy/ui/section';
import type {
  LpComposition,
  LpSection,
  LpLeadCaptureConfig,
  LpAnalyticsConfig,
} from '@/lib/lp/composition-types';
import { LpLeadForm } from './lp-lead-form';
import { LpGpsSalesRenderer } from './themes/gps-sales-renderer';
import {
  DefaultHero,
  DefaultCtaSection,
  DefaultListSection,
  DefaultGridSection,
  DefaultQaSection,
  DefaultCredibilitySection,
  DefaultReframeSection,
  DefaultProseSection,
  type DefaultSectionProps,
} from './sections/default';

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
 * Wave 15 Phase 2 Session 1 (2026-04-25): default-theme section rendering
 * extracted from a single 420-LOC `SectionBlock` function into per-section
 * components at `apps/web/src/components/lp/sections/default/{type}.tsx`.
 * Behaviour-preserving — no visual deltas. SECTION_COMPONENTS dispatch
 * mirrors the gps-sales pattern.
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
// DEFAULT THEME RENDERER (site-wide Kun brand)
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
        <DefaultHero hero={composition.hero} isAr={isAr} headingFont={headingFont} />
      )}

      {composition.sections?.map((section, i) => (
        <DefaultSectionDispatcher
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

// ── Section dispatcher (default theme) ────────────────────────────────────
function DefaultSectionDispatcher(props: DefaultSectionProps) {
  const { section } = props;
  const Comp = SECTION_COMPONENTS[section.type] ?? DefaultProseSection;
  return <Comp {...props} />;
}

// ── Section type → component map (default theme) ──────────────────────────
//
// Multi-mapped: `benefits` + `who_for` + `who_not_for` + `group_alumni` +
// `carry_out` all share DefaultListSection (same dot/icon list rendering in
// the default theme). `format` + `price` share DefaultGridSection. `objections`
// + `faq` share DefaultQaSection. `mirror` + `description` + `custom` use the
// generic prose shell. `reframe` gets its own large-typography shell. `cta`
// short-circuits to its primary-variant centered band.
const SECTION_COMPONENTS: Record<string, React.ComponentType<DefaultSectionProps>> = {
  // List-style sections
  benefits: DefaultListSection,
  who_for: DefaultListSection,
  who_not_for: DefaultListSection,
  group_alumni: DefaultListSection,
  carry_out: DefaultListSection,
  // Grid-style sections
  format: DefaultGridSection,
  price: DefaultGridSection,
  // Q/A sections
  objections: DefaultQaSection,
  faq: DefaultQaSection,
  // Specialized
  credibility: DefaultCredibilitySection,
  reframe: DefaultReframeSection,
  cta: DefaultCtaSection,
  // Generic prose shell (mirror, description, custom, anything unrecognized)
  mirror: DefaultProseSection,
  description: DefaultProseSection,
  custom: DefaultProseSection,
};

// Re-export type alias for backward-compat with anything importing from this file
export type { LpSection };
