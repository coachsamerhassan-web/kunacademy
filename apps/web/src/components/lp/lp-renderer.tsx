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
import {
  UniversalImageSection,
  UniversalVideoSection,
  UniversalHeaderSection,
  UniversalBodySection,
  UniversalQuoteSection,
  UniversalDividerSection,
} from './sections/default/universal-sections';
import {
  StaticFaqAccordionSection,
  StaticMethodologyPillarSection,
  StaticPhilosophyStatementSection,
  StaticContactFormSection,
  StaticTeamGridSection,
  StaticTestimonialGridSection,
  StaticProgramCardStripSection,
} from './sections/default/static-sections';
import type { StaticSectionData } from './sections/default/static-section-data';

interface LpRendererProps {
  slug: string;
  locale: string;
  composition: LpComposition;
  leadCaptureConfig?: LpLeadCaptureConfig | null;
  analyticsConfig?: LpAnalyticsConfig | null;
  /**
   * Wave 4 PRECURSOR — pre-resolved data for DB-reading static sections.
   * Pre-fetched at the route-level page.tsx (Server Component) using
   * `preloadStaticSectionData(composition.sections)` and threaded through
   * here. Keyed by section index. Undefined = editor canvas / no preload —
   * DB-reading sections render their preview placeholder.
   *
   * The boundary contract preserves lp-renderer.tsx as a "neutral" tree-
   * mountable component (works in both server and client trees). All
   * server-only imports (`@kunacademy/cms/server`) live in
   * `static-section-data.ts` (`import 'server-only'`), reachable only
   * from page.tsx → never bundled into the client.
   */
  staticData?: Map<number, StaticSectionData>;
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
  staticData,
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
          staticDataForSection={staticData?.get(i)}
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
//
// Wave 15 W3 canary v2 — added universal types (image/video/header/body/quote/divider).
// Wave 4 PRECURSOR (2026-04-29) — added 7 static-specific types (faq_accordion,
// team_grid, methodology_pillar, philosophy_statement, contact_form,
// testimonial_grid, program_card_strip). DB-reading types (team_grid,
// testimonial_grid, program_card_strip) consume pre-resolved data passed
// via `staticDataForSection` from the route-level page.tsx (which calls
// `preloadStaticSectionData` from `static-section-data.ts`). The renderer
// itself stays neutral — no DB / no `'server-only'` — so it remains
// importable from the editor canvas (use client) without dragging
// googleapis / node:net into the client bundle.
interface DispatcherProps extends DefaultSectionProps {
  staticDataForSection?: StaticSectionData;
}

function DefaultSectionDispatcher(props: DispatcherProps) {
  const { section, isAr, locale, staticDataForSection } = props;
  // These aren't in the LpSectionType union but live in composition_json
  // at runtime. Match the runtime discriminator string.
  const t = section.type as unknown as string;
  const sectionRecord = section as unknown as Record<string, unknown>;

  // Universal types
  if (t === 'image') {
    return <UniversalImageSection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'video') {
    return <UniversalVideoSection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'header') {
    return <UniversalHeaderSection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'body') {
    return <UniversalBodySection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'quote') {
    return <UniversalQuoteSection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'divider') {
    return <UniversalDividerSection section={sectionRecord} isAr={isAr} />;
  }

  // Wave 4 PRECURSOR — Static-specific types
  if (t === 'faq_accordion') {
    return <StaticFaqAccordionSection section={sectionRecord} isAr={isAr} locale={locale} />;
  }
  if (t === 'methodology_pillar') {
    return <StaticMethodologyPillarSection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'philosophy_statement') {
    return <StaticPhilosophyStatementSection section={sectionRecord} isAr={isAr} />;
  }
  if (t === 'contact_form') {
    return <StaticContactFormSection section={sectionRecord} isAr={isAr} />;
  }
  // DB-reading types — pull pre-resolved data slice from props.
  if (t === 'testimonial_grid') {
    const testimonials =
      staticDataForSection?.kind === 'testimonial_grid' ? staticDataForSection.testimonials : [];
    return (
      <StaticTestimonialGridSection
        section={sectionRecord}
        isAr={isAr}
        testimonials={testimonials}
      />
    );
  }
  if (t === 'team_grid') {
    const coaches =
      staticDataForSection?.kind === 'team_grid' ? staticDataForSection.coaches : [];
    return (
      <StaticTeamGridSection
        section={sectionRecord}
        isAr={isAr}
        locale={locale}
        coaches={coaches}
      />
    );
  }
  if (t === 'program_card_strip') {
    const programs =
      staticDataForSection?.kind === 'program_card_strip' ? staticDataForSection.programs : [];
    return (
      <StaticProgramCardStripSection
        section={sectionRecord}
        isAr={isAr}
        locale={locale}
        programs={programs}
      />
    );
  }

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
