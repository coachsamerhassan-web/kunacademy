#!/usr/bin/env npx tsx
/**
 * CMS→DB Phase 2e — Migrate apps/web/data/cms/events.json → events table.
 *
 * Source: N events in the CMS JSON export. Normalizes pricing strings,
 * CSV-joined arrays, and date strings into the DB column shapes.
 *
 * Idempotent: uses ON CONFLICT (slug) DO UPDATE so re-running updates in place.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-events.ts
 *   DRY_RUN=1                  npx tsx scripts/migrate-events.ts
 *   EMIT_SQL=/tmp/seed.sql     npx tsx scripts/migrate-events.ts
 *     — no DB write; emits an idempotent .sql seed safe for non-BYPASSRLS roles.
 *     Apply with: sudo -u postgres psql kunacademy -f <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const SOURCE = resolve(process.cwd(), 'apps/web/data/cms/events.json');

interface RawEvent {
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  date_start: string;
  date_end?: string;
  location_ar?: string;
  location_en?: string;
  location_type?: string;
  capacity?: number | string;
  price_aed?: number | string;
  price_egp?: number | string;
  price_usd?: number | string;
  image_url?: string;
  promo_video_url?: string;
  program_slug?: string;
  registration_url?: string;
  status?: string;
  speaker_slugs?: string[] | string;
  registration_deadline?: string;
  is_featured?: boolean | string;
  display_order?: number | string;
  published?: boolean;
}

interface NormalizedEvent {
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
  price_aed: number;
  price_egp: number;
  price_usd: number;
  image_url: string | null;
  promo_video_url: string | null;
  program_slug: string | null;
  speaker_slugs: string[];
  registration_url: string | null;
  registration_deadline: string | null;
  status: string;
  is_featured: boolean;
  display_order: number;
  published: boolean;
}

function strOrNull(s: string | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t === '' ? null : t;
}
function numOrZero(s: string | number | undefined): number {
  if (s === undefined || s === null || s === '') return 0;
  const n = typeof s === 'number' ? s : Number(s);
  return Number.isFinite(n) ? n : 0;
}
function intOrNull(s: string | number | undefined): number | null {
  if (s === undefined || s === null || s === '') return null;
  const n = typeof s === 'number' ? s : Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
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

const VALID_LOCATION_TYPES = new Set(['in-person', 'online', 'hybrid']);
const VALID_STATUSES = new Set(['open', 'sold_out', 'completed']);

function normalize(r: RawEvent, issues: string[]): NormalizedEvent {
  const locationType = strOrNull(r.location_type) ?? 'online';
  const status = strOrNull(r.status) ?? 'open';

  if (!VALID_LOCATION_TYPES.has(locationType))
    issues.push(`${r.slug}: invalid location_type=${locationType}`);
  if (!VALID_STATUSES.has(status)) issues.push(`${r.slug}: invalid status=${status}`);

  if (!r.date_start || !/^\d{4}-\d{2}-\d{2}/.test(r.date_start)) {
    issues.push(`${r.slug}: invalid/missing date_start=${r.date_start}`);
  }

  return {
    slug: r.slug,
    title_ar: r.title_ar ?? '',
    title_en: r.title_en ?? '',
    description_ar: strOrNull(r.description_ar),
    description_en: strOrNull(r.description_en),
    date_start: dateOrNull(r.date_start) ?? '1970-01-01',
    date_end: dateOrNull(r.date_end),
    location_ar: strOrNull(r.location_ar),
    location_en: strOrNull(r.location_en),
    location_type: locationType,
    capacity: intOrNull(r.capacity),
    price_aed: numOrZero(r.price_aed),
    price_egp: numOrZero(r.price_egp),
    price_usd: numOrZero(r.price_usd),
    image_url: strOrNull(r.image_url),
    promo_video_url: strOrNull(r.promo_video_url),
    program_slug: strOrNull(r.program_slug),
    speaker_slugs: arrOf(r.speaker_slugs),
    registration_url: strOrNull(r.registration_url),
    registration_deadline: dateOrNull(r.registration_deadline),
    status,
    is_featured: boolOf(r.is_featured, false),
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
    if (v.length === 0) return `'{}'::text[]`;
    return `ARRAY[${v.map((x) => sqlLiteral(String(x))).join(', ')}]::text[]`;
  }
  return sqlLiteral(String(v));
}

const COLS = [
  'slug',
  'title_ar',
  'title_en',
  'description_ar',
  'description_en',
  'date_start',
  'date_end',
  'location_ar',
  'location_en',
  'location_type',
  'capacity',
  'price_aed',
  'price_egp',
  'price_usd',
  'image_url',
  'promo_video_url',
  'program_slug',
  'speaker_slugs',
  'registration_url',
  'registration_deadline',
  'status',
  'is_featured',
  'display_order',
  'published',
  'published_at',
] as const;

function rowToSqlValues(p: NormalizedEvent): string[] {
  const parts: string[] = [];
  for (const col of COLS) {
    if (col === 'published_at') {
      parts.push(p.published ? 'now()' : 'NULL');
      continue;
    }
    // @ts-expect-error dynamic col lookup
    parts.push(sqlValue(p[col]));
  }
  return parts;
}

function emitSql(rows: NormalizedEvent[]): string {
  const lines: string[] = [];
  lines.push('-- Generated by scripts/migrate-events.ts — idempotent seed');
  lines.push('-- Run via: sudo -u postgres psql kunacademy -f <this-file>');
  lines.push('BEGIN;');
  for (const p of rows) {
    const values = rowToSqlValues(p);
    const nonKeyUpdates = COLS.filter((c) => c !== 'slug')
      .map(
        (c) =>
          `  ${c} = ${
            c === 'published_at' ? 'COALESCE(events.published_at, EXCLUDED.published_at)' : `EXCLUDED.${c}`
          }`,
      )
      .join(',\n');
    lines.push(
      `INSERT INTO events (${COLS.join(', ')})\nVALUES (${values.join(', ')})\n` +
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
  const rows = JSON.parse(raw) as RawEvent[];
  console.log(`  Loaded ${rows.length} event rows`);

  const issues: string[] = [];
  const normalized = rows.map((r) => normalize(r, issues));

  for (const p of normalized) {
    console.log(
      `    - ${p.slug.padEnd(42)} [${p.location_type.padEnd(9)}] start=${p.date_start} status=${p.status.padEnd(9)} order=${p.display_order} published=${p.published}`,
    );
  }
  if (issues.length > 0) {
    console.log(`\nValidation issues:`);
    for (const i of issues) console.log(`    - ${i}`);
  }

  if (emitSqlPath) {
    const sql = emitSql(normalized);
    writeFileSync(emitSqlPath, sql, 'utf-8');
    console.log(`\nEMIT_SQL -> wrote ${normalized.length} upserts to ${emitSqlPath}`);
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
      const colsSql = COLS.map((_, i) => `$${i + 1}`).join(', ');
      const updateClause = COLS.filter((c) => c !== 'slug')
        .map(
          (c) =>
            `${c} = ${
              c === 'published_at' ? 'COALESCE(events.published_at, EXCLUDED.published_at)' : `EXCLUDED.${c}`
            }`,
        )
        .join(', ');
      const params: unknown[] = [];
      for (const col of COLS) {
        if (col === 'published_at') {
          params.push(p.published ? new Date().toISOString() : null);
        } else {
          // @ts-expect-error dynamic
          params.push(p[col]);
        }
      }
      const res = await client.query(
        `INSERT INTO events (${COLS.join(', ')}) VALUES (${colsSql})
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

  console.log(`\nMigration complete:`);
  console.log(`   - Inserted: ${inserted}`);
  console.log(`   - Updated:  ${updated}`);
  console.log(`   - Total:    ${normalized.length}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
