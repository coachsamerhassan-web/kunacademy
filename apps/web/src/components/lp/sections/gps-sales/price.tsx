/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Price (tier rows; consumes payment_config tiers if present).
 */

import type { SectionProps } from './_shared';

export function GpsPriceSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const note = isAr ? section.close_ar : section.close_en;
  return (
    <section className="gps-price" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <div className="gps-price-grid">
            {section.items.map((item, i) => {
              const tier = item.tier || (i === 0 ? 'early' : i === section.items!.length - 1 ? 'late' : 'regular');
              const name = isAr ? item.label_ar : item.label_en;
              const dates = isAr ? item.meta_ar : item.meta_en;
              const amount = isAr ? item.body_ar : item.body_en;
              return (
                <div className={`gps-price-tier gps-tier-${tier}`} key={i}>
                  <div>
                    <div className="gps-tier-name">{name}</div>
                    {dates && <div className="gps-tier-dates">{dates}</div>}
                  </div>
                  <div className="gps-tier-amount">{amount}</div>
                </div>
              );
            })}
          </div>
        )}
        {note && <p className="gps-price-note">{note}</p>}
      </div>
    </section>
  );
}
