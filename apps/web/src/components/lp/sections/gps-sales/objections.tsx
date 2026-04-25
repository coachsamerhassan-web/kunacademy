/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Objections (anticipated objections + reframes).
 */

import type { SectionProps } from './_shared';

export function GpsObjectionsSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-objections" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items?.map((item, i) => {
          const q = isAr ? item.label_ar : item.label_en;
          const a = isAr ? item.body_ar : item.body_en;
          return (
            <div className="gps-objection-card" key={i}>
              {q && <p className="gps-obj-question">{q}</p>}
              {a && <p className="gps-obj-answer">{a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
