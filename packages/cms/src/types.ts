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

/** Navigation groups for the mega-menu (7 groups from site structure) */
export type NavGroup =
  | 'certifications'
  | 'courses'
  | 'retreats'
  | 'micro-courses'
  | 'corporate'
  | 'free'
  | 'community';

/** Program type classification */
export type ProgramType =
  | 'certification'
  | 'diploma'
  | 'recorded-course'
  | 'live-course'
  | 'retreat'
  | 'micro-course'
  | 'workshop'
  | 'free-resource';

/** Program format */
export type ProgramFormat = 'online' | 'in-person' | 'hybrid';

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
}

// ── Sheet 3: Services & Packages ────────────────────────────────────────────

/** Service audience category (Nashit's critique) */
export type ServiceCategory = 'seeker' | 'student' | 'corporate';

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
}

// ── Sheet 4: Team ───────────────────────────────────────────────────────────

/** Coach/instructor credential level */
export type CoachLevel = 'ACC' | 'PCC' | 'MCC' | 'instructor' | 'facilitator' | 'guest';

export interface TeamMember extends AuditFields {
  slug: string;
  name_ar: string;
  name_en: string;
  title_ar?: string;
  title_en?: string;
  bio_ar?: string;
  bio_en?: string;
  /** Photo URL (Supabase Storage or external) */
  photo_url?: string;
  /** Credential level (for coaches) */
  coach_level?: CoachLevel;
  /** ICF credential details */
  credentials?: string;
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

// ── Provider Interface ──────────────────────────────────────────────────────

/** Content fetched for a specific page — grouped by section */
export type PageSections = Record<string, Record<string, BilingualText>>;

/** Aggregated settings by category */
export type SettingsMap = Record<string, Record<string, string>>;
