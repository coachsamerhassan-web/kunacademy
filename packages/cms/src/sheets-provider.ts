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

  // ── Phase 3 PARTIAL cutover (2026-04-21) ────────────────────────────────
  // 7 entities are DB-only. GoogleSheetsProvider is retained only as a
  // legacy fallback path for pathfinder + team + blog (un-migrated).
  // Calls to migrated-entity methods throw to surface misconfiguration.
  private migrated(method: string): never {
    throw new Error(
      `[cms/sheets] ${method}() is DB-only since Phase 3 PARTIAL (2026-04-21). ` +
      `Unset GOOGLE_SHEETS_API_KEY to fall back to DbContentProvider, or route this call through DbContentProvider directly.`,
    );
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

  // ── Sheet 5: Settings (MIGRATED → site_settings) ────────────────────────

  async getAllSettings(): Promise<SettingsMap> {
    this.migrated('getAllSettings');
  }

  async getSetting(_category: string, _key: string): Promise<string | null> {
    this.migrated('getSetting');
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


  // ── Sheet 7: Testimonials (MIGRATED → testimonials) ─────────────────────

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

  // ── Sheet 8: Events (MIGRATED → events) ─────────────────────────────────

  async getAllEvents(): Promise<Event[]> {
    this.migrated('getAllEvents');
  }

  async getUpcomingEvents(): Promise<Event[]> {
    this.migrated('getUpcomingEvents');
  }

  async getEvent(_slug: string): Promise<Event | null> {
    this.migrated('getEvent');
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
