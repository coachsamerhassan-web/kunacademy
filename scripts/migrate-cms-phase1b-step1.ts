/**
 * CMS → DB Phase 1b-Step1 — one-time data migration for site_settings, quotes, testimonials.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-cms-phase1b-step1.ts           # dry-run (default, prints counts + diffs)
 *   pnpm tsx scripts/migrate-cms-phase1b-step1.ts --apply   # write to DB
 *
 * Idempotent: safe to re-run. Uses upsert-by-unique-key pattern on each table.
 *
 * Source: Google Sheets via @kunacademy/cms/server (cms singleton)
 * Target: Postgres via @kunacademy/db (withAdminContext for writes — bypasses RLS)
 */

import { cms } from '@kunacademy/cms/server';
import { db, withAdminContext, eq, and } from '@kunacademy/db';
import { site_settings, quotes, testimonials } from '@kunacademy/db/schema';
import { sql } from 'drizzle-orm';

const APPLY = process.argv.includes('--apply');

// ── Counters ────────────────────────────────────────────────────────────────

interface Counts {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
}

function emptyCounts(): Counts {
  return { inserted: 0, updated: 0, unchanged: 0, skipped: 0 };
}

// ── site_settings migration ──────────────────────────────────────────────────

async function migrateSettings(): Promise<Counts> {
  const c = emptyCounts();

  // cms.getAllSettings() returns SettingsMap (nested object), not a flat array.
  // We need the flat SiteSetting[] shape — reconstruct from raw sheet via getSetting
  // workaround: getAllSettings returns Record<category, Record<key, value>>.
  // We flatten it ourselves to get individual (category, key, value) triples.
  const settingsMap = await cms.getAllSettings();
  const cmsSettings: Array<{ category: string; key: string; value: string }> = [];
  for (const [category, keys] of Object.entries(settingsMap)) {
    for (const [key, value] of Object.entries(keys)) {
      cmsSettings.push({ category, key, value });
    }
  }

  console.log(`[migrate] site_settings: ${cmsSettings.length} rows from CMS`);

  // Fetch current DB state once (to minimise round-trips)
  const existing = await db
    .select({ category: site_settings.category, key: site_settings.key, value: site_settings.value })
    .from(site_settings);
  const existingMap = new Map(existing.map((r) => [`${r.category}::${r.key}`, r.value]));

  const toInsert: Array<{ category: string; key: string; value: string }> = [];
  const toUpdate: Array<{ category: string; key: string; value: string }> = [];

  for (const s of cmsSettings) {
    const mapKey = `${s.category}::${s.key}`;
    if (!existingMap.has(mapKey)) {
      console.log(`[migrate] site_settings INSERT (category=${s.category}, key=${s.key})`);
      toInsert.push(s);
    } else if (existingMap.get(mapKey) !== s.value) {
      console.log(`[migrate] site_settings UPDATE (category=${s.category}, key=${s.key})`);
      toUpdate.push(s);
    } else {
      console.log(`[migrate] site_settings UNCHANGED (category=${s.category}, key=${s.key})`);
      c.unchanged++;
    }
  }

  if (APPLY && (toInsert.length > 0 || toUpdate.length > 0)) {
    await withAdminContext(async (adminDb) => {
      // Wrap entire table migration in one transaction
      if (toInsert.length > 0) {
        await adminDb.insert(site_settings).values(
          toInsert.map((s) => ({
            category: s.category,
            key: s.key,
            value: s.value,
            published: true,
            last_edited_at: new Date().toISOString(),
          }))
        );
      }
      for (const s of toUpdate) {
        await adminDb
          .update(site_settings)
          .set({
            value: s.value,
            last_edited_at: new Date().toISOString(),
          })
          .where(
            and(
              eq(site_settings.category, s.category),
              eq(site_settings.key, s.key)
            )
          );
      }
    });
  }

  c.inserted = toInsert.length;
  c.updated = toUpdate.length;
  return c;
}

// ── quotes migration ─────────────────────────────────────────────────────────

async function migrateQuotes(): Promise<Counts> {
  const c = emptyCounts();
  const cmsQuotes = await cms.getAllQuotes();
  console.log(`[migrate] quotes: ${cmsQuotes.length} rows from CMS`);

  // Fetch existing quote_ids
  const existing = await db
    .select({ quote_id: quotes.quote_id })
    .from(quotes);
  const existingIds = new Set(existing.map((r) => r.quote_id));

  const toInsert: typeof cmsQuotes = [];
  const toUpdate: typeof cmsQuotes = [];

  for (const q of cmsQuotes) {
    if (!q.quote_id) {
      console.warn(`[migrate] quotes SKIPPED — missing quote_id: "${q.content_en?.slice(0, 40)}..."`);
      c.skipped++;
      continue;
    }
    if (!existingIds.has(q.quote_id)) {
      console.log(`[migrate] quotes INSERT (quote_id=${q.quote_id})`);
      toInsert.push(q);
    } else {
      console.log(`[migrate] quotes UPDATE (quote_id=${q.quote_id})`);
      toUpdate.push(q);
    }
  }

  if (APPLY && (toInsert.length > 0 || toUpdate.length > 0)) {
    await withAdminContext(async (adminDb) => {
      if (toInsert.length > 0) {
        await adminDb.insert(quotes).values(
          toInsert.map((q) => ({
            quote_id: q.quote_id,
            author_ar: q.author_ar,
            author_en: q.author_en,
            content_ar: q.content_ar,
            content_en: q.content_en,
            category: q.category ?? null,
            display_order: q.display_order ?? 0,
            published: q.published ?? true,
            // CMS field: `date` → DB column: `quote_date`
            quote_date: q.date ?? null,
            last_edited_at: new Date().toISOString(),
          }))
        );
      }
      for (const q of toUpdate) {
        await adminDb
          .update(quotes)
          .set({
            author_ar: q.author_ar,
            author_en: q.author_en,
            content_ar: q.content_ar,
            content_en: q.content_en,
            category: q.category ?? null,
            display_order: q.display_order ?? 0,
            published: q.published ?? true,
            quote_date: q.date ?? null,
            last_edited_at: new Date().toISOString(),
          })
          .where(eq(quotes.quote_id, q.quote_id));
      }
    });
  }

  c.inserted = toInsert.length;
  c.updated = toUpdate.length;
  return c;
}

// ── testimonials migration ───────────────────────────────────────────────────

async function migrateTestimonials(): Promise<Counts> {
  const c = emptyCounts();
  const cmsTestimonials = await cms.getAllTestimonials();
  console.log(`[migrate] testimonials: ${cmsTestimonials.length} rows from CMS`);

  // Fetch existing IDs from DB
  const existing = await db
    .select({ id: testimonials.id })
    .from(testimonials);
  const existingIds = new Set(existing.map((r) => r.id));

  const toInsert: typeof cmsTestimonials = [];
  const toUpdateNew: typeof cmsTestimonials = [];  // exist in DB, only fill new nullable cols
  const toSkip: typeof cmsTestimonials = [];

  for (const t of cmsTestimonials) {
    if (!t.id) {
      console.warn(`[migrate] testimonials SKIPPED — no id field: name_ar="${t.name_ar}"`);
      c.skipped++;
      toSkip.push(t);
      continue;
    }
    if (existingIds.has(t.id)) {
      console.log(`[migrate] testimonials UPDATE new-cols only (id=${t.id}, name_ar=${t.name_ar})`);
      toUpdateNew.push(t);
    } else {
      console.log(`[migrate] testimonials INSERT (id=${t.id}, name_ar=${t.name_ar})`);
      toInsert.push(t);
    }
  }

  if (APPLY && (toInsert.length > 0 || toUpdateNew.length > 0)) {
    await withAdminContext(async (adminDb) => {
      // INSERT full rows for new testimonials
      if (toInsert.length > 0) {
        await adminDb.insert(testimonials).values(
          toInsert.map((t) => ({
            // Use the CMS id as the PK (it's a UUID from CMS)
            id: t.id,
            author_name_ar: t.name_ar,
            author_name_en: t.name_en,
            content_ar: t.content_ar,
            content_en: t.content_en,
            program: t.program ?? null,
            video_url: t.video_url ?? null,
            is_featured: t.is_featured ?? false,
            // Phase 1a new columns
            role_ar: t.role_ar ?? null,
            role_en: t.role_en ?? null,
            location_ar: t.location_ar ?? null,
            location_en: t.location_en ?? null,
            country_code: t.country_code ?? null,
            display_order: t.display_order ?? 0,
          }))
        );
      }

      // UPDATE existing rows: only fill in the 6 new nullable columns.
      // Do NOT overwrite author_name_ar/en, content_ar/en, photo_url — already populated.
      for (const t of toUpdateNew) {
        await adminDb
          .update(testimonials)
          .set({
            role_ar: t.role_ar ?? null,
            role_en: t.role_en ?? null,
            location_ar: t.location_ar ?? null,
            location_en: t.location_en ?? null,
            country_code: t.country_code ?? null,
            display_order: t.display_order ?? 0,
          })
          .where(eq(testimonials.id, t.id));
      }
    });
  }

  c.inserted = toInsert.length;
  c.updated = toUpdateNew.length;
  return c;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[migrate] mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[migrate] starting CMS → DB Phase 1b-Step1`);

  const [settingsCounts, quotesCounts, testimonialsCounts] = await Promise.all([
    migrateSettings(),
    migrateQuotes(),
    migrateTestimonials(),
  ]);

  console.log(
    `[migrate] DONE — ` +
    `settings: +${settingsCounts.inserted} ~${settingsCounts.updated} =${settingsCounts.unchanged} | ` +
    `quotes: +${quotesCounts.inserted} ~${quotesCounts.updated} skip=${quotesCounts.skipped} | ` +
    `testimonials: +${testimonialsCounts.inserted} ~${testimonialsCounts.updated} skip=${testimonialsCounts.skipped}`
  );

  if (!APPLY) {
    console.log(`[migrate] This was a DRY-RUN. Re-run with --apply to write.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
