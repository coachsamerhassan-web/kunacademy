/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 * Shared types + helpers for default-theme section components.
 *
 * Behaviour-preserving: every primitive is byte-identical to the original
 * inline branches inside `SectionBlock`. Only file location changed.
 */

import type { ReactNode } from 'react';
import type {
  LpSection,
  LpLeadCaptureConfig,
} from '@/lib/lp/composition-types';
import { Section } from '@kunacademy/ui/section';
import { RichContent } from '@kunacademy/ui/rich-editor';
import { LpLeadForm } from '../../lp-lead-form';

// ── Per-section component contract ──────────────────────────────────────────
export interface DefaultSectionProps {
  section: LpSection;
  isAr: boolean;
  headingFont: string;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
}

/**
 * The default theme had a single `SectionBlock` function with shared chrome
 * (Section wrapper, title, body, optional CTA, optional lead-form anchor)
 * and per-type branches (list, FAQ/objection, format/price grids, credibility).
 *
 * Rather than recreate that variance per file with tons of duplicated chrome,
 * we expose a `<DefaultSectionShell>` that handles the shared parts and lets
 * each per-type component plug in its body content. Behaviour-preserving.
 */
interface DefaultSectionShellProps {
  section: LpSection;
  isAr: boolean;
  headingFont: string;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
  /** Renders below the title, before items. The body slot. */
  body?: ReactNode;
  /** Renders below body, before CTA. The items slot. */
  items?: ReactNode;
  /** When true, force reframe-style large centered title. */
  isReframeType?: boolean;
}

export function DefaultSectionShell({
  section,
  isAr,
  headingFont,
  slug,
  locale,
  leadCaptureConfig,
  conversionEventName,
  body,
  items,
  isReframeType = false,
}: DefaultSectionShellProps) {
  const variant = section.background || 'surface-low';
  const title = isAr ? section.title_ar : section.title_en;
  const ctaLabel = isAr ? section.cta_label_ar : section.cta_label_en;

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

        {body}

        {items}

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

/**
 * Body renderer for any section type whose primary body field is rich-or-string.
 * Centralizes the rich-over-string preference per spec §6 1.4.
 *
 * The `isReframeType` flag controls the typographic treatment for reframe sections
 * (larger, centered, medium weight) — preserved from the original `SectionBlock`.
 */
export function DefaultSectionBody({
  section,
  isAr,
  isReframeType = false,
}: {
  section: LpSection;
  isAr: boolean;
  isReframeType?: boolean;
}) {
  const body = isAr ? section.body_ar : section.body_en;
  const bodyRich = isAr ? section.body_ar_rich : section.body_en_rich;

  if (bodyRich && typeof bodyRich === 'object') {
    return (
      <div
        className={`text-[var(--color-neutral-700)] leading-loose ${isReframeType ? 'text-xl md:text-2xl text-center font-medium' : 'text-base md:text-lg'} space-y-4`}
      >
        <RichContent doc={bodyRich} />
      </div>
    );
  }

  if (!body) return null;

  return (
    <div
      className={`text-[var(--color-neutral-700)] leading-loose ${isReframeType ? 'text-xl md:text-2xl text-center font-medium' : 'text-base md:text-lg'} space-y-4`}
    >
      {body.split(/\n\n+/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
}
