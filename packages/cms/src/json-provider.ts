// @kunacademy/cms — JsonFileProvider
// Development provider that reads from local JSON files.
// Mirrors the exact Google Sheets structure for seamless swap.
// Usage: Drop JSON files in /data/cms/ matching sheet names.

import { readFile } from 'fs/promises';
import { join } from 'path';
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
  Quote,
  BlogPost,
  CorporateBenefit,
  CorporateBenefitDirection,
  CorporateBenefitsData,
} from './types';

// Phase 3b (2026-04-21): csvToArray helper removed — team/specialties/languages
// normalization now happens in DbContentProvider.mapInstructorRow.
// Phase 3 PARTIAL (2026-04-21): program/event asset maps removed — now live
// in DbContentProvider normalizers (rowToProgram / rowToEvent). See db-provider.ts.

export class JsonFileProvider implements ContentProvider {
  readonly name = 'json-file';
  private dataDir: string;
  private cache: Map<string, { data: unknown; loadedAt: number }> = new Map();
  private cacheTtlMs: number;

  constructor(dataDir: string, cacheTtlMs = 30_000) {
    this.dataDir = dataDir;
    this.cacheTtlMs = cacheTtlMs;
  }

  // ── Phase 3 PARTIAL cutover (2026-04-21) ────────────────────────────────
  // 8 entities are DB-only after Phase 3c. JsonFileProvider is retained only
  // as a legacy fallback path for pathfinder (un-migrated).
  // Calls to migrated-entity methods throw to surface misconfiguration.
  private migrated(method: string): never {
    throw new Error(
      `[cms/json] ${method}() is DB-only since Phase 3 PARTIAL (2026-04-21). ` +
      `Route this call through DbContentProvider.`,
    );
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async loadSheet<T>(filename: string): Promise<T[]> {
    const cached = this.cache.get(filename);
    if (cached && Date.now() - cached.loadedAt < this.cacheTtlMs) {
      return cached.data as T[];
    }

    try {
      const raw = await readFile(join(this.dataDir, `${filename}.json`), 'utf-8');
      const rows = JSON.parse(raw) as T[];
      this.cache.set(filename, { data: rows, loadedAt: Date.now() });
      return rows;
    } catch {
      console.warn(`[cms/json] Could not load ${filename}.json — returning empty`);
      return [];
    }
  }

  private published<T extends { published: boolean }>(rows: T[]): T[] {
    return rows.filter((r) => r.published);
  }

  // ── Sheet 1: Page Content (MIGRATED → landing_pages) ────────────────────

  async getPageContent(_slug: string): Promise<PageSections> {
    this.migrated('getPageContent');
  }

  async getAllPageSlugs(): Promise<string[]> {
    this.migrated('getAllPageSlugs');
  }

  async getPageSeo(_slug: string): Promise<{
    meta_title_ar?: string;
    meta_title_en?: string;
    meta_description_ar?: string;
    meta_description_en?: string;
    og_image_url?: string;
    canonical_url?: string;
  } | null> {
    this.migrated('getPageSeo');
  }

  async getLandingPages(): Promise<PageContent[]> {
    this.migrated('getLandingPages');
  }

  // ── Sheet 2: Programs (MIGRATED → programs) ─────────────────────────────

  async getAllPrograms(): Promise<Program[]> {
    this.migrated('getAllPrograms');
  }

  async getProgramsByNavGroup(_group: NavGroup): Promise<Program[]> {
    this.migrated('getProgramsByNavGroup');
  }

  async getProgram(_slug: string): Promise<Program | null> {
    this.migrated('getProgram');
  }

  async getFeaturedPrograms(): Promise<Program[]> {
    this.migrated('getFeaturedPrograms');
  }

  // ── Sheet 3: Services (MIGRATED → services) ─────────────────────────────

  async getAllServices(): Promise<Service[]> {
    this.migrated('getAllServices');
  }

  async getServicesByCategory(_category: ServiceCategory): Promise<Service[]> {
    this.migrated('getServicesByCategory');
  }

  async getService(_slug: string): Promise<Service | null> {
    this.migrated('getService');
  }

  // ── Sheet 4: Team (MIGRATED → instructors) ──────────────────────────────

  async getAllTeamMembers(): Promise<TeamMember[]> {
    this.migrated('getAllTeamMembers');
  }

  async getBookableCoaches(): Promise<TeamMember[]> {
    this.migrated('getBookableCoaches');
  }

  async getTeamMember(_slug: string): Promise<TeamMember | null> {
    this.migrated('getTeamMember');
  }

  // ── Sheet 5: Settings (MIGRATED → site_settings) ────────────────────────

  async getAllSettings(): Promise<SettingsMap> {
    this.migrated('getAllSettings');
  }

  async getSetting(_category: string, _key: string): Promise<string | null> {
    this.migrated('getSetting');
  }

  // ── Sheet 6: Pathfinder ─────────────────────────────────────────────

  async getAllPathfinderQuestions(): Promise<PathfinderQuestion[]> {
    const rows = await this.loadSheet<PathfinderQuestion>('pathfinder');
    return this.published(rows).map(row => ({
      ...row,
      answers: typeof row.answers === 'string'
        ? (() => { try { return JSON.parse(row.answers as unknown as string); } catch { return []; } })()
        : (row.answers ?? []),
    }));
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

  // ── Testimonials (MIGRATED → testimonials) ──────────────────────────────

  async getAllTestimonials(): Promise<Testimonial[]> {
    this.migrated('getAllTestimonials');
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    this.migrated('getFeaturedTestimonials');
  }

  async getTestimonialsByCoach(_coachSlug: string): Promise<Testimonial[]> {
    this.migrated('getTestimonialsByCoach');
  }

  // ── Quotes (MIGRATED → quotes) ──────────────────────────────────────────

  async getAllQuotes(): Promise<Quote[]> {
    this.migrated('getAllQuotes');
  }

  async getQuotesByCategory(_category: string): Promise<Quote[]> {
    this.migrated('getQuotesByCategory');
  }

  // ── Events (MIGRATED → events) ──────────────────────────────────────────

  async getAllEvents(): Promise<import('./types').Event[]> {
    this.migrated('getAllEvents');
  }

  async getUpcomingEvents(): Promise<import('./types').Event[]> {
    this.migrated('getUpcomingEvents');
  }

  async getEvent(_slug: string): Promise<import('./types').Event | null> {
    this.migrated('getEvent');
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    this.migrated('getAllBlogPosts');
  }

  async getBlogPost(_slug: string): Promise<BlogPost | null> {
    this.migrated('getBlogPost');
  }

  async getFeaturedBlogPosts(): Promise<BlogPost[]> {
    this.migrated('getFeaturedBlogPosts');
  }

  async getBlogPostsByCategory(_category: string): Promise<BlogPost[]> {
    this.migrated('getBlogPostsByCategory');
  }

  // ── Phase 3d (2026-04-21) — corporate benefits migrated to DB ───────────
  async getAllCorporateBenefitDirections(): Promise<CorporateBenefitDirection[]> {
    this.migrated('getAllCorporateBenefitDirections');
  }
  async getAllCorporateBenefits(): Promise<CorporateBenefit[]> {
    this.migrated('getAllCorporateBenefits');
  }
  async getCorporateBenefitsByDirection(_d: string): Promise<CorporateBenefit[]> {
    this.migrated('getCorporateBenefitsByDirection');
  }
  async getCorporateBenefit(_slug: string): Promise<CorporateBenefit | null> {
    this.migrated('getCorporateBenefit');
  }
  async getCorporateBenefitsData(): Promise<CorporateBenefitsData> {
    this.migrated('getCorporateBenefitsData');
  }

  async invalidateCache(): Promise<void> {
    this.cache.clear();
  }
}
