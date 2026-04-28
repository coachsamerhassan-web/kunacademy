/**
 * Wave 15 Wave 3 canary v2 — Shared styling types for the canary v2 panels.
 *
 * One source of truth for the shapes added to `composition_json.sections[i]` to
 * support per-element background (Issue 3) and per-image styling (Issue 2).
 *
 * These shapes are ADDITIVE on the existing `LpSection` structure:
 *   - sections that don't carry `background` or `styling` render byte-identical
 *     to today (boundary contract preserved).
 *   - sections that DO carry them get the new behaviour at render-time via
 *     `LpRenderer` extensions (added in canary v2).
 *
 * IP rule: these are presentation shapes, not methodology. Hakima's beats stay
 * intact; only the visual chrome they wear is parameterised.
 *
 * WP UX research lineage:
 *   - SectionBackground → §6 (Cover + Group block backgrounds)
 *   - ImageStyling      → §2 (alignment + size + object-fit + aspect ratio)
 *                         §3 (overlay + opacity + parallax)
 */

/** Subset of CSS object-fit relevant to image affordances. */
export type ImageObjectFit = 'cover' | 'contain' | 'fill';

/** Image alignment per WP convention (Issue 2). RTL-aware at render. */
export type ImageAlign = 'left' | 'center' | 'right' | 'wide' | 'full';

/** Aspect ratio presets per WP Cover block (Issue 2). */
export type AspectRatio = '16/9' | '4/3' | '3/2' | '1/1' | '9/16' | 'free';

/** Background type per WP Group/Cover blocks (Issue 3). */
export type BackgroundType = 'none' | 'color' | 'image' | 'gradient';

/** Padding presets — top/bottom only per dispatch (Issue 3). */
export type PaddingPreset = 'none' | 'small' | 'medium' | 'large';

/** Overlay type per WP Cover block (Issue 2). */
export type OverlayType = 'none' | 'color' | 'gradient';

/** A single gradient stop. 0–100% position. */
export interface GradientStop {
  color: string; // hex e.g. "#F47E42"
  position: number; // 0–100
}

/** Linear gradient — minimum 2 stops. */
export interface GradientSpec {
  stops: GradientStop[];
  /** 0–360°; 0 = top-to-bottom, 90 = left-to-right. */
  angle: number;
}

/** Per-section background controls (Issue 3). Shared across all section types. */
export interface SectionBackground {
  type: BackgroundType;
  /** When type=color. Hex string or CSS-safe palette token. */
  color?: string;
  /** When type=image. */
  image?: {
    src: string;
    alt_ar?: string | null;
    alt_en?: string | null;
    mediaId?: string | null;
    /** Object-fit for the bg image; defaults to 'cover'. */
    fit?: ImageObjectFit;
    /** When true, sets background-attachment: fixed (parallax). */
    parallax?: boolean;
    /** Optional focal point: 0–100 each axis. WP focal-point picker. */
    focal_x?: number;
    focal_y?: number;
  };
  /** When type=gradient. */
  gradient?: GradientSpec;
  /** Top/bottom padding preset. */
  padding_top?: PaddingPreset;
  padding_bottom?: PaddingPreset;
  /** Optional overlay layered on top of image / gradient (Issue 2 + 3). */
  overlay?: OverlayConfig;
}

/** Overlay layered on top of image or gradient backgrounds. */
export interface OverlayConfig {
  type: OverlayType;
  color?: string;
  gradient?: GradientSpec;
  /** 0–100. */
  opacity?: number;
}

/** Per-image styling (Issue 2). Lives on image sections (and on hero featured_image
 *  when shipped post-canary). */
export interface ImageStyling {
  /** Alignment of the image in its container. */
  align?: ImageAlign;
  /** Object-fit. cover (default) / contain / fill. */
  fit?: ImageObjectFit;
  /** Aspect ratio lock. */
  aspect?: AspectRatio;
  /** Overlay (only meaningful for full/wide-aligned images that act as covers). */
  overlay?: OverlayConfig;
  /** Width % of container (for non-full alignments). 25/50/75/100. */
  width_pct?: 25 | 50 | 75 | 100;
}

/** Shared palette for color pickers. Brand tokens per Kun brand profile. */
export const KUN_COLOR_PALETTE: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Cosmic Latte', hex: '#FFF5E9' },
  { name: 'Platinum', hex: '#E6E7E8' },
  { name: 'Mandarin', hex: '#F47E42' },
  { name: 'Charleston Green', hex: '#2C2C2D' },
  { name: 'Dark Slate Blue', hex: '#474099' },
  { name: 'Sky Blue', hex: '#82C4E8' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
];

/** Default empty background — type 'none', no overrides. */
export const EMPTY_BACKGROUND: SectionBackground = { type: 'none' };

/** Default empty styling. */
export const EMPTY_STYLING: ImageStyling = {};

/** Helper — derive aspect-ratio CSS value from preset. */
export function aspectToCss(a: AspectRatio | undefined): string | undefined {
  if (!a || a === 'free') return undefined;
  return a.replace('/', ' / ');
}

/** Helper — render gradient as CSS background-image. */
export function gradientToCss(g: GradientSpec): string {
  const stops = g.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

/** Helper — derive padding rem value from preset. */
export function paddingToRem(p: PaddingPreset | undefined): string {
  switch (p) {
    case 'small':
      return '1.5rem';
    case 'medium':
      return '3rem';
    case 'large':
      return '5rem';
    case 'none':
      return '0';
    default:
      return '';
  }
}
