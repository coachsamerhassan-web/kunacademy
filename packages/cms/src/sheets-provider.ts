// @kunacademy/cms — GoogleSheetsProvider
// Production provider that reads from Google Sheets API v4.
// Content team edits in Zoho Sheet → Zoho Flow syncs → Google Sheet → this reads.
//
// Requires: GOOGLE_SHEETS_API_KEY env var (read-only, no OAuth needed)
// Sheets must be shared as "Anyone with the link can view"

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
  PathfinderAnswer,
  Testimonial,
  Event,
  BlogPost,
  Quote,
} from './types';

// ── Config ──────────────────────────────────────────────────────────────────

interface SheetConfig {
  /** Google Sheets spreadsheet ID (from the URL) */
  spreadsheetId: string;
  /** API key for Google Sheets v4 */
  apiKey: string;
  /** Sheet/tab names within the spreadsheet */
  sheetNames: {
    pageContent: string;
    programs: string;
    services: string;
    team: string;
    settings: string;
    pathfinder: string;
    testimonials: string;
    events: string;
    blog: string;
    quotes: string;
  };
  /** Cache TTL in milliseconds (default: 5 minutes for ISR alignment) */
  cacheTtlMs?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

/** Fetch a sheet tab and return rows as key-value objects (header row = keys) */
async function fetchSheetRows<T>(
  spreadsheetId: string,
  sheetName: string,
  apiKey: string
): Promise<T[]> {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE`;
  // Next.js extends RequestInit with `next` option for ISR revalidation.
  // Cast to avoid TS error in non-Next environments.
  const res = await fetch(url, {
    next: { revalidate: 300 },
  } as RequestInit); // ISR: 5 min

  if (!res.ok) {
    console.error(`[cms/sheets] Failed to fetch "${sheetName}": ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json() as { values?: string[][] };
  if (!data.values || data.values.length < 2) return [];

  const [headers, ...rows] = data.values;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      obj[header] = parseSheetValue(header, row[i] ?? '');
    });
    return obj as T;
  });
}

/**
 * Parse a raw sheet cell value into the correct JS type.
 *
 * TODO(samer): This is where you decide the parsing strategy.
 * See the comment block below for the design choice.
 */
function parseSheetValue(header: string, raw: string): unknown {
  // Empty cells
  if (raw === '' || raw === undefined) return undefined;

  // ── Boolean columns ──────────────────────────────────────────────────
  // Sheet convention: "TRUE"/"FALSE" or "yes"/"no" or "1"/"0"
  if (isBooleanColumn(header)) {
    return raw === 'TRUE' || raw === 'yes' || raw === '1' || raw === 'true';
  }

  // ── Numeric columns ──────────────────────────────────────────────────
  if (isNumericColumn(header)) {
    const num = Number(raw);
    return isNaN(num) ? 0 : num;
  }

  // ── Array columns (comma-separated → string[]) ──────────────────────
  if (isArrayColumn(header)) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  // Everything else: string
  return raw;
}

// ── Column classification ───────────────────────────────────────────────────
// These functions define which columns are treated as booleans, numbers, or arrays.
// This is a meaningful design choice — see the learning mode comment below.

function isBooleanColumn(header: string): boolean {
  return /^(published|is_|installment_enabled)/.test(header);
}

function isNumericColumn(header: string): boolean {
  return /^(price_|early_bird_price_|discount_percentage|duration_minutes|sessions_count|validity_days|display_order|access_duration_days|cce_units|capacity|reading_time_minutes)/.test(header);
}

function isArrayColumn(header: string): boolean {
  return /^(specialties|coaching_styles|languages|speaker_slugs|tags|prerequisite_codes|pathway_codes|service_roles)$/.test(header);
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

// ── Program Hero Image Defaults (reusing existing site assets) ───────────────

const PROGRAM_HERO_MAP: Record<string, string> = {
  'stce-level-3-stgc': '/images/community/hands-circle-gulf.jpg',
  'mcc-mentoring': '/images/founder/samer-podcast-smile-warm-light.jpg',
  'menhajak-training': '/images/founder/samer-workshop-candid-thumbsup.jpg',
};

// ── Provider Implementation ─────────────────────────────────────────────────

export class GoogleSheetsProvider implements ContentProvider {
  readonly name = 'google-sheets';
  private config: Required<SheetConfig>;
  private cache: Map<string, { data: unknown; loadedAt: number }> = new Map();

  constructor(config: SheetConfig) {
    this.config = {
      ...config,
      cacheTtlMs: config.cacheTtlMs ?? 300_000, // 5 min default
    };
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async loadSheet<T>(sheetKey: keyof SheetConfig['sheetNames']): Promise<T[]> {
    const sheetName = this.config.sheetNames[sheetKey];
    const cacheKey = `sheet:${sheetKey}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.loadedAt < this.config.cacheTtlMs) {
      return cached.data as T[];
    }

    const rows = await fetchSheetRows<T>(
      this.config.spreadsheetId,
      sheetName,
      this.config.apiKey
    );

    this.cache.set(cacheKey, { data: rows, loadedAt: Date.now() });
    return rows;
  }

  private published<T extends { published: boolean }>(rows: T[]): T[] {
    return rows.filter((r) => r.published);
  }

  // ── Sheet 1: Page Content ───────────────────────────────────────────────

  async getPageContent(slug: string): Promise<PageSections> {
    const rows = await this.loadSheet<PageContent>('pageContent');
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
    const rows = await this.loadSheet<PageContent>('pageContent');
    const slugs = new Set(this.published(rows).map((r) => r.slug));
    return [...slugs];
  }

  async getPageSeo(slug: string) {
    const rows = await this.loadSheet<PageContent>('pageContent');
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

  async getLandingPages(): Promise<PageContent[]> {
    const rows = await this.loadSheet<PageContent>('pageContent');
    return this.published(rows).filter((r) => r.type === 'landing');
  }

  // ── Sheet 2: Programs ─────────────────────────────────────────────────

  private normalizeProgram(p: Program): Program {
    return {
      ...p,
      status: p.status || 'active',
      prerequisite_codes: Array.isArray(p.prerequisite_codes) ? p.prerequisite_codes : [],
      pathway_codes: Array.isArray(p.pathway_codes) ? p.pathway_codes : [],
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
    const found = this.published(rows).find((t) => t.slug === slug);
    return found ? this.normalizeTeamMember(found) : null;
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

  private async loadPathfinder(): Promise<PathfinderQuestion[]> {
    // P0 fix: Google Sheets has corrupted Arabic text for the Pathfinder tab.
    // Prefer the local JSON file (committed to the repo) over Sheets data for
    // this tab specifically. The JSON is the source of truth until the Sheets
    // encoding is repaired. Works in both local dev and on VPS because the file
    // is part of the repository/build at data/cms/pathfinder.json.
    const localJsonPath = join(process.cwd(), 'data', 'cms', 'pathfinder.json');
    try {
      const raw = await readFile(localJsonPath, 'utf-8');
      const rows = JSON.parse(raw) as PathfinderQuestion[];
      const published = rows.filter((r) => (r as unknown as { published: boolean }).published !== false);
      console.log(`[cms/sheets] Pathfinder: using local JSON override (${published.length} questions)`);
      return published.map((row) => ({
        ...row,
        answers: Array.isArray(row.answers)
          ? row.answers
          : parseAnswersJson(row.answers as unknown as string),
      }));
    } catch {
      console.warn('[cms/sheets] Pathfinder local JSON not found — falling back to Google Sheets');
    }

    const rows = await this.loadSheet<PathfinderQuestion & { answers: string }>('pathfinder');
    return this.published(rows as unknown as (PathfinderQuestion & { published: boolean })[]).map((row) => ({
      ...row,
      answers: parseAnswersJson((row as unknown as { answers: string }).answers),
    }));
  }

  async getAllPathfinderQuestions(): Promise<PathfinderQuestion[]> {
    return this.loadPathfinder();
  }

  async getPathfinderRoots(type?: 'individual' | 'corporate'): Promise<PathfinderQuestion[]> {
    const all = await this.loadPathfinder();
    const roots = all.filter((q) => !q.parent_answer_id);
    return type ? roots.filter((q) => q.type === type) : roots;
  }

  async getPathfinderChildren(parentAnswerId: string): Promise<PathfinderQuestion[]> {
    const all = await this.loadPathfinder();
    return all.filter((q) => q.parent_answer_id === parentAnswerId);
  }


  // ── Sheet 7: Testimonials ─────────────────────────────────────────────

  async getAllTestimonials(): Promise<Testimonial[]> {
    const rows = await this.loadSheet<Testimonial>('testimonials');
    return this.published(rows).sort((a, b) => a.display_order - b.display_order);
  }

  async getFeaturedTestimonials(): Promise<Testimonial[]> {
    const all = await this.getAllTestimonials();
    return all.filter((t) => t.is_featured);
  }

  async getTestimonialsByCoach(coachSlug: string): Promise<Testimonial[]> {
    const all = await this.getAllTestimonials();
    return all.filter((t) => t.coach_slug === coachSlug);
  }

  // ── Quotes ─────────────────────────────────────────────────────────

  async getAllQuotes(): Promise<Quote[]> {
    const rows = await this.loadSheet<Quote>('quotes');
    return this.published(rows).sort((a, b) => a.display_order - b.display_order);
  }

  async getQuotesByCategory(category: string): Promise<Quote[]> {
    const all = await this.getAllQuotes();
    return all.filter((q) => q.category === category);
  }

  // ── Sheet 8: Events ─────────────────────────────────────────────────

  async getAllEvents(): Promise<Event[]> {
    const rows = await this.loadSheet<Event>('events');
    return this.published(rows).sort((a, b) => {
      if (a.date_start && b.date_start) return a.date_start.localeCompare(b.date_start);
      return a.display_order - b.display_order;
    });
  }

  async getUpcomingEvents(): Promise<Event[]> {
    const all = await this.getAllEvents();
    const today = new Date().toISOString().split('T')[0];
    return all.filter((e) => e.date_start >= today);
  }

  async getEvent(slug: string): Promise<Event | null> {
    const rows = await this.loadSheet<Event>('events');
    return this.published(rows).find((e) => e.slug === slug) ?? null;
  }

  // ── Sheet 9: Blog ─────────────────────────────────────────────────

  async getAllBlogPosts(): Promise<BlogPost[]> {
    const rows = await this.loadSheet<BlogPost>('blog');
    return this.published(rows).sort((a, b) => {
      if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at);
      return a.display_order - b.display_order;
    });
  }

  async getBlogPost(slug: string): Promise<BlogPost | null> {
    const rows = await this.loadSheet<BlogPost>('blog');
    return this.published(rows).find((p) => p.slug === slug) ?? null;
  }

  async getFeaturedBlogPosts(): Promise<BlogPost[]> {
    const all = await this.getAllBlogPosts();
    return all.filter((p) => p.is_featured);
  }

  async getBlogPostsByCategory(category: string): Promise<BlogPost[]> {
    const all = await this.getAllBlogPosts();
    return all.filter((p) => p.category === category);
  }

  // ── Cache ─────────────────────────────────────────────────────────────

  async invalidateCache(): Promise<void> {
    this.cache.clear();
  }
}

/** Parse the JSON answers column from the Pathfinder sheet */
function parseAnswersJson(raw: unknown): PathfinderAnswer[] {
  if (!raw || raw === '[]') return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as PathfinderAnswer[];
    } catch {
      console.error('[cms/sheets] Failed to parse Pathfinder answers JSON:', raw);
      return [];
    }
  }
  return [];
}
