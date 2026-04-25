/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Format / details (2-col detail cards on deep teal).
 */

import type { SectionProps } from './_shared';

export function GpsFormatSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const note = isAr ? section.close_ar : section.close_en;
  return (
    <section className="gps-format" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <div className="gps-detail-cards">
            {section.items.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const value = isAr ? item.body_ar : item.body_en;
              return (
                <div className="gps-detail-card" key={i}>
                  {label && <div className="gps-detail-label">{label}</div>}
                  {value && <div className="gps-detail-value">{value}</div>}
                </div>
              );
            })}
          </div>
        )}
        {note && <p className="gps-format-note">{note}</p>}
      </div>
    </section>
  );
}
