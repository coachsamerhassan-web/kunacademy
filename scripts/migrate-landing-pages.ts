#!/usr/bin/env npx tsx
/**
 * CMS→DB Phase 2c — Migrate page-content.json → landing_pages table.
 *
 * Reads apps/web/data/cms/page-content.json (562 rows across 28 slugs) and
 * consolidates into one landing_pages row per slug, with:
 *   sections_json = { [section]: { [key]: { ar, en } } }
 *   seo_meta_json = { meta_title_*, meta_description_*, og_image_url, canonical_url }
 *   hero_json     = { hero_image_url, cta_text_*, cta_url, form_embed }
 *   page_type     = first non-empty row.type (defaults 'page')
 *   published     = any row published
 *
 * Idempotent: uses ON CONFLICT (slug) DO UPDATE so re-running updates in place.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-landing-pages.ts
 *   DATABASE_URL=... DRY_RUN=1 npx tsx scripts/migrate-landing-pages.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const SOURCE = resolve(process.cwd(), 'apps/web/data/cms/page-content.json');

interface PageContentRow {
  slug: string;
  section: string;
  key: string;
  value_ar: string;
  value_en: string;
  type?: 'page' | 'landing' | 'legal';
  published: boolean;
  meta_title_ar?: string;
  meta_title_en?: string;
  meta_description_ar?: string;
  meta_description_en?: string;
  og_image_url?: string;
  canonical_url?: string;
  hero_image_url?: string;
  cta_text_ar?: string;
  cta_text_en?: string;
  cta_url?: string;
  form_embed?: string;
}

interface ConsolidatedPage {
  slug: string;
  page_type: 'page' | 'landing' | 'legal';
  sections_json: Record<string, Record<string, { ar: string; en: string }>>;
  seo_meta_json: Record<string, string | undefined>;
  hero_json: Record<string, string | undefined>;
  published: boolean;
  row_count: number;
}

function consolidate(rows: PageContentRow[]): ConsolidatedPage[] {
  const bySlug = new Map<string, ConsolidatedPage>();

  for (const row of rows) {
    if (!bySlug.has(row.slug)) {
      bySlug.set(row.slug, {
        slug: row.slug,
        page_type: (row.type as ConsolidatedPage['page_type']) ?? 'page',
        sections_json: {},
        seo_meta_json: {},
        hero_json: {},
        published: false,
        row_count: 0,
      });
    }
    const page = bySlug.get(row.slug)!;
    page.row_count++;
    page.published = page.published || row.published;

    // Upgrade type if we see a non-page type
    if (row.type && row.type !== 'page' && page.page_type === 'page') {
      page.page_type = row.type;
    }

    // Sections content (only if both ar and en values present? Keep even if empty — CMS allowed partial.)
    if (!page.sections_json[row.section]) page.sections_json[row.section] = {};
    page.sections_json[row.section][row.key] = {
      ar: row.value_ar ?? '',
      en: row.value_en ?? '',
    };

    // SEO — first non-empty wins (CMS repeated SEO on every row, we keep the first real value)
    for (const f of ['meta_title_ar','meta_title_en','meta_description_ar','meta_description_en','og_image_url','canonical_url'] as const) {
      if (row[f] && !page.seo_meta_json[f]) {
        page.seo_meta_json[f] = row[f];
      }
    }

    // Hero — same first-non-empty rule
    for (const f of ['hero_image_url','cta_text_ar','cta_text_en','cta_url','form_embed'] as const) {
      if (row[f] && !page.hero_json[f]) {
        page.hero_json[f] = row[f];
      }
    }
  }

  // Strip empty seo/hero maps to keep JSONB lean
  for (const page of bySlug.values()) {
    for (const obj of [page.seo_meta_json, page.hero_json]) {
      for (const k of Object.keys(obj)) {
        if (obj[k] === undefined || obj[k] === '') delete obj[k];
      }
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const dbUrl = process.env.DATABASE_URL;
  if (!dryRun && !dbUrl) {
    console.error('ERROR: DATABASE_URL required (or DRY_RUN=1 to skip DB writes)');
    process.exit(1);
  }

  console.log(`Reading ${SOURCE}...`);
  const raw = readFileSync(SOURCE, 'utf-8');
  const rows = JSON.parse(raw) as PageContentRow[];
  console.log(`  Loaded ${rows.length} page-content rows`);

  const pages = consolidate(rows);
  console.log(`  Consolidated into ${pages.length} landing_pages rows:`);

  const issues: Array<{ slug: string; issue: string }> = [];
  for (const p of pages) {
    const sectionCount = Object.keys(p.sections_json).length;
    const keyCount = Object.values(p.sections_json).reduce((n, s) => n + Object.keys(s).length, 0);
    console.log(`    - ${p.slug.padEnd(24)} [${p.page_type.padEnd(7)}] ${p.row_count} rows → ${sectionCount} sections, ${keyCount} keys, published=${p.published}`);

    // Data-quality checks
    if (sectionCount === 0) issues.push({ slug: p.slug, issue: 'no sections after consolidation' });
    if (keyCount === 0) issues.push({ slug: p.slug, issue: 'no content keys after consolidation' });
  }

  if (issues.length > 0) {
    console.log(`\n⚠️  Data quality issues found:`);
    for (const i of issues) console.log(`    - ${i.slug}: ${i.issue}`);
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
    for (const p of pages) {
      const res = await client.query(
        `INSERT INTO landing_pages (slug, page_type, sections_json, hero_json, seo_meta_json, published, published_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, CASE WHEN $6 THEN now() ELSE NULL END)
         ON CONFLICT (slug) DO UPDATE
           SET page_type     = EXCLUDED.page_type,
               sections_json = EXCLUDED.sections_json,
               hero_json     = EXCLUDED.hero_json,
               seo_meta_json = EXCLUDED.seo_meta_json,
               published     = EXCLUDED.published,
               published_at  = COALESCE(landing_pages.published_at, EXCLUDED.published_at),
               updated_at    = now()
         RETURNING (xmax = 0) AS inserted`,
        [
          p.slug,
          p.page_type,
          JSON.stringify(p.sections_json),
          JSON.stringify(p.hero_json),
          JSON.stringify(p.seo_meta_json),
          p.published,
        ]
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
  console.log(`   - Total:    ${pages.length}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
