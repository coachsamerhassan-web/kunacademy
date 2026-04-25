/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * What-is (description with layer blocks).
 */

import { RichContent } from '@kunacademy/ui/rich-editor';
import type { SectionProps } from './_shared';

export function GpsDescriptionSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const tagline = isAr ? section.body_ar : section.body_en;
  const taglineRich = isAr ? section.body_ar_rich : section.body_en_rich;
  return (
    <section className="gps-what-is" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {taglineRich && typeof taglineRich === 'object' ? (
          <div className="gps-what-is-tagline">
            <RichContent doc={taglineRich} />
          </div>
        ) : tagline ? (
          <div className="gps-what-is-tagline">{tagline}</div>
        ) : null}
        {section.items?.map((item, i) => {
          const label = isAr ? item.label_ar : item.label_en;
          const body = isAr ? item.body_ar : item.body_en;
          return (
            <div key={i}>
              <div className="gps-layer-block">
                <p>
                  {label && <strong>{label}</strong>}
                  {label && body && ' — '}
                  {body}
                </p>
              </div>
              {i < (section.items?.length ?? 0) - 1 && (
                <hr className="gps-layer-divider" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
