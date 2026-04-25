/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * CTA (gradient midnight + gold button).
 */

import type { SectionProps } from './_shared';
import { sanitizeAuthorHtml } from './_shared';

export function GpsCtaSection({ section, isAr }: SectionProps) {
  const headline = isAr
    ? section.cta_headline_ar ?? section.title_ar
    : section.cta_headline_en ?? section.title_en;
  const sub = isAr ? section.cta_sub_ar : section.cta_sub_en;
  const deadline = isAr ? section.cta_deadline_ar : section.cta_deadline_en;
  const ctaLabel = isAr ? section.cta_label_ar : section.cta_label_en;
  const contact = isAr ? section.cta_contact_ar : section.cta_contact_en;

  return (
    <section className="gps-cta" id={section.anchor_id}>
      <div className="gps-cta-inner">
        {headline && <h2 className="gps-cta-headline">{headline}</h2>}
        {sub && <p className="gps-cta-sub">{sub}</p>}
        {deadline && <p className="gps-cta-deadline">{deadline}</p>}
        {ctaLabel && section.cta_anchor && (
          <a href={section.cta_anchor} className="gps-cta-button">
            {ctaLabel}
          </a>
        )}
        {contact && (
          <p
            className="gps-cta-contact"
            dangerouslySetInnerHTML={{ __html: sanitizeAuthorHtml(contact) }}
          />
        )}
      </div>
    </section>
  );
}
