#!/usr/bin/env npx tsx
/**
 * CMS→DB Phase 2d — Migrate apps/web/data/cms/programs.json → programs table.
 *
 * Source: 34 programs in the CMS JSON export. Normalizes pricing strings,
 * CSV-joined arrays, and date strings into the DB column shapes.
 *
 * Idempotent: uses ON CONFLICT (slug) DO UPDATE so re-running updates in place.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-programs.ts
 *   DRY_RUN=1                  npx tsx scripts/migrate-programs.ts
 *   EMIT_SQL=/tmp/seed.sql     npx tsx scripts/migrate-programs.ts
 *     — no DB write; emits an idempotent .sql seed safe for non-BYPASSRLS roles.
 *     Apply with: sudo -u postgres psql kunacademy -f <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const SOURCE = resolve(process.cwd(), 'apps/web/data/cms/programs.json');

interface RawProgram {
  slug: string;
  title_ar: string;
  title_en: string;
  subtitle_ar?: string;
  subtitle_en?: string;
  description_ar?: string;
  description_en?: string;
  nav_group?: string;
  type?: string;
  format?: string;
  status?: string;
  category?: string;
  parent_code?: string;
  instructor_slug?: string;
  location?: string;
  duration?: string;
  next_start_date?: string;
  enrollment_deadline?: string;
  access_duration_days?: string | number;
  price_aed?: string | number;
  price_egp?: string | number;
  price_usd?: string | number;
  price_eur?: string | number;
  early_bird_price_aed?: string | number;
  early_bird_deadline?: string;
  discount_percentage?: string | number;
  discount_valid_until?: string;
  installment_enabled?: boolean | string;
  bundle_id?: string;
  is_icf_accredited?: boolean | string;
  icf_details?: string;
  cce_units?: string | number;
  hero_image_url?: string;
  thumbnail_url?: string;
  program_logo?: string;
  promo_video_url?: string;
  prerequisite_codes?: string | string[];
  pathway_codes?: string | string[];
  curriculum_json?: string;
  faq_json?: string;
  journey_stages?: string;
  materials_folder_url?: string;
  content_doc_id?: string;
  meta_title_ar?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_en?: string;
  og_image_url?: string;
  is_featured?: boolean | string;
  is_free?: boolean | string;
  display_order?: string | number;
  published?: boolean;
}

interface NormalizedProgram {
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
  price_aed: number | null;
  price_egp: number | null;
  price_usd: number | null;
  price_eur: number | null;
  early_bird_price_aed: number | null;
  early_bird_deadline: string | null;
  discount_percentage: number | null;
  discount_valid_until: string | null;
  installment_enabled: boolean;
  bundle_id: string | null;
  is_icf_accredited: boolean;
  icf_details: string | null;
  cce_units: number | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  program_logo: string | null;
  promo_video_url: string | null;
  prerequisite_codes: string[];
  pathway_codes: string[];
  curriculum_json: string | null;
  faq_json: string | null;
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
}

function strOrNull(s: string | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t === '' ? null : t;
}
function numOrNull(s: string | number | undefined): number | null {
  if (s === undefined || s === null || s === '') return null;
  const n = typeof s === 'number' ? s : Number(s);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(s: string | number | undefined): number | null {
  const n = numOrNull(s);
  return n === null ? null : Math.trunc(n);
}
function boolOf(v: boolean | string | undefined, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const lc = v.trim().toLowerCase();
    if (lc === 'true' || lc === '1' || lc === 'yes') return true;
    if (lc === 'false' || lc === '0' || lc === 'no' || lc === '') return false;
  }
  return fallback;
}
function dateOrNull(s: string | undefined): string | null {
  const t = strOrNull(s);
  if (!t) return null;
  // Keep only YYYY-MM-DD portion if ISO; otherwise pass through
  const m = t.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : t;
}
function arrOf(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => s.trim()).filter(Boolean);
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const VALID_NAV_GROUPS = new Set([
  'certifications',
  'courses',
  'retreats',
  'micro-courses',
  'corporate',
  'free',
  'community',
]);
const VALID_TYPES = new Set([
  'certification',
  'diploma',
  'recorded-course',
  'live-course',
  'retreat',
  'micro-course',
  'workshop',
  'free-resource',
]);
const VALID_FORMATS = new Set(['online', 'in-person', 'hybrid']);
const VALID_STATUSES = new Set(['active', 'coming-soon', 'archived', 'paused']);

function normalize(r: RawProgram, issues: string[]): NormalizedProgram {
  const navGroup = strOrNull(r.nav_group) ?? 'courses';
  const type = strOrNull(r.type) ?? 'live-course';
  const format = strOrNull(r.format) ?? 'online';
  const status = strOrNull(r.status) ?? 'active';

  if (!VALID_NAV_GROUPS.has(navGroup)) issues.push(`${r.slug}: invalid nav_group=${navGroup}`);
  if (!VALID_TYPES.has(type)) issues.push(`${r.slug}: invalid type=${type}`);
  if (!VALID_FORMATS.has(format)) issues.push(`${r.slug}: invalid format=${format}`);
  if (!VALID_STATUSES.has(status)) issues.push(`${r.slug}: invalid status=${status}`);

  return {
    slug: r.slug,
    title_ar: r.title_ar ?? '',
    title_en: r.title_en ?? '',
    subtitle_ar: strOrNull(r.subtitle_ar),
    subtitle_en: strOrNull(r.subtitle_en),
    description_ar: strOrNull(r.description_ar),
    description_en: strOrNull(r.description_en),
    nav_group: navGroup,
    type,
    format,
    status,
    category: strOrNull(r.category),
    parent_code: strOrNull(r.parent_code),
    instructor_slug: strOrNull(r.instructor_slug),
    location: strOrNull(r.location),
    duration: strOrNull(r.duration),
    next_start_date: dateOrNull(r.next_start_date),
    enrollment_deadline: dateOrNull(r.enrollment_deadline),
    access_duration_days: intOrNull(r.access_duration_days),
    price_aed: numOrNull(r.price_aed),
    price_egp: numOrNull(r.price_egp),
    price_usd: numOrNull(r.price_usd),
    price_eur: numOrNull(r.price_eur),
    early_bird_price_aed: numOrNull(r.early_bird_price_aed),
    early_bird_deadline: dateOrNull(r.early_bird_deadline),
    discount_percentage: numOrNull(r.discount_percentage),
    discount_valid_until: dateOrNull(r.discount_valid_until),
    installment_enabled: boolOf(r.installment_enabled, false),
    bundle_id: strOrNull(r.bundle_id),
    is_icf_accredited: boolOf(r.is_icf_accredited, false),
    icf_details: strOrNull(r.icf_details),
    cce_units: numOrNull(r.cce_units),
    hero_image_url: strOrNull(r.hero_image_url),
    thumbnail_url: strOrNull(r.thumbnail_url),
    program_logo: strOrNull(r.program_logo),
    promo_video_url: strOrNull(r.promo_video_url),
    prerequisite_codes: arrOf(r.prerequisite_codes),
    pathway_codes: arrOf(r.pathway_codes),
    curriculum_json: strOrNull(r.curriculum_json),
    faq_json: strOrNull(r.faq_json),
    journey_stages: strOrNull(r.journey_stages),
    materials_folder_url: strOrNull(r.materials_folder_url),
    content_doc_id: strOrNull(r.content_doc_id),
    meta_title_ar: strOrNull(r.meta_title_ar),
    meta_title_en: strOrNull(r.meta_title_en),
    meta_description_ar: strOrNull(r.meta_description_ar),
    meta_description_en: strOrNull(r.meta_description_en),
    og_image_url: strOrNull(r.og_image_url),
    is_featured: boolOf(r.is_featured, false),
    is_free: boolOf(r.is_free, false),
    display_order: intOrNull(r.display_order) ?? 0,
    published: r.published !== false,
  };
}

function sqlLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    // Postgres text[] literal
    if (v.length === 0) return `'{}'::text[]`;
    return `ARRAY[${v.map((x) => sqlLiteral(String(x))).join(', ')}]::text[]`;
  }
  // strings + dates: string literal
  return sqlLiteral(String(v));
}

const COLS = [
  'slug',
  'title_ar',
  'title_en',
  'subtitle_ar',
  'subtitle_en',
  'description_ar',
  'description_en',
  'nav_group',
  'type',
  'format',
  'status',
  'category',
  'parent_code',
  'instructor_slug',
  'location',
  'duration',
  'next_start_date',
  'enrollment_deadline',
  'access_duration_days',
  'price_aed',
  'price_egp',
  'price_usd',
  'price_eur',
  'early_bird_price_aed',
  'early_bird_deadline',
  'discount_percentage',
  'discount_valid_until',
  'installment_enabled',
  'bundle_id',
  'is_icf_accredited',
  'icf_details',
  'cce_units',
  'hero_image_url',
  'thumbnail_url',
  'program_logo',
  'promo_video_url',
  'prerequisite_codes',
  'pathway_codes',
  'curriculum_json',
  'faq_json',
  'journey_stages',
  'materials_folder_url',
  'content_doc_id',
  'meta_title_ar',
  'meta_title_en',
  'meta_description_ar',
  'meta_description_en',
  'og_image_url',
  'is_featured',
  'is_free',
  'display_order',
  'published',
  'published_at',
] as const;

function rowToSqlValues(p: NormalizedProgram): string[] {
  const parts: string[] = [];
  for (const col of COLS) {
    if (col === 'published_at') {
      parts.push(p.published ? 'now()' : 'NULL');
      continue;
    }
    if (col === 'curriculum_json' || col === 'faq_json') {
      const v = p[col];
      parts.push(v === null ? 'NULL' : `${sqlLiteral(v)}::jsonb`);
      continue;
    }
    // @ts-expect-error dynamic col lookup
    parts.push(sqlValue(p[col]));
  }
  return parts;
}

function emitSql(pages: NormalizedProgram[]): string {
  const lines: string[] = [];
  lines.push('-- Generated by scripts/migrate-programs.ts — idempotent seed');
  lines.push('-- Run via: sudo -u postgres psql kunacademy -f <this-file>');
  lines.push('BEGIN;');
  for (const p of pages) {
    const values = rowToSqlValues(p);
    const nonKeyUpdates = COLS.filter((c) => c !== 'slug')
      .map(
        (c) =>
          `  ${c} = ${c === 'published_at' ? 'COALESCE(programs.published_at, EXCLUDED.published_at)' : `EXCLUDED.${c}`}`,
      )
      .join(',\n');
    lines.push(
      `INSERT INTO programs (${COLS.join(', ')})\nVALUES (${values.join(', ')})\n` +
        `ON CONFLICT (slug) DO UPDATE SET\n${nonKeyUpdates},\n  updated_at = now();`,
    );
  }
  lines.push('COMMIT;');
  return lines.join('\n') + '\n';
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const emitSqlPath = process.env.EMIT_SQL;
  const dbUrl = process.env.DATABASE_URL;
  if (!dryRun && !emitSqlPath && !dbUrl) {
    console.error('ERROR: DATABASE_URL required (or DRY_RUN=1 / EMIT_SQL=<path>)');
    process.exit(1);
  }

  console.log(`Reading ${SOURCE}...`);
  const raw = readFileSync(SOURCE, 'utf-8');
  const rows = JSON.parse(raw) as RawProgram[];
  console.log(`  Loaded ${rows.length} program rows`);

  const issues: string[] = [];
  const normalized = rows.map((r) => normalize(r, issues));

  for (const p of normalized) {
    console.log(
      `    - ${p.slug.padEnd(32)} [${p.nav_group.padEnd(14)}] type=${p.type.padEnd(16)} order=${p.display_order} published=${p.published}`,
    );
  }
  if (issues.length > 0) {
    console.log(`\n⚠️  Validation issues:`);
    for (const i of issues) console.log(`    - ${i}`);
  }

  if (emitSqlPath) {
    const sql = emitSql(normalized);
    writeFileSync(emitSqlPath, sql, 'utf-8');
    console.log(`\nEMIT_SQL → wrote ${normalized.length} upserts to ${emitSqlPath}`);
    console.log(`Apply with: sudo -u postgres psql kunacademy -f ${emitSqlPath}`);
    return;
  }

  if (dryRun) {
    console.log('\nDRY_RUN=1 — skipping DB writes.');
    return;
  }

  console.log(`\nConnecting to DB...`);
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  let inserted = 0;
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const p of normalized) {
      const placeholders = COLS.map((_, i) => `$${i + 1}`).join(', ');
      const updateClause = COLS.filter((c) => c !== 'slug')
        .map(
          (c) =>
            `${c} = ${c === 'published_at' ? 'COALESCE(programs.published_at, EXCLUDED.published_at)' : `EXCLUDED.${c}`}`,
        )
        .join(', ');
      // Flatten values in COLS order, but swap published_at to parameter representation
      const params: unknown[] = [];
      for (const col of COLS) {
        if (col === 'published_at') {
          params.push(p.published ? new Date().toISOString() : null);
        } else if (col === 'curriculum_json' || col === 'faq_json') {
          params.push(p[col]); // passed as string; cast in SQL
        } else {
          // @ts-expect-error dynamic
          params.push(p[col]);
        }
      }
      // Build query with typed casts for JSONB fields
      const colsSql = COLS.map((c) =>
        c === 'curriculum_json' || c === 'faq_json'
          ? `$${COLS.indexOf(c) + 1}::jsonb`
          : `$${COLS.indexOf(c) + 1}`,
      ).join(', ');
      const res = await client.query(
        `INSERT INTO programs (${COLS.join(', ')}) VALUES (${colsSql})
         ON CONFLICT (slug) DO UPDATE SET ${updateClause}, updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        params,
      );
      if (res.rows[0]?.inserted) inserted++;
      else updated++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  console.log(`\n✅ Migration complete:`);
  console.log(`   - Inserted: ${inserted}`);
  console.log(`   - Updated:  ${updated}`);
  console.log(`   - Total:    ${normalized.length}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
