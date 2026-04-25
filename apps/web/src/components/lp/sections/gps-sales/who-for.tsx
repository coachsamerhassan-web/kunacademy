/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Who-for (audience match — checkmark list).
 */

import type { SectionProps } from './_shared';

export function GpsWhoForSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-who gps-who-for" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <ul className="gps-check-list">
            {section.items.map((item, i) => {
              const text = isAr ? item.body_ar ?? item.label_ar : item.body_en ?? item.label_en;
              return (
                <li key={i}>
                  <span className="gps-check-icon" aria-hidden>
                    ✓
                  </span>
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
