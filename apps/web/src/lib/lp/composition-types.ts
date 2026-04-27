/**
 * Wave 14 LP-INFRA — Landing-page composition + config types.
 *
 * These mirror the JSONB columns added on `landing_pages` in migration 0052.
 * All shapes are deliberately permissive: every sub-field is optional so the
 * renderer can skip missing sections gracefully and the admin can author
 * partial pages incrementally.
 *
 * Source of truth: Project Memory/KUN-Features/Waves/14-LANDING-PAGE-INFRASTRUCTURE.md §3
 *
 * Wave 15 Phase 2 (2026-04-25): added optional `*_rich` companions to free-form
 * prose fields (TipTap JSON via `JSONContent`). Renderers prefer rich-over-string
 * when both are populated. Fields stay optional + non-breaking; existing scalar
 * authoring continues to work. See Specs/wave-15-phase-2-spec.md §5.
 */

import type { JSONContent } from '@tiptap/core';

// ── Theme ──────────────────────────────────────────────────────────────────
/** LP visual theme. Default uses site-wide Kun brand tokens (purple + orange
 *  + cream). 'gps-sales' applies the midnight-navy + gold + ivory sales-pack
 *  design from Hakawati's GPS-of-Life PDF treatment.
 *
 *  Add new themes by:
 *    1. Creating a CSS file under `components/lp/themes/{theme}.css` with
 *       every rule scoped under `[data-lp-theme="{theme}"]`.
 *    2. Importing it from `lp-renderer.tsx`.
 *    3. Adding the identifier to `LpTheme` below.
 *
 *  The theme is read from `composition.theme` and emitted as
 *  `data-lp-theme="..."` on the root `<main>` element by lp-renderer. */
export type LpTheme = 'default' | 'gps-sales';

/** Regional variant (used by themes that render different fonts/layouts
 *  for different markets — e.g. AR-Egypt vs AR-Gulf). 'default' = use
 *  locale alone; specific variants only matter when the theme implements them. */
export type LpVariant = 'default' | 'egypt' | 'gulf';

// ── Hero (top of page) ──────────────────────────────────────────────────────
/** Hero layout. 'default' = centered text with optional background image +
 *  CTA button. 'gps-cover' renders the sales-pack cover composition: brand
 *  mark top, eyebrow label, huge title with accent span, subtitle, divider,
 *  framed hook block with gold left-border, date + geo-badge footer row. */
export type LpHeroLayout = 'default' | 'gps-cover';

export interface LpHero {
  /** Layout variant. Default = centered hero with CTA button. */
  layout?: LpHeroLayout;
  /** Top-of-page eyebrow / kicker label (GPS cover uses this). */
  eyebrow_ar?: string;
  eyebrow_en?: string;
  headline_ar?: string;
  headline_en?: string;
  /** Substring of the headline to render with an accent color treatment.
   *  For GPS cover this is typically "GPS" so the gold color applies only
   *  to that span. Case-sensitive match. */
  headline_accent?: string;
  subheadline_ar?: string;
  subheadline_en?: string;
  /** Secondary text block rendered beneath the divider on sales-pack cover.
   *  1-2 sentence framed "hook line" with gold left border. */
  hook_ar?: string;
  hook_en?: string;
  background_image_url?: string;
  background_overlay_color?: string;     // CSS color; default rgba(30,27,75,0.85)
  /** Wave 14b Session 2: featured / OG image for the LP. Stored on hero for
   *  consistency (no migration; JSONB key per spec Q2). Distinct from
   *  `background_image_url` — the featured image is the canonical visual
   *  representation of the LP (used by SEO/OG fallback, future thumbnails,
   *  social cards). Renderers may consume this independently of background.
   *  Alt text is required for a11y; bilingual fields stored at the same
   *  level so author can localize. */
  featured_image_url?: string;
  featured_image_alt_ar?: string;
  featured_image_alt_en?: string;
  cta_label_ar?: string;
  cta_label_en?: string;
  cta_anchor?: string;                   // '#lead-form' | '#payment' | external URL
  badge_label_ar?: string;
  badge_label_en?: string;
  /** Footer date block (GPS cover: "Saturday 7 June 2026" + venue subtext). */
  footer_date_ar?: string;
  footer_date_en?: string;
  footer_date_subtext_ar?: string;
  footer_date_subtext_en?: string;
  /** Footer geo-badge (GPS cover: "نسخة مصر · جنيه مصري" / "Egypt edition"). */
  footer_badge_ar?: string;
  footer_badge_en?: string;
  /** Optional brand-mark text (e.g. "أكاديمية كُن للكوتشينج" with sub "Kun Coaching Academy · Since 2013"). */
  brand_mark_ar?: string;
  brand_mark_en?: string;
  brand_mark_sub_ar?: string;
  brand_mark_sub_en?: string;
}

// ── Section item (for list-style sections) ──────────────────────────────────
export interface LpSectionItem {
  label_ar?: string;
  label_en?: string;
  body_ar?: string;
  body_en?: string;
  /** Wave 15 Phase 2: optional rich-text body. When present (and an object),
   *  renderers prefer it over `body_ar`/`body_en`. Used by `benefits`,
   *  `carry_out`, `who_for`, `who_not_for`, `objections`, `faq` items. */
  body_ar_rich?: JSONContent | null;
  body_en_rich?: JSONContent | null;
  icon?: string;                          // emoji or icon hint
  meta_ar?: string;                       // small annotation, e.g. price subtext
  meta_en?: string;
  /** For price tiers: 'early' | 'regular' | 'late' — drives accent styling
   *  (gps-sales renders `early` with gold border + teal bg). Ignored by
   *  non-price sections. */
  tier?: 'early' | 'regular' | 'late';
}

// ── Section (one body block) ────────────────────────────────────────────────
export type LpSectionType =
  | 'mirror'         // world-mirror: data-lines bridge OR pain-mirror cards
  | 'reframe'        // hook line / pivot
  | 'description'    // 4-layer description (identity → invitation → impressions → glimpse)
  | 'benefits'       // outcomes list (numbered circles on gps-sales)
  | 'carry_out'      // parallel "what you leave with" list — dark background variant (gps-sales only)
  | 'who_for'        // audience match (checkmark list)
  | 'who_not_for'    // audience anti-match (× list; must include therapy boundary)
  | 'format'         // date / time / location / duration — 2-col detail cards
  | 'price'          // tier display (consumes payment_config tiers if present)
  | 'group_alumni'   // group-discount + alumni rule — 2-col card grid
  | 'credibility'    // trainer/host credentials — name + lead + pill chips + bio + closer
  | 'objections'     // anticipated objections + reframes
  | 'faq'            // Q&A list (generic, default theme; sales-pack uses 'objections')
  | 'cta'            // dedicated CTA block — headline + sub + deadline + button
  | 'custom';        // free-form rich text

/** Mirror section render variant. 'data-lines' = big typographic data-lines
 *  + bridge paragraph (world-mirror pattern); 'cards' = stack of mirror-cards
 *  with strong opener (four-mirrors audience pattern). */
export type LpMirrorLayout = 'data-lines' | 'cards';

export interface LpSection {
  type: LpSectionType;
  title_ar?: string;
  title_en?: string;
  /** Small uppercase kicker label rendered above the title (gps-sales uses
   *  this for "اللحظة اللي إحنا فيها" / "هل ده إنت؟" / "Is this you?"). */
  kicker_ar?: string;
  kicker_en?: string;
  body_ar?: string;
  body_en?: string;
  /** Wave 15 Phase 2: optional rich-text companion to body_*. When present
   *  (typeof object) renderers prefer it over the scalar body. Applies to
   *  `mirror`, `reframe`, `description`, `benefits`, `carry_out`, `who_for`,
   *  `who_not_for`, `group_alumni`, `credibility` (bio), `custom`. Ignored
   *  on `format`, `price`, `cta` (those stay scalar). */
  body_ar_rich?: JSONContent | null;
  body_en_rich?: JSONContent | null;
  /** Secondary body block rendered after primary body (used on reframe,
   *  mirror-bridge, credibility-closer). */
  close_ar?: string;
  close_en?: string;
  /** Wave 15 Phase 2: optional rich-text companion to close_*. Same
   *  rich-over-string preference as `body_*_rich`. Applies to `mirror`,
   *  `reframe`, `description`, `credibility`, `custom`. */
  close_ar_rich?: JSONContent | null;
  close_en_rich?: JSONContent | null;
  items?: LpSectionItem[];
  cta_label_ar?: string;
  cta_label_en?: string;
  cta_anchor?: string;
  /** Section-specific layout variant (e.g. mirror: 'data-lines' vs 'cards'). */
  layout?: LpMirrorLayout;
  /** Visual background variant hint for the default theme. On `gps-sales`
   *  the section type alone determines background; this field is ignored. */
  background?: 'white' | 'surface' | 'surface-low' | 'primary' | 'dark' | 'accent-tint';
  /** Anchor id for in-page nav (e.g. 'lead-form', 'payment'). */
  anchor_id?: string;
  /** CTA-specific extras (rendered only for `type: 'cta'`). */
  cta_headline_ar?: string;
  cta_headline_en?: string;
  cta_sub_ar?: string;
  cta_sub_en?: string;
  cta_deadline_ar?: string;
  cta_deadline_en?: string;
  cta_contact_ar?: string;
  cta_contact_en?: string;
}

// ── Thank-you surface ───────────────────────────────────────────────────────
export interface LpThankYou {
  headline_ar?: string;
  headline_en?: string;
  body_ar?: string;
  body_en?: string;
  /** Wave 15 Phase 2: rich body — authors want inline links to WhatsApp /
   *  calendar / next-step forms. Renderer prefers rich-over-string. */
  body_ar_rich?: JSONContent | null;
  body_en_rich?: JSONContent | null;
  cta_label_ar?: string;
  cta_label_en?: string;
  cta_url?: string;                       // optional follow-up link (e.g. WhatsApp)
}

// ── Composition (whole page minus hero is sections[]) ───────────────────────
export interface LpComposition {
  /** Visual theme. Default = site Kun brand; 'gps-sales' = Hakawati's
   *  sales-pack design (midnight navy + gold + ivory). See `LpTheme`. */
  theme?: LpTheme;
  /** Regional variant — only meaningful for themes that implement per-variant
   *  treatments. 'gps-sales' supports 'egypt' (Cairo font) vs 'gulf' (Tajawal). */
  variant?: LpVariant;
  hero?: LpHero;
  sections?: LpSection[];
  thank_you?: LpThankYou;
}

// ── Lead-capture config ─────────────────────────────────────────────────────
export type LpLeadField = 'name' | 'email' | 'phone' | 'message' | 'company' | 'role';

export interface LpLeadCaptureConfig {
  enabled: boolean;
  /** Which fields render in the form. Order is render order. */
  fields: LpLeadField[];
  /** Subset of `fields` that are required. */
  required_fields: LpLeadField[];
  /** Path or absolute URL for post-submit redirect. Default = thank-you page on this LP. */
  success_redirect?: string;
  /** Tag passed to createZohoCrmContact. Default 'Landing Page'. */
  zoho_lead_source?: string;
  /** Optional consent-line text rendered above the submit button. */
  consent_text_ar?: string;
  consent_text_en?: string;
  /** Per-field labels override (rare — defaults are usually fine). */
  field_labels?: Partial<Record<LpLeadField, { ar?: string; en?: string }>>;
}

// ── Payment config (schema only this wave; widget in LP-INFRA-B) ────────────
export type LpCurrency = 'EGP' | 'AED' | 'EUR' | 'USD';

export interface LpPaymentTier {
  code: string;                           // 'early_bird' | 'regular' | 'late_week' | custom
  label_ar: string;
  label_en: string;
  /** ISO date — tier auto-rotates after this. NULL = always available. */
  deadline?: string;
  prices: Partial<Record<LpCurrency, number>>;
  stripe_price_ids?: Partial<Record<LpCurrency, string>>;
}

export interface LpGroupCode {
  code: string;
  discount_pct: number;
  min_pax: number;
}

export interface LpPaymentConfig {
  enabled: boolean;
  currencies: LpCurrency[];
  tiers: LpPaymentTier[];
  group_codes?: LpGroupCode[];
  alumni_unlock_early_bird?: boolean;
}

// ── Analytics config ────────────────────────────────────────────────────────
export interface LpAnalyticsConfig {
  ga4_id?: string;                        // overrides site default
  meta_pixel_id?: string;
  tiktok_pixel_id?: string;
  conversion_event_name?: string;         // default 'lp_lead_submit'
}

// ── Type guards ─────────────────────────────────────────────────────────────
export function isLpComposition(v: unknown): v is LpComposition {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isLpLeadCaptureConfig(v: unknown): v is LpLeadCaptureConfig {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { enabled?: unknown }).enabled === 'boolean'
  );
}

export function isLpPaymentConfig(v: unknown): v is LpPaymentConfig {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { enabled?: unknown }).enabled === 'boolean' &&
    Array.isArray((v as { tiers?: unknown }).tiers)
  );
}

export function isLpAnalyticsConfig(v: unknown): v is LpAnalyticsConfig {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Pick the active payment tier given a `now` timestamp + the configured tiers,
 *  ordered by deadline ascending (NULL last). */
export function pickActiveTier(tiers: LpPaymentTier[], now: Date = new Date()): LpPaymentTier | null {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return ad - bd;
  });
  for (const t of sorted) {
    if (!t.deadline) return t;
    if (new Date(t.deadline).getTime() >= now.getTime()) return t;
  }
  // All deadlines past → return the last (most-late) tier
  return sorted[sorted.length - 1];
}
