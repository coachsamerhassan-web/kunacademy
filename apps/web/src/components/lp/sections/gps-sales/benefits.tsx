/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Benefits / outcomes (numbered, teal circles on ivory).
 */

import type { SectionProps } from './_shared';

export function GpsBenefitsSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-outcomes" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items?.map((item, i) => {
          const text = isAr ? item.body_ar : item.body_en;
          return (
            <div className="gps-outcome-item" key={i}>
              <div className="gps-outcome-num">{i + 1}</div>
              <div className="gps-outcome-text">{text}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
