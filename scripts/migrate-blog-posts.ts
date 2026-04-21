#!/usr/bin/env npx tsx
/**
 * CMS→DB Phase 3c — Migrate apps/web/data/cms/blog.json → blog_posts table.
 *
 * Source: 30 blog posts in the CMS JSON. Normalizes strings, tag arrays,
 * date strings, numeric reading times into DB column shapes.
 *
 * Idempotent: uses ON CONFLICT (slug) DO UPDATE so re-running replaces in place.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-blog-posts.ts
 *   DRY_RUN=1                  npx tsx scripts/migrate-blog-posts.ts
 *   EMIT_SQL=/tmp/seed.sql     npx tsx scripts/migrate-blog-posts.ts
 *     — no DB write; emits an idempotent .sql seed safe for non-BYPASSRLS roles.
 *     Apply with: sudo -u postgres psql kunacademy -f <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const SOURCE = resolve(process.cwd(), 'apps/web/data/cms/blog.json');

interface RawBlogPost {
  slug: string;
  title_ar: string;
  title_en?: string;
  excerpt_ar?: string;
  excerpt_en?: string;
  content_ar?: string;
  content_en?: string;
  content_doc_id?: string;
  featured_image_url?: string;
  category?: string;
  tags?: string[] | string;
  author_slug?: string;
  published_at?: string;
  reading_time_minutes?: number | string;
  is_featured?: boolean | string;
  display_order?: number | string;
  published?: boolean;
  meta_title_ar?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_en?: string;
}

interface NormalizedBlogPost {
  slug: string;
  title_ar: string;
  title_en: string | null;
  excerpt_ar: string | null;
  excerpt_en: string | null;
  content_ar: string | null;
  content_en: string | null;
  content_doc_id: string | null;
  featured_image_url: string | null;
  category: string | null;
  tags: string[];
  author_slug: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
  is_featured: boolean;
  display_order: number;
  published: boolean;
  meta_title_ar: string | null;
  meta_title_en: string | null;
  meta_description_ar: string | null;
  meta_description_en: string | null;
}

function strOrNull(s: string | undefined | null): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t === '' ? null : t;
}
function intOrNull(v: number | string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
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
  // blog.json uses date-only strings like '2026-04-07'; widen to ISO midnight UTC.
  const m = t.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? `${m[0]}T00:00:00.000Z` : t;
}
function arrOf(v: string | string[] | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalize(r: RawBlogPost, issues: string[]): NormalizedBlogPost {
  if (!r.slug || !strOrNull(r.slug)) issues.push(`<missing slug>: record skipped upstream`);
  if (!r.title_ar) issues.push(`${r.slug}: missing title_ar`);
  return {
    slug: r.slug,
    title_ar: r.title_ar ?? '',
    title_en: strOrNull(r.title_en),
    excerpt_ar: strOrNull(r.excerpt_ar),
    excerpt_en: strOrNull(r.excerpt_en),
    content_ar: strOrNull(r.content_ar),
    content_en: strOrNull(r.content_en),
    content_doc_id: strOrNull(r.content_doc_id),
    featured_image_url: strOrNull(r.featured_image_url),
    category: strOrNull(r.category),
    tags: arrOf(r.tags),
    author_slug: strOrNull(r.author_slug),
    published_at: dateOrNull(r.published_at),
    reading_time_minutes: intOrNull(r.reading_time_minutes),
    is_featured: boolOf(r.is_featured, false),
    display_order: intOrNull(r.display_order) ?? 0,
    published: r.published !== false,
    meta_title_ar: strOrNull(r.meta_title_ar),
    meta_title_en: strOrNull(r.meta_title_en),
    meta_description_ar: strOrNull(r.meta_description_ar),
    meta_description_en: strOrNull(r.meta_description_en),
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
  'excerpt_ar',
  'excerpt_en',
  'content_ar',
  'content_en',
  'content_doc_id',
  'featured_image_url',
  'category',
  'tags',
  'author_slug',
  'published_at',
  'reading_time_minutes',
  'is_featured',
  'display_order',
  'published',
  'meta_title_ar',
  'meta_title_en',
  'meta_description_ar',
  'meta_description_en',
] as const;

function rowToSqlValues(p: NormalizedBlogPost): string[] {
  const parts: string[] = [];
  for (const col of COLS) {
    parts.push(sqlValue(p[col]));
  }
  return parts;
}

/**
 * Chunked emit — batches INSERTs into groups of CHUNK_SIZE to keep individual
 * statements reasonable. 336KB JSON → ~350KB of SQL in one transaction.
 */
const CHUNK_SIZE = 10;

function emitSql(rows: NormalizedBlogPost[]): string {
  const lines: string[] = [];
  lines.push('-- Generated by scripts/migrate-blog-posts.ts — idempotent seed');
  lines.push('-- Run via: sudo -u postgres psql kunacademy -f <this-file>');
  lines.push('BEGIN;');
  const nonKeyUpdates = COLS.filter((c) => c !== 'slug')
    .map((c) => `  ${c} = EXCLUDED.${c}`)
    .join(',\n');
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    for (const p of chunk) {
      const values = rowToSqlValues(p);
      lines.push(
        `INSERT INTO blog_posts (${COLS.join(', ')})\nVALUES (${values.join(', ')})\n` +
          `ON CONFLICT (slug) DO UPDATE SET\n${nonKeyUpdates},\n  updated_at = now();`,
      );
    }
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
  const rows = JSON.parse(raw) as RawBlogPost[];
  console.log(`  Loaded ${rows.length} blog post rows`);

  const issues: string[] = [];
  const normalized = rows.map((r) => normalize(r, issues));

  for (const p of normalized) {
    console.log(
      `    - ${p.slug.padEnd(60)} cat=${(p.category ?? '').padEnd(18)} ` +
        `order=${String(p.display_order).padStart(2)} featured=${p.is_featured} ` +
        `has_en=${!!p.title_en} published=${p.published}`,
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
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');
      const params: unknown[] = [];
      for (const col of COLS) {
        params.push(p[col]);
      }
      const res = await client.query(
        `INSERT INTO blog_posts (${COLS.join(', ')}) VALUES (${colsSql})
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
