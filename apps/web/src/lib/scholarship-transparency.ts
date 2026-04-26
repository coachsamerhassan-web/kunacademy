/**
 * Scholarship Fund — transparency dashboard data layer.
 *
 * Wave E.4 (2026-04-26).
 *
 * Computes aggregate metrics over the live E.1 schema (donations,
 * scholarships, scholarship_applications, scholarship_donation_links) for the
 * public-facing /[locale]/scholarships transparency board and the public
 * /api/scholarships/transparency JSON feed.
 *
 * Design constraints (locked):
 *   - PUBLIC, NO AUTH. Aggregates only — never returns recipient PII.
 *   - Donor PII is NEVER joined into transparency output (no recent-donors
 *     feed in E.4 — explicitly out of scope for transparency dashboard,
 *     spec §9 mentions optional but per dispatch scope it's omitted; a future
 *     wave can add an opt-in donor name strip and that is NOT this).
 *   - Small-N suppression: any program-level allocation count below
 *     SMALL_N_THRESHOLD is bucketed into "other_programs" so no
 *     re-identification is possible.
 *   - In-process cache with 5-minute TTL — recompute on first request after
 *     expiry. NOT a freshness ticker.
 *   - Aggregates BOTH stripe_webhook AND manual_entry donations (B5 — single
 *     trust narrative, no online-vs-manual split visible).
 *   - Multi-currency preserved: amounts grouped by currency. NO conversion
 *     at display time (dispatch directive: "single-currency conversions
 *     happen at grant time, not display time").
 *   - Scholarships are "active" when allocated AND not yet disbursed. This is
 *     the queryable definition since the schema has no scholarships.status
 *     column (an `allocated_at` timestamp + nullable `disbursed_at`).
 *   - Programs covered = distinct program_slug among "active" scholarships
 *     (same definition).
 *   - 12-month donation timeseries — buckets are calendar months in UTC.
 *
 * IP / dignity:
 *   - No recipient names, emails, photos, methodology, screening details
 *     anywhere in the returned shape.
 *   - Beneficiary count is a single integer (count of distinct application_id
 *     across allocated scholarships). It is NEVER coupled with program
 *     identity in a way that creates a small-N inference.
 *   - Per-program allocation breakdown applies SMALL_N_THRESHOLD (3) — a
 *     program with 1 or 2 active allocations is rolled up into
 *     "other_programs" so the response cannot leak a 1:1 inference like
 *     "Ihya: 1 allocation, AED 25,000" → identifiable applicant.
 */

import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';

/** Suppress per-program detail when allocation count is below this threshold.
 *  Aggregates fewer-than-N rows into a single 'other_programs' bucket. */
const SMALL_N_THRESHOLD = 3;

/** Cache TTL in ms — aligns with page revalidate=300s. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** How many calendar months (current + previous) to render in the
 *  recurrence timeseries. 12 = trailing year. */
const TIMESERIES_MONTHS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Public types — what /api/scholarships/transparency returns and what the
// page passes to the ScholarshipsBoard component.
// ─────────────────────────────────────────────────────────────────────────────

export interface CurrencyTotal {
  /** ISO 4217 — 'AED', 'USD', 'EUR', 'SAR', 'EGP', 'GBP'. */
  currency: string;
  /** Major-unit amount (already divided by 100 / converted from cents). */
  amount_major: number;
  /** Donation count for this currency (used internally; useful for QA). */
  donation_count: number;
}

export interface MonthBucket {
  /** ISO calendar month start in UTC, e.g. '2026-04-01'. */
  month: string;
  /** Map of currency → major-unit total for that month. */
  totals: Record<string, number>;
}

export interface ProgramAllocation {
  /** Bucket key — either a real slug like 'ihya' or 'other_programs'. */
  program_slug: string;
  /** Bucket family — 'gps'|'ihya'|'wisal'|'seeds'|'other'. Set to 'other'
   *  when small-N suppression collapses multiple programs together. */
  program_family: string;
  /** Number of distinct allocated-and-not-disbursed scholarships. */
  allocation_count: number;
  /** Currency breakdown of total amounts allocated. */
  totals: Record<string, number>;
}

export interface TransparencyData {
  /** Sums of donations.amount_cents where status IN ('received','allocated','disbursed')
   *  i.e. anything that successfully landed and wasn't refunded/failed.
   *  Grouped by currency, returned in major units. */
  total_raised: CurrencyTotal[];
  /** Sums of scholarship_donation_links.amount_portion (in donation's native
   *  currency) for allocations where the linked scholarship has been
   *  disbursed (disbursed_at IS NOT NULL). Grouped by currency. */
  total_disbursed: CurrencyTotal[];
  /** Count of "active" scholarships (allocated, not yet disbursed). */
  active_scholarships: number;
  /** Count of distinct application_id values across allocated scholarships
   *  (regardless of disbursement). This is the beneficiary count — never
   *  paired with a name. */
  beneficiary_count: number;
  /** List of program slugs covered by ACTIVE scholarships. Output uses canon
   *  program titles when available; falls back to slug. Empty when no active
   *  allocations exist. */
  programs_covered: Array<{
    slug: string;
    family: string;
    title_ar: string;
    title_en: string;
  }>;
  /** Per-program breakdown (small-N suppressed). */
  program_breakdown: ProgramAllocation[];
  /** 12-month donation totals for the sparkline. Always 12 entries (zero
   *  buckets when no donations existed). */
  monthly_recurrence: MonthBucket[];
  /** ISO timestamp of when this data was computed. */
  computed_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-process cache — single value, time-keyed
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: TransparencyData;
  expiresAt: number;
}

let _cache: CacheEntry | null = null;

/** Force-refresh helper — used by tests, not by production code. */
export function _resetTransparencyCache(): void {
  _cache = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Computation
// ─────────────────────────────────────────────────────────────────────────────

interface RawDonationsRow {
  currency: string;
  total_cents: string | number;
  donation_count: string | number;
}

interface RawDisbursedRow {
  currency: string;
  total_cents: string | number;
}

interface RawProgramRow {
  program_slug: string;
  program_family: string;
  allocation_count: string | number;
  currency: string;
  total_cents: string | number;
}

interface RawTimeseriesRow {
  month: string;
  currency: string;
  total_cents: string | number;
}

/** Convert minor-unit amount (cents) into major-unit (e.g. AED). Half-up
 *  rounding to 2 decimal places is overkill for display; we round to whole
 *  unit per spec §9.3 ("Donation amounts displayed rounded to nearest whole
 *  AED") to avoid micro-amount fingerprinting. */
function centsToWholeMajor(cents: number): number {
  return Math.round(cents / 100);
}

/** UTC ISO-month key for grouping. */
function utcMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Generate the trailing N month keys, oldest first. */
function generateMonthKeys(n: number, ref: Date): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1));
    keys.push(utcMonthKey(d));
  }
  return keys;
}

/** Pull canon program titles from the programs table for the given slugs.
 *  Falls back to humanized slug if a row is missing. */
async function fetchProgramTitles(
  db: any,
  slugs: string[],
): Promise<Map<string, { family: string; title_ar: string; title_en: string }>> {
  const out = new Map<string, { family: string; title_ar: string; title_en: string }>();
  if (slugs.length === 0) return out;

  const rows = await db.execute(sql`
    SELECT slug, title_ar, title_en, type
    FROM programs
    WHERE slug = ANY(${slugs}::text[])
  `);
  for (const r of rows.rows as Array<{
    slug: string;
    title_ar: string;
    title_en: string;
    type: string;
  }>) {
    out.set(r.slug, {
      family: inferFamilyFromSlug(r.slug),
      title_ar: r.title_ar,
      title_en: r.title_en,
    });
  }
  return out;
}

/** Heuristic: derive program_family bucket from slug. The scholarships table
 *  stores program_family explicitly — when we use that we don't need this.
 *  This helper is only for rendering canon titles when programs.json
 *  returns rows whose family wasn't carried through.
 *
 *  Per dispatch + canon Phase 2 §M7: scholarships fund big programs only —
 *  Ihya, GPS, Wisal, Seeds. */
function inferFamilyFromSlug(slug: string): string {
  const s = slug.toLowerCase();
  if (s.startsWith('ihya')) return 'ihya';
  if (s.startsWith('gps')) return 'gps';
  if (s.startsWith('wisal')) return 'wisal';
  if (s.startsWith('seeds')) return 'seeds';
  return 'other';
}

/** Compute the transparency data. Direct DB queries via withAdminContext so
 *  RLS doesn't block the aggregate reads. Public surface is enforced by:
 *  (a) the API route gating + (b) the response shape carrying ZERO PII. */
async function computeTransparencyData(): Promise<TransparencyData> {
  return withAdminContext(async (db) => {
    // ─── 1) total_raised — by currency, all non-failed/refunded donations
    const raisedRes = await db.execute(sql`
      SELECT currency,
             SUM(amount_cents) AS total_cents,
             COUNT(*)          AS donation_count
      FROM donations
      WHERE status IN ('received','allocated','disbursed')
      GROUP BY currency
      ORDER BY currency
    `);
    const total_raised: CurrencyTotal[] = (raisedRes.rows as RawDonationsRow[]).map((r) => ({
      currency: r.currency,
      amount_major: centsToWholeMajor(Number(r.total_cents) || 0),
      donation_count: Number(r.donation_count) || 0,
    }));

    // ─── 2) total_disbursed — sum of amount_portion across links whose
    //     scholarship has disbursed_at IS NOT NULL. amount_portion is in the
    //     DONATION's native currency, so we need to JOIN to donations to read
    //     currency, NOT to scholarships.
    const disbursedRes = await db.execute(sql`
      SELECT d.currency                 AS currency,
             SUM(sdl.amount_portion)    AS total_cents
      FROM scholarship_donation_links sdl
      JOIN scholarships s ON s.id = sdl.scholarship_id
      JOIN donations d ON d.id = sdl.donation_id
      WHERE s.disbursed_at IS NOT NULL
        AND d.status NOT IN ('refunded','failed')
      GROUP BY d.currency
      ORDER BY d.currency
    `);
    const total_disbursed: CurrencyTotal[] = (disbursedRes.rows as RawDisbursedRow[]).map((r) => ({
      currency: r.currency,
      amount_major: centsToWholeMajor(Number(r.total_cents) || 0),
      donation_count: 0, // not meaningful for disbursed totals; UI ignores
    }));

    // ─── 3) active_scholarships + beneficiary_count
    const activeRes = await db.execute(sql`
      SELECT COUNT(*)                                 AS active_count,
             COUNT(DISTINCT application_id)           AS beneficiary_count
      FROM scholarships
      WHERE disbursed_at IS NULL
    `);
    const activeRow = activeRes.rows[0] as
      | { active_count: string | number; beneficiary_count: string | number }
      | undefined;
    const active_scholarships = Number(activeRow?.active_count ?? 0);
    const beneficiary_count_active = Number(activeRow?.beneficiary_count ?? 0);

    // Beneficiary count includes BOTH active and disbursed (people who have
    // received a scholarship — the lifetime count is the dignity-framed
    // headline).
    const lifetimeBenRes = await db.execute(sql`
      SELECT COUNT(DISTINCT application_id) AS beneficiary_count
      FROM scholarships
    `);
    const beneficiary_count = Math.max(
      Number((lifetimeBenRes.rows[0] as { beneficiary_count?: string | number } | undefined)
        ?.beneficiary_count ?? 0),
      beneficiary_count_active,
    );

    // ─── 4) programs_covered — distinct program_slug among ACTIVE scholarships
    const programsCoveredRes = await db.execute(sql`
      SELECT DISTINCT program_slug, program_family
      FROM scholarships
      WHERE disbursed_at IS NULL
      ORDER BY program_slug
    `);
    const coveredSlugs = (programsCoveredRes.rows as Array<{
      program_slug: string;
      program_family: string;
    }>).map((r) => r.program_slug);
    const titleMap = await fetchProgramTitles(db, coveredSlugs);

    const programs_covered = (programsCoveredRes.rows as Array<{
      program_slug: string;
      program_family: string;
    }>).map((r) => {
      const tm = titleMap.get(r.program_slug);
      return {
        slug: r.program_slug,
        family: r.program_family,
        title_ar: tm?.title_ar ?? r.program_slug,
        title_en: tm?.title_en ?? r.program_slug,
      };
    });

    // ─── 5) program_breakdown — per-program allocation totals + SMALL_N suppression
    //     We aggregate only ACTIVE scholarships (allocated, not disbursed) so
    //     the breakdown reflects current outstanding allocations. Currency
    //     totals come from the linked donations (native currency).
    //
    //     amount_portion is in DONATION's native currency, so we join on
    //     donations to read currency. We GROUP BY program_slug + currency and
    //     also surface allocation_count = distinct scholarship_id per program.
    //     Filter out refunded/failed donations so a reversed payment doesn't
    //     inflate active-program totals.
    const breakdownRes = await db.execute(sql`
      SELECT s.program_slug                     AS program_slug,
             s.program_family                   AS program_family,
             COUNT(DISTINCT s.id)               AS allocation_count,
             d.currency                         AS currency,
             SUM(sdl.amount_portion)            AS total_cents
      FROM scholarships s
      JOIN scholarship_donation_links sdl ON sdl.scholarship_id = s.id
      JOIN donations d ON d.id = sdl.donation_id
      WHERE s.disbursed_at IS NULL
        AND d.status NOT IN ('refunded','failed')
      GROUP BY s.program_slug, s.program_family, d.currency
      ORDER BY s.program_slug, d.currency
    `);

    // Group rows into per-slug entries with currency totals
    const slugMap = new Map<string, ProgramAllocation>();
    for (const r of breakdownRes.rows as RawProgramRow[]) {
      const slug = r.program_slug;
      let entry = slugMap.get(slug);
      if (!entry) {
        entry = {
          program_slug: slug,
          program_family: r.program_family,
          allocation_count: Number(r.allocation_count) || 0,
          totals: {},
        };
        slugMap.set(slug, entry);
      }
      // allocation_count is per-currency-row in the SQL; take the max to
      // handle multi-currency funding for the same slug correctly.
      // (A scholarship is one row in scholarships; multi-currency only
      // surfaces if multiple donations in different currencies fund one
      // scholarship — rare but possible. Distinct scholarship_id per slug
      // is what we want regardless of currency.)
      entry.allocation_count = Math.max(entry.allocation_count, Number(r.allocation_count) || 0);
      entry.totals[r.currency] =
        (entry.totals[r.currency] ?? 0) + centsToWholeMajor(Number(r.total_cents) || 0);
    }

    // Apply small-N suppression
    const detailedPrograms: ProgramAllocation[] = [];
    const otherBucket: ProgramAllocation = {
      program_slug: 'other_programs',
      program_family: 'other',
      allocation_count: 0,
      totals: {},
    };
    for (const entry of slugMap.values()) {
      if (entry.allocation_count >= SMALL_N_THRESHOLD) {
        detailedPrograms.push(entry);
      } else {
        otherBucket.allocation_count += entry.allocation_count;
        for (const [cur, amt] of Object.entries(entry.totals)) {
          otherBucket.totals[cur] = (otherBucket.totals[cur] ?? 0) + amt;
        }
      }
    }

    // Sort detailed programs by allocation_count desc
    detailedPrograms.sort((a, b) => b.allocation_count - a.allocation_count);

    const program_breakdown: ProgramAllocation[] =
      otherBucket.allocation_count > 0
        ? [...detailedPrograms, otherBucket]
        : detailedPrograms;

    // ─── 6) monthly_recurrence — last 12 months of donation totals by currency
    //     Buckets in calendar UTC months. Empty months are zero-filled.
    const ref = new Date();
    const monthKeys = generateMonthKeys(TIMESERIES_MONTHS, ref);
    // Earliest bucket start
    const earliestMonth = monthKeys[0];

    const tsRes = await db.execute(sql`
      SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS month,
             currency,
             SUM(amount_cents) AS total_cents
      FROM donations
      WHERE status IN ('received','allocated','disbursed')
        AND created_at >= ${earliestMonth}::timestamptz
      GROUP BY 1, currency
      ORDER BY 1
    `);

    const monthMap = new Map<string, Record<string, number>>();
    for (const k of monthKeys) monthMap.set(k, {});
    for (const r of tsRes.rows as RawTimeseriesRow[]) {
      const k = String(r.month);
      const bucket = monthMap.get(k);
      if (!bucket) continue; // outside window — defensive
      bucket[r.currency] =
        (bucket[r.currency] ?? 0) + centsToWholeMajor(Number(r.total_cents) || 0);
    }
    const monthly_recurrence: MonthBucket[] = monthKeys.map((k) => ({
      month: k,
      totals: monthMap.get(k) ?? {},
    }));

    return {
      total_raised,
      total_disbursed,
      active_scholarships,
      beneficiary_count,
      programs_covered,
      program_breakdown,
      monthly_recurrence,
      computed_at: new Date().toISOString(),
    };
  });
}

/**
 * Get cached or freshly computed transparency data.
 *
 * Cache strategy: in-process Map, single key, TTL=CACHE_TTL_MS.
 * Concurrent callers within the same process during cache-miss serialize on
 * the underlying DB — Postgres handles the contention gracefully. We could
 * de-dupe with a single in-flight Promise but the cost (~30ms per query
 * series) is small enough not to bother.
 */
export async function getTransparencyData(): Promise<TransparencyData> {
  const now = Date.now();
  if (_cache && now < _cache.expiresAt) {
    return _cache.data;
  }

  const data = await computeTransparencyData();
  _cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

/**
 * Public-API serialization. Strips internal-only fields before returning to
 * the network. Currently the internal shape IS the public shape (we
 * deliberately constructed it that way), but routing all responses through
 * this helper means future internal additions don't accidentally leak.
 */
export function serializeTransparencyForApi(data: TransparencyData): TransparencyData {
  return {
    total_raised: data.total_raised.map((t) => ({
      currency: t.currency,
      amount_major: t.amount_major,
      donation_count: t.donation_count,
    })),
    total_disbursed: data.total_disbursed.map((t) => ({
      currency: t.currency,
      amount_major: t.amount_major,
      donation_count: t.donation_count,
    })),
    active_scholarships: data.active_scholarships,
    beneficiary_count: data.beneficiary_count,
    programs_covered: data.programs_covered,
    program_breakdown: data.program_breakdown,
    monthly_recurrence: data.monthly_recurrence,
    computed_at: data.computed_at,
  };
}
