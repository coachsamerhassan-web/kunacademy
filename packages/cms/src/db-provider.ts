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
  CorporateBenefit,
  CorporateBenefitDirection,
  CorporateBenefitsData,
  CorporateBenefitsMode,
  CorporateRoiCategory,
} from './types';
import { JsonFileProvider } from './json-provider';

/**
 * Region-level price override shape returned by getProgramWithRegionPrice().
 * Exported so public-facing page components can type-check the optional field.
 */
export interface RegionPriceOverride {
  region: string;
  /** Price as a JS number (parsed from DB numeric string). */
  price: number;
  /** Currency code: AED | EGP | SAR | USD | EUR */
  currency: string;
  notes?: string;
}

export class DbContentProvider implements ContentProvider {
  readonly name = 'db';
  private fallback: JsonFileProvider;

  constructor(fallbackDataDir: string) {
    this.fallback = new JsonFileProvider(fallbackDataDir);
  }

  // ── MIGRATED: SiteSettings ────────────────────────────────────────────────

  async getAllSettings(): Promise<SettingsMap> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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
  }

  async getSetting(category: string, key: string): Promise<string | null> {
    const map = await this.getAllSettings();
    return map[category]?.[key] ?? null;
  }

  // ── MIGRATED: Quotes ──────────────────────────────────────────────────────

  async getAllQuotes(): Promise<Quote[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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
  }

  async getQuotesByCategory(category: string): Promise<Quote[]> {
    const all = await this.getAllQuotes();
    return all.filter((q) => q.category === category);
  }

  // ── MIGRATED: Testimonials ────────────────────────────────────────────────

  async getAllTestimonials(): Promise<Testimonial[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    const all = await this.getAllTestimonials();
    return all.filter((t) => t.is_featured);
  }

  async getTestimonialsByCoach(coachSlug: string): Promise<Testimonial[]> {
    const all = await this.getAllTestimonials();
    return all.filter((t) => t.coach_slug === coachSlug);
  }

  // ── MIGRATED: PageContent / LandingPages — Phase 2c ──────────────────────

  async getPageContent(slug: string): Promise<PageSections> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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
  }

  async getAllPageSlugs(): Promise<string[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
    const { db, eq } = await import('@kunacademy/db');
    const { landing_pages } = await import('@kunacademy/db/schema');
    const rows = await db
      .select({ slug: landing_pages.slug })
      .from(landing_pages)
      .where(eq(landing_pages.published, true));
    return rows.map((r) => r.slug);
  }

  async getPageSeo(slug: string): Promise<{
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  } | null> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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
  }

  async getLandingPages(): Promise<PageContent[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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

  // ── MIGRATED: Programs (Phase 2d) ─────────────────────────────────────────

  /**
   * DB row → CMS Program mapper. Numeric columns come back as strings from pg;
   * date columns as YYYY-MM-DD strings; text[] as string[]. We coerce pricing
   * to numbers (TheaterPricing requires number, coerce null → 0) and keep
   * other optional fields nullable via `?? undefined`.
   */
  private rowToProgram(r: {
    slug: string;
    title_ar: string;
    title_en: string;
    subtitle_ar: string | null;
    subtitle_en: string | null;
    description_ar: string | null;
    description_en: string | null;
    nav_group: string;
    type: string;
    format: string;
    status: string;
    category: string | null;
    parent_code: string | null;
    instructor_slug: string | null;
    location: string | null;
    duration: string | null;
    next_start_date: string | null;
    enrollment_deadline: string | null;
    access_duration_days: number | null;
    price_aed: string | number | null;
    price_egp: string | number | null;
    price_usd: string | number | null;
    price_eur: string | number | null;
    early_bird_price_aed: string | number | null;
    early_bird_deadline: string | null;
    discount_percentage: string | number | null;
    discount_valid_until: string | null;
    installment_enabled: boolean;
    bundle_id: string | null;
    is_icf_accredited: boolean;
    icf_details: string | null;
    cce_units: string | number | null;
    hero_image_url: string | null;
    thumbnail_url: string | null;
    program_logo: string | null;
    promo_video_url: string | null;
    prerequisite_codes: string[] | null;
    pathway_codes: string[] | null;
    curriculum_json: unknown;
    faq_json: unknown;
    journey_stages: string | null;
    materials_folder_url: string | null;
    content_doc_id: string | null;
    meta_title_ar: string | null;
    meta_title_en: string | null;
    meta_description_ar: string | null;
    meta_description_en: string | null;
    og_image_url: string | null;
    is_featured: boolean;
    is_free: boolean;
    display_order: number;
    published: boolean;
    last_edited_by: string | null;
    last_edited_at: Date | string | null;
    // Canon Phase 2 extensions (migration 0039)
    cross_list_nav_groups?: string[] | null;
    delivery_formats?: string[] | null;
    individually_bookable?: boolean | null;
    delivery_certification_required?: boolean | null;
    grants_delivery_license?: string | null;
    concept_by?: string | null;
    cta_type?: string | null;
    durations_offered?: unknown;
    pricing_by_duration?: unknown;
    track_color?: string | null;
    delivery_notes?: string | null;
    // Canon W3-A (migration 0049)
    gallery_json?: unknown;
    closing_bg_url?: string | null;
    // Canon W4 (migration 0051)
    long_description_ar?: unknown;
    long_description_en?: unknown;
  }): Program {
    const num = (v: string | number | null | undefined): number => {
      if (v === null || v === undefined || v === '') return 0;
      return typeof v === 'number' ? v : Number(v);
    };
    const numOpt = (v: string | number | null | undefined): number | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      return typeof v === 'number' ? v : Number(v);
    };
    return {
      slug: r.slug,
      title_ar: r.title_ar,
      title_en: r.title_en,
      subtitle_ar: r.subtitle_ar ?? undefined,
      subtitle_en: r.subtitle_en ?? undefined,
      description_ar: r.description_ar ?? undefined,
      description_en: r.description_en ?? undefined,
      nav_group: r.nav_group as Program['nav_group'],
      type: r.type as Program['type'],
      format: r.format as Program['format'],
      location: r.location ?? undefined,
      instructor_slug: r.instructor_slug ?? undefined,
      duration: r.duration ?? undefined,
      next_start_date: r.next_start_date ?? undefined,
      enrollment_deadline: r.enrollment_deadline ?? undefined,
      // TheaterPricing — coerce null → 0
      price_aed: num(r.price_aed),
      price_egp: num(r.price_egp),
      price_usd: num(r.price_usd),
      price_eur: num(r.price_eur),
      early_bird_price_aed: numOpt(r.early_bird_price_aed),
      early_bird_deadline: r.early_bird_deadline ?? undefined,
      discount_percentage: numOpt(r.discount_percentage),
      discount_valid_until: r.discount_valid_until ?? undefined,
      installment_enabled: r.installment_enabled,
      bundle_id: r.bundle_id ?? undefined,
      is_icf_accredited: r.is_icf_accredited,
      icf_details: r.icf_details ?? undefined,
      cce_units: numOpt(r.cce_units),
      materials_folder_url: r.materials_folder_url ?? undefined,
      access_duration_days: r.access_duration_days ?? undefined,
      journey_stages: r.journey_stages ?? undefined,
      hero_image_url: r.hero_image_url ?? undefined,
      thumbnail_url: r.thumbnail_url ?? undefined,
      is_featured: r.is_featured,
      is_free: r.is_free,
      display_order: r.display_order,
      meta_title_ar: r.meta_title_ar ?? undefined,
      meta_title_en: r.meta_title_en ?? undefined,
      meta_description_ar: r.meta_description_ar ?? undefined,
      meta_description_en: r.meta_description_en ?? undefined,
      og_image_url: r.og_image_url ?? undefined,
      promo_video_url: r.promo_video_url ?? undefined,
      category: r.category ?? undefined,
      parent_code: r.parent_code ?? undefined,
      prerequisite_codes: r.prerequisite_codes ?? [],
      status: r.status as Program['status'],
      pathway_codes: r.pathway_codes ?? [],
      curriculum_json:
        r.curriculum_json != null && typeof r.curriculum_json !== 'string'
          ? JSON.stringify(r.curriculum_json)
          : (r.curriculum_json as string | undefined) ?? undefined,
      faq_json:
        r.faq_json != null && typeof r.faq_json !== 'string'
          ? JSON.stringify(r.faq_json)
          : (r.faq_json as string | undefined) ?? undefined,
      program_logo: r.program_logo ?? undefined,
      content_doc_id: r.content_doc_id ?? undefined,
      published: r.published,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at:
        r.last_edited_at instanceof Date
          ? r.last_edited_at.toISOString()
          : r.last_edited_at ?? undefined,
      // ── Canon Phase 2 (migration 0039) — pass-through ────────────────────
      // Arrays: `?? undefined` so the Program type's `?: NavGroup[]` shape is
      //   honored (empty DB default `{}` → undefined at the TS layer keeps
      //   the "absent" semantic clean).
      // JSONB (durations_offered, pricing_by_duration): structure is validated
      //   by the API-layer write path; at read time we pass through as-typed.
      cross_list_nav_groups:
        r.cross_list_nav_groups && r.cross_list_nav_groups.length > 0
          ? (r.cross_list_nav_groups as Program['cross_list_nav_groups'])
          : undefined,
      delivery_formats:
        r.delivery_formats && r.delivery_formats.length > 0
          ? (r.delivery_formats as Program['delivery_formats'])
          : undefined,
      individually_bookable: r.individually_bookable ?? undefined,
      delivery_certification_required: r.delivery_certification_required ?? undefined,
      grants_delivery_license: r.grants_delivery_license ?? undefined,
      concept_by: r.concept_by ?? undefined,
      cta_type: (r.cta_type ?? undefined) as Program['cta_type'],
      durations_offered: r.durations_offered
        ? (r.durations_offered as Program['durations_offered'])
        : undefined,
      pricing_by_duration: r.pricing_by_duration
        ? (r.pricing_by_duration as Program['pricing_by_duration'])
        : undefined,
      track_color: r.track_color ?? undefined,
      delivery_notes: r.delivery_notes ?? undefined,
      // ── Canon W3-A (migration 0049) ────────────────────────────────────
      gallery_json: (() => {
        const raw = r.gallery_json;
        if (raw == null) return undefined;
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!Array.isArray(parsed)) return undefined;
          return parsed
            .map((item: unknown) => {
              if (typeof item === 'string') return { url: item };
              if (item && typeof item === 'object' && 'url' in item && typeof (item as { url: unknown }).url === 'string') {
                return item as import('./types').GalleryImage;
              }
              return null;
            })
            .filter((x): x is import('./types').GalleryImage => x !== null);
        } catch {
          return undefined;
        }
      })(),
      closing_bg_url: r.closing_bg_url ?? undefined,
      // ── Canon W4 (migration 0051) ──────────────────────────────────────
      long_description_ar: (() => {
        const raw = r.long_description_ar;
        if (raw == null) return undefined;
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
          }
          return parsed as import('./types').ProgramLongDescription;
        } catch {
          return undefined;
        }
      })(),
      long_description_en: (() => {
        const raw = r.long_description_en;
        if (raw == null) return undefined;
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
          }
          return parsed as import('./types').ProgramLongDescription;
        } catch {
          return undefined;
        }
      })(),
    };
  }

  async getAllPrograms(): Promise<Program[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
    const { db, eq, asc } = await import('@kunacademy/db');
    const { programs } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(programs)
      .where(eq(programs.published, true))
      .orderBy(asc(programs.display_order));
    return rows.map((r) => this.rowToProgram(r));
  }

  async getProgramsByNavGroup(group: NavGroup): Promise<Program[]> {
    const all = await this.getAllPrograms();
    return all.filter((p) => p.nav_group === group);
  }

  async getProgram(slug: string): Promise<Program | null> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
    const { db, and, eq } = await import('@kunacademy/db');
    const { programs } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(programs)
      .where(and(eq(programs.slug, slug), eq(programs.published, true)))
      .limit(1);
    const r = rows[0];
    return r ? this.rowToProgram(r) : null;
  }

  async getFeaturedPrograms(): Promise<Program[]> {
    const all = await this.getAllPrograms();
    return all.filter((p) => p.is_featured);
  }

  /**
   * Region-aware program fetch (migration 0042 — 2026-04-21).
   *
   * Returns the program with an optional `region_price_override` field
   * attached when a price override exists for the given region.
   *
   * Backwards-compatible: callers that do NOT pass `region` get the exact same
   * object as `getProgram()` (override field is simply absent).
   *
   * Shape of the attached field:
   *   program.region_price_override = { region, price, currency, notes } | undefined
   *
   * Public-facing price display should:
   *   1. Check `program.region_price_override` — if present, display that price.
   *   2. Otherwise fall back to `program.price_aed` / `price_egp` / etc.
   */
  async getProgramWithRegionPrice(
    slug: string,
    region?: string,
  ): Promise<(Program & { region_price_override?: RegionPriceOverride }) | null> {
    const base = await this.getProgram(slug);
    if (!base) return null;
    if (!region) return base;

    try {
      const { db, and, eq } = await import('@kunacademy/db');
      const { programPriceOverrides } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(programPriceOverrides)
        .where(
          and(
            eq(programPriceOverrides.program_slug, slug),
            eq(programPriceOverrides.region, region.toUpperCase()),
          ),
        )
        .limit(1);
      if (rows.length === 0) return base;
      const o = rows[0];
      return {
        ...base,
        region_price_override: {
          region: o.region,
          price: parseFloat(o.price),
          currency: o.currency,
          notes: o.notes ?? undefined,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getProgramWithRegionPrice(${slug}, ${region}): ${msg}`);
      return base; // Safe fallback: return base program without override
    }
  }

  /**
   * Phase 2d extension — filter programs by `category` (not on base interface).
   */
  async getProgramsByCategory(category: string): Promise<Program[]> {
    try {
      const all = await this.getAllPrograms();
      return all.filter((p) => p.category === category);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getProgramsByCategory: ${msg}`);
      return [];
    }
  }

  /**
   * Admin helper — list every programs row including unpublished (for /admin/programs).
   */
  async getAllProgramsAdmin(): Promise<
    Array<Program & { id: string; published_at: string | null }>
  > {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { programs } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(programs).orderBy(asc(programs.display_order));
      return rows.map((r) => ({
        ...this.rowToProgram(r),
        id: r.id,
        published_at: r.published_at ?? null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllProgramsAdmin: ${msg}`);
      return [];
    }
  }

  /** Admin helper — fetch one program by UUID (admin edit). */
  async getProgramById(id: string): Promise<
    | (Program & { id: string; published_at: string | null })
    | null
  > {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { programs } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
      const r = rows[0];
      if (!r) return null;
      return { ...this.rowToProgram(r), id: r.id, published_at: r.published_at ?? null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getProgramById(${id}): ${msg}`);
      return null;
    }
  }

  // ── MIGRATED: Services (Phase 2a) ────────────────────────────────────────
  async getAllServices(): Promise<Service[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
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
  }

  async getServicesByCategory(category: ServiceCategory): Promise<Service[]> {
    const all = await this.getAllServices();
    return all.filter((s) => s.category === category);
  }

  async getService(slug: string): Promise<Service | null> {
    const all = await this.getAllServices();
    return all.find((s) => s.slug === slug) ?? null;
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
    // Phase 3b (2026-04-21): DB-only. team.json archived.
    const { db, and, eq, asc } = await import('@kunacademy/db');
    const { instructors } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(instructors)
      .where(and(eq(instructors.published, true), eq(instructors.is_visible, true)))
      .orderBy(asc(instructors.display_order));
    return rows.map((r) => this.mapInstructorRow(r));
  }

  async getBookableCoaches(): Promise<TeamMember[]> {
    const all = await this.getAllTeamMembers();
    return all.filter((t) => t.is_bookable);
  }

  async getTeamMember(slug: string): Promise<TeamMember | null> {
    // Phase 3b (2026-04-21): DB-only. team.json archived.
    const { db, and, eq } = await import('@kunacademy/db');
    const { instructors } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(instructors)
      .where(and(eq(instructors.slug, slug), eq(instructors.published, true)))
      .limit(1);
    const row = rows[0];
    return row ? this.mapInstructorRow(row) : null;
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

  // ── MIGRATED: Pathfinder tree (migration 0045, 2026-04-21) ─────────────────
  //
  // The tree is versioned; exactly one row in pathfinder_tree_versions has
  // is_active=true (enforced by partial unique index). Public reads always
  // use the active version. Admin UIs can fetch drafts via the version-aware
  // helpers below.
  //
  // Legacy PathfinderQuestion shape (question_id + parent_answer_id string +
  // embedded answers[]) is preserved at the TS boundary so PathfinderEngine
  // client component needs zero prop churn. The DB layer uses code+UUID.

  /**
   * Return the active tree version id. Throws if no active version exists
   * (configuration error — migration 0045 seeds one).
   */
  async getActivePathfinderVersion(): Promise<{ id: string; version_number: number; label: string } | null> {
    const { db, eq } = await import('@kunacademy/db');
    const { pathfinder_tree_versions } = await import('@kunacademy/db/schema');
    const rows = await db
      .select({
        id: pathfinder_tree_versions.id,
        version_number: pathfinder_tree_versions.version_number,
        label: pathfinder_tree_versions.label,
      })
      .from(pathfinder_tree_versions)
      .where(eq(pathfinder_tree_versions.is_active, true))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Fetch every (question, answer) pair for a given version and reassemble
   * the legacy PathfinderQuestion shape the client engine expects.
   * Uses answer codes for parent_answer_id so the existing engine keeps
   * working against string identifiers (not UUIDs).
   */
  private async getPathfinderTreeByVersion(versionId: string): Promise<PathfinderQuestion[]> {
    const { db, eq, asc } = await import('@kunacademy/db');
    const { pathfinder_questions, pathfinder_answers } = await import('@kunacademy/db/schema');

    const qRows = await db
      .select()
      .from(pathfinder_questions)
      .where(eq(pathfinder_questions.version_id, versionId))
      .orderBy(asc(pathfinder_questions.sort_order));

    if (qRows.length === 0) return [];

    const aRows = await db
      .select()
      .from(pathfinder_answers)
      .orderBy(asc(pathfinder_answers.sort_order));

    // Build question-code → answer-code maps for parent resolution.
    const answerIdToCode = new Map<string, string>();
    for (const a of aRows) answerIdToCode.set(a.id, a.code);

    const byQuestion = new Map<string, typeof aRows>();
    for (const a of aRows) {
      const arr = byQuestion.get(a.question_id) ?? [];
      arr.push(a);
      byQuestion.set(a.question_id, arr);
    }

    return qRows.map((q) => {
      const answers = (byQuestion.get(q.id) ?? []).map((a) => ({
        id: a.code,
        text_ar: a.text_ar,
        text_en: a.text_en ?? '',
        category_weights: (a.category_weights ?? {}) as Record<string, number>,
      }));
      const parentCode = q.parent_answer_id ? answerIdToCode.get(q.parent_answer_id) ?? '' : '';
      return {
        question_id: q.code,
        parent_answer_id: parentCode,
        question_ar: q.question_ar,
        question_en: q.question_en ?? '',
        type: q.type as 'individual' | 'corporate',
        answers,
        published: q.published,
      };
    });
  }

  async getAllPathfinderQuestions(): Promise<PathfinderQuestion[]> {
    const active = await this.getActivePathfinderVersion();
    if (!active) {
      console.warn('[cms/db] No active pathfinder tree version — returning empty');
      return [];
    }
    const tree = await this.getPathfinderTreeByVersion(active.id);
    // Preserve the JSON-era semantic: only return published questions to the public
    return tree.filter((q) => q.published);
  }

  async getPathfinderRoots(type?: 'individual' | 'corporate'): Promise<PathfinderQuestion[]> {
    const all = await this.getAllPathfinderQuestions();
    const roots = all.filter((q) => !q.parent_answer_id);
    return type ? roots.filter((q) => q.type === type) : roots;
  }

  async getPathfinderChildren(parentAnswerId: string): Promise<PathfinderQuestion[]> {
    const all = await this.getAllPathfinderQuestions();
    return all.filter((q) => q.parent_answer_id === parentAnswerId);
  }

  /**
   * Admin-facing: fetch full tree (including unpublished) for a specific
   * version id. Used by /admin/pathfinder/ preview + edit flows.
   */
  async getPathfinderTreeForAdmin(versionId: string): Promise<PathfinderQuestion[]> {
    return this.getPathfinderTreeByVersion(versionId);
  }

  /** Admin-facing: list every version (active + drafts). */
  async getAllPathfinderVersionsAdmin(): Promise<
    Array<{
      id: string;
      version_number: number;
      label: string;
      is_active: boolean;
      published_at: string | null;
      created_at: string;
    }>
  > {
    const { db, asc } = await import('@kunacademy/db');
    const { pathfinder_tree_versions } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(pathfinder_tree_versions)
      .orderBy(asc(pathfinder_tree_versions.version_number));
    return rows.map((r) => ({
      id: r.id,
      version_number: r.version_number,
      label: r.label,
      is_active: r.is_active,
      published_at: r.published_at ?? null,
      created_at: r.created_at,
    }));
  }

  /** Admin-facing: outcomes for a version. */
  async getPathfinderOutcomesForVersion(versionId: string): Promise<
    Array<{
      id: string;
      program_slug: string;
      category_affinity: Record<string, number>;
      min_score: number;
      cta_label_ar: string | null;
      cta_label_en: string | null;
      cta_type: 'book_call' | 'enroll' | 'explore' | 'free_signup';
    }>
  > {
    const { db, eq, asc } = await import('@kunacademy/db');
    const { pathfinder_outcomes } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(pathfinder_outcomes)
      .where(eq(pathfinder_outcomes.version_id, versionId))
      .orderBy(asc(pathfinder_outcomes.program_slug));
    return rows.map((r) => ({
      id: r.id,
      program_slug: r.program_slug,
      category_affinity: (r.category_affinity ?? {}) as Record<string, number>,
      min_score: r.min_score,
      cta_label_ar: r.cta_label_ar,
      cta_label_en: r.cta_label_en,
      cta_type: r.cta_type as 'book_call' | 'enroll' | 'explore' | 'free_signup',
    }));
  }

  // ── MIGRATED: Events (Phase 2e) ───────────────────────────────────────────

  /**
   * DB row → CMS Event mapper. Numeric columns come back as strings from pg;
   * date columns as YYYY-MM-DD strings; text[] as string[]. We coerce pricing
   * to numbers (Event type requires number) and keep optional fields nullable
   * via `?? undefined`.
   */
  private rowToEvent(r: {
    slug: string;
    title_ar: string;
    title_en: string;
    description_ar: string | null;
    description_en: string | null;
    date_start: string;
    date_end: string | null;
    location_ar: string | null;
    location_en: string | null;
    location_type: string;
    capacity: number | null;
    price_aed: string | number;
    price_egp: string | number;
    price_usd: string | number;
    image_url: string | null;
    promo_video_url: string | null;
    program_slug: string | null;
    speaker_slugs: string[] | null;
    registration_url: string | null;
    registration_deadline: string | null;
    status: string;
    is_featured: boolean;
    display_order: number;
    published: boolean;
    last_edited_by: string | null;
    last_edited_at: Date | string | null;
  }): Event {
    const num = (v: string | number | null | undefined): number => {
      if (v === null || v === undefined || v === '') return 0;
      return typeof v === 'number' ? v : Number(v);
    };
    return {
      slug: r.slug,
      title_ar: r.title_ar,
      title_en: r.title_en,
      description_ar: r.description_ar ?? undefined,
      description_en: r.description_en ?? undefined,
      date_start: r.date_start,
      date_end: r.date_end ?? undefined,
      location_ar: r.location_ar ?? undefined,
      location_en: r.location_en ?? undefined,
      location_type: r.location_type as Event['location_type'],
      capacity: r.capacity ?? undefined,
      price_aed: num(r.price_aed),
      price_egp: num(r.price_egp),
      price_usd: num(r.price_usd),
      image_url: r.image_url ?? undefined,
      promo_video_url: r.promo_video_url ?? undefined,
      program_slug: r.program_slug ?? undefined,
      registration_url: r.registration_url ?? undefined,
      status: r.status as Event['status'],
      speaker_slugs: r.speaker_slugs ?? [],
      registration_deadline: r.registration_deadline ?? undefined,
      is_featured: r.is_featured,
      display_order: r.display_order,
      published: r.published,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at:
        r.last_edited_at instanceof Date
          ? r.last_edited_at.toISOString()
          : r.last_edited_at ?? undefined,
    };
  }

  async getAllEvents(): Promise<Event[]> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
    const { db, eq, asc } = await import('@kunacademy/db');
    const { events } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.published, true))
      .orderBy(asc(events.display_order));
    return rows.map((r) => this.rowToEvent(r));
  }

  async getUpcomingEvents(): Promise<Event[]> {
    const all = await this.getAllEvents();
    const today = new Date().toISOString().split('T')[0];
    return all
      .filter((e) => e.date_start >= today)
      .sort((a, b) => a.date_start.localeCompare(b.date_start));
  }

  async getEvent(slug: string): Promise<Event | null> {
    // DB-only since Phase 3 PARTIAL (2026-04-21). No JSON fallback.
    const { db, and, eq } = await import('@kunacademy/db');
    const { events } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(events)
      .where(and(eq(events.slug, slug), eq(events.published, true)))
      .limit(1);
    const r = rows[0];
    return r ? this.rowToEvent(r) : null;
  }

  /**
   * Admin helper — list every events row including unpublished (for /admin/events).
   */
  async getAllEventsAdmin(): Promise<
    Array<Event & { id: string; published_at: string | null }>
  > {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { events } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(events).orderBy(asc(events.display_order));
      return rows.map((r) => ({
        ...this.rowToEvent(r),
        id: r.id,
        published_at: r.published_at ?? null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllEventsAdmin: ${msg}`);
      return [];
    }
  }

  /** Admin helper — fetch one event by UUID (admin edit). */
  async getEventById(
    id: string,
  ): Promise<(Event & { id: string; published_at: string | null }) | null> {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { events } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
      const r = rows[0];
      if (!r) return null;
      return { ...this.rowToEvent(r), id: r.id, published_at: r.published_at ?? null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getEventById(${id}): ${msg}`);
      return null;
    }
  }

  // ── MIGRATED: Blog Posts ──────────────────────────────────────────────────

  private rowToBlogPost(r: {
    slug: string;
    title_ar: string;
    title_en: string | null;
    excerpt_ar: string | null;
    excerpt_en: string | null;
    content_ar: string | null;
    content_en: string | null;
    content_doc_id: string | null;
    featured_image_url: string | null;
    category: string | null;
    tags: string[] | null;
    author_slug: string | null;
    published_at: string | null;
    reading_time_minutes: number | null;
    is_featured: boolean;
    display_order: number;
    published: boolean | null;
    meta_title_ar: string | null;
    meta_title_en: string | null;
    meta_description_ar: string | null;
    meta_description_en: string | null;
    last_edited_by: string | null;
    last_edited_at: Date | string | null;
  }): BlogPost {
    return {
      slug: r.slug,
      title_ar: r.title_ar,
      title_en: r.title_en ?? '',
      excerpt_ar: r.excerpt_ar ?? undefined,
      excerpt_en: r.excerpt_en ?? undefined,
      content_ar: r.content_ar ?? undefined,
      content_en: r.content_en ?? undefined,
      content_doc_id: r.content_doc_id ?? undefined,
      featured_image_url: r.featured_image_url ?? undefined,
      category: r.category ?? undefined,
      tags: r.tags ?? [],
      author_slug: r.author_slug ?? undefined,
      // published_at stored as TIMESTAMPTZ; downstream UI uses date-only prefix.
      published_at:
        r.published_at != null && typeof r.published_at === 'string'
          ? r.published_at.slice(0, 10)
          : r.published_at ?? undefined,
      reading_time_minutes: r.reading_time_minutes ?? undefined,
      is_featured: r.is_featured,
      display_order: r.display_order,
      published: r.published ?? false,
      meta_title_ar: r.meta_title_ar ?? undefined,
      meta_title_en: r.meta_title_en ?? undefined,
      meta_description_ar: r.meta_description_ar ?? undefined,
      meta_description_en: r.meta_description_en ?? undefined,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at:
        r.last_edited_at instanceof Date
          ? r.last_edited_at.toISOString()
          : r.last_edited_at ?? undefined,
    };
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    // DB-only since Phase 3c (2026-04-21). No JSON fallback.
    const { db, eq, asc, desc } = await import('@kunacademy/db');
    const { blog_posts } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(blog_posts)
      .where(eq(blog_posts.published, true))
      .orderBy(asc(blog_posts.display_order), desc(blog_posts.published_at));
    return rows.map((r) => this.rowToBlogPost(r));
  }

  async getBlogPost(slug: string): Promise<BlogPost | null> {
    // DB-only since Phase 3c (2026-04-21). No JSON fallback.
    const { db, and, eq } = await import('@kunacademy/db');
    const { blog_posts } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(blog_posts)
      .where(and(eq(blog_posts.slug, slug), eq(blog_posts.published, true)))
      .limit(1);
    const r = rows[0];
    return r ? this.rowToBlogPost(r) : null;
  }

  async getFeaturedBlogPosts(): Promise<BlogPost[]> {
    const { db, and, eq, asc, desc } = await import('@kunacademy/db');
    const { blog_posts } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(blog_posts)
      .where(and(eq(blog_posts.published, true), eq(blog_posts.is_featured, true)))
      .orderBy(asc(blog_posts.display_order), desc(blog_posts.published_at));
    return rows.map((r) => this.rowToBlogPost(r));
  }

  async getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
    const { db, and, eq, asc, desc, sql } = await import('@kunacademy/db');
    const { blog_posts } = await import('@kunacademy/db/schema');
    // Case-insensitive match; blog.json has mixed-case categories.
    const rows = await db
      .select()
      .from(blog_posts)
      .where(
        and(
          eq(blog_posts.published, true),
          sql`LOWER(${blog_posts.category}) = LOWER(${category})`,
        ),
      )
      .orderBy(asc(blog_posts.display_order), desc(blog_posts.published_at));
    return rows.map((r) => this.rowToBlogPost(r));
  }

  /** Admin helper — list every blog_posts row including unpublished. */
  async getAllBlogPostsAdmin(): Promise<
    Array<BlogPost & { id: string; published_at_raw: string | null }>
  > {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { blog_posts } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(blog_posts).orderBy(asc(blog_posts.display_order));
      return rows.map((r) => ({
        ...this.rowToBlogPost(r),
        id: r.id,
        published_at_raw: r.published_at ?? null,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllBlogPostsAdmin: ${msg}`);
      return [];
    }
  }

  /** Admin helper — fetch one blog post by UUID. */
  async getBlogPostById(
    id: string,
  ): Promise<(BlogPost & { id: string; published_at_raw: string | null }) | null> {
    try {
      const { db, eq } = await import('@kunacademy/db');
      const { blog_posts } = await import('@kunacademy/db/schema');
      const rows = await db.select().from(blog_posts).where(eq(blog_posts.id, id)).limit(1);
      const r = rows[0];
      if (!r) return null;
      return { ...this.rowToBlogPost(r), id: r.id, published_at_raw: r.published_at ?? null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getBlogPostById(${id}): ${msg}`);
      return null;
    }
  }

  // ── MIGRATED: Corporate Benefits (Phase 3d, 2026-04-21) ───────────────────

  private rowToCorporateBenefitDirection(r: {
    slug: string;
    title_ar: string;
    title_en: string;
    description_ar: string | null;
    description_en: string | null;
    icon: string | null;
    benefits_mode: string;
    display_order: number;
    published: boolean;
    last_edited_by: string | null;
    last_edited_at: Date | string | null;
  }): CorporateBenefitDirection {
    return {
      slug: r.slug,
      title_ar: r.title_ar,
      title_en: r.title_en,
      description_ar: r.description_ar ?? undefined,
      description_en: r.description_en ?? undefined,
      icon: r.icon ?? undefined,
      benefits_mode: (r.benefits_mode as CorporateBenefitsMode) ?? 'list',
      display_order: r.display_order,
      published: r.published,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at:
        r.last_edited_at instanceof Date
          ? r.last_edited_at.toISOString()
          : r.last_edited_at ?? undefined,
    };
  }

  private rowToCorporateBenefit(r: {
    slug: string;
    direction_slug: string;
    label_ar: string;
    label_en: string;
    description_ar: string | null;
    description_en: string | null;
    citation_ar: string | null;
    citation_en: string | null;
    benchmark_improvement_pct: number;
    roi_category: string;
    self_assessment_prompt_ar: string | null;
    self_assessment_prompt_en: string | null;
    display_order: number;
    published: boolean;
    last_edited_by: string | null;
    last_edited_at: Date | string | null;
  }): CorporateBenefit {
    return {
      slug: r.slug,
      direction_slug: r.direction_slug,
      label_ar: r.label_ar,
      label_en: r.label_en,
      description_ar: r.description_ar ?? undefined,
      description_en: r.description_en ?? undefined,
      citation_ar: r.citation_ar ?? undefined,
      citation_en: r.citation_en ?? undefined,
      benchmark_improvement_pct: r.benchmark_improvement_pct,
      roi_category: (r.roi_category as CorporateRoiCategory) ?? 'productivity',
      self_assessment_prompt_ar: r.self_assessment_prompt_ar ?? undefined,
      self_assessment_prompt_en: r.self_assessment_prompt_en ?? undefined,
      display_order: r.display_order,
      published: r.published,
      last_edited_by: r.last_edited_by ?? undefined,
      last_edited_at:
        r.last_edited_at instanceof Date
          ? r.last_edited_at.toISOString()
          : r.last_edited_at ?? undefined,
    };
  }

  async getAllCorporateBenefitDirections(): Promise<CorporateBenefitDirection[]> {
    const { db, eq, asc } = await import('@kunacademy/db');
    const { corporate_benefit_directions, corporate_benefits } = await import('@kunacademy/db/schema');
    const dirRows = await db
      .select()
      .from(corporate_benefit_directions)
      .where(eq(corporate_benefit_directions.published, true))
      .orderBy(asc(corporate_benefit_directions.display_order));

    const benRows = await db
      .select()
      .from(corporate_benefits)
      .where(eq(corporate_benefits.published, true))
      .orderBy(asc(corporate_benefits.direction_slug), asc(corporate_benefits.display_order));

    const byDir = new Map<string, CorporateBenefit[]>();
    for (const b of benRows) {
      const mapped = this.rowToCorporateBenefit(b);
      const arr = byDir.get(mapped.direction_slug) ?? [];
      arr.push(mapped);
      byDir.set(mapped.direction_slug, arr);
    }

    return dirRows.map((d) => {
      const dir = this.rowToCorporateBenefitDirection(d);
      dir.benefits = byDir.get(dir.slug) ?? [];
      return dir;
    });
  }

  async getAllCorporateBenefits(): Promise<CorporateBenefit[]> {
    const { db, eq, asc } = await import('@kunacademy/db');
    const { corporate_benefits } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(corporate_benefits)
      .where(eq(corporate_benefits.published, true))
      .orderBy(asc(corporate_benefits.direction_slug), asc(corporate_benefits.display_order));
    return rows.map((r) => this.rowToCorporateBenefit(r));
  }

  async getCorporateBenefitsByDirection(directionSlug: string): Promise<CorporateBenefit[]> {
    const { db, and, eq, asc } = await import('@kunacademy/db');
    const { corporate_benefits } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(corporate_benefits)
      .where(
        and(
          eq(corporate_benefits.published, true),
          eq(corporate_benefits.direction_slug, directionSlug),
        ),
      )
      .orderBy(asc(corporate_benefits.display_order));
    return rows.map((r) => this.rowToCorporateBenefit(r));
  }

  async getCorporateBenefit(slug: string): Promise<CorporateBenefit | null> {
    const { db, and, eq } = await import('@kunacademy/db');
    const { corporate_benefits } = await import('@kunacademy/db/schema');
    const rows = await db
      .select()
      .from(corporate_benefits)
      .where(and(eq(corporate_benefits.published, true), eq(corporate_benefits.slug, slug)))
      .limit(1);
    const r = rows[0];
    return r ? this.rowToCorporateBenefit(r) : null;
  }

  /**
   * Legacy-shape payload used by PathfinderEngine. Directions with
   * benefits_mode='all' emit the sentinel `"all"` for `benefits` so the
   * client's existing logic flattens other directions.
   */
  async getCorporateBenefitsData(): Promise<CorporateBenefitsData> {
    const directions = await this.getAllCorporateBenefitDirections();
    return {
      version: '1.0',
      directions: directions.map((d) => ({
        id: d.slug,
        title_ar: d.title_ar,
        title_en: d.title_en,
        description_ar: d.description_ar ?? '',
        description_en: d.description_en ?? '',
        icon: d.icon ?? '',
        benefits:
          d.benefits_mode === 'all'
            ? 'all'
            : (d.benefits ?? []).map((b) => ({
                id: b.slug,
                label_ar: b.label_ar,
                label_en: b.label_en,
                description_ar: b.description_ar ?? '',
                description_en: b.description_en ?? '',
                citation_ar: b.citation_ar ?? '',
                citation_en: b.citation_en ?? '',
                benchmark_improvement_pct: b.benchmark_improvement_pct,
                roi_category: b.roi_category,
                self_assessment_prompt_ar: b.self_assessment_prompt_ar ?? '',
                self_assessment_prompt_en: b.self_assessment_prompt_en ?? '',
              })),
      })),
    };
  }

  // ── Admin helpers for Corporate Benefits CRUD ─────────────────────────────

  async getAllCorporateBenefitDirectionsAdmin(): Promise<
    Array<CorporateBenefitDirection & { id: string }>
  > {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { corporate_benefit_directions } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(corporate_benefit_directions)
        .orderBy(asc(corporate_benefit_directions.display_order));
      return rows.map((r) => ({
        ...this.rowToCorporateBenefitDirection(r),
        id: r.id,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllCorporateBenefitDirectionsAdmin: ${msg}`);
      return [];
    }
  }

  async getAllCorporateBenefitsAdmin(): Promise<
    Array<CorporateBenefit & { id: string }>
  > {
    try {
      const { db, asc } = await import('@kunacademy/db');
      const { corporate_benefits } = await import('@kunacademy/db/schema');
      const rows = await db
        .select()
        .from(corporate_benefits)
        .orderBy(
          asc(corporate_benefits.direction_slug),
          asc(corporate_benefits.display_order),
        );
      return rows.map((r) => ({ ...this.rowToCorporateBenefit(r), id: r.id }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cms/db] DB read failed for getAllCorporateBenefitsAdmin: ${msg}`);
      return [];
    }
  }

  async invalidateCache(): Promise<void> {
    // Invalidate JsonFileProvider cache; DB reads are always fresh
    await this.fallback.invalidateCache();
  }
}
