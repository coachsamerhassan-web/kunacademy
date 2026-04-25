/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Reframe (hook line OR multi-part reframe).
 */

import { RichContent } from '@kunacademy/ui/rich-editor';
import type { SectionProps } from './_shared';

export function GpsReframeSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const body = isAr ? section.body_ar : section.body_en;
  const bodyRich = isAr ? section.body_ar_rich : section.body_en_rich;
  const close = isAr ? section.close_ar : section.close_en;
  const closeRich = isAr ? section.close_ar_rich : section.close_en_rich;

  // If ONLY title present → hook-line card (standalone quote)
  if (title && !body && !bodyRich && !close && !closeRich) {
    return (
      <section className="gps-hook" id={section.anchor_id}>
        <div className="gps-hook-inner">
          <p className="gps-hook-text">{title}</p>
        </div>
      </section>
    );
  }

  // Otherwise → multi-part reframe (headline + subline + body + close)
  return (
    <section className="gps-reframe" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2 className="gps-reframe-headline">{title}</h2>}
        {bodyRich && typeof bodyRich === 'object' ? (
          <div className="gps-reframe-body">
            <RichContent doc={bodyRich} />
          </div>
        ) : body ? (
          body.split(/\n\n+/).map((para, i) =>
            i === 0 ? (
              <p key={i} className="gps-reframe-subline">
                {para}
              </p>
            ) : (
              <p key={i} className="gps-reframe-body">
                {para}
              </p>
            ),
          )
        ) : null}
        {closeRich && typeof closeRich === 'object' ? (
          <div className="gps-reframe-close">
            <RichContent doc={closeRich} />
          </div>
        ) : close ? (
          <p className="gps-reframe-close">{close}</p>
        ) : null}
      </div>
    </section>
  );
}
