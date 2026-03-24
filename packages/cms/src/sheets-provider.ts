// @kunacademy/cms — GoogleSheetsProvider
// Production provider that reads from Google Sheets API v4.
// Content team edits in Zoho Sheet → Zoho Flow syncs → Google Sheet → this reads.
//
// Requires: GOOGLE_SHEETS_API_KEY env var (read-only, no OAuth needed)
// Sheets must be shared as "Anyone with the link can view"

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
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
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
  return /^(price_|early_bird_price_|discount_percentage|duration_minutes|sessions_count|validity_days|display_order|access_duration_days|cce_units)/.test(header);
}

function isArrayColumn(header: string): boolean {
  return /^(specialties|coaching_styles|languages)$/.test(header);
}

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

  private async loadPathfinder(): Promise<PathfinderQuestion[]> {
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
