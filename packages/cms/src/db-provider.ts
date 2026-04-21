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

  // ── MIGRATED: PageContent / LandingPages — Phase 2c ──────────────────────

  async getPageContent(slug: string): Promise<PageSections> {
    try {
      const { db, and, eq } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db
        .select({ sections_json: landing_pages.sections_json })
        .from(landing_pages)
        .where(and(eq(landing_pages.slug, slug), eq(landing_pages.published, true)))
        .limit(1);
      const row = rows[0];
      if (!row) return {};
      return (row.sections_json ?? {}) as PageSections;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getPageContent(${slug}); falling back to JSON: ${msg}`);
      return this.fallback.getPageContent(slug);
    }
  }

  async getAllPageSlugs(): Promise<string[]> {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db
        .select({ slug: landing_pages.slug })
        .from(landing_pages)
        .where(eq(landing_pages.published, true));
      return rows.map((r) => r.slug);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllPageSlugs; falling back to JSON: ${msg}`);
      return this.fallback.getAllPageSlugs();
    }
  }

  async getPageSeo(slug: string): Promise<{
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  } | null> {
    try {
      const { db, and, eq } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db
        .select({ seo_meta_json: landing_pages.seo_meta_json })
        .from(landing_pages)
        .where(and(eq(landing_pages.slug, slug), eq(landing_pages.published, true)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const seo = (row.seo_meta_json ?? {}) as {
        meta_title_ar?: string;
        meta_title_en?: string;
        meta_description_ar?: string;
        meta_description_en?: string;
        og_image_url?: string;
        canonical_url?: string;
      };
      // Return null when the JSONB is empty so existing consumers can fall through cleanly.
      if (Object.keys(seo).length === 0) return null;
      return seo;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getPageSeo(${slug}); falling back to JSON: ${msg}`);
      return this.fallback.getPageSeo(slug);
    }
  }

  async getLandingPages(): Promise<PageContent[]> {
    try {
      const { db, and, eq } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(landing_pages)
        .where(and(eq(landing_pages.published, true), eq(landing_pages.page_type, 'landing')));

      // Flatten each DB row back into the legacy PageContent row-shape the CMS type expects.
      // A page in the DB = 1 row; in the legacy shape it's one PageContent per (section, key).
      // We emit one "synthetic" PageContent per (section, key) pair so consumers stay compatible.
      const out: PageContent[] = [];
      for (const r of rows) {
        const sections = (r.sections_json ?? {}) as PageSections;
        const seo = (r.seo_meta_json ?? {}) as {
          meta_title_ar?: string;
          meta_title_en?: string;
          meta_description_ar?: string;
          meta_description_en?: string;
          og_image_url?: string;
          canonical_url?: string;
        };
        const hero = (r.hero_json ?? {}) as {
          hero_image_url?: string;
          cta_text_ar?: string;
          cta_text_en?: string;
          cta_url?: string;
          form_embed?: string;
        };
        for (const [section, keys] of Object.entries(sections)) {
          for (const [key, bi] of Object.entries(keys)) {
            out.push({
              slug: r.slug,
              section,
              key,
              value_ar: bi.ar ?? '',
              value_en: bi.en ?? '',
              type: (r.page_type as 'page' | 'landing' | 'legal') ?? 'landing',
              meta_title_ar: seo.meta_title_ar,
              meta_title_en: seo.meta_title_en,
              meta_description_ar: seo.meta_description_ar,
              meta_description_en: seo.meta_description_en,
              og_image_url: seo.og_image_url,
              canonical_url: seo.canonical_url,
              hero_image_url: hero.hero_image_url,
              cta_text_ar: hero.cta_text_ar,
              cta_text_en: hero.cta_text_en,
              cta_url: hero.cta_url,
              form_embed: hero.form_embed,
              published: r.published,
              last_edited_by: r.last_edited_by ?? undefined,
              last_edited_at: r.last_edited_at ?? undefined,
            });
          }
        }
      }
      return out;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getLandingPages; falling back to JSON: ${msg}`);
      return this.fallback.getLandingPages();
    }
  }

  // ── Phase 2c extension methods — not on base ContentProvider interface ────

  /**
   * Fetch one landing-page row by slug and locale.
   * Returns locale-projected content + metadata for the /[locale]/landing/[slug] route.
   * `locale` filters the bilingual sections_json into a flat Record<string,string>.
   */
  async getLandingPageBySlug(locale: 'ar' | 'en', slug: string): Promise<{
    slug: string;
    page_type: 'page' | 'landing' | 'legal';
    program_slug: string | null;
    sections: Record<string, Record<string, string>>;
    hero: {
      hero_image_url?: string;
      cta_text?: string;
      cta_url?: string;
      form_embed?: string;
    };
    seo: {
      meta_title?: string;
      meta_description?: string;
      og_image_url?: string;
      canonical_url?: string;
    };
    published: boolean;
  } | null> {
    try {
      const { db, and, eq } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(landing_pages)
        .where(and(eq(landing_pages.slug, slug), eq(landing_pages.published, true)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;

      const sectionsJson = (row.sections_json ?? {}) as PageSections;
      const heroJson = (row.hero_json ?? {}) as {
        hero_image_url?: string;
        cta_text_ar?: string;
        cta_text_en?: string;
        cta_url?: string;
        form_embed?: string;
      };
      const seoJson = (row.seo_meta_json ?? {}) as {
        meta_title_ar?: string;
        meta_title_en?: string;
        meta_description_ar?: string;
        meta_description_en?: string;
        og_image_url?: string;
        canonical_url?: string;
      };

      // Project bilingual sections → single-locale strings with graceful AR↔EN fallback
      const sections: Record<string, Record<string, string>> = {};
      for (const [section, keys] of Object.entries(sectionsJson)) {
        sections[section] = {};
        for (const [key, bi] of Object.entries(keys)) {
          sections[section][key] = locale === 'ar'
            ? (bi.ar || bi.en || '')
            : (bi.en || bi.ar || '');
        }
      }

      return {
        slug: row.slug,
        page_type: (row.page_type as 'page' | 'landing' | 'legal') ?? 'page',
        program_slug: row.program_slug ?? null,
        sections,
        hero: {
          hero_image_url: heroJson.hero_image_url,
          cta_text: locale === 'ar'
            ? (heroJson.cta_text_ar || heroJson.cta_text_en)
            : (heroJson.cta_text_en || heroJson.cta_text_ar),
          cta_url: heroJson.cta_url,
          form_embed: heroJson.form_embed,
        },
        seo: {
          meta_title: locale === 'ar' ? seoJson.meta_title_ar : seoJson.meta_title_en,
          meta_description: locale === 'ar' ? seoJson.meta_description_ar : seoJson.meta_description_en,
          og_image_url: seoJson.og_image_url,
          canonical_url: seoJson.canonical_url,
        },
        published: row.published,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getLandingPageBySlug(${slug}): ${msg}`);
      return null;
    }
  }

  /**
   * Admin/listing helper — returns every landing page row (including unpublished).
   * If `locale` is passed, the sections field is projected; otherwise raw bilingual
   * JSONB is returned for editing.
   */
  async getAllLandingPages(locale?: 'ar' | 'en'): Promise<Array<{
    id: string;
    slug: string;
    page_type: 'page' | 'landing' | 'legal';
    program_slug: string | null;
    sections: PageSections | Record<string, Record<string, string>>;
    hero_json: Record<string, unknown>;
    seo_meta_json: Record<string, unknown>;
    published: boolean;
    published_at: string | null;
    last_edited_at: string | null;
  }>> {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(landing_pages).orderBy(asc(landing_pages.slug));
      return rows.map((r) => {
        const sectionsJson = (r.sections_json ?? {}) as PageSections;
        let sections: PageSections | Record<string, Record<string, string>> = sectionsJson;
        if (locale) {
          const projected: Record<string, Record<string, string>> = {};
          for (const [section, keys] of Object.entries(sectionsJson)) {
            projected[section] = {};
            for (const [key, bi] of Object.entries(keys)) {
              projected[section][key] = locale === 'ar'
                ? (bi.ar || bi.en || '')
                : (bi.en || bi.ar || '');
            }
          }
          sections = projected;
        }
        return {
          id: r.id,
          slug: r.slug,
          page_type: (r.page_type as 'page' | 'landing' | 'legal') ?? 'page',
          program_slug: r.program_slug ?? null,
          sections,
          hero_json: (r.hero_json ?? {}) as Record<string, unknown>,
          seo_meta_json: (r.seo_meta_json ?? {}) as Record<string, unknown>,
          published: r.published,
          published_at: r.published_at ?? null,
          last_edited_at: r.last_edited_at ?? null,
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllLandingPages: ${msg}`);
      return [];
    }
  }

  /** Fetch a single landing page row by UUID (admin edit). */
  async getLandingPage(id: string): Promise<{
    id: string;
    slug: string;
    page_type: 'page' | 'landing' | 'legal';
    program_slug: string | null;
    sections_json: PageSections;
    hero_json: Record<string, unknown>;
    seo_meta_json: Record<string, unknown>;
    published: boolean;
    published_at: string | null;
    last_edited_at: string | null;
  } | null> {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { landing_pages } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(landing_pages).where(eq(landing_pages.id, id)).limit(1);
      const r = rows[0];
      if (!r) return null;
      return {
        id: r.id,
        slug: r.slug,
        page_type: (r.page_type as 'page' | 'landing' | 'legal') ?? 'page',
        program_slug: r.program_slug ?? null,
        sections_json: (r.sections_json ?? {}) as PageSections,
        hero_json: (r.hero_json ?? {}) as Record<string, unknown>,
        seo_meta_json: (r.seo_meta_json ?? {}) as Record<string, unknown>,
        published: r.published,
        published_at: r.published_at ?? null,
        last_edited_at: r.last_edited_at ?? null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getLandingPage(${id}): ${msg}`);
      return null;
    }
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

  // ── MIGRATED: Services (Phase 2a) ────────────────────────────────────────
  async getAllServices(): Promise<Service[]> {
    try {
      const { db, eq, asc } = await import('@kunacademy/db');
      const { services, service_categories } = await import('@kunacademy/db/schema');
      // Left-join to get the category slug (CMS Service.category is ServiceCategory enum)
      const rows = await db
        .select({
          slug: services.slug,
          name_ar: services.name_ar,
          name_en: services.name_en,
          description_ar: services.description_ar,
          description_en: services.description_en,
          duration_minutes: services.duration_minutes,
          price_aed: services.price_aed,
          price_egp: services.price_egp,
          price_usd: services.price_usd,
          price_eur: services.price_eur,
          price_sar: services.price_sar,
          sessions_count: services.sessions_count,
          validity_days: services.validity_days,
          discount_percentage: services.discount_percentage,
          discount_valid_until: services.discount_valid_until,
          installment_enabled: services.installment_enabled,
          bundle_id: services.bundle_id,
          display_order: services.display_order,
          is_free: services.is_free,
          coach_slug: services.coach_slug,
          coach_level_min: services.coach_level_min,
          coach_level_exact: services.coach_level_exact,
          student_only: services.student_only,
          icf_credential_target: services.icf_credential_target,
          program_slug: services.program_slug,
          published: services.published,
          last_edited_by: services.last_edited_by,
          last_edited_at: services.last_edited_at,
          category_slug: service_categories.slug,
        })
        .from(services)
        .leftJoin(service_categories, eq(services.category_id, service_categories.id))
        .where(eq(services.published, true))
        .orderBy(asc(services.display_order));

      return rows.map((r) => this.rowToService(r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllServices; falling back to JSON: ${msg}`);
      return this.fallback.getAllServices();
    }
  }

  async getServicesByCategory(category: ServiceCategory): Promise<Service[]> {
    try {
      const all = await this.getAllServices();
      return all.filter((s) => s.category === category);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getServicesByCategory; falling back to JSON: ${msg}`);
      return this.fallback.getServicesByCategory(category);
    }
  }

  async getService(slug: string): Promise<Service | null> {
    try {
      const all = await this.getAllServices();
      return all.find((s) => s.slug === slug) ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getService; falling back to JSON: ${msg}`);
      return this.fallback.getService(slug);
    }
  }

  /**
   * Map a DB row (with joined category_slug) into the CMS Service type.
   * Category fallback: if no service_categories row exists (legacy rows), default to 'seeker'.
   */
  private rowToService(r: {
    slug: string | null;
    name_ar: string;
    name_en: string;
    description_ar: string | null;
    description_en: string | null;
    duration_minutes: number;
    price_aed: number | null;
    price_egp: number | null;
    price_usd: number | null;
    price_eur: number | null;
    price_sar: number | null;
    sessions_count: number | null;
    validity_days: number | null;
    discount_percentage: number | null;
    discount_valid_until: string | null;
    installment_enabled: boolean;
    bundle_id: string | null;
    display_order: number;
    is_free: boolean;
    coach_slug: string | null;
    coach_level_min: string | null;
    coach_level_exact: string | null;
    student_only: boolean;
    icf_credential_target: string | null;
    program_slug: string | null;
    published: boolean;
    last_edited_by: string | null;
    last_edited_at: Date | string | null;
    category_slug: string | null;
  }): Service {
    const cat = (r.category_slug ?? 'seeker') as ServiceCategory;
    return {
      slug: r.slug ?? '',
      name_ar: r.name_ar,
      name_en: r.name_en,
      description_ar: r.description_ar ?? undefined,
      description_en: r.description_en ?? undefined,
      category: cat,
      duration_minutes: r.duration_minutes,
      // TheaterPricing (price_aed/egp/usd/eur) — coerce nulls to 0
      // price_sar exists in DB but not in CMS TheaterPricing — intentionally not emitted
      price_aed: r.price_aed ?? 0,
      price_egp: r.price_egp ?? 0,
      price_usd: r.price_usd ?? 0,
      price_eur: r.price_eur ?? 0,
      coach_slug: r.coach_slug ?? undefined,
      sessions_count: r.sessions_count ?? undefined,
      validity_days: r.validity_days ?? undefined,
      discount_percentage: r.discount_percentage ?? undefined,
      discount_valid_until: r.discount_valid_until ?? undefined,
      installment_enabled: r.installment_enabled,
      bundle_id: r.bundle_id ?? undefined,
      display_order: r.display_order,
      is_free: r.is_free,
      coach_level_min: r.coach_level_min ?? undefined,
      coach_level_exact: r.coach_level_exact ?? undefined,
      student_only: r.student_only,
      icf_credential_target: r.icf_credential_target ?? undefined,
      program_slug: r.program_slug ?? undefined,
      published: r.published,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at:
        r.last_edited_at instanceof Date
          ? r.last_edited_at.toISOString()
          : r.last_edited_at ?? undefined,
    };
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
