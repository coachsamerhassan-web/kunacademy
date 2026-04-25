/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Behaviour-preserving: identical to the original `GpsHero` function.
 */

import type { LpHero } from '@/lib/lp/composition-types';
import { GpsGeoWatermark, sanitizeAuthorHtml } from './_shared';

export function GpsHero({ hero, isAr }: { hero: LpHero; isAr: boolean }) {
  const layout = hero.layout || 'gps-cover';
  const eyebrow = isAr ? hero.eyebrow_ar : hero.eyebrow_en;
  const headline = isAr ? hero.headline_ar : hero.headline_en;
  const subheadline = isAr ? hero.subheadline_ar : hero.subheadline_en;
  const hook = isAr ? hero.hook_ar : hero.hook_en;
  const date = isAr ? hero.footer_date_ar : hero.footer_date_en;
  const dateSub = isAr
    ? hero.footer_date_subtext_ar
    : hero.footer_date_subtext_en;
  const badge = isAr ? hero.footer_badge_ar : hero.footer_badge_en;
  const brand = isAr ? hero.brand_mark_ar : hero.brand_mark_en;
  const brandSub = isAr ? hero.brand_mark_sub_ar : hero.brand_mark_sub_en;

  // Render headline with optional accent span. Belt-and-suspenders null
  // guard + type guard on headline_accent — per DeepSeek adversarial pass.
  const renderHeadline = () => {
    if (!headline || typeof headline !== 'string') return null;
    const accent = hero.headline_accent;
    if (accent && typeof accent === 'string' && accent.length > 0 && headline.includes(accent)) {
      const parts = headline.split(accent);
      return (
        <h1 className="gps-cover-title">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && <span className="gps-accent">{accent}</span>}
            </span>
          ))}
        </h1>
      );
    }
    return <h1 className="gps-cover-title">{headline}</h1>;
  };

  // Only gps-cover layout implemented for this theme; fall through to a plain
  // hero if a future layout variant is passed that we don't yet render.
  if (layout !== 'gps-cover') {
    return (
      <section className="gps-cover">
        <div className="gps-cover-header">
          {headline && renderHeadline()}
          {subheadline && <p className="gps-cover-subtitle">{subheadline}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="gps-cover">
      <GpsGeoWatermark />
      <div className="gps-cover-header">
        {(brand || brandSub) && (
          <div className="gps-brand-mark">
            <div>
              {brand && <div className="gps-logo-text">{brand}</div>}
              {brandSub && <div className="gps-logo-sub">{brandSub}</div>}
            </div>
          </div>
        )}
        {eyebrow && <div className="gps-cover-eyebrow">{eyebrow}</div>}
        {renderHeadline()}
        {subheadline && (
          <p
            className="gps-cover-subtitle"
            dangerouslySetInnerHTML={{
              __html: sanitizeAuthorHtml(subheadline.replace(/\n/g, '<br/>')),
            }}
          />
        )}
        <div className="gps-cover-divider" />
        {hook && (
          <div
            className="gps-cover-hook"
            dangerouslySetInnerHTML={{
              __html: sanitizeAuthorHtml(hook.replace(/\n/g, '<br/>')),
            }}
          />
        )}
      </div>
      {(date || badge) && (
        <div className="gps-cover-footer">
          {(date || dateSub) && (
            <div className="gps-cover-date">
              {date}
              {dateSub && <span>{dateSub}</span>}
            </div>
          )}
          {badge && <div className="gps-cover-geo-badge">{badge}</div>}
        </div>
      )}
    </section>
  );
}
