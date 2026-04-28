/**
 * Wave 15 Wave 3 canary v2 — Default-theme renderers for universal section types.
 *
 * Added in canary v2 to support Issues 2/3/6 (image styling, per-element
 * background, video embed) at the public-rendered surface. Per WP UX research:
 *   - §2: image alignment / fit / aspect
 *   - §3: cover-style overlay + opacity
 *   - §6: per-section background (color / image / gradient + padding)
 *   - §7: YouTube/Vimeo iframe with privacy-respecting embed + sandbox
 *
 * IMPORTANT — boundary contract:
 *   - These renderers ONLY fire for sections whose `type` is one of the
 *     universal types (image, video, header, body, quote, divider).
 *   - When `section.styling` / `section.background` are undefined, output is
 *     the simple no-chrome version (byte-stable for sections that author
 *     never customizes; new fields are purely additive).
 *   - No EXISTING `LpSectionType` (mirror, reframe, …) is affected by this
 *     file — it adds new branches; the legacy branches keep their renderers.
 */

import type { ReactNode } from 'react';
import {
  type SectionBackground,
  type ImageStyling,
  type ImageAlign,
  type ImageObjectFit,
  type AspectRatio,
  type OverlayConfig,
  aspectToCss,
  gradientToCss,
  paddingToRem,
} from '../../../authoring/panels/styling-types';
import { Section } from '@kunacademy/ui/section';

// ─── Background wrapper ────────────────────────────────────────────────────
/**
 * Wraps a section's content with the per-element background controls
 * defined in `section.background` (canary v2 Issue 3). When `background` is
 * undefined or type='none', renders children inside a normal Section variant.
 */
export function BackgroundWrapper({
  background,
  anchor_id,
  variant,
  children,
}: {
  background: SectionBackground | undefined;
  anchor_id?: string;
  variant?: 'white' | 'surface' | 'surface-low' | 'primary' | 'dark';
  children: ReactNode;
}) {
  if (!background || background.type === 'none') {
    return (
      <Section variant={variant ?? 'surface-low'} id={anchor_id}>
        {children}
      </Section>
    );
  }

  const padTop = paddingToRem(background.padding_top);
  const padBottom = paddingToRem(background.padding_bottom);

  // Build a single style object representing the background layer.
  const style: React.CSSProperties = {
    position: 'relative',
  };
  if (padTop) style.paddingTop = padTop;
  if (padBottom) style.paddingBottom = padBottom;

  if (background.type === 'color' && background.color) {
    style.backgroundColor = background.color;
  }
  if (background.type === 'gradient' && background.gradient) {
    style.backgroundImage = gradientToCss(background.gradient);
  }
  if (background.type === 'image' && background.image?.src) {
    const escaped = escapeUrl(background.image.src);
    if (escaped) {
      style.backgroundImage = `url(${escaped})`;
      style.backgroundSize = background.image.fit ?? 'cover';
      style.backgroundPosition = `${background.image.focal_x ?? 50}% ${background.image.focal_y ?? 50}%`;
      style.backgroundRepeat = 'no-repeat';
      if (background.image.parallax) {
        // CSS parallax via background-attachment: fixed. Per WP UX research §3.3
        // (Workspace/CTO/output/2026-04-28-wp-ux-research.md), this is known to
        // jank on iOS Safari. Mobile-fallback handled by the @media (hover: none)
        // override appended in globals.css (see the .kun-canary-v2-no-parallax
        // class — auto-applied on touch-only devices).
        style.backgroundAttachment = 'fixed';
      }
    }
  }

  return (
    <section id={anchor_id} style={style} className="relative">
      {/* Overlay layer (issue 2 + 3) */}
      {background.overlay && background.overlay.type !== 'none' && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={overlayCss(background.overlay)}
        />
      )}
      {/* Content sits above overlay */}
      <div className="relative z-[1]">
        {children}
      </div>
    </section>
  );
}

function overlayCss(o: OverlayConfig): React.CSSProperties {
  const opacity = (o.opacity ?? 50) / 100;
  if (o.type === 'color' && o.color) {
    return { backgroundColor: o.color, opacity };
  }
  if (o.type === 'gradient' && o.gradient) {
    return { backgroundImage: gradientToCss(o.gradient), opacity };
  }
  return {};
}

/** Conservative URL escape for safe inclusion inside a CSS `url(...)` context.
 *
 * DeepSeek extra-care QA (2026-04-28) hardening:
 *   - Strips `"`, `'`, `(`, `)`, `<`, `>`, `\`, and ALL whitespace
 *     (newlines, tabs, spaces) — any of which could break out of url()
 *     into the surrounding CSS rule.
 *   - Returns empty string if the result has no http(s)://, mailto:, /, or
 *     # prefix — defense in depth against javascript:/data:/file: schemes
 *     even though the source is admin-authored.
 *
 * This is layered on top of:
 *   - Server-side upload allowlist (jpeg/png/webp/gif only — no SVG)
 *   - URL-tab regex validation (http(s):// only)
 */
export function escapeUrl(u: string): string {
  const stripped = u.replace(/["'()<>\\\s]/g, '');
  if (!stripped) return '';
  if (
    /^https?:\/\//i.test(stripped) ||
    /^\//.test(stripped) ||
    /^#/.test(stripped) ||
    /^mailto:/i.test(stripped)
  ) {
    return stripped;
  }
  // Reject anything that didn't pass scheme allowlist — including
  // javascript:, data:, file:, vbscript:, etc.
  return '';
}

// ─── Image section renderer ────────────────────────────────────────────────
type AnyRecord = Record<string, unknown>;

interface UniversalSectionLike {
  type?: string;
  anchor_id?: string;
  background?: SectionBackground;
  styling?: ImageStyling;
  image_url?: string;
  alt_ar?: string;
  alt_en?: string;
  caption_ar?: string;
  caption_en?: string;
  embed_url?: string;
  title_ar?: string;
  title_en?: string;
  subtitle_ar?: string;
  subtitle_en?: string;
  body_ar?: string;
  body_en?: string;
  quote_ar?: string;
  quote_en?: string;
  attribution_ar?: string;
  attribution_en?: string;
}

function asUniversal(s: AnyRecord): UniversalSectionLike {
  return s as UniversalSectionLike;
}

export function UniversalImageSection({ section, isAr }: { section: AnyRecord; isAr: boolean }) {
  const u = asUniversal(section);
  const styling: ImageStyling = u.styling ?? {};
  const align = styling.align ?? 'center';
  const fit: ImageObjectFit = styling.fit ?? 'cover';
  const aspect = styling.aspect;
  const widthPct = styling.width_pct ?? 100;
  const alt = (isAr ? u.alt_ar : u.alt_en) ?? '';
  const caption = isAr ? u.caption_ar : u.caption_en;

  if (!u.image_url) return null;

  const widthClass = widthCssForAlign(align, widthPct);
  const aspectCss = aspectToCss(aspect);

  return (
    <BackgroundWrapper background={u.background} anchor_id={u.anchor_id}>
      <figure className={alignContainerClass(align)}>
        <div
          className={widthClass + ' relative'}
          style={{
            aspectRatio: aspectCss,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u.image_url}
            alt={alt}
            loading="lazy"
            className="block w-full h-full"
            style={{
              objectFit: fit,
            }}
          />
          {/* Optional overlay for full/wide cover-style images */}
          {styling.overlay && styling.overlay.type !== 'none' && (align === 'full' || align === 'wide') && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={overlayCss(styling.overlay)}
            />
          )}
        </div>
        {caption && (
          <figcaption className="mt-2 text-sm text-[var(--color-neutral-600)] text-center">
            {caption}
          </figcaption>
        )}
      </figure>
    </BackgroundWrapper>
  );
}

function alignContainerClass(a: ImageAlign): string {
  switch (a) {
    case 'left':
      return 'flex flex-col items-start';
    case 'right':
      return 'flex flex-col items-end';
    case 'center':
      return 'flex flex-col items-center';
    case 'wide':
      return 'mx-auto max-w-[1100px] flex flex-col items-stretch';
    case 'full':
      return 'flex flex-col items-stretch';
    default:
      return 'flex flex-col items-center';
  }
}

function widthCssForAlign(a: ImageAlign, pct: number): string {
  if (a === 'full' || a === 'wide') return 'w-full';
  return pct === 100
    ? 'w-full'
    : pct === 75
    ? 'w-3/4'
    : pct === 50
    ? 'w-1/2'
    : 'w-1/4';
}

// ─── Video section renderer ────────────────────────────────────────────────
import { parseVideoSrc } from '../../../authoring/video-embed-preview';

export function UniversalVideoSection({ section, isAr }: { section: AnyRecord; isAr: boolean }) {
  const u = asUniversal(section);
  const styling: ImageStyling = u.styling ?? {};
  const align = styling.align ?? 'center';
  const aspect: AspectRatio = styling.aspect ?? '16/9';
  const widthPct = styling.width_pct ?? 100;
  const caption = isAr ? u.caption_ar : u.caption_en;

  const parsed = parseVideoSrc(u.embed_url);
  if (!parsed) return null;

  const widthClass = widthCssForAlign(align, widthPct);
  const aspectCss = aspectToCss(aspect) ?? '16 / 9';

  return (
    <BackgroundWrapper background={u.background} anchor_id={u.anchor_id}>
      <figure className={alignContainerClass(align)}>
        <div
          className={widthClass + ' relative rounded-2xl overflow-hidden bg-[var(--color-neutral-900)]'}
          style={{ aspectRatio: aspectCss }}
        >
          <iframe
            src={parsed.src}
            title={`Embedded ${parsed.provider} video`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox={
              parsed.provider === 'gdrive'
                ? 'allow-scripts allow-same-origin allow-presentation'
                : 'allow-scripts allow-same-origin allow-presentation allow-popups'
            }
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
          />
        </div>
        {caption && (
          <figcaption className="mt-2 text-sm text-[var(--color-neutral-600)] text-center">
            {caption}
          </figcaption>
        )}
      </figure>
    </BackgroundWrapper>
  );
}

// ─── Header / Body / Quote / Divider — minimal renderers ──────────────────

export function UniversalHeaderSection({ section, isAr }: { section: AnyRecord; isAr: boolean }) {
  const u = asUniversal(section);
  const title = (isAr ? u.title_ar : u.title_en) ?? '';
  const subtitle = isAr ? u.subtitle_ar : u.subtitle_en;
  if (!title && !subtitle) return null;
  return (
    <BackgroundWrapper background={u.background} anchor_id={u.anchor_id}>
      <div className="mx-auto max-w-3xl text-center">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3">{title}</h2>
        )}
        {subtitle && (
          <p className="text-lg md:text-xl text-[var(--color-neutral-700)] leading-relaxed">{subtitle}</p>
        )}
      </div>
    </BackgroundWrapper>
  );
}

export function UniversalBodySection({ section, isAr }: { section: AnyRecord; isAr: boolean }) {
  const u = asUniversal(section);
  const body = (isAr ? u.body_ar : u.body_en) ?? '';
  if (!body) return null;
  return (
    <BackgroundWrapper background={u.background} anchor_id={u.anchor_id}>
      <div className="mx-auto max-w-3xl prose prose-base md:prose-lg text-[var(--color-neutral-800)]">
        {body.split(/\n\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </BackgroundWrapper>
  );
}

export function UniversalQuoteSection({ section, isAr }: { section: AnyRecord; isAr: boolean }) {
  const u = asUniversal(section);
  const quote = (isAr ? u.quote_ar : u.quote_en) ?? '';
  const attribution = isAr ? u.attribution_ar : u.attribution_en;
  if (!quote) return null;
  return (
    <BackgroundWrapper background={u.background} anchor_id={u.anchor_id}>
      <blockquote className="mx-auto max-w-3xl border-s-4 border-[var(--color-accent,#F47E42)] ps-6 py-4">
        <p className="text-xl md:text-2xl italic text-[var(--color-neutral-800)] leading-relaxed">
          {quote}
        </p>
        {attribution && (
          <cite className="mt-3 block text-sm text-[var(--color-neutral-600)] not-italic">
            — {attribution}
          </cite>
        )}
      </blockquote>
    </BackgroundWrapper>
  );
}

export function UniversalDividerSection({ section }: { section: AnyRecord; isAr: boolean }) {
  const u = asUniversal(section);
  return (
    <BackgroundWrapper background={u.background} anchor_id={u.anchor_id}>
      <hr className="border-0 border-t border-[var(--color-neutral-200)] mx-auto max-w-3xl" />
    </BackgroundWrapper>
  );
}
