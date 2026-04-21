#!/usr/bin/env npx tsx
/**
 * CMS→DB Phase 3d — Migrate apps/web/data/cms/corporate-benefits.json →
 * corporate_benefit_directions + corporate_benefits tables.
 *
 * Source: 4 directions (leadership_development, organizational_transformation,
 * individual_coaching, custom_program) × 10/10/10/3 benefits = 4 direction rows
 * + 33 benefit rows total.
 *
 * The `custom_program` direction in the JSON uses `"benefits": "all"` — we
 * translate that into `benefits_mode='all'` on the direction row (no children).
 * Every other direction gets `benefits_mode='list'` with its benefits seeded.
 *
 * Idempotent: ON CONFLICT (slug) DO UPDATE so re-running replaces in place.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-corporate-benefits.ts
 *   DRY_RUN=1                  npx tsx scripts/migrate-corporate-benefits.ts
 *   EMIT_SQL=/tmp/seed.sql     npx tsx scripts/migrate-corporate-benefits.ts
 *     — no DB write; emits an idempotent .sql seed safe for non-BYPASSRLS roles.
 *     Apply with: sudo -u postgres psql kunacademy -f <file>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';

const SOURCE = resolve(process.cwd(), 'apps/web/data/cms/corporate-benefits.json');

interface RawBenefit {
  id: string;
  label_ar: string;
  label_en: string;
  description_ar?: string;
  description_en?: string;
  citation_ar?: string;
  citation_en?: string;
  benchmark_improvement_pct?: number | string;
  roi_category?: string;
  self_assessment_prompt_ar?: string;
  self_assessment_prompt_en?: string;
}

interface RawDirection {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  icon?: string;
  benefits: 'all' | RawBenefit[];
}

interface RawFile {
  version: string;
  directions: RawDirection[];
}

interface NormDirection {
  slug: string;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  icon: string | null;
  benefits_mode: 'list' | 'all';
  display_order: number;
  published: boolean;
}

interface NormBenefit {
  slug: string;
  direction_slug: string;
  label_ar: string;
  label_en: string;
  description_ar: string | null;
  description_en: string | null;
  citation_ar: string | null;
  citation_en: string | null;
  benchmark_improvement_pct: number;
  roi_category: 'productivity' | 'turnover' | 'absenteeism' | 'engagement' | 'conflict';
  self_assessment_prompt_ar: string | null;
  self_assessment_prompt_en: string | null;
  display_order: number;
  published: boolean;
}

function strOrNull(s: string | undefined | null): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t === '' ? null : t;
}
function intOrZero(v: number | string | undefined): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

const VALID_ROI = new Set(['productivity', 'turnover', 'absenteeism', 'engagement', 'conflict']);

function normalize(file: RawFile, issues: string[]): {
  directions: NormDirection[];
  benefits: NormBenefit[];
} {
  const directions: NormDirection[] = [];
  const benefits: NormBenefit[] = [];

  file.directions.forEach((d, dirIdx) => {
    if (!d.id) issues.push(`direction[${dirIdx}] missing id`);
    const mode: 'list' | 'all' = d.benefits === 'all' ? 'all' : 'list';
    directions.push({
      slug: d.id,
      title_ar: d.title_ar,
      title_en: d.title_en,
      description_ar: strOrNull(d.description_ar),
      description_en: strOrNull(d.description_en),
      icon: strOrNull(d.icon),
      benefits_mode: mode,
      display_order: dirIdx,
      published: true,
    });

    if (d.benefits !== 'all' && Array.isArray(d.benefits)) {
      d.benefits.forEach((b, bIdx) => {
        if (!b.id) issues.push(`${d.id}.benefit[${bIdx}] missing id`);
        const cat = (b.roi_category ?? 'productivity') as string;
        if (!VALID_ROI.has(cat)) {
          issues.push(`${d.id}.${b.id}: unknown roi_category '${cat}', defaulting to productivity`);
        }
        // Use bare benefit id as DB slug. Source-of-truth JSON ids are globally
        // unique across all directions (verified: 30 benefits, 30 distinct ids),
        // and preserving the bare id means getCorporateBenefitsData() emits the
        // same `id` values PathfinderEngine already references in its state
        // (selected_benefits, self-assessment keys, etc.). Zero prop churn.
        benefits.push({
          slug: b.id,
          direction_slug: d.id,
          label_ar: b.label_ar,
          label_en: b.label_en,
          description_ar: strOrNull(b.description_ar),
          description_en: strOrNull(b.description_en),
          citation_ar: strOrNull(b.citation_ar),
          citation_en: strOrNull(b.citation_en),
          benchmark_improvement_pct: intOrZero(b.benchmark_improvement_pct),
          roi_category: (VALID_ROI.has(cat) ? cat : 'productivity') as NormBenefit['roi_category'],
          self_assessment_prompt_ar: strOrNull(b.self_assessment_prompt_ar),
          self_assessment_prompt_en: strOrNull(b.self_assessment_prompt_en),
          display_order: bIdx,
          published: true,
        });
      });
    }
  });

  return { directions, benefits };
}

function sqlLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return sqlLiteral(String(v));
}

const DIR_COLS = [
  'slug',
  'title_ar',
  'title_en',
  'description_ar',
  'description_en',
  'icon',
  'benefits_mode',
  'display_order',
  'published',
] as const;

const BEN_COLS = [
  'slug',
  'direction_slug',
  'label_ar',
  'label_en',
  'description_ar',
  'description_en',
  'citation_ar',
  'citation_en',
  'benchmark_improvement_pct',
  'roi_category',
  'self_assessment_prompt_ar',
  'self_assessment_prompt_en',
  'display_order',
  'published',
] as const;

function dirRowValues(d: NormDirection): string[] {
  return DIR_COLS.map((c) => {
    const v = (d as unknown as Record<string, unknown>)[c];
    if (c === 'benefits_mode') return `${sqlValue(v)}::corporate_benefits_mode`;
    return sqlValue(v);
  });
}
function benRowValues(b: NormBenefit): string[] {
  return BEN_COLS.map((c) => {
    const v = (b as unknown as Record<string, unknown>)[c];
    if (c === 'roi_category') return `${sqlValue(v)}::corporate_roi_category`;
    return sqlValue(v);
  });
}

function emitSql(dirs: NormDirection[], bens: NormBenefit[]): string {
  const lines: string[] = [];
  lines.push('-- Generated by scripts/migrate-corporate-benefits.ts — idempotent seed');
  lines.push('-- Run via: sudo -u postgres psql kunacademy -f <this-file>');
  lines.push('BEGIN;');

  const dirUpdates = DIR_COLS.filter((c) => c !== 'slug')
    .map((c) => `  ${c} = EXCLUDED.${c}`)
    .join(',\n');
  for (const d of dirs) {
    lines.push(
      `INSERT INTO corporate_benefit_directions (${DIR_COLS.join(', ')})\n` +
        `VALUES (${dirRowValues(d).join(', ')})\n` +
        `ON CONFLICT (slug) DO UPDATE SET\n${dirUpdates},\n  updated_at = now();`,
    );
  }

  const benUpdates = BEN_COLS.filter((c) => c !== 'slug')
    .map((c) => `  ${c} = EXCLUDED.${c}`)
    .join(',\n');
  for (const b of bens) {
    lines.push(
      `INSERT INTO corporate_benefits (${BEN_COLS.join(', ')})\n` +
        `VALUES (${benRowValues(b).join(', ')})\n` +
        `ON CONFLICT (slug) DO UPDATE SET\n${benUpdates},\n  updated_at = now();`,
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
  const file = JSON.parse(raw) as RawFile;
  console.log(`  version=${file.version}, directions=${file.directions.length}`);

  const issues: string[] = [];
  const { directions, benefits } = normalize(file, issues);

  console.log(`\nDirections (${directions.length}):`);
  for (const d of directions) {
    console.log(
      `  - ${d.slug.padEnd(30)} order=${d.display_order} mode=${d.benefits_mode} icon=${d.icon}`,
    );
  }
  console.log(`\nBenefits (${benefits.length}):`);
  for (const b of benefits) {
    console.log(
      `  - ${b.slug.padEnd(60)} dir=${b.direction_slug.padEnd(30)} ` +
        `roi=${b.roi_category.padEnd(12)} pct=${String(b.benchmark_improvement_pct).padStart(3)}`,
    );
  }
  if (issues.length > 0) {
    console.log(`\nValidation issues:`);
    for (const i of issues) console.log(`    - ${i}`);
  }

  if (emitSqlPath) {
    const sql = emitSql(directions, benefits);
    writeFileSync(emitSqlPath, sql, 'utf-8');
    console.log(
      `\nEMIT_SQL -> wrote ${directions.length} directions + ${benefits.length} benefits to ${emitSqlPath}`,
    );
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

  let dirIns = 0;
  let dirUpd = 0;
  let benIns = 0;
  let benUpd = 0;
  try {
    await client.query('BEGIN');

    for (const d of directions) {
      const placeholders = DIR_COLS.map((_, i) => `$${i + 1}`).join(', ');
      const updateClause = DIR_COLS.filter((c) => c !== 'slug')
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');
      const params: unknown[] = DIR_COLS.map(
        (c) => (d as unknown as Record<string, unknown>)[c],
      );
      const res = await client.query(
        `INSERT INTO corporate_benefit_directions (${DIR_COLS.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (slug) DO UPDATE SET ${updateClause}, updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        params,
      );
      if (res.rows[0]?.inserted) dirIns++;
      else dirUpd++;
    }

    for (const b of benefits) {
      const placeholders = BEN_COLS.map((_, i) => `$${i + 1}`).join(', ');
      const updateClause = BEN_COLS.filter((c) => c !== 'slug')
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');
      const params: unknown[] = BEN_COLS.map(
        (c) => (b as unknown as Record<string, unknown>)[c],
      );
      const res = await client.query(
        `INSERT INTO corporate_benefits (${BEN_COLS.join(', ')}) VALUES (${placeholders})
         ON CONFLICT (slug) DO UPDATE SET ${updateClause}, updated_at = now()
         RETURNING (xmax = 0) AS inserted`,
        params,
      );
      if (res.rows[0]?.inserted) benIns++;
      else benUpd++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  console.log(`\nMigration complete:`);
  console.log(`   Directions: inserted ${dirIns}, updated ${dirUpd}, total ${directions.length}`);
  console.log(`   Benefits:   inserted ${benIns}, updated ${benUpd}, total ${benefits.length}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
