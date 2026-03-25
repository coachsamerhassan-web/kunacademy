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


  // ── Sheet 7: Testimonials ────────────────────────────────────────────

  /** Get all published testimonials */
  getAllTestimonials(): Promise<Testimonial[]>;

  /** Get featured testimonials (for homepage carousel) */
  getFeaturedTestimonials(): Promise<Testimonial[]>;

  // ── Cache Control ─────────────────────────────────────────────────────

  /** Invalidate all cached data (called by revalidation webhook) */
  invalidateCache(): Promise<void>;
}
