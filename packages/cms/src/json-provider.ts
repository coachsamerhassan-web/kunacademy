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

// ── Program Logo Defaults (code assets, not CMS content) ────────────────────

const PROGRAM_LOGO_MAP: Record<string, string> = {
  // STCE family
  'somatic-thinking-intro': '/images/programs/logos/somatic-thinking-methodology.png',
  'stce-level-1-stic': '/images/programs/logos/stic.png',
  'your-identity': '/images/programs/logos/stic.png',
  'stce-level-2-staic': '/images/programs/logos/staic.png',
  'stce-level-3-stgc': '/images/programs/logos/stgc.png',
  'stce-level-4-stoc': '/images/programs/logos/stoc.png',
  'stce-level-5-stfc': '/images/programs/logos/stfc.png',
  'stdc-doctors': '/images/programs/logos/stdc.png',
  'stcm-managers': '/images/programs/logos/stcm.png',
  // Manhajak family
  'menhajak-training': '/images/programs/logos/manhajak-dark.png',
  'menhajak-organizational': '/images/programs/logos/manhajak-dark.png',
  'menhajak-leadership': '/images/programs/logos/manhajak-dark.png',
  // Impact Engineering family
  'impact-engineering': '/images/programs/logos/impact-eng-white.png',
  'impact-engineering-foundation': '/images/programs/logos/impact-eng-white.png',
  'impact-engineering-mastery': '/images/programs/logos/impact-eng-white.png',
  // GM Playbook family
  'gm-playbook-briefing': '/images/programs/logos/gm-milestone-1-briefing.png',
  'gm-playbook-foundation': '/images/programs/logos/gm-milestone-2-foundation.png',
  'gm-playbook-mastery': '/images/programs/logos/gm-milestone-3-mastery.png',
  // Ihya
  'ihya-reviving-the-self': '/images/programs/logos/ihya-main-white.png',
  // GPS of Life family
  'gps-of-life': '/images/programs/logos/gps-life-main.png',
  'gps': '/images/programs/logos/gps-life-main.png',
  'gps-accelerator': '/images/programs/logos/gps-life-main.png',
  'gps-professional': '/images/programs/logos/gps-life-main.png',
  // Yaqatha
  'yaqatha': '/images/programs/logos/yaqatha-gradient.svg',
};

const PROGRAM_HERO_MAP: Record<string, string> = {
  'stce-level-3-stgc': '/images/community/hands-circle-gulf.jpg',
  'mcc-mentoring': '/images/founder/samer-podcast-smile-warm-light.jpg',
  'menhajak-training': '/images/founder/samer-workshop-candid-thumbsup.jpg',
};

// ── Event Image Fallbacks (by program_slug → first content image) ────────────
// Used when an event has no image_url but links to a known program.
// Maps program slug → first content image for that program.
const EVENT_IMAGE_BY_PROGRAM: Record<string, string> = {
  'somatic-thinking-intro':   '/images/programs/content/somatic-thinking-intro--01-stone-doorway.png',
  'stce-level-1-stic':        '/images/programs/content/stce-level-1-stic--01-coaching-room-presence.png',
  'your-identity':            '/images/programs/content/your-identity--01-coach-client-profile.png',
  'stce-level-2-staic':       '/images/programs/content/stce-level-2-staic--01-terrace-dusk.png',
  'stce-level-3-stgc':        '/images/programs/content/stce-level-3-stgc--01-coaching-circle.png',
  'stce-level-4-stoc':        '/images/programs/content/stce-level-4-stoc--01-executive-office.png',
  'stce-level-5-stfc':        '/images/programs/content/stce-level-5-stfc--01-couple-couch.png',
  'menhajak-training':        '/images/programs/content/menhajak-training--01-empty-seminar-room.png',
  'menhajak-organizational':  '/images/programs/content/menhajak-organizational--01-institutional-corridor.png',
  'menhajak-leadership':      '/images/programs/content/menhajak-leadership--01-founder-at-window.png',
  'impact-engineering':       '/images/programs/content/impact-engineering--01-split-moment-diptych.png',
  'gm-playbook-briefing':     '/images/programs/content/gm-playbook-briefing--01-leader-phone.png',
  'gps-of-life':              '/images/programs/content/gps-of-life--01-cairo-crossroads.png',
  'ihya-reviving-the-self':   '/images/programs/content/ihya-reviving-the-self--01-car-night-recognition.png',
  'mcc-mentoring':            '/images/programs/content/mcc-mentoring--01-master-apprentice-chiaroscuro.png',
};

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

  private normalizeProgram(p: Program): Program {
    return {
      ...p,
      status: p.status || 'active',
      prerequisite_codes: Array.isArray(p.prerequisite_codes)
        ? p.prerequisite_codes
        : csvToArray(p.prerequisite_codes as unknown as string),
      pathway_codes: Array.isArray(p.pathway_codes)
        ? p.pathway_codes
        : csvToArray(p.pathway_codes as unknown as string),
      program_logo: p.program_logo || PROGRAM_LOGO_MAP[p.slug],
      hero_image_url: p.hero_image_url || PROGRAM_HERO_MAP[p.slug],
    };
  }

  async getAllPrograms(): Promise<Program[]> {
    const rows = await this.loadSheet<Program>('programs');
    return this.published(rows)
      .map((p) => this.normalizeProgram(p))
      .sort((a, b) => a.display_order - b.display_order);
  }

  async getProgramsByNavGroup(group: NavGroup): Promise<Program[]> {
    const all = await this.getAllPrograms();
    return all.filter((p) => p.nav_group === group);
  }

  async getProgram(slug: string): Promise<Program | null> {
    const rows = await this.loadSheet<Program>('programs');
    const found = this.published(rows).find((p) => p.slug === slug);
    return found ? this.normalizeProgram(found) : null;
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

  private normalizeTeamMember(t: TeamMember): TeamMember {
    return {
      ...t,
      languages: Array.isArray(t.languages) ? t.languages : csvToArray(t.languages as unknown as string),
      specialties: Array.isArray(t.specialties) ? t.specialties : csvToArray(t.specialties as unknown as string),
      coaching_styles: Array.isArray(t.coaching_styles) ? t.coaching_styles : csvToArray(t.coaching_styles as unknown as string),
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

  // ── Cache ─────────────────────────────────────────────────────────────


  async getAllTestimonials(): Promise<Testimonial[]> {
    const rows = await this.loadSheet<Testimonial>('testimonials');
    return rows
      .filter((t) => t.published !== false)
      .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    const all = await this.getAllTestimonials();
    return all.filter((t) => t.is_featured);
  }

  async getTestimonialsByCoach(coachSlug: string): Promise<Testimonial[]> {
    const all = await this.getAllTestimonials();
    return all.filter((t) => t.coach_slug === coachSlug);
  }

  async getAllQuotes(): Promise<Quote[]> {
    const rows = await this.loadSheet<Quote>('quotes');
    return rows
      .filter((q) => q.published !== false)
      .sort((a, b) => a.display_order - b.display_order);
  }

  async getQuotesByCategory(category: string): Promise<Quote[]> {
    const all = await this.getAllQuotes();
    return all.filter((q) => q.category === category);
  }

  private normalizeEvent(e: import('./types').Event): import('./types').Event {
    // Resolve image_url: use CMS value if present, otherwise fall back to
    // the program's first content image (if the event links to a program).
    const image_url =
      e.image_url ||
      (e.program_slug ? (EVENT_IMAGE_BY_PROGRAM[e.program_slug] ?? '') : '');
    return { ...e, image_url };
  }

  async getAllEvents(): Promise<import('./types').Event[]> {
    const rows = await this.loadSheet<import('./types').Event>('events');
    return rows
      .filter((e) => e.published !== false)
      .map((e) => this.normalizeEvent(e));
  }

  async getUpcomingEvents(): Promise<import('./types').Event[]> {
    const all = await this.getAllEvents();
    const today = new Date().toISOString().split('T')[0];
    return all
      .filter((e) => e.date_start >= today)
      .sort((a, b) => a.date_start.localeCompare(b.date_start));
  }

  async getEvent(slug: string): Promise<import('./types').Event | null> {
    const all = await this.getAllEvents();
    return all.find((e) => e.slug === slug) ?? null;
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
