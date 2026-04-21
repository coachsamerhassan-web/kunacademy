// @kunacademy/cms — ContentProvider interface
// Abstraction layer per Blueprint v2 §Part 3 (Zoho Contingency Plan).
// Current: GoogleSheetsProvider. Fallback: JsonFileProvider (dev).
// Future: ZohoSheetProvider when credentials are ready.

import type {
  PageContent,
  PageSections,
  Program,
  Service,
  TeamMember,
  SiteSetting,
  SettingsMap,
  NavGroup,
  ServiceCategory,
  PathfinderQuestion,
  Testimonial,
  Event,
  BlogPost,
  Quote,
  CorporateBenefit,
  CorporateBenefitDirection,
  CorporateBenefitsData,
} from './types';

/**
 * ContentProvider — the single interface all CMS backends must implement.
 *
 * Design decisions:
 * - Methods return parsed, typed objects (not raw sheet rows)
 * - Filtering happens server-side (published flag, nav_group, etc.)
 * - Caching is the provider's responsibility (not the caller's)
 * - All methods are async to support both API and file-based providers
 */
export interface ContentProvider {
  /** Provider name for logging */
  readonly name: string;

  // ── Sheet 1: Page Content ───────────────────────────────────────────────

  /** Get all content for a page, grouped by section and key */
  getPageContent(slug: string): Promise<PageSections>;

  /** Get all pages (for sitemap generation) */
  getAllPageSlugs(): Promise<string[]>;

  /** Get SEO fields for a page (meta_title, meta_description, og_image) */
  getPageSeo(slug: string): Promise<{
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  } | null>;

  /** Get landing page data (for dynamic /[locale]/[slug] landing pages) */
  getLandingPages(): Promise<PageContent[]>;

  // ── Sheet 2: Programs ─────────────────────────────────────────────────

  /** Get all published programs */
  getAllPrograms(): Promise<Program[]>;

  /** Get programs by nav group (for mega-menu) */
  getProgramsByNavGroup(group: NavGroup): Promise<Program[]>;

  /** Get a single program by slug */
  getProgram(slug: string): Promise<Program | null>;

  /** Get featured programs (for homepage) */
  getFeaturedPrograms(): Promise<Program[]>;

  // ── Sheet 3: Services ─────────────────────────────────────────────────

  /** Get all published services */
  getAllServices(): Promise<Service[]>;

  /** Get services by category (seeker vs student vs corporate) */
  getServicesByCategory(category: ServiceCategory): Promise<Service[]>;

  /** Get a single service by slug */
  getService(slug: string): Promise<Service | null>;

  // ── Sheet 4: Team ─────────────────────────────────────────────────────

  /** Get all visible team members */
  getAllTeamMembers(): Promise<TeamMember[]>;

  /** Get bookable coaches (for booking flow) */
  getBookableCoaches(): Promise<TeamMember[]>;

  /** Get a single team member by slug */
  getTeamMember(slug: string): Promise<TeamMember | null>;

  // ── Sheet 5: Settings ─────────────────────────────────────────────────

  /** Get all settings grouped by category */
  getAllSettings(): Promise<SettingsMap>;

  /** Get a single setting value */
  getSetting(category: string, key: string): Promise<string | null>;

  // ── Sheet 6: Pathfinder ──────────────────────────────────────────────

  /** Get all published pathfinder questions */
  getAllPathfinderQuestions(): Promise<PathfinderQuestion[]>;

  /** Get root questions (no parent — the starting points) */
  getPathfinderRoots(type?: 'individual' | 'corporate'): Promise<PathfinderQuestion[]>;

  /** Get child questions for a given parent answer ID */
  getPathfinderChildren(parentAnswerId: string): Promise<PathfinderQuestion[]>;

  /**
   * Get the active pathfinder tree version (migration 0045, 2026-04-21).
   * Returns null if no active version exists (shouldn't happen in healthy setups).
   * Only DbContentProvider returns a real value; JsonFileProvider throws
   * migrated(); SheetsProvider returns null (legacy, un-migrated).
   */
  getActivePathfinderVersion(): Promise<{
    id: string;
    version_number: number;
    label: string;
  } | null>;


  // ── Sheet 7: Testimonials ────────────────────────────────────────────

  /** Get all published testimonials */
  getAllTestimonials(): Promise<Testimonial[]>;

  /** Get featured testimonials (for homepage carousel) */
  getFeaturedTestimonials(): Promise<Testimonial[]>;

  /** Get testimonials attributed to a specific coach (by slug) */
  getTestimonialsByCoach(coachSlug: string): Promise<Testimonial[]>;

  // ── Quotes ───────────────────────────────────────────────────────────

  getAllQuotes(): Promise<Quote[]>;

  getQuotesByCategory(category: string): Promise<Quote[]>;

  // ── Sheet 8: Events ─────────────────────────────────────────────────

  /** Get all published events */
  getAllEvents(): Promise<Event[]>;

  /** Get upcoming events (date_start >= today) */
  getUpcomingEvents(): Promise<Event[]>;

  /** Get a single event by slug */
  getEvent(slug: string): Promise<Event | null>;

  // ── Sheet 9: Blog ─────────────────────────────────────────────────

  /** Get all published blog posts */
  getAllBlogPosts(): Promise<BlogPost[]>;

  /** Get a single blog post by slug */
  getBlogPost(slug: string): Promise<BlogPost | null>;

  /** Get featured blog posts */
  getFeaturedBlogPosts(): Promise<BlogPost[]>;

  /** Get blog posts by category */
  getBlogPostsByCategory(category: string): Promise<BlogPost[]>;

  // ── Sheet 10: Corporate Benefits (Pathfinder corporate flow) ──────────

  /** Get all published corporate benefit directions (with children populated). */
  getAllCorporateBenefitDirections(): Promise<CorporateBenefitDirection[]>;

  /** Get all published corporate benefits across every direction. */
  getAllCorporateBenefits(): Promise<CorporateBenefit[]>;

  /** Get benefits scoped to one direction (by direction_slug). */
  getCorporateBenefitsByDirection(directionSlug: string): Promise<CorporateBenefit[]>;

  /** Get a single benefit by slug (its own slug, not direction's). */
  getCorporateBenefit(slug: string): Promise<CorporateBenefit | null>;

  /**
   * Returns the full legacy-shape payload for PathfinderEngine:
   *   { version, directions: [{ id, title_*, description_*, icon, benefits }] }
   * where benefits is either an array of Benefit objects or the sentinel 'all'
   * for directions whose benefits_mode='all'. Zero prop-shape churn downstream.
   */
  getCorporateBenefitsData(): Promise<CorporateBenefitsData>;

  // ── Cache Control ─────────────────────────────────────────────────────

  /** Invalidate all cached data (called by revalidation webhook) */
  invalidateCache(): Promise<void>;
}
