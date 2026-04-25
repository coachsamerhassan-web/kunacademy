/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Group + alumni (2-col card grid).
 */

import type { SectionProps } from './_shared';

export function GpsGroupAlumniSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  if (!section.items || section.items.length === 0) return null;

  // Split items: non-alumni rows go in left card; any item with icon='alumni'
  // or tier='late' marker goes in right card. For predictability, we take
  // the LAST item as the alumni card and all others as group-card rows.
  const groupItems = section.items.slice(0, -1);
  const alumniItem = section.items[section.items.length - 1];

  return (
    <section className="gps-group" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && (
          <h2
            style={{
              fontSize: 'clamp(24px, 3.5vw, 32px)',
              fontWeight: 900,
              color: 'var(--deep-teal)',
              marginBottom: '40px',
            }}
          >
            {title}
          </h2>
        )}
        <div className="gps-group-cards">
          <div className="gps-group-card">
            <h3>{isAr ? 'خصم المجموعة' : 'Group pricing'}</h3>
            {groupItems.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const pct = isAr ? item.body_ar : item.body_en;
              return (
                <div className="gps-discount-row" key={i}>
                  <span>{label}</span>
                  <span className="gps-discount-pct">{pct}</span>
                </div>
              );
            })}
          </div>
          <div className="gps-group-card gps-alumni-card">
            <h3>{isAr ? alumniItem.label_ar ?? 'الخرّيجون' : alumniItem.label_en ?? 'Alumni'}</h3>
            <p className="gps-alumni-note">
              {isAr ? alumniItem.body_ar : alumniItem.body_en}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
