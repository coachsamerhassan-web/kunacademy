/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Carry-out (parallel to benefits, dark-variant with gold-ringed numbers).
 */

import type { SectionProps } from './_shared';

export function GpsCarryOutSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const closing = isAr ? section.close_ar : section.close_en;
  return (
    <section className="gps-carry-out" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items?.map((item, i) => {
          const text = isAr ? item.body_ar : item.body_en;
          return (
            <div className="gps-carry-item" key={i}>
              <div className="gps-carry-num">{i + 1}</div>
              <div className="gps-carry-text">{text}</div>
            </div>
          );
        })}
        {closing && <div className="gps-carry-closing">{closing}</div>}
      </div>
    </section>
  );
}
