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
} from './types';

/** Parse comma-separated string into string[] (for specialties, languages, etc.) */
function csvToArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export class JsonFileProvider implements ContentProvider {
  readonly name = 'json-file';
  private dataDir: string;
  private cache: Map<string, { data: unknown; loadedAt: number }> = new Map();
  private cacheTtlMs: number;

  constructor(dataDir: string, cacheTtlMs = 30_000) {
    this.dataDir = dataDir;
    this.cacheTtlMs = cacheTtlMs;
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

  // ── Sheet 1: Page Content ───────────────────────────────────────────────

  async getPageContent(slug: string): Promise<PageSections> {
    const rows = await this.loadSheet<PageContent>('page-content');
    const pageRows = this.published(rows).filter((r) => r.slug === slug);
    const sections: PageSections = {};

    for (const row of pageRows) {
      if (!sections[row.section]) sections[row.section] = {};
      sections[row.section][row.key] = {
        ar: row.value_ar,
        en: row.value_en,
      };
    }
    return sections;
  }

  async getAllPageSlugs(): Promise<string[]> {
    const rows = await this.loadSheet<PageContent>('page-content');
    const slugs = new Set(this.published(rows).map((r) => r.slug));
    return [...slugs];
  }

  async getPageSeo(slug: string) {
    const rows = await this.loadSheet<PageContent>('page-content');
    const seoRow = this.published(rows).find(
      (r) => r.slug === slug && r.section === 'seo'
    );
    if (!seoRow) {
      // Fall back to first row for the slug (SEO fields are per-page, not per-section)
      const firstRow = this.published(rows).find((r) => r.slug === slug);
      if (!firstRow) return null;
      return {
        meta_title_ar: firstRow.meta_title_ar,
        meta_title_en: firstRow.meta_title_en,
        meta_description_ar: firstRow.meta_description_ar,
        meta_description_en: firstRow.meta_description_en,
        og_image_url: firstRow.og_image_url,
        canonical_url: firstRow.canonical_url,
      };
    }
    return {
      meta_title_ar: seoRow.meta_title_ar,
      meta_title_en: seoRow.meta_title_en,
      meta_description_ar: seoRow.meta_description_ar,
      meta_description_en: seoRow.meta_description_en,
      og_image_url: seoRow.og_image_url,
      canonical_url: seoRow.canonical_url,
    };
  }

  async getLandingPages(): Promise<PageContent[]> {
    const rows = await this.loadSheet<PageContent>('page-content');
    return this.published(rows).filter((r) => r.type === 'landing');
  }

  // ── Sheet 2: Programs ─────────────────────────────────────────────────

  async getAllPrograms(): Promise<Program[]> {
    const rows = await this.loadSheet<Program>('programs');
    return this.published(rows).sort((a, b) => a.display_order - b.display_order);
  }

  async getProgramsByNavGroup(group: NavGroup): Promise<Program[]> {
    const all = await this.getAllPrograms();
    return all.filter((p) => p.nav_group === group);
  }

  async getProgram(slug: string): Promise<Program | null> {
    const rows = await this.loadSheet<Program>('programs');
    return this.published(rows).find((p) => p.slug === slug) ?? null;
  }

  async getFeaturedPrograms(): Promise<Program[]> {
    const all = await this.getAllPrograms();
    return all.filter((p) => p.is_featured);
  }

  // ── Sheet 3: Services ─────────────────────────────────────────────────

  async getAllServices(): Promise<Service[]> {
    const rows = await this.loadSheet<Service>('services');
    return this.published(rows).sort((a, b) => a.display_order - b.display_order);
  }

  async getServicesByCategory(category: ServiceCategory): Promise<Service[]> {
    const all = await this.getAllServices();
    return all.filter((s) => s.category === category);
  }

  async getService(slug: string): Promise<Service | null> {
    const rows = await this.loadSheet<Service>('services');
    return this.published(rows).find((s) => s.slug === slug) ?? null;
  }

  // ── Sheet 4: Team ─────────────────────────────────────────────────────

  async getAllTeamMembers(): Promise<TeamMember[]> {
    const rows = await this.loadSheet<TeamMember>('team');
    return this.published(rows)
      .filter((t) => t.is_visible)
      .sort((a, b) => a.display_order - b.display_order);
  }

  async getBookableCoaches(): Promise<TeamMember[]> {
    const all = await this.getAllTeamMembers();
    return all.filter((t) => t.is_bookable);
  }

  async getTeamMember(slug: string): Promise<TeamMember | null> {
    const rows = await this.loadSheet<TeamMember>('team');
    return this.published(rows).find((t) => t.slug === slug) ?? null;
  }

  // ── Sheet 5: Settings ─────────────────────────────────────────────────

  async getAllSettings(): Promise<SettingsMap> {
    const rows = await this.loadSheet<{ category: string; key: string; value: string; published: boolean }>('settings');
    const map: SettingsMap = {};
    for (const row of this.published(rows)) {
      if (!map[row.category]) map[row.category] = {};
      map[row.category][row.key] = row.value;
    }
    return map;
  }

  async getSetting(category: string, key: string): Promise<string | null> {
    const all = await this.getAllSettings();
    return all[category]?.[key] ?? null;
  }

  // ── Sheet 6: Pathfinder ─────────────────────────────────────────────

  async getAllPathfinderQuestions(): Promise<PathfinderQuestion[]> {
    const rows = await this.loadSheet<PathfinderQuestion>('pathfinder');
    return this.published(rows);
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

  // ── Cache ─────────────────────────────────────────────────────────────


  async getAllTestimonials(): Promise<Testimonial[]> {
    return [];
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    return [];
  }

  async invalidateCache(): Promise<void> {
    this.cache.clear();
  }
}
