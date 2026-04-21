// @kunacademy/cms — DbContentProvider (Phase 1b)
// Reads migrated entities from Postgres; delegates un-migrated entities to a wrapped JsonFileProvider.
// As more entities migrate, override methods one-by-one and remove fallbacks.
//
// ⚠️  SERVER-ONLY — do NOT import this file from 'use client' components or the client barrel.
//     @kunacademy/db is lazy-imported inside each method to prevent client bundle breakage.

import type { ContentProvider } from './content-provider';
import type {
  PageContent,
  PageSections,
  Program,
  Service,
  TeamMember,
  SettingsMap,
  NavGroup,
  ServiceCategory,
  PathfinderQuestion,
  Testimonial,
  Event,
  BlogPost,
  Quote,
} from './types';
import { JsonFileProvider } from './json-provider';

export class DbContentProvider implements ContentProvider {
  readonly name = 'db';
  private fallback: JsonFileProvider;

  constructor(fallbackDataDir: string) {
    this.fallback = new JsonFileProvider(fallbackDataDir);
  }

  // ── MIGRATED: SiteSettings ────────────────────────────────────────────────

  async getAllSettings(): Promise<SettingsMap> {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { site_settings } = await import('@kunacademy/db/schema');
      const rows = await db
        .select({
          category: site_settings.category,
          key: site_settings.key,
          value: site_settings.value,
        })
        .from(site_settings)
        .where(eq(site_settings.published, true));

      const map: SettingsMap = {};
      for (const r of rows) {
        if (!map[r.category]) map[r.category] = {};
        map[r.category][r.key] = r.value;
      }
      return map;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllSettings; falling back to JSON: ${msg}`);
      return this.fallback.getAllSettings();
    }
  }

  async getSetting(category: string, key: string): Promise<string | null> {
    try {
      const map = await this.getAllSettings();
      return map[category]?.[key] ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getSetting; falling back to JSON: ${msg}`);
      return this.fallback.getSetting(category, key);
    }
  }

  // ── MIGRATED: Quotes ──────────────────────────────────────────────────────

  async getAllQuotes(): Promise<Quote[]> {
    try {
      const { db, eq, asc } = await import('@kunacademy/db');
      const { quotes } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(quotes)
        .where(eq(quotes.published, true))
        .orderBy(asc(quotes.display_order));

      return rows.map((r) => ({
        quote_id: r.quote_id,
        author_ar: r.author_ar,
        author_en: r.author_en,
        content_ar: r.content_ar,
        content_en: r.content_en,
        category: r.category ?? undefined,
        display_order: r.display_order,
        // CMS Quote.date maps to DB quote_date (ISO date string from pg `date` column)
        date: r.quote_date ?? undefined,
        published: r.published,
        last_edited_by: r.last_edited_by ?? undefined,
        last_edited_at: r.last_edited_at ?? undefined,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllQuotes; falling back to JSON: ${msg}`);
      return this.fallback.getAllQuotes();
    }
  }

  async getQuotesByCategory(category: string): Promise<Quote[]> {
    try {
      const all = await this.getAllQuotes();
      return all.filter((q) => q.category === category);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getQuotesByCategory; falling back to JSON: ${msg}`);
      return this.fallback.getQuotesByCategory(category);
    }
  }

  // ── MIGRATED: Testimonials ────────────────────────────────────────────────

  async getAllTestimonials(): Promise<Testimonial[]> {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { testimonials } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(testimonials)
        .orderBy(asc(testimonials.display_order));

      return rows.map((r) => ({
        // Prefer legacy_slug (CMS origin) for stable id; fall back to UUID string
        id: r.legacy_slug ?? r.id,
        name_ar: r.author_name_ar ?? '',
        name_en: r.author_name_en ?? '',
        content_ar: r.content_ar,
        content_en: r.content_en ?? '',
        // Testimonial.program is required string in CMS type — coerce null to empty
        program: r.program ?? '',
        role_ar: r.role_ar ?? undefined,
        role_en: r.role_en ?? undefined,
        location_ar: r.location_ar ?? undefined,
        location_en: r.location_en ?? undefined,
        country_code: r.country_code ?? undefined,
        // photo_url not stored in DB testimonials table; leave undefined
        photo_url: undefined,
        video_url: r.video_url ?? undefined,
        is_featured: r.is_featured ?? false,
        display_order: r.display_order,
        // DB testimonials table has no explicit published column — treat all rows as published
        published: true,
        last_edited_by: undefined,
        // Synthesize from migrated_at (ISO string) if present
        last_edited_at: r.migrated_at ?? undefined,
        coach_slug: undefined,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllTestimonials; falling back to JSON: ${msg}`);
      return this.fallback.getAllTestimonials();
    }
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    try {
      const all = await this.getAllTestimonials();
      return all.filter((t) => t.is_featured);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getFeaturedTestimonials; falling back to JSON: ${msg}`);
      return this.fallback.getFeaturedTestimonials();
    }
  }

  async getTestimonialsByCoach(coachSlug: string): Promise<Testimonial[]> {
    try {
      const all = await this.getAllTestimonials();
      return all.filter((t) => t.coach_slug === coachSlug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getTestimonialsByCoach; falling back to JSON: ${msg}`);
      return this.fallback.getTestimonialsByCoach(coachSlug);
    }
  }

  // ── DELEGATED: All other entities → JsonFileProvider ─────────────────────

  async getPageContent(slug: string): Promise<PageSections> {
    return this.fallback.getPageContent(slug);
  }

  async getAllPageSlugs(): Promise<string[]> {
    return this.fallback.getAllPageSlugs();
  }

  async getPageSeo(slug: string): Promise<{
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  } | null> {
    return this.fallback.getPageSeo(slug);
  }

  async getLandingPages(): Promise<PageContent[]> {
    return this.fallback.getLandingPages();
  }

  async getAllPrograms(): Promise<Program[]> {
    return this.fallback.getAllPrograms();
  }

  async getProgramsByNavGroup(group: NavGroup): Promise<Program[]> {
    return this.fallback.getProgramsByNavGroup(group);
  }

  async getProgram(slug: string): Promise<Program | null> {
    return this.fallback.getProgram(slug);
  }

  async getFeaturedPrograms(): Promise<Program[]> {
    return this.fallback.getFeaturedPrograms();
  }

  async getAllServices(): Promise<Service[]> {
    return this.fallback.getAllServices();
  }

  async getServicesByCategory(category: ServiceCategory): Promise<Service[]> {
    return this.fallback.getServicesByCategory(category);
  }

  async getService(slug: string): Promise<Service | null> {
    return this.fallback.getService(slug);
  }

  // ── MIGRATED: TeamMembers (instructors table) — Phase 2b ───────────────────

  /** Shared mapper: instructors row → CMS TeamMember shape. */
  private mapInstructorRow(r: {
    id: string;
    profile_id: string | null;
    slug: string;
    title_ar: string;
    title_en: string;
    name_ar: string | null;
    name_en: string | null;
    bio_ar: string | null;
    bio_en: string | null;
    bio_doc_id: string | null;
    photo_url: string | null;
    credentials: string | null;
    kun_level: string | null;
    icf_credential: string | null;
    coach_level_legacy: string | null;
    service_roles: string[] | null;
    specialties: string[] | null;
    coaching_styles: string[] | null;
    languages: string[] | null;
    is_visible: boolean | null;
    is_bookable: boolean;
    published: boolean;
    display_order: number | null;
    last_edited_by: string | null;
    last_edited_at: string | null;
  }): TeamMember {
    return {
      slug: r.slug,
      name_ar: r.name_ar ?? r.title_ar ?? '',
      name_en: r.name_en ?? r.title_en ?? '',
      title_ar: r.title_ar ?? undefined,
      title_en: r.title_en ?? undefined,
      bio_ar: r.bio_ar ?? undefined,
      bio_en: r.bio_en ?? undefined,
      bio_doc_id: r.bio_doc_id ?? undefined,
      photo_url: r.photo_url ?? undefined,
      // Legacy CMS column kept for audit (TeamMember.coach_level)
      coach_level: r.coach_level_legacy ?? r.icf_credential ?? undefined,
      icf_credential: r.icf_credential ?? undefined,
      kun_level: (r.kun_level as TeamMember['kun_level']) ?? undefined,
      credentials: r.credentials ?? undefined,
      service_roles: r.service_roles ?? [],
      specialties: r.specialties ?? [],
      coaching_styles: r.coaching_styles ?? [],
      languages: r.languages ?? [],
      is_visible: r.is_visible ?? true,
      is_bookable: r.is_bookable,
      display_order: r.display_order ?? 0,
      published: r.published,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at: r.last_edited_at ?? undefined,
    };
  }

  async getAllTeamMembers(): Promise<TeamMember[]> {
    try {
      const { db, and, eq, asc } = await import('@kunacademy/db');
      const { instructors } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(instructors)
        .where(and(eq(instructors.published, true), eq(instructors.is_visible, true)))
        .orderBy(asc(instructors.display_order));
      return rows.map((r) => this.mapInstructorRow(r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllTeamMembers; falling back to JSON: ${msg}`);
      return this.fallback.getAllTeamMembers();
    }
  }

  async getBookableCoaches(): Promise<TeamMember[]> {
    try {
      const all = await this.getAllTeamMembers();
      return all.filter((t) => t.is_bookable);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getBookableCoaches; falling back to JSON: ${msg}`);
      return this.fallback.getBookableCoaches();
    }
  }

  async getTeamMember(slug: string): Promise<TeamMember | null> {
    try {
      const { db, and, eq } = await import('@kunacademy/db');
      const { instructors } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(instructors)
        .where(and(eq(instructors.slug, slug), eq(instructors.published, true)))
        .limit(1);
      const row = rows[0];
      return row ? this.mapInstructorRow(row) : null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getTeamMember; falling back to JSON: ${msg}`);
      return this.fallback.getTeamMember(slug);
    }
  }

  /**
   * Phase 2b bridge — public coach-ratings display.
   * Looks up the instructor row by `profile_id` so `coach_ratings.coach_id`
   * (→ profiles.id) can be aggregated onto the instructor's public profile
   * without a fuzzy slug/name match. Returns null if no instructor is linked.
   *
   * Not part of the base ContentProvider interface — call as a DB extension.
   */
  async getInstructorByProfileId(profileId: string): Promise<TeamMember | null> {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { instructors } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(instructors)
        .where(eq(instructors.profile_id, profileId))
        .limit(1);
      const row = rows[0];
      return row ? this.mapInstructorRow(row) : null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getInstructorByProfileId: ${msg}`);
      return null;
    }
  }

  async getAllPathfinderQuestions(): Promise<PathfinderQuestion[]> {
    return this.fallback.getAllPathfinderQuestions();
  }

  async getPathfinderRoots(type?: 'individual' | 'corporate'): Promise<PathfinderQuestion[]> {
    return this.fallback.getPathfinderRoots(type);
  }

  async getPathfinderChildren(parentAnswerId: string): Promise<PathfinderQuestion[]> {
    return this.fallback.getPathfinderChildren(parentAnswerId);
  }

  async getAllEvents(): Promise<Event[]> {
    return this.fallback.getAllEvents();
  }

  async getUpcomingEvents(): Promise<Event[]> {
    return this.fallback.getUpcomingEvents();
  }

  async getEvent(slug: string): Promise<Event | null> {
    return this.fallback.getEvent(slug);
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return this.fallback.getAllBlogPosts();
  }

  async getBlogPost(slug: string): Promise<BlogPost | null> {
    return this.fallback.getBlogPost(slug);
  }

  async getFeaturedBlogPosts(): Promise<BlogPost[]> {
    return this.fallback.getFeaturedBlogPosts();
  }

  async getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
    return this.fallback.getBlogPostsByCategory(category);
  }

  async invalidateCache(): Promise<void> {
    // Invalidate JsonFileProvider cache; DB reads are always fresh
    await this.fallback.invalidateCache();
  }
}
