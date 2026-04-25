/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 * CTA section short-circuits into a centered CTA band on its own variant.
 * Behaviour-preserving copy of the original `if (isCtaType) {...}` branch.
 */

import { Section } from '@kunacademy/ui/section';
import type { DefaultSectionProps } from './_shared';

export function DefaultCtaSection({ section, isAr, headingFont }: DefaultSectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const ctaLabel = isAr ? section.cta_label_ar : section.cta_label_en;
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
