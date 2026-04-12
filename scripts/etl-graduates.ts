#!/usr/bin/env tsx
/**
 * ETL: Google Sheets (graduates) → PostgreSQL database + enrichment
 *
 * Sources:
 *   Google Sheet ID: 1PiExrScatxdbmb3SBRrqzOu-XHQP6XQErglwjiryljc  (tab: Main, rows 2-201)
 *
 * Writes to:
 *   community_members       — one row per graduate (upsert on student_number)
 *   graduate_certificates   — one row per program module + one row per STCE level
 *   badge_definitions       — seed rows for all programs + STCE levels
 *
 * Enrichment priority (never overwrite a higher-priority source):
 *   1. Sheet data (always primary)
 *   2. Zoho CRM contacts (exact name match — email + phone)
 *   3. Amelia WP users CSV (exact name match — email + phone)
 *   4. WP instructors JSON (slug match — Arabic name only)
 *
 * DRY RUN mode: set DRY_RUN=1 to log without writing.
 *
 * Configurable paths:
 *   AMELIA_CSV       — default: /Users/samer/Downloads/wp_amelia_users.csv
 *   WP_INSTRUCTORS   — default: <repo>/data/wp-export/instructors.json
 *
 * Usage:
 *   npx tsx scripts/etl-graduates.ts
 *   DRY_RUN=1 npx tsx scripts/etl-graduates.ts
 */

import { google } from 'googleapis';
import { resolve } from 'path';
import { withAdminContext, closePool } from '../packages/db/src/pool';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.env.DRY_RUN === '1';

const SHEET_ID = '1PiExrScatxdbmb3SBRrqzOu-XHQP6XQErglwjiryljc';
const SHEET_RANGE = 'Main!A2:O201';

const GOOGLE_CREDS_PATH = '/Users/samer/Claude Code/credentials/google-sheets-token.json';

// Zoho CRM credentials (one-time ETL — hardcoded intentionally)
const ZOHO_CLIENT_ID = '1000.YZYHPX11K54IU89O1RV1DKSFHCOIAC';
const ZOHO_CLIENT_SECRET = '4e39128782adc40ca8a48cf4cc712b79ed1bdadf80';
const ZOHO_REFRESH_TOKEN = '1000.39db15fbc6cf921773155675a0c9a937.30aa181da94e4e83493dab2bd990cc7c';

// Enrichment source paths (configurable via env)
const REPO_ROOT = resolve(__dirname, '..');
const AMELIA_CSV = process.env.AMELIA_CSV || '/Users/samer/Downloads/wp_amelia_users.csv';
const WP_INSTRUCTORS_JSON = process.env.WP_INSTRUCTORS || resolve(REPO_ROOT, 'data/wp-export/instructors.json');

// ---------------------------------------------------------------------------
// Program map
// ---------------------------------------------------------------------------

interface ProgramDef {
  slug: string;
  name_ar: string;
  name_en: string;
  colIndex: number;
  badgeSlug: string;
}

// STCE is the umbrella program. Each entry below is a MODULE within STCE,
// except MANHAJAK which is a separate standalone program.
// Cert column (col 3) tracks STCE progression levels (L1–L4), not program membership.
const PROGRAMS: Record<string, ProgramDef> = {
  STIC: {
    slug: 'stce-stic',
    name_ar: 'التفكير الحسّي في الكوتشينج — STIC',
    name_en: 'STCE — Somatic Thinking in Coaching',
    colIndex: 4,
    badgeSlug: 'stce-stic-completion',
  },
  STAIC: {
    slug: 'stce-staic',
    name_ar: 'التفكير الحسّي المتقدم في الكوتشينج — STAIC',
    name_en: 'STCE — Somatic Thinking Advanced in Coaching',
    colIndex: 5,
    badgeSlug: 'stce-staic-completion',
  },
  STGC: {
    slug: 'stce-stgc',
    name_ar: 'التفكير الحسّي في كوتشينج المجموعات — STGC',
    name_en: 'STCE — Somatic Thinking in Group Coaching',
    colIndex: 6,
    badgeSlug: 'stce-stgc-completion',
  },
  STOC: {
    slug: 'stce-stoc',
    name_ar: 'التفكير الحسّي في كوتشينج المنظمات — STOC',
    name_en: 'STCE — Somatic Thinking in Organizational Coaching',
    colIndex: 7,
    badgeSlug: 'stce-stoc-completion',
  },
  MANHAJAK: {
    slug: 'manhajak',
    name_ar: 'منهجك',
    name_en: 'Manhajak',
    colIndex: 9,
    badgeSlug: 'manhajak-completion',
  },
};

// STCE level definitions
const STCE_LEVELS: Array<{
  certType: string;
  badgeSlug: string;
  badgeLabelEn: string;
  badgeLabelAr: string;
  nameEn: string;
  nameAr: string;
}> = [
  {
    certType: 'level_1',
    badgeSlug: 'stce-level-1',
    badgeLabelEn: 'STCE Level 1',
    badgeLabelAr: 'STCE المستوى الأول',
    nameEn: 'STCE Level 1',
    nameAr: 'STCE المستوى الأول',
  },
  {
    certType: 'level_2',
    badgeSlug: 'stce-level-2',
    badgeLabelEn: 'STCE Level 2',
    badgeLabelAr: 'STCE المستوى الثاني',
    nameEn: 'STCE Level 2',
    nameAr: 'STCE المستوى الثاني',
  },
  {
    certType: 'level_3',
    badgeSlug: 'stce-level-3',
    badgeLabelEn: 'STCE Level 3',
    badgeLabelAr: 'STCE المستوى الثالث',
    nameEn: 'STCE Level 3',
    nameAr: 'STCE المستوى الثالث',
  },
  {
    certType: 'level_4',
    badgeSlug: 'stce-level-4',
    badgeLabelEn: 'STCE Level 4',
    badgeLabelAr: 'STCE المستوى الرابع',
    nameEn: 'STCE Level 4',
    nameAr: 'STCE المستوى الرابع',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(msg);
}

function warn(msg: string) {
  console.warn(`  [WARN] ${msg}`);
}

/** Trim a raw cell value, returning null if blank */
function cell(row: (string | null | undefined)[], idx: number): string | null {
  const v = row[idx];
  if (v == null) return null;
  const trimmed = String(v).replace(/^\s+|\s+$/g, '');
  return trimmed === '' ? null : trimmed;
}

/**
 * Parse a freeform date string like "August 31, 2017" into YYYY-MM-DD.
 * Returns null if the string is blank or unparseable.
 */
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    warn(`  Could not parse date: "${raw}"`);
    return null;
  }
  // Use UTC parts to avoid timezone shifts on date-only strings
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalize cert_language: "Ar" | "AR" | "Eng" → "ar" | "en"
 */
function normalizeLang(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === 'ar') return 'ar';
  if (lower.startsWith('en')) return 'en';
  return lower;
}

/**
 * Build a URL-safe slug from an English name.
 * e.g. "John Doe" → "john-doe"
 */
function buildSlug(nameEn: string): string {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalise a name for CRM matching: lowercase + collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Parse the Cert column into an array of level numbers.
 * "L1, L2, L3, L4" → [1, 2, 3, 4]
 * "L1" → [1]
 */
function parseCertLevels(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(s => /^L\d$/i.test(s))
    .map(s => parseInt(s.slice(1), 10))
    .filter(n => n >= 1 && n <= 4);
}

// ---------------------------------------------------------------------------
// Google Sheets
// ---------------------------------------------------------------------------

async function fetchSheetRows(): Promise<(string | null)[][]> {
  log('Reading Google credentials...');
  const credsRaw = require('fs').readFileSync(GOOGLE_CREDS_PATH, 'utf-8');
  const creds = JSON.parse(credsRaw);

  const oauth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
  );
  oauth2Client.setCredentials({ refresh_token: creds.refresh_token });

  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  log(`Fetching sheet range ${SHEET_RANGE} from ${SHEET_ID}...`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rows = res.data.values ?? [];
  log(`Sheet returned ${rows.length} rows`);
  return rows as (string | null)[][];
}

// ---------------------------------------------------------------------------
// Zoho CRM
// ---------------------------------------------------------------------------

interface CrmContact {
  id: string;
  Full_Name: string;
  Email: string | null;
  Phone: string | null;
  Mobile: string | null;
}

async function fetchZohoAccessToken(): Promise<string> {
  const url =
    `https://accounts.zoho.com/oauth/v2/token` +
    `?grant_type=refresh_token` +
    `&client_id=${ZOHO_CLIENT_ID}` +
    `&client_secret=${ZOHO_CLIENT_SECRET}` +
    `&refresh_token=${ZOHO_REFRESH_TOKEN}`;

  const res = await fetch(url, { method: 'POST' });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`Zoho token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function fetchAllZohoContacts(): Promise<CrmContact[]> {
  log('\nFetching Zoho CRM contacts for enrichment...');
  const token = await fetchZohoAccessToken();
  const all: CrmContact[] = [];
  let page = 1;

  while (true) {
    const url =
      `https://www.zohoapis.com/crm/v6/Contacts` +
      `?fields=Full_Name,Email,Phone,Mobile&per_page=200&page=${page}`;

    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const data = (await res.json()) as {
      data?: CrmContact[];
      info?: { more_records?: boolean };
    };

    if (!data.data || data.data.length === 0) break;

    all.push(...data.data);
    log(`  Fetched Zoho page ${page}: ${data.data.length} contacts (total so far: ${all.length})`);

    if (!data.info?.more_records) break;
    page++;
  }

  log(`  Total Zoho contacts: ${all.length}`);
  return all;
}

/** Build a map: normalizedName → first CRM contact with that name */
function buildCrmLookup(contacts: CrmContact[]): Map<string, CrmContact> {
  const map = new Map<string, CrmContact>();
  for (const c of contacts) {
    if (!c.Full_Name) continue;
    const key = normalizeName(c.Full_Name);
    if (!map.has(key)) {
      map.set(key, c);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Amelia WP users CSV
// ---------------------------------------------------------------------------

interface AmeliaUser {
  email: string | null;
  phone: string | null;
}

/**
 * Parse a single CSV line, handling double-quote escaping and quoted fields.
 * Columns: id, status, type, externalId, firstName, lastName, email, birthday, phone, ...
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && line[i + 1] === '"') { current += '"'; i++; continue; }
    if (line[i] === '"') { inQuotes = !inQuotes; continue; }
    if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += line[i];
  }
  result.push(current);
  return result;
}

/**
 * Read the Amelia WP users CSV and build a map: normalizedFullName → {email, phone}.
 * Columns (0-indexed): 0=id, 1=status, 2=type, 3=externalId, 4=firstName, 5=lastName, 6=email, 7=birthday, 8=phone
 */
function loadAmeliaLookup(): Map<string, AmeliaUser> {
  const map = new Map<string, AmeliaUser>();
  const fs = require('fs') as typeof import('fs');

  if (!fs.existsSync(AMELIA_CSV)) {
    warn(`Amelia CSV not found at ${AMELIA_CSV} — skipping Amelia enrichment`);
    return map;
  }

  const content = fs.readFileSync(AMELIA_CSV, 'utf-8');
  const lines = content.split('\n');
  // Skip header row
  let parsed = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const firstName = (cols[4] ?? '').trim();
    const lastName = (cols[5] ?? '').trim();
    if (!firstName && !lastName) continue;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const email = (cols[6] ?? '').trim() || null;
    const phone = (cols[8] ?? '').trim() || null;
    const key = normalizeName(fullName);
    if (!map.has(key)) {
      map.set(key, { email, phone });
      parsed++;
    }
  }

  log(`  Amelia CSV: loaded ${parsed} unique entries from ${lines.length - 1} rows`);
  return map;
}

// ---------------------------------------------------------------------------
// WP instructors JSON (Arabic names)
// ---------------------------------------------------------------------------

interface WpInstructor {
  slug: string;
  title: { rendered: string };
}

/**
 * Read the WP instructors JSON and build a map: instructorSlug → Arabic name.
 * Only entries whose title contains Arabic characters are included.
 */
function loadWpInstructors(): Map<string, string> {
  const map = new Map<string, string>();
  const fs = require('fs') as typeof import('fs');

  if (!fs.existsSync(WP_INSTRUCTORS_JSON)) {
    warn(`WP instructors JSON not found at ${WP_INSTRUCTORS_JSON} — skipping WP name enrichment`);
    return map;
  }

  const raw = fs.readFileSync(WP_INSTRUCTORS_JSON, 'utf-8');
  const instructors: WpInstructor[] = JSON.parse(raw);

  const arabicRegex = /[\u0600-\u06FF]/;
  let loaded = 0;
  for (const instructor of instructors) {
    if (!instructor.slug || !instructor.title?.rendered) continue;
    const title = instructor.title.rendered;
    if (arabicRegex.test(title)) {
      map.set(instructor.slug, title);
      loaded++;
    }
  }

  log(`  WP instructors: ${loaded} Arabic-named coaches loaded from ${instructors.length} total`);
  return map;
}

// ---------------------------------------------------------------------------
// Badge definitions seed
// ---------------------------------------------------------------------------

async function seedBadgeDefinitions(adminDb: any): Promise<void> {
  log('\n--- Seeding badge_definitions ---');

  // Program completion badges
  const programBadges = Object.values(PROGRAMS).map(p => ({
    slug: p.badgeSlug,
    name_ar: p.name_ar,
    name_en: `${p.name_en} — Graduate`,
    program_slug: p.slug,
    display_order: 0,
  }));

  // STCE level badges
  const levelBadges = STCE_LEVELS.map((l, i) => ({
    slug: l.badgeSlug,
    name_ar: l.nameAr,
    name_en: l.nameEn,
    program_slug: 'stce',
    display_order: i + 1,
  }));

  const allBadges = [...programBadges, ...levelBadges];

  let ok = 0;
  for (const badge of allBadges) {
    if (DRY_RUN) {
      log(`  [DRY RUN] badge ${badge.slug} would upsert`);
      ok++;
      continue;
    }
    try {
      await adminDb.execute(sql`
        INSERT INTO badge_definitions (slug, name_ar, name_en, image_url, program_slug, display_order, is_active)
        VALUES (
          ${badge.slug},
          ${badge.name_ar},
          ${badge.name_en},
          ${''},
          ${badge.program_slug},
          ${badge.display_order},
          true
        )
        ON CONFLICT (slug) DO UPDATE SET
          name_ar       = EXCLUDED.name_ar,
          name_en       = EXCLUDED.name_en,
          program_slug  = EXCLUDED.program_slug,
          display_order = EXCLUDED.display_order,
          is_active     = EXCLUDED.is_active
      `);
      log(`  ok  badge:${badge.slug}`);
      ok++;
    } catch (err: any) {
      warn(`badge ${badge.slug} failed: ${err?.message}`);
    }
  }

  log(`Badge definitions: ${ok}/${allBadges.length} seeded${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

// ---------------------------------------------------------------------------
// Slug dedup registry
// ---------------------------------------------------------------------------

class SlugRegistry {
  private seen = new Map<string, number>();

  allocate(base: string): string {
    const count = this.seen.get(base) ?? 0;
    this.seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  }

  /** Pre-populate with slugs already in the DB */
  seed(slug: string): void {
    if (!this.seen.has(slug)) {
      this.seen.set(slug, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Graduates ETL
// ---------------------------------------------------------------------------

async function etlGraduates(adminDb: any): Promise<void> {
  // 1. Read sheet
  const rows = await fetchSheetRows();

  // 2. Fetch all Zoho contacts for enrichment
  const crmContacts = await fetchAllZohoContacts();
  const crmLookup = buildCrmLookup(crmContacts);

  // 3. Load Amelia WP users CSV
  log('\nLoading Amelia WP users CSV...');
  const ameliaLookup = loadAmeliaLookup();

  // 4. Load WP instructors JSON (Arabic names)
  log('\nLoading WP instructors JSON...');
  const wpInstructors = loadWpInstructors();

  // 5. Pre-load existing slugs from DB so we can deduplicate correctly
  const slugRegistry = new SlugRegistry();
  if (!DRY_RUN) {
    try {
      const { rows: existingRows } = await adminDb.execute(sql`
        SELECT slug FROM community_members
      `);
      for (const r of existingRows as { slug: string }[]) {
        slugRegistry.seed(r.slug);
      }
      log(`\nPre-loaded ${existingRows.length} existing slugs from DB`);
    } catch (err: any) {
      warn(`Could not pre-load existing slugs: ${err?.message}`);
    }
  }

  // 6. Counters
  let membersCreated = 0;
  let membersUpdated = 0;
  let certsCreated = 0;
  let crmEnrichments = 0;
  let ameliaEnrichments = 0;
  let wpNameEnrichments = 0;
  let profileLinks = 0;
  let errors = 0;

  log('\n--- Processing graduates ---');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, offset by header row

    // Skip rows with no student number or name
    const studentNumber = cell(row, 0);
    const nameEn = cell(row, 1);
    if (!studentNumber || !nameEn) {
      continue;
    }

    const label = `[row ${rowNum}:${studentNumber}]`;

    // -------------------------------------------------------------------------
    // Extract raw fields
    // -------------------------------------------------------------------------
    const certLang = normalizeLang(cell(row, 2));
    const certCol = cell(row, 3);
    const icfCredential = cell(row, 10)?.toUpperCase() ?? null;
    let phone = cell(row, 11);
    let email = cell(row, 12);
    const country = cell(row, 13);
    const spokenLangsRaw = cell(row, 14);

    // Spoken languages: comma-separated → array
    const spokenLangs: string[] | null = spokenLangsRaw
      ? spokenLangsRaw.split(',').map(s => s.trim()).filter(Boolean)
      : null;

    // -------------------------------------------------------------------------
    // Multi-source enrichment (priority: sheet → CRM → Amelia → WP instructors)
    // Never overwrite a value already present from a higher-priority source.
    // -------------------------------------------------------------------------
    const nameKey = normalizeName(nameEn);

    // Source 2: Zoho CRM
    if (!email || !phone) {
      const crmMatch = crmLookup.get(nameKey);
      if (crmMatch) {
        const prevEmail = email;
        const prevPhone = phone;
        if (!email) email = crmMatch.Email ?? null;
        if (!phone) phone = crmMatch.Mobile ?? crmMatch.Phone ?? null;
        if (email !== prevEmail || phone !== prevPhone) {
          crmEnrichments++;
          log(`  ${label} CRM enriched: email=${email ?? 'none'} phone=${phone ?? 'none'}`);
        }
      }
    }

    // Source 3: Amelia WP users CSV
    if (!email || !phone) {
      const ameliaMatch = ameliaLookup.get(nameKey);
      if (ameliaMatch) {
        const prevEmail = email;
        const prevPhone = phone;
        if (!email) email = ameliaMatch.email ?? null;
        if (!phone) phone = ameliaMatch.phone ?? null;
        if (email !== prevEmail || phone !== prevPhone) {
          ameliaEnrichments++;
          log(`  ${label} Amelia enriched: email=${email ?? 'none'} phone=${phone ?? 'none'}`);
        }
      }
    }

    // Source 4: WP instructors (Arabic name only — no email/phone)
    let wpNameAr: string | null = null;
    {
      const instructorSlug = buildSlug(nameEn);
      const wpAr = wpInstructors.get(instructorSlug) ?? null;
      if (wpAr) {
        wpNameAr = wpAr;
        wpNameEnrichments++;
        log(`  ${label} WP name_ar enriched: ${wpNameAr}`);
      }
    }

    // -------------------------------------------------------------------------
    // Build slug (deduplicated)
    // -------------------------------------------------------------------------
    const slugBase = buildSlug(nameEn);
    const slug = slugRegistry.allocate(slugBase);

    // -------------------------------------------------------------------------
    // Profile lookup by email
    // -------------------------------------------------------------------------
    let profileId: string | null = null;
    if (!DRY_RUN && email) {
      try {
        const { rows: profileRows } = await adminDb.execute(sql`
          SELECT id FROM profiles WHERE email = ${email.toLowerCase()} LIMIT 1
        `);
        if (profileRows.length > 0) {
          profileId = (profileRows[0] as { id: string }).id;
          profileLinks++;
          log(`  ${label} profile linked: ${profileId}`);
        }
      } catch (err: any) {
        warn(`${label} profile lookup failed: ${err?.message}`);
      }
    }

    if (DRY_RUN) {
      log(`  [DRY RUN] ${label} ${nameEn} → slug=${slug}, email=${email ?? 'none'}, country=${country ?? 'none'}`);
    }

    // -------------------------------------------------------------------------
    // Upsert community_members
    // -------------------------------------------------------------------------
    let memberId: string | null = null;

    if (DRY_RUN) {
      membersCreated++;
    } else {
      try {
        const { rows: upsertRows } = await adminDb.execute(sql`
          INSERT INTO community_members (
            student_number,
            slug,
            name_ar,
            name_en,
            email,
            phone,
            country,
            languages,
            member_type,
            source,
            profile_id,
            is_visible
          )
          VALUES (
            ${studentNumber},
            ${slug},
            ${wpNameAr ?? nameEn},
            ${nameEn},
            ${email ?? null},
            ${phone ?? null},
            ${country ?? null},
            ${spokenLangs},
            'alumni',
            'sheet_import',
            ${profileId ? sql`${profileId}::uuid` : sql`NULL`},
            true
          )
          ON CONFLICT (student_number) DO UPDATE SET
            name_en     = EXCLUDED.name_en,
            name_ar     = COALESCE(EXCLUDED.name_ar, community_members.name_ar),
            email       = COALESCE(EXCLUDED.email, community_members.email),
            phone       = COALESCE(EXCLUDED.phone, community_members.phone),
            country     = COALESCE(EXCLUDED.country, community_members.country),
            languages   = COALESCE(EXCLUDED.languages, community_members.languages),
            profile_id  = COALESCE(EXCLUDED.profile_id, community_members.profile_id),
            updated_at  = now()
          RETURNING id, (xmax = 0) AS inserted
        `);

        if (upsertRows.length > 0) {
          const r = upsertRows[0] as { id: string; inserted: boolean };
          memberId = r.id;
          if (r.inserted) {
            membersCreated++;
          } else {
            membersUpdated++;
          }
          log(`  ok  ${label} ${nameEn} → member_id=${memberId}${r.inserted ? ' (new)' : ' (updated)'}`);
        }
      } catch (err: any) {
        warn(`${label} community_members upsert failed: ${err?.message}`);
        errors++;
        continue;
      }
    }

    // -------------------------------------------------------------------------
    // Graduate certificates
    // -------------------------------------------------------------------------
    if (!DRY_RUN && !memberId) continue;

    // Helper: insert a certificate row (skip if graduation_date is null)
    async function insertCert(opts: {
      programSlug: string;
      programNameAr: string;
      programNameEn: string;
      certType: string;
      graduationDate: string | null;
      badgeSlug: string;
      badgeLabelEn: string;
      badgeLabelAr: string;
      icf?: string | null;
    }): Promise<void> {
      if (!opts.graduationDate) return;

      if (DRY_RUN) {
        log(`  [DRY RUN]   cert: ${opts.programSlug}/${opts.certType} date=${opts.graduationDate} badge=${opts.badgeSlug}`);
        certsCreated++;
        return;
      }

      try {
        // Idempotent: skip if a cert with the same member + program + cert_type already exists
        const { rows: existing } = await adminDb.execute(sql`
          SELECT id FROM graduate_certificates
          WHERE member_id = ${memberId}::uuid
            AND program_slug = ${opts.programSlug}
            AND certificate_type = ${opts.certType}
          LIMIT 1
        `);

        if (existing.length > 0) {
          // Update graduation_date and icf_credential in case they changed
          await adminDb.execute(sql`
            UPDATE graduate_certificates SET
              graduation_date  = ${opts.graduationDate},
              icf_credential   = COALESCE(${opts.icf ?? null}, icf_credential)
            WHERE id = ${(existing[0] as { id: string }).id}
          `);
          log(`    ok (updated) cert: ${opts.programSlug}/${opts.certType}`);
        } else {
          await adminDb.execute(sql`
            INSERT INTO graduate_certificates (
              member_id,
              program_slug,
              program_name_ar,
              program_name_en,
              certificate_type,
              graduation_date,
              badge_slug,
              badge_label_en,
              badge_label_ar,
              icf_credential,
              verified
            )
            VALUES (
              ${memberId}::uuid,
              ${opts.programSlug},
              ${opts.programNameAr},
              ${opts.programNameEn},
              ${opts.certType},
              ${opts.graduationDate},
              ${opts.badgeSlug},
              ${opts.badgeLabelEn},
              ${opts.badgeLabelAr},
              ${opts.icf ?? null},
              true
            )
          `);
          log(`    ok (new)     cert: ${opts.programSlug}/${opts.certType}`);
          certsCreated++;
        }
      } catch (err: any) {
        warn(`${label} cert ${opts.programSlug}/${opts.certType} failed: ${err?.message}`);
        errors++;
      }
    }

    // STCE program: parse Cert column and create one row per level
    const stceDateRaw = cell(row, PROGRAMS.STIC.colIndex);
    const stceDate = parseDate(stceDateRaw);
    const levels = parseCertLevels(certCol);

    if (levels.length > 0) {
      for (const lvl of levels) {
        const levelDef = STCE_LEVELS[lvl - 1];
        if (!levelDef) continue;
        // ICF credential goes on the highest level cert
        const isHighestLevel = lvl === Math.max(...levels);
        await insertCert({
          programSlug: 'stce',
          programNameAr: PROGRAMS.STIC.name_ar,
          programNameEn: PROGRAMS.STIC.name_en,
          certType: levelDef.certType,
          graduationDate: stceDate,
          badgeSlug: levelDef.badgeSlug,
          badgeLabelEn: levelDef.badgeLabelEn,
          badgeLabelAr: levelDef.badgeLabelAr,
          icf: isHighestLevel ? icfCredential : null,
        });
      }
    } else if (stceDate) {
      // Has a STIC date but no Cert column — store as plain completion
      await insertCert({
        programSlug: 'stce',
        programNameAr: PROGRAMS.STIC.name_ar,
        programNameEn: PROGRAMS.STIC.name_en,
        certType: 'completion',
        graduationDate: stceDate,
        badgeSlug: PROGRAMS.STIC.badgeSlug,
        badgeLabelEn: 'STCE Graduate',
        badgeLabelAr: 'خريج STCE',
        icf: icfCredential,
      });
    }

    // Other programs: STAIC, STGC, STOC, MANHAJAK
    for (const [key, prog] of Object.entries(PROGRAMS)) {
      if (key === 'STIC') continue; // handled above
      const dateRaw = cell(row, prog.colIndex);
      const gradDate = parseDate(dateRaw);
      if (!gradDate) continue;

      // ICF credential only on the first (and typically only) cert for the row
      await insertCert({
        programSlug: prog.slug,
        programNameAr: prog.name_ar,
        programNameEn: prog.name_en,
        certType: 'completion',
        graduationDate: gradDate,
        badgeSlug: prog.badgeSlug,
        badgeLabelEn: `${prog.name_en} — Graduate`,
        badgeLabelAr: `خريج ${prog.name_ar}`,
        icf: icfCredential ?? null,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  log('\n=== ETL Summary ===');
  log(`Members created:        ${membersCreated}`);
  log(`Members updated:        ${membersUpdated}`);
  log(`Certificates created:   ${certsCreated}`);
  log(`Profile links:          ${profileLinks}`);
  log(`Errors:                 ${errors}`);
  log('');
  log('Enrichment by source:');
  log(`  CRM (Zoho):           ${crmEnrichments} graduates enriched`);
  log(`  Amelia WP:            ${ameliaEnrichments} graduates enriched`);
  log(`  WP instructors (AR):  ${wpNameEnrichments} Arabic names added`);
  if (DRY_RUN) log('\n(DRY RUN — no writes occurred)');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('=== ETL: Google Sheets Graduates → Database ===');
  if (DRY_RUN) {
    log('MODE: DRY RUN — no writes will occur');
  }
  log(`Target DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(DATABASE_URL not set)'}`);
  log('');

  await withAdminContext(async (adminDb: any) => {
    await seedBadgeDefinitions(adminDb);
    await etlGraduates(adminDb);
  });

  log('\n=== ETL complete ===');
  await closePool();
}

main().catch((err) => {
  console.error('[etl-graduates] FAILED:', err);
  process.exit(1);
});
