/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Mirror section: world-mirror data-lines OR four-mirrors cards.
 *
 * Body/close render-path strategy:
 * - The `close` field uses `sanitizeAuthorHtml` + `dangerouslySetInnerHTML`
 *   today (for `<br/>` + `<a>` support). When `close_*_rich` is populated
 *   the renderer prefers it; otherwise the existing sanitized-HTML fallback
 *   stands. RichContent is also a sanitized server-renderer so this is safe.
 */

import { RichContent } from '@kunacademy/ui/rich-editor';
import type { SectionProps } from './_shared';
import { GpsGeoWatermark, sanitizeAuthorHtml } from './_shared';

export function GpsMirrorSection({ section, isAr }: SectionProps) {
  const layout = section.layout || 'data-lines';
  const kicker = isAr ? section.kicker_ar : section.kicker_en;
  const title = isAr ? section.title_ar : section.title_en;
  const close = isAr ? section.close_ar : section.close_en;
  const closeRich = isAr ? section.close_ar_rich : section.close_en_rich;

  if (layout === 'cards') {
    return (
      <section className="gps-four-mirrors" id={section.anchor_id}>
        <div className="gps-section-inner">
          {kicker && <div className="gps-section-label">{kicker}</div>}
          {title && <h2 className="gps-mirrors-headline">{title}</h2>}
          {section.items?.map((item, i) => {
            const opener = isAr ? item.label_ar : item.label_en;
            const body = isAr ? item.body_ar : item.body_en;
            return (
              <div className="gps-mirror-card" key={i}>
                <p>
                  {opener && <span className="gps-opener">{opener}</span>}
                  {opener && body && ' '}
                  {body}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Default: data-lines
  return (
    <section className="gps-world-mirror" id={section.anchor_id}>
      <GpsGeoWatermark />
      <div className="gps-section-inner">
        {kicker && <div className="gps-section-label">{kicker}</div>}
        {title && <h2 className="gps-mirror-headline">{title}</h2>}
        {section.items && section.items.length > 0 && (
          <div className="gps-data-lines">
            {section.items.map((item, i) => {
              const line = isAr ? item.body_ar ?? item.label_ar : item.body_en ?? item.label_en;
              return (
                <div className="gps-data-line" key={i}>
                  {line}
                </div>
              );
            })}
          </div>
        )}
        {closeRich && typeof closeRich === 'object' ? (
          <div className="gps-mirror-bridge">
            <RichContent doc={closeRich} />
          </div>
        ) : close ? (
          <div
            className="gps-mirror-bridge"
            dangerouslySetInnerHTML={{
              __html: sanitizeAuthorHtml(close.replace(/\n\n/g, '<br/><br/>')),
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
