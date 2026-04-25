/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Credibility / trainer (name + lead + pill chips + bio + closer).
 */

import type { SectionProps } from './_shared';

export function GpsCredibilitySection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const closer = isAr ? section.close_ar : section.close_en;
  const firstItem = section.items?.[0];
  const trainerName = isAr ? firstItem?.label_ar : firstItem?.label_en;
  const credLead = isAr ? firstItem?.meta_ar : firstItem?.meta_en;
  const bio = isAr ? firstItem?.body_ar : firstItem?.body_en;
  // Pills = items[1..] — each item.label is a credential chip
  const pills = section.items?.slice(1) ?? [];

  return (
    <section className="gps-trainer" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {trainerName && <div className="gps-trainer-name">{trainerName}</div>}
        {credLead && <p className="gps-trainer-credential-lead">{credLead}</p>}
        {pills.length > 0 && (
          <div className="gps-cred-pills">
            {pills.map((p, i) => (
              <span className="gps-cred-pill" key={i}>
                {isAr ? p.label_ar ?? p.body_ar : p.label_en ?? p.body_en}
              </span>
            ))}
          </div>
        )}
        {bio &&
          bio.split(/\n\n+/).map((para, i) => (
            <p key={i} className="gps-trainer-bio">
              {para}
            </p>
          ))}
        {closer && <p className="gps-trainer-closer">{closer}</p>}
      </div>
    </section>
  );
}
