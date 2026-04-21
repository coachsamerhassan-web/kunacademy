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
} from './types';

/** Parse comma-separated string into string[] (for specialties, languages, etc.) */
function csvToArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

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
  // 7 entities are DB-only. JsonFileProvider is retained only as a legacy
  // fallback path for team + blog + pathfinder (un-migrated).
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

  // ── Sheet 4: Team ─────────────────────────────────────────────────────

  private normalizeTeamMember(t: TeamMember): TeamMember {
    return {
      ...t,
      languages: Array.isArray(t.languages) ? t.languages : csvToArray(t.languages as unknown as string),
      specialties: Array.isArray(t.specialties) ? t.specialties : csvToArray(t.specialties as unknown as string),
      coaching_styles: Array.isArray(t.coaching_styles) ? t.coaching_styles : csvToArray(t.coaching_styles as unknown as string),
      // Map legacy coach_level column → icf_credential (unless icf_credential is already set)
      icf_credential: t.icf_credential ?? t.coach_level,
    };
  }

  async getAllTeamMembers(): Promise<TeamMember[]> {
    const rows = await this.loadSheet<TeamMember>('team');
    return this.published(rows)
      .filter((t) => t.is_visible)
      .map((t) => this.normalizeTeamMember(t))
      .sort((a, b) => a.display_order - b.display_order);
  }

  async getBookableCoaches(): Promise<TeamMember[]> {
    const all = await this.getAllTeamMembers();
    return all.filter((t) => t.is_bookable);
  }

  async getTeamMember(slug: string): Promise<TeamMember | null> {
    const rows = await this.loadSheet<TeamMember>('team');
    const member = this.published(rows).find((t) => t.slug === slug);
    return member ? this.normalizeTeamMember(member) : null;
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
    const rows = await this.loadSheet<BlogPost>('blog');
    return rows
      .filter((p) => p.published !== false)
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return (b.published_at ?? '').localeCompare(a.published_at ?? '');
      });
  }

  async getBlogPost(slug: string): Promise<BlogPost | null> {
    const all = await this.getAllBlogPosts();
    return all.find((p) => p.slug === slug) ?? null;
  }

  async getFeaturedBlogPosts(): Promise<BlogPost[]> {
    const all = await this.getAllBlogPosts();
    return all.filter((p) => p.is_featured);
  }

  async getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
    const all = await this.getAllBlogPosts();
    return all.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
  }

  async invalidateCache(): Promise<void> {
    this.cache.clear();
  }
}
