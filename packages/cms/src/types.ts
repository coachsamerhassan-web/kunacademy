// @kunacademy/cms — Content types matching the 5-sheet CMS architecture
// Sheet schemas from Blueprint v2, Board Critique §Part 4
//
// 5 sheets:
//   1. PageContent — Static page content (hero, body, cta per page slug)
//   2. Programs — 59-program catalog with pricing, dates, nav groups
//   3. Services — Coaching sessions, mentoring, pricing, discounts
//   4. Team — Coaches, instructors, credentials
//   5. Settings — Global config (social, contact, footer, branding)

// ── Shared ──────────────────────────────────────────────────────────────────

/** Bilingual string pair — every content field has AR + EN */
export interface BilingualText {
  ar: string;
  en: string;
}

/** Audit columns present on every sheet row */
export interface AuditFields {
  published: boolean;
  last_edited_by?: string;
  last_edited_at?: string;
}

/** Theater pricing — Gulf (AED), Egypt (EGP), Global (USD/EUR) */
export interface TheaterPricing {
  price_aed: number;
  price_egp: number;
  price_usd: number;
  price_eur: number;
}

// ── Sheet 1: Page Content ───────────────────────────────────────────────────

export interface PageContent extends AuditFields {
  /** Page URL slug, e.g. "about", "contact", "faq" */
  slug: string;
  /** Section within the page: "hero", "body", "cta", "stats", "faq" */
  section: string;
  /** Content key within the section, e.g. "title", "subtitle", "description" */
  key: string;
  /** Arabic value */
  value_ar: string;
  /** English value */
  value_en: string;
  /** Page type: "page" | "landing" | "legal" */
  type: 'page' | 'landing' | 'legal';
  /** SEO: meta title */
  meta_title_ar?: string;
  meta_title_en?: string;
  /** SEO: meta description */
  meta_description_ar?: string;
  meta_description_en?: string;
  /** SEO: Open Graph image URL */
  og_image_url?: string;
  /** SEO: canonical URL override */
  canonical_url?: string;
  /** Landing pages: hero image URL */
  hero_image_url?: string;
  /** Landing pages: CTA text */
  cta_text_ar?: string;
  cta_text_en?: string;
  /** Landing pages: CTA link */
  cta_url?: string;
  /** Landing pages: form embed code */
  form_embed?: string;
}

// ── Sheet 2: Programs ───────────────────────────────────────────────────────

/** Navigation groups for the mega-menu
 *
 * Canon Phase 2 (2026-04-21) added `'family'` to host the Family & Couples
 * track (Wisal + Seeds-Youth/Parents/Caregivers). Render order is:
 *   certifications → courses → retreats → micro-courses → family → corporate → free → community.
 */
export type NavGroup =
  | 'certifications'
  | 'courses'
  | 'retreats'
  | 'micro-courses'
  | 'family'
  | 'corporate'
  | 'free'
  | 'community';

/** Program type classification
 *
 * Canon Phase 2 (2026-04-21) added `'service'` for proposal-based engagements
 * (Wisal, Seeds tiers). Service-type programs:
 *   - suppress pricing / cohort-date / installment UI on their detail page
 *   - render `cta_type === 'request-proposal'` button
 *   - may still carry TheaterPricing columns for internal/proposal use
 */
export type ProgramType =
  | 'certification'
  | 'diploma'
  | 'recorded-course'
  | 'live-course'
  | 'retreat'
  | 'micro-course'
  | 'workshop'
  | 'free-resource'
  | 'service';

/** Program format */
export type ProgramFormat = 'online' | 'in-person' | 'hybrid';

// ── Canon Phase 2 supporting types ──────────────────────────────────────────

/** CTA variant — locked bilingual labels are rendered client-side by the
 *  program detail page from a whitelisted map. Anything outside this union
 *  must be rejected at write-validation (no arbitrary cta strings).
 */
export type CtaType =
  | 'enroll'              // default — existing behaviour
  | 'request-proposal'    // Wisal + Seeds tiers
  | 'register-interest'   // Gated-launch Ihya retreats (pre-date state)
  | 'notify-me'           // Alternative copy for gated-launch closing CTA
  | 'contact';            // Fallback for bespoke engagements

/** A single duration offering for programs that are sold at multiple lengths
 *  (e.g. GPS 3h vs 6h, Ihya 5-day vs 7-day). `public_default` drives which
 *  duration is shown first on the public detail page; admin UI can still
 *  expose all of them via a selector.
 */
export interface DurationOffering {
  hours: number;           // integer hours (3, 6) OR minutes-as-hours fraction — canonical is 3 | 6 for GPS
  label_ar: string;
  label_en: string;
  public_default: boolean;
}

/** Per-variant, per-duration, per-currency price matrix.
 *
 * Shape (Samer-approved Q8, 2026-04-21):
 *   Record<variant_slug, Record<'3h'|'6h', Record<'aed'|'egp'|'usd'|'eur', number | null>>>
 *
 * `null` at any leaf = price intentionally hidden (admin hasn't set it yet).
 * `0` = free (still show the line, do not hide).
 */
export type PricingByDuration = Record<
  string, // variant slug (e.g. 'gps-of-life', 'gps-accelerator', 'gps-couples', 'gps-entrepreneurs')
  Partial<Record<'3h' | '6h', Partial<Record<'aed' | 'egp' | 'usd' | 'eur', number | null>>>>
>;

export interface Program extends AuditFields, TheaterPricing {
  slug: string;
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
  description_ar?: string;
  description_en?: string;
  /** Navigation group for mega-menu placement */
  nav_group: NavGroup;
  type: ProgramType;
  format: ProgramFormat;
  /** Location (for in-person/hybrid) */
  location?: string;
  /** Instructor/lead coach slug (references Sheet 4) */
  instructor_slug?: string;
  /** Duration: "40 hours", "3 days", etc. */
  duration?: string;
  /** Next cohort start date (ISO 8601) */
  next_start_date?: string;
  /** Enrollment deadline (ISO 8601) */
  enrollment_deadline?: string;
  /** Early bird pricing */
  early_bird_price_aed?: number;
  early_bird_deadline?: string;
  /** Discount */
  discount_percentage?: number;
  discount_valid_until?: string;
  /** Installments via Tabby */
  installment_enabled: boolean;
  /** Bundle reference (for package deals) */
  bundle_id?: string;
  /** ICF accreditation */
  is_icf_accredited: boolean;
  icf_details?: string;
  /** CCE units (for credential renewal) */
  cce_units?: number;
  /** Materials folder URL (Google Drive/WorkDrive) */
  materials_folder_url?: string;
  /** Access duration in days after program ends */
  access_duration_days?: number;
  /** Learning journey stages (Hakima's pedagogical model) */
  journey_stages?: string;
  /** Hero background image for program detail page */
  hero_image_url?: string;
  /** Thumbnail/card image */
  thumbnail_url?: string;
  /** Featured on homepage */
  is_featured: boolean;
  is_free: boolean;
  /** Display order within nav_group */
  display_order: number;
  /** SEO fields */
  meta_title_ar?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_en?: string;
  og_image_url?: string;
  promo_video_url?: string;
  /** Program category for filtering: 'certification' | 'specialization' | 'professional' | 'foundational' | 'micro' */
  category?: string;
  /** Parent program code (e.g., STCE for all STCE levels) */
  parent_code?: string;
  /** Comma-separated prerequisite program slugs */
  prerequisite_codes?: string[];
  /** Program lifecycle: 'active' | 'coming-soon' | 'archived' | 'paused' */
  status?: 'active' | 'coming-soon' | 'archived' | 'paused';
  /** Comma-separated pathway codes this program belongs to */
  pathway_codes?: string[];
  /** JSON string: array of { module_title_ar, module_title_en, hours, description_ar?, description_en? } */
  curriculum_json?: string;
  /** JSON string: array of { question_ar, question_en, answer_ar, answer_en } */
  faq_json?: string;
  /** Program-specific logo URL (from /Brand/programs logos/) */
  program_logo?: string;
  /** Google Doc ID for rich program content (rendered via fetchDocAsHtml) */
  content_doc_id?: string;

  // ── Canon Phase 2 extensions (2026-04-21) ──────────────────────────────
  // All fields below are OPTIONAL and ADDITIVE. Existing 34 programs validate
  // without providing any of them.

  /** Additional nav groups a program appears under (cross-listing).
   *  Example: Seeds-Caregivers may be primary `corporate` but cross-listed
   *  into `['family','certifications']`.
   */
  cross_list_nav_groups?: NavGroup[];

  /** Delivery formats supported (superset of `format`, for programs that
   *  can be delivered in multiple modes — e.g. online cohort + in-person weekend).
   */
  delivery_formats?: ProgramFormat[];

  /** Whether a single-track entry can be booked by an individual (true) or
   *  only sold as an institutional proposal (false). Default: true.
   */
  individually_bookable?: boolean;

  /** Whether a delivery certification is required to run this program as a
   *  licensed coach (e.g. Seeds-Caregivers → required to deliver Seeds-Parents).
   */
  delivery_certification_required?: boolean;

  /** Whether graduating this program grants a license to deliver another
   *  program to end-beneficiaries (Seeds-Caregivers grants delivery license
   *  for Seeds-Parents; STFC grants delivery license for Wisal).
   *  Interpreted as the slug of the downstream program the graduate may deliver.
   */
  grants_delivery_license?: string;

  /** Concept attribution — slug of the team member who designed this
   *  program. Single slug per Samer's Q9 decision (no array/structured).
   */
  concept_by?: string;

  /** CTA variant rendered on the public detail page. Defaults to `'enroll'`
   *  when omitted to preserve existing behavior for the 34 legacy programs.
   */
  cta_type?: CtaType;

  /** Available durations (GPS variants: 3h and 6h). When present, pricing
   *  UI shows a duration selector; when absent, `duration` string is used.
   */
  durations_offered?: DurationOffering[];

  /** Per-variant, per-duration, per-currency price matrix. See PricingByDuration. */
  pricing_by_duration?: PricingByDuration;

  /** Track accent color (hex or Tailwind token) used to visually distinguish
   *  cross-cutting tracks (e.g. Ihya retreats, Seeds tiers) in the mega-menu
   *  and cards.
   */
  track_color?: string;

  /** Free-text delivery notes for admins (internal — never surfaced to public).
   *  Enforced by Sani's IP-grep guard: never copy session-count or beat
   *  structure into public `description_*` fields; this field is the only
   *  place operational/delivery detail is allowed to live.
   */
  delivery_notes?: string;

  // ── Canon W3-A extensions (2026-04-22, migration 0049) ─────────────────
  /** Gallery images rendered below the body on the program detail page.
   *  Each entry is a structured descriptor; string URLs are accepted for
   *  backward-compat and treated as {url} with no alt-text. Cross-attributed
   *  images (same asset on sibling-Ihya pages) set `cross_attrib: true` to
   *  trigger the "من مواسم إحياء السابقة / from previous Ihya seasons" caption.
   */
  gallery_json?: GalleryImage[];

  /** Background image for the closing CTA band. Track-color tinted per
   *  variant at render (scrim gradient + `track_color` overlay).
   */
  closing_bg_url?: string;
}

/** Gallery image descriptor for program detail page Gallery section. */
export interface GalleryImage {
  url: string;
  alt_ar?: string;
  alt_en?: string;
  /** `square` (1:1), `landscape` (16:9 or 21:9), `portrait`. Hints to renderer
   *  for grid placement. Absent → default `square`.
   */
  aspect?: 'square' | 'landscape' | 'portrait';
  caption_ar?: string;
  caption_en?: string;
  /** When true, render the "من مواسم إحياء السابقة / from previous Ihya seasons"
   *  cross-attribution caption (for sibling-Ihya reused assets).
   */
  cross_attrib?: boolean;
}

// ── Sheet 3: Services & Packages ────────────────────────────────────────────

/** Service audience category (Nashit's critique) */
export type ServiceCategory =
  | 'seeker'
  | 'student'
  | 'corporate'
  | 'coaching'
  | 'mentoring'
  | 'package';

export interface Service extends AuditFields, TheaterPricing {
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  /** Category determines booking flow visibility */
  category: ServiceCategory;
  /** Session duration in minutes */
  duration_minutes: number;
  /** Coach slug (references Sheet 4) — null = any available coach */
  coach_slug?: string;
  /** Package: number of sessions included */
  sessions_count?: number;
  /** Package: validity period in days */
  validity_days?: number;
  /** Discount */
  discount_percentage?: number;
  discount_valid_until?: string;
  /** Installments */
  installment_enabled: boolean;
  /** Bundle reference */
  bundle_id?: string;
  /** Display order */
  display_order: number;
  /** Free service flag */
  is_free?: boolean;
  /** Minimum coach credential level required to offer this service */
  coach_level_min?: string;
  /** Exact coach credential level required (exclusive) */
  coach_level_exact?: string;
  /** Restrict visibility to enrolled students only */
  student_only?: boolean;
  /** ICF credential this service supports (e.g. "ACC", "PCC", "MCC") */
  icf_credential_target?: string;
  /** Program slug this package belongs to (e.g. "manhajak") */
  program_slug?: string;
}

// ── Sheet 4: Team ───────────────────────────────────────────────────────────

/** ICF credential (external accreditation) */
export type IcfCredential = 'ACC' | 'PCC' | 'MCC';

/** Kun internal coaching level (Samer's assessment, independent of ICF) */
export type KunLevel = 'basic' | 'professional' | 'expert' | 'master';

/** Special service roles (beyond standard coaching) */
export type ServiceRole = 'mentor_coach' | 'advanced_mentor';

export interface TeamMember extends AuditFields {
  slug: string;
  name_ar: string;
  name_en: string;
  title_ar?: string;
  title_en?: string;
  bio_ar?: string;
  bio_en?: string;
  /** Google Doc ID for rich bio content (rendered via fetchDocAsHtml) */
  bio_doc_id?: string;
  /** Photo URL (Supabase Storage or external) */
  photo_url?: string;
  /**
   * Legacy Sheets column — raw string value from the coach_level column.
   * New code should use `icf_credential` (IcfCredential) and `kun_level` (KunLevel) instead.
   */
  coach_level?: string;
  /**
   * ICF credential level — mapped from the `coach_level` source column at load time.
   * Possible values: 'ACC' | 'PCC' | 'MCC' (uppercase from CMS) or 'none'.
   * Kept as `string` to avoid casing conflicts with the db enum (which uses lowercase).
   */
  icf_credential?: string;
  /** Kun internal level (basic/professional/expert/master) — column V in Sheets */
  kun_level?: KunLevel;
  /** ICF credential details (free text, e.g. "ICF ACC, 2024") */
  credentials?: string;
  /** Special service roles (comma-separated in sheet → string[]) — column W in Sheets */
  service_roles: string[];
  /** Specialties list (comma-separated in sheet → string[]) */
  specialties: string[];
  /** Coaching styles */
  coaching_styles: string[];
  /** Languages spoken */
  languages: string[];
  /** Whether they appear on the public site */
  is_visible: boolean;
  /** Whether they can receive bookings */
  is_bookable: boolean;
  /** Display order on team page */
  display_order: number;
}

// ── Sheet 5: Settings ───────────────────────────────────────────────────────

export interface SiteSetting extends AuditFields {
  /** Setting category: "social", "contact", "footer", "branding", "seo" */
  category: string;
  /** Setting key, e.g. "instagram_url", "phone_primary", "footer_tagline_ar" */
  key: string;
  /** Setting value */
  value: string;
}


// ── Sheet 7: Testimonials ───────────────────────────────────────────────────

export interface Testimonial extends AuditFields {
  /** Unique ID */
  id: string;
  /** Author name in Arabic */
  name_ar: string;
  /** Author name in English */
  name_en: string;
  /** Testimonial text in Arabic */
  content_ar: string;
  /** Testimonial text in English */
  content_en: string;
  /** Program they completed */
  program: string;
  /** Professional role/title */
  role_ar?: string;
  role_en?: string;
  /** Location (city, country) */
  location_ar?: string;
  location_en?: string;
  /** ISO country code (e.g. "EG", "SA", "US") */
  country_code?: string;
  /** Photo URL (optional — falls back to initial) */
  photo_url?: string;
  /** YouTube video URL (optional — makes it a video testimonial) */
  video_url?: string;
  /** Display on homepage carousel */
  is_featured: boolean;
  /** Sort order */
  display_order: number;
  /** Coach who delivered this testimonial's session (references Team slug) */
  coach_slug?: string;
}

// ── Quotes ─────────────────────────────────────────────────────────────────

export interface Quote extends AuditFields {
  quote_id: string;
  author_ar: string;
  author_en: string;
  content_ar: string;
  content_en: string;
  category?: string;
  /** ISO 8601 scheduled display date — used for date-based daily rotation */
  date?: string;
  display_order: number;
}

// ── Sheet 8: Events ─────────────────────────────────────────────────────────

export type EventLocationType = 'in-person' | 'online' | 'hybrid';

export interface Event extends AuditFields {
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  /** ISO 8601 date string */
  date_start: string;
  /** ISO 8601 date string (same as start for single-day events) */
  date_end?: string;
  location_ar?: string;
  location_en?: string;
  location_type: EventLocationType;
  capacity?: number;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  image_url?: string;
  promo_video_url?: string;
  /** Slug referencing Programs sheet — used to show program logo overlay on event card */
  program_slug?: string;
  /** Registration / booking URL */
  registration_url?: string;
  /** "open" | "sold_out" | "completed" — derived from date if not set */
  status?: 'open' | 'sold_out' | 'completed';
  /** Comma-separated slugs referencing Team sheet */
  speaker_slugs: string[];
  /** ISO 8601 date string */
  registration_deadline?: string;
  is_featured: boolean;
  display_order: number;
}

// ── Sheet 9: Blog ───────────────────────────────────────────────────────────

export interface BlogPost extends AuditFields {
  slug: string;
  title_ar: string;
  title_en: string;
  excerpt_ar?: string;
  excerpt_en?: string;
  /** Full article content (Markdown or rich text) */
  content_ar?: string;
  content_en?: string;
  /** Google Doc ID for rich article content (rendered via fetchDocAsHtml) */
  content_doc_id?: string;
  featured_image_url?: string;
  category?: string;
  /** Comma-separated tags */
  tags: string[];
  /** Author slug referencing Team sheet */
  author_slug?: string;
  /** ISO 8601 date string */
  published_at?: string;
  reading_time_minutes?: number;
  is_featured: boolean;
  display_order: number;
  /** SEO fields */
  meta_title_ar?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_en?: string;
}

// ── Sheet 6: Pathfinder ──────────────────────────────────────────────────────

/** A single answer option within a Pathfinder question */
export interface PathfinderAnswer {
  id: string;
  text_ar: string;
  text_en: string;
  /** Optional icon name (from Lucide icon set) */
  icon?: string;
  /** Optional longer description shown below the answer text */
  description_ar?: string;
  description_en?: string;
  /** Scoring weights per program category — used by pathfinder-scorer */
  category_weights?: Record<string, number>;
}

/** Pathfinder question tree node — for the guided recommendation flow */
export interface PathfinderQuestion {
  /** Unique question identifier, e.g. "q1", "q2" */
  question_id: string;
  /** Parent answer that leads to this question (empty = root question) */
  parent_answer_id: string;
  question_ar: string;
  question_en: string;
  /** JSON-encoded answer options */
  answers: PathfinderAnswer[];
  /** Optional video URL for leaf/recommendation nodes */
  video_url?: string;
  /** Program/service slug recommended at this leaf */
  recommendation_slug?: string;
  /** Audience type */
  type: 'individual' | 'corporate';
  published: boolean;
  last_edited_by?: string;
  last_edited_at?: string;
}

// ── Sheet 10: Corporate Benefits (Pathfinder corporate flow) ────────────────
//
// Phase 3d migration (2026-04-21). Powers the corporate direction-select +
// benefits-quiz steps in /pathfinder/assess. Two related entities:
//   - Direction: one of 4 strategic buckets (leadership_development,
//     organizational_transformation, individual_coaching, custom_program)
//   - Benefit: a specific capability inside a direction (33 total)
//
// The `custom_program` direction uses benefits_mode='all' meaning the UI
// should flatten benefits from every other direction (previously encoded as
// the JSON sentinel `"benefits": "all"`).

export type CorporateBenefitsMode = 'list' | 'all';
export type CorporateRoiCategory =
  | 'productivity'
  | 'turnover'
  | 'absenteeism'
  | 'engagement'
  | 'conflict';

export interface CorporateBenefit extends AuditFields {
  slug: string;
  direction_slug: string;
  label_ar: string;
  label_en: string;
  description_ar?: string;
  description_en?: string;
  citation_ar?: string;
  citation_en?: string;
  benchmark_improvement_pct: number;
  roi_category: CorporateRoiCategory;
  self_assessment_prompt_ar?: string;
  self_assessment_prompt_en?: string;
  display_order: number;
}

export interface CorporateBenefitDirection extends AuditFields {
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  icon?: string;
  benefits_mode: CorporateBenefitsMode;
  display_order: number;
  /** Populated by getAllCorporateBenefits() joining children. */
  benefits?: CorporateBenefit[];
}

/**
 * Legacy-shape payload matching the old corporate-benefits.json file.
 * Returned by DbContentProvider.getCorporateBenefitsData() so the existing
 * PathfinderEngine client component can consume the DB output with zero
 * prop-shape changes. `benefits: 'all'` sentinel preserved for custom_program.
 */
export interface CorporateBenefitsData {
  version: string;
  directions: Array<{
    id: string;
    title_ar: string;
    title_en: string;
    description_ar: string;
    description_en: string;
    icon: string;
    benefits:
      | 'all'
      | Array<{
          id: string;
          label_ar: string;
          label_en: string;
          description_ar: string;
          description_en: string;
          citation_ar: string;
          citation_en: string;
          benchmark_improvement_pct: number;
          roi_category: CorporateRoiCategory;
          self_assessment_prompt_ar: string;
          self_assessment_prompt_en: string;
        }>;
  }>;
}

// ── Provider Interface ──────────────────────────────────────────────────────

/** Content fetched for a specific page — grouped by section */
export type PageSections = Record<string, Record<string, BilingualText>>;

/** Aggregated settings by category */
export type SettingsMap = Record<string, Record<string, string>>;
