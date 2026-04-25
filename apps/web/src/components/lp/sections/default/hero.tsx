/**
 * Wave 15 Phase 2 Session 1 — extracted from `lp-renderer.tsx`.
 * Default-theme hero. Behaviour-preserving copy of the original `HeroBlock`.
 */

import type { LpHero } from '@/lib/lp/composition-types';
import { GeometricPattern } from '@kunacademy/ui/patterns';

export function DefaultHero({
  hero,
  isAr,
  headingFont,
}: {
  hero: LpHero;
  isAr: boolean;
  headingFont: string;
}) {
  const headline = isAr ? hero.headline_ar : hero.headline_en;
  const subheadline = isAr ? hero.subheadline_ar : hero.subheadline_en;
  const ctaLabel = isAr ? hero.cta_label_ar : hero.cta_label_en;
  const badge = isAr ? hero.badge_label_ar : hero.badge_label_en;
  const overlay = hero.background_overlay_color || 'rgba(30,27,75,0.85)';

  const bgStyle = hero.background_image_url
    ? {
        background: `linear-gradient(to bottom, ${overlay} 0%, ${overlay} 100%), url(${hero.background_image_url}) center/cover no-repeat`,
      }
    : {
        background:
          'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
      };

  return (
    <section className="relative overflow-hidden py-16 md:py-28" style={bgStyle}>
      <GeometricPattern pattern="flower-of-life" opacity={0.07} fade="both" />
      <div className="relative z-10 mx-auto max-w-[var(--max-content-width)] px-4 md:px-6 text-center">
        {badge && (
          <span className="inline-block mb-6 px-4 py-1 rounded-full bg-[var(--color-accent)]/90 text-white text-sm font-semibold backdrop-blur-sm">
            {badge}
          </span>
        )}
        {headline && (
          <h1
            className="text-[2.25rem] md:text-[3.5rem] font-bold text-[#FFF5E9] leading-[1.15] max-w-4xl mx-auto"
            style={{ fontFamily: headingFont }}
          >
            {headline}
          </h1>
        )}
        {subheadline && (
          <p className="mt-5 text-white/80 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {subheadline}
          </p>
        )}
        {ctaLabel && hero.cta_anchor && (
          <a
            href={hero.cta_anchor}
            className="inline-flex items-center justify-center mt-8 rounded-xl bg-[var(--color-accent)] px-8 py-4 font-semibold text-white min-h-[48px] hover:bg-[var(--color-accent-500)] transition-all duration-300 shadow-[0_8px_28px_rgba(228,96,30,0.35)] hover:scale-[1.02]"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}
