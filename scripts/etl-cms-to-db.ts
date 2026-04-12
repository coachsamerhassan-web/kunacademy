#!/usr/bin/env tsx
/**
 * ETL: CMS JSON files → PostgreSQL database
 *
 * Migrates:
 *   apps/web/data/cms/services.json → services table
 *   apps/web/data/cms/team.json     → instructors + providers tables
 *
 * Idempotent: safe to re-run. Uses upsert-by-slug for services and
 * instructors. Providers are keyed by profile_id when a matching profile
 * exists; coaches without a profile row are logged as warnings and skipped
 * for the providers table (the instructor row is still written).
 *
 * DRY RUN mode: set DRY_RUN=1 to log all SQL without writing.
 *
 * Usage:
 *   npx tsx scripts/etl-cms-to-db.ts
 *   DRY_RUN=1 npx tsx scripts/etl-cms-to-db.ts
 *
 * Pricing note:
 *   The services DB schema stores prices in MINOR UNITS (e.g. 250 AED → 25000).
 *   The JSON stores prices in MAJOR UNITS (e.g. 250 AED). This script
 *   multiplies by 100 on write. price_eur is present in the JSON but the
 *   services table has no price_eur column — it is skipped with a log note.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.env.DRY_RUN === '1';
const REPO_ROOT = resolve(__dirname, '..');

const SERVICES_JSON = resolve(REPO_ROOT, 'apps/web/data/cms/services.json');
const TEAM_JSON = resolve(REPO_ROOT, 'apps/web/data/cms/team.json');

// ---------------------------------------------------------------------------
// Source types (matching the actual JSON structure)
// ---------------------------------------------------------------------------

interface CmsService {
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar?: string;
  description_en?: string;
  duration_minutes: number;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  price_eur: number;       // JSON has this; DB does not — noted and skipped
  sessions_count: number;
  validity_days: number;
  coach_level_min?: string;
  coach_level_exact?: string;
  published: boolean;
  [key: string]: unknown;
}

interface CmsCoach {
  slug: string;
  name_ar: string;
  name_en: string;
  title_ar: string;
  title_en: string;
  bio_ar: string;
  bio_en: string;
  photo_url: string;
  coach_level: string;    // ICF credential in the JSON: ACC / PCC / MCC
  credentials: string;
  specialties: string;    // comma-separated string
  coaching_styles: string; // comma-separated string
  languages: string;       // comma-separated string
  is_visible: boolean;
  is_bookable: boolean;
  display_order: string | number;
  published: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split a comma-separated string into a cleaned string array, or null if empty. */
function splitCSV(value: string | undefined | null): string[] | null {
  if (!value || value.trim() === '') return null;
  const parts = value.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/**
 * Map ICF credential string (ACC/PCC/MCC) to an internal Kun level label.
 * This is a best-effort mapping — the DB keeps both fields. The actual
 * kun_level (basic/professional/expert/master) will need a human review;
 * here we map the credential to the closest level as a starting point.
 */
function icfToKunLevel(icfCredential: string): string | null {
  const map: Record<string, string> = {
    ACC: 'professional',
    PCC: 'expert',
    MCC: 'master',
  };
  return map[icfCredential?.toUpperCase()] ?? null;
}

function log(msg: string) {
  console.log(msg);
}

function warn(msg: string) {
  console.warn(`  [WARN] ${msg}`);
}

// ---------------------------------------------------------------------------
// Services ETL
// ---------------------------------------------------------------------------

async function etlServices(adminDb: any): Promise<void> {
  log('\n--- Services ETL ---');
  log(`Source: ${SERVICES_JSON}`);

  const raw: CmsService[] = JSON.parse(readFileSync(SERVICES_JSON, 'utf-8'));
  log(`Loaded ${raw.length} services from JSON`);

  // Note on price_eur: JSON has it, DB services table does not. Skipped.
  log('  Note: price_eur is in the JSON but has no matching DB column — skipped.');

  let ok = 0;
  let skipped = 0;

  for (const svc of raw) {
    const label = `[service:${svc.slug}]`;

    // Map coach_level_min / coach_level_exact to eligible_kun_levels array.
    // The JSON uses ICF labels (basic, professional, expert, master, PCC, MCC…).
    // We store whatever value is present; human review recommended post-migration.
    const eligibleLevels: string[] | null = (() => {
      const exact = svc.coach_level_exact;
      const min = svc.coach_level_min;
      if (exact) return [exact];
      if (min) return [min];
      return null;
    })();

    // Prices: JSON = major units. DB = minor units. Multiply by 100.
    const priceAed = Math.round((svc.price_aed ?? 0) * 100);
    const priceEgp = Math.round((svc.price_egp ?? 0) * 100);
    const priceUsd = Math.round((svc.price_usd ?? 0) * 100);

    const isActive = svc.published !== false;

    if (DRY_RUN) {
      log(`  [DRY RUN] ${label} would upsert:`);
      log(`    name_en=${svc.name_en}, duration=${svc.duration_minutes}min`);
      log(`    price_aed=${priceAed} (minor), price_egp=${priceEgp} (minor), price_usd=${priceUsd} (minor)`);
      log(`    sessions_count=${svc.sessions_count}, validity_days=${svc.validity_days}`);
      log(`    eligible_kun_levels=${JSON.stringify(eligibleLevels)}, is_active=${isActive}`);
      ok++;
      continue;
    }

    try {
      // ON CONFLICT on slug. The services table has no DB-level unique
      // constraint defined in the schema file, so we use a WHERE-based upsert:
      // try INSERT first; if slug already exists, UPDATE that row.
      await adminDb.execute(sql`
        INSERT INTO services (
          slug,
          name_ar,
          name_en,
          description_ar,
          description_en,
          duration_minutes,
          price_aed,
          price_egp,
          price_usd,
          price_sar,
          sessions_count,
          validity_days,
          eligible_kun_levels,
          is_active
        )
        VALUES (
          ${svc.slug},
          ${svc.name_ar},
          ${svc.name_en},
          ${svc.description_ar ?? null},
          ${svc.description_en ?? null},
          ${svc.duration_minutes},
          ${priceAed},
          ${priceEgp},
          ${priceUsd},
          0,
          ${svc.sessions_count},
          ${svc.validity_days},
          ${eligibleLevels},
          ${isActive}
        )
        ON CONFLICT (slug) DO UPDATE SET
          name_ar           = EXCLUDED.name_ar,
          name_en           = EXCLUDED.name_en,
          description_ar    = EXCLUDED.description_ar,
          description_en    = EXCLUDED.description_en,
          duration_minutes  = EXCLUDED.duration_minutes,
          price_aed         = EXCLUDED.price_aed,
          price_egp         = EXCLUDED.price_egp,
          price_usd         = EXCLUDED.price_usd,
          sessions_count    = EXCLUDED.sessions_count,
          validity_days     = EXCLUDED.validity_days,
          eligible_kun_levels = EXCLUDED.eligible_kun_levels,
          is_active         = EXCLUDED.is_active
      `);
      log(`  ok  ${label}  ${svc.name_en}`);
      ok++;
    } catch (err: any) {
      // If the ON CONFLICT clause fails because there is no unique index on slug,
      // fall back to a manual check-then-update pattern.
      if (err?.message?.includes('no unique or exclusion constraint')) {
        warn(`${label} has no unique index on slug — falling back to SELECT+UPDATE`);
        try {
          const { rows } = await adminDb.execute(sql`
            SELECT id FROM services WHERE slug = ${svc.slug} LIMIT 1
          `);
          if (rows.length > 0) {
            await adminDb.execute(sql`
              UPDATE services SET
                name_ar           = ${svc.name_ar},
                name_en           = ${svc.name_en},
                description_ar    = ${svc.description_ar ?? null},
                description_en    = ${svc.description_en ?? null},
                duration_minutes  = ${svc.duration_minutes},
                price_aed         = ${priceAed},
                price_egp         = ${priceEgp},
                price_usd         = ${priceUsd},
                sessions_count    = ${svc.sessions_count},
                validity_days     = ${svc.validity_days},
                eligible_kun_levels = ${eligibleLevels},
                is_active         = ${isActive}
              WHERE slug = ${svc.slug}
            `);
            log(`  ok (updated)  ${label}  ${svc.name_en}`);
          } else {
            await adminDb.execute(sql`
              INSERT INTO services (
                slug, name_ar, name_en, description_ar, description_en,
                duration_minutes, price_aed, price_egp, price_usd, price_sar,
                sessions_count, validity_days, eligible_kun_levels, is_active
              ) VALUES (
                ${svc.slug}, ${svc.name_ar}, ${svc.name_en},
                ${svc.description_ar ?? null}, ${svc.description_en ?? null},
                ${svc.duration_minutes}, ${priceAed}, ${priceEgp}, ${priceUsd}, 0,
                ${svc.sessions_count}, ${svc.validity_days},
                ${eligibleLevels}, ${isActive}
              )
            `);
            log(`  ok (inserted)  ${label}  ${svc.name_en}`);
          }
          ok++;
        } catch (innerErr: any) {
          warn(`${label} fallback also failed: ${innerErr?.message}`);
          skipped++;
        }
      } else {
        warn(`${label} failed: ${err?.message}`);
        skipped++;
      }
    }
  }

  log(`\nServices: ${ok} ok, ${skipped} skipped${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

// ---------------------------------------------------------------------------
// Coaches ETL (instructors + providers)
// ---------------------------------------------------------------------------

async function etlCoaches(adminDb: any): Promise<void> {
  log('\n--- Coaches ETL (instructors + providers) ---');
  log(`Source: ${TEAM_JSON}`);

  const raw: CmsCoach[] = JSON.parse(readFileSync(TEAM_JSON, 'utf-8'));
  log(`Loaded ${raw.length} coaches from JSON`);

  let instructorOk = 0;
  let instructorSkipped = 0;
  let providerOk = 0;
  let providerSkipped = 0;

  for (const coach of raw) {
    const label = `[coach:${coach.slug}]`;

    // Derived fields
    const specialtiesArr = splitCSV(coach.specialties);
    const stylesArr = splitCSV(coach.coaching_styles);
    const langArr = splitCSV(coach.languages);
    const displayOrder = parseInt(String(coach.display_order), 10) || 0;
    const isVisible = coach.is_visible === true && coach.published !== false;
    const icfCredential = coach.coach_level?.toUpperCase() || null; // ACC / PCC / MCC
    const kunLevel = icfCredential ? icfToKunLevel(icfCredential) : null;

    // -----------------------------------------------------------------------
    // 1. instructors table
    // -----------------------------------------------------------------------
    if (DRY_RUN) {
      log(`  [DRY RUN] ${label} instructors would upsert:`);
      log(`    name_en=${coach.name_en}, icf_credential=${icfCredential}, kun_level=${kunLevel}`);
      log(`    is_visible=${isVisible}, display_order=${displayOrder}`);
      log(`    specialties=${JSON.stringify(specialtiesArr)}`);
      log(`    coaching_styles=${JSON.stringify(stylesArr)}`);
      instructorOk++;
    } else {
      try {
        // Try ON CONFLICT (slug) first; fall back to SELECT+UPDATE if no unique index.
        await adminDb.execute(sql`
          INSERT INTO instructors (
            slug,
            title_ar,
            title_en,
            bio_ar,
            bio_en,
            photo_url,
            credentials,
            coach_level,
            icf_credential,
            kun_level,
            specialties,
            coaching_styles,
            is_visible,
            is_platform_coach,
            display_order
          )
          VALUES (
            ${coach.slug},
            ${coach.title_ar},
            ${coach.title_en},
            ${coach.bio_ar || null},
            ${coach.bio_en || null},
            ${coach.photo_url || null},
            ${coach.credentials || null},
            ${icfCredential},
            ${icfCredential},
            ${kunLevel},
            ${specialtiesArr},
            ${stylesArr},
            ${isVisible},
            ${coach.is_bookable === true},
            ${displayOrder}
          )
          ON CONFLICT (slug) DO UPDATE SET
            title_ar         = EXCLUDED.title_ar,
            title_en         = EXCLUDED.title_en,
            bio_ar           = EXCLUDED.bio_ar,
            bio_en           = EXCLUDED.bio_en,
            photo_url        = EXCLUDED.photo_url,
            credentials      = EXCLUDED.credentials,
            coach_level      = EXCLUDED.coach_level,
            icf_credential   = EXCLUDED.icf_credential,
            kun_level        = EXCLUDED.kun_level,
            specialties      = EXCLUDED.specialties,
            coaching_styles  = EXCLUDED.coaching_styles,
            is_visible       = EXCLUDED.is_visible,
            is_platform_coach = EXCLUDED.is_platform_coach,
            display_order    = EXCLUDED.display_order
        `);
        log(`  ok  ${label} → instructors  ${coach.name_en}`);
        instructorOk++;
      } catch (err: any) {
        if (err?.message?.includes('no unique or exclusion constraint')) {
          warn(`${label} no unique index on instructors.slug — falling back`);
          try {
            const { rows } = await adminDb.execute(sql`
              SELECT id FROM instructors WHERE slug = ${coach.slug} LIMIT 1
            `);
            if (rows.length > 0) {
              await adminDb.execute(sql`
                UPDATE instructors SET
                  title_ar         = ${coach.title_ar},
                  title_en         = ${coach.title_en},
                  bio_ar           = ${coach.bio_ar || null},
                  bio_en           = ${coach.bio_en || null},
                  photo_url        = ${coach.photo_url || null},
                  credentials      = ${coach.credentials || null},
                  coach_level      = ${icfCredential},
                  icf_credential   = ${icfCredential},
                  kun_level        = ${kunLevel},
                  specialties      = ${specialtiesArr},
                  coaching_styles  = ${stylesArr},
                  is_visible       = ${isVisible},
                  is_platform_coach = ${coach.is_bookable === true},
                  display_order    = ${displayOrder}
                WHERE slug = ${coach.slug}
              `);
              log(`  ok (updated)  ${label} → instructors  ${coach.name_en}`);
            } else {
              await adminDb.execute(sql`
                INSERT INTO instructors (
                  slug, title_ar, title_en, bio_ar, bio_en, photo_url,
                  credentials, coach_level, icf_credential, kun_level,
                  specialties, coaching_styles, is_visible, is_platform_coach, display_order
                ) VALUES (
                  ${coach.slug}, ${coach.title_ar}, ${coach.title_en},
                  ${coach.bio_ar || null}, ${coach.bio_en || null}, ${coach.photo_url || null},
                  ${coach.credentials || null}, ${icfCredential}, ${icfCredential}, ${kunLevel},
                  ${specialtiesArr}, ${stylesArr}, ${isVisible},
                  ${coach.is_bookable === true}, ${displayOrder}
                )
              `);
              log(`  ok (inserted)  ${label} → instructors  ${coach.name_en}`);
            }
            instructorOk++;
          } catch (innerErr: any) {
            warn(`${label} instructors fallback failed: ${innerErr?.message}`);
            instructorSkipped++;
          }
        } else {
          warn(`${label} instructors failed: ${err?.message}`);
          instructorSkipped++;
        }
      }
    }

    // -----------------------------------------------------------------------
    // 2. providers table
    //    Requires a profile_id. We look up profiles by full_name_en as a
    //    best-effort match (no email in team.json). If not found, we skip
    //    the providers row and log a clear warning — no silent data loss.
    // -----------------------------------------------------------------------
    if (DRY_RUN) {
      log(`  [DRY RUN] ${label} providers: would look up profile by name "${coach.name_en}"`);
      providerOk++;
      continue;
    }

    let profileId: string | null = null;
    try {
      const { rows } = await adminDb.execute(sql`
        SELECT id FROM profiles
        WHERE full_name_en ILIKE ${coach.name_en}
           OR full_name_ar = ${coach.name_ar}
        LIMIT 1
      `);
      if (rows.length > 0) {
        profileId = (rows[0] as { id: string }).id;
      }
    } catch (err: any) {
      warn(`${label} profile lookup failed: ${err?.message}`);
    }

    if (!profileId) {
      warn(`${label} no matching profile found for "${coach.name_en}" — providers row skipped. Create a profile first.`);
      providerSkipped++;
      continue;
    }

    try {
      await adminDb.execute(sql`
        INSERT INTO providers (
          profile_id,
          bio_ar,
          bio_en,
          specialties,
          languages,
          credentials,
          is_visible
        )
        VALUES (
          ${profileId}::uuid,
          ${coach.bio_ar || null},
          ${coach.bio_en || null},
          ${specialtiesArr},
          ${langArr},
          ${coach.credentials || null},
          ${isVisible}
        )
        ON CONFLICT (profile_id) DO UPDATE SET
          bio_ar      = EXCLUDED.bio_ar,
          bio_en      = EXCLUDED.bio_en,
          specialties = EXCLUDED.specialties,
          languages   = EXCLUDED.languages,
          credentials = EXCLUDED.credentials,
          is_visible  = EXCLUDED.is_visible
      `);
      log(`  ok  ${label} → providers  profile_id=${profileId}`);
      providerOk++;
    } catch (err: any) {
      if (err?.message?.includes('no unique or exclusion constraint')) {
        // No unique index on profile_id — fall back to SELECT+UPDATE
        warn(`${label} no unique index on providers.profile_id — falling back`);
        try {
          const { rows } = await adminDb.execute(sql`
            SELECT id FROM providers WHERE profile_id = ${profileId}::uuid LIMIT 1
          `);
          if (rows.length > 0) {
            await adminDb.execute(sql`
              UPDATE providers SET
                bio_ar      = ${coach.bio_ar || null},
                bio_en      = ${coach.bio_en || null},
                specialties = ${specialtiesArr},
                languages   = ${langArr},
                credentials = ${coach.credentials || null},
                is_visible  = ${isVisible}
              WHERE profile_id = ${profileId}::uuid
            `);
            log(`  ok (updated)  ${label} → providers`);
          } else {
            await adminDb.execute(sql`
              INSERT INTO providers (profile_id, bio_ar, bio_en, specialties, languages, credentials, is_visible)
              VALUES (
                ${profileId}::uuid, ${coach.bio_ar || null}, ${coach.bio_en || null},
                ${specialtiesArr}, ${langArr}, ${coach.credentials || null}, ${isVisible}
              )
            `);
            log(`  ok (inserted)  ${label} → providers`);
          }
          providerOk++;
        } catch (innerErr: any) {
          warn(`${label} providers fallback failed: ${innerErr?.message}`);
          providerSkipped++;
        }
      } else {
        warn(`${label} providers failed: ${err?.message}`);
        providerSkipped++;
      }
    }
  }

  log(`\nInstructors: ${instructorOk} ok, ${instructorSkipped} skipped${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`Providers:   ${providerOk} ok, ${providerSkipped} skipped${DRY_RUN ? ' (DRY RUN)' : ''}`);
  if (providerSkipped > 0 && !DRY_RUN) {
    log(`\n  Coaches without profiles need profile rows created first.`);
    log(`  Run seed-test-users.ts or create profiles manually, then re-run this ETL.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('=== ETL: CMS JSON → Database ===');
  if (DRY_RUN) {
    log('MODE: DRY RUN — no writes will occur');
  }
  log(`Target DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(DATABASE_URL not set)'}`);
  log('');
  log('Pricing note: JSON prices are in major units (e.g. 250 AED).');
  log('  DB stores minor units. This script multiplies by 100 before writing.');
  log('  price_eur from JSON is skipped (no matching column in services table).');

  await withAdminContext(async (adminDb: any) => {
    await etlServices(adminDb);
    await etlCoaches(adminDb);
  });

  log('\n=== ETL complete ===');

  const { closePool } = await import('@kunacademy/db');
  await closePool();
}

main().catch((err) => {
  console.error('[etl-cms-to-db] FAILED:', err);
  process.exit(1);
});
