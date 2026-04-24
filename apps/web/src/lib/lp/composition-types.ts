/**
 * Wave 14 LP-INFRA — Landing-page composition + config types.
 *
 * These mirror the JSONB columns added on `landing_pages` in migration 0052.
 * All shapes are deliberately permissive: every sub-field is optional so the
 * renderer can skip missing sections gracefully and the admin can author
 * partial pages incrementally.
 *
 * Source of truth: Project Memory/KUN-Features/Waves/14-LANDING-PAGE-INFRASTRUCTURE.md §3
 */

// ── Hero (top of page) ──────────────────────────────────────────────────────
export interface LpHero {
  headline_ar?: string;
  headline_en?: string;
  subheadline_ar?: string;
  subheadline_en?: string;
  background_image_url?: string;
  background_overlay_color?: string;     // CSS color; default rgba(30,27,75,0.85)
  cta_label_ar?: string;
  cta_label_en?: string;
  cta_anchor?: string;                   // '#lead-form' | '#payment' | external URL
  badge_label_ar?: string;
  badge_label_en?: string;
}

// ── Section item (for list-style sections) ──────────────────────────────────
export interface LpSectionItem {
  label_ar?: string;
  label_en?: string;
  body_ar?: string;
  body_en?: string;
  icon?: string;                          // emoji or icon hint
  meta_ar?: string;                       // small annotation, e.g. price subtext
  meta_en?: string;
}

// ── Section (one body block) ────────────────────────────────────────────────
export type LpSectionType =
  | 'mirror'         // world-mirror or pain-mirror — narrative + optional data
  | 'reframe'        // hook line / pivot
  | 'description'    // 4-layer description (identity → invitation → impressions → glimpse)
  | 'benefits'       // outcomes list
  | 'who_for'        // audience match
  | 'who_not_for'    // audience anti-match (must include therapy boundary line)
  | 'format'         // date / time / location / duration
  | 'price'          // tier display (consumes payment_config tiers if present)
  | 'group_alumni'   // group-discount + alumni rule
  | 'credibility'    // trainer/host credentials
  | 'objections'     // anticipated objections + reframes
  | 'faq'            // Q&A list
  | 'custom';        // free-form rich text

export interface LpSection {
  type: LpSectionType;
  title_ar?: string;
  title_en?: string;
  body_ar?: string;
  body_en?: string;
  items?: LpSectionItem[];
  cta_label_ar?: string;
  cta_label_en?: string;
  cta_anchor?: string;
  /** Visual variant hint to the renderer. Default 'surface'. */
  background?: 'white' | 'surface' | 'surface-low' | 'primary' | 'dark' | 'accent-tint';
  /** Anchor id for in-page nav (e.g. 'lead-form', 'payment'). */
  anchor_id?: string;
}

// ── Thank-you surface ───────────────────────────────────────────────────────
export interface LpThankYou {
  headline_ar?: string;
  headline_en?: string;
  body_ar?: string;
  body_en?: string;
  cta_label_ar?: string;
  cta_label_en?: string;
  cta_url?: string;                       // optional follow-up link (e.g. WhatsApp)
}

// ── Composition (whole page minus hero is sections[]) ───────────────────────
export interface LpComposition {
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
