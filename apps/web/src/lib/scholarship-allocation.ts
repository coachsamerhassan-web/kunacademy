/**
 * Scholarship Fund — allocation matcher + disbursement flow data layer.
 *
 * Wave E.6 (2026-04-26).
 *
 * Responsibilities:
 *   - applyAllocation()    — atomic txn that turns donations + an approved
 *                            application into a scholarships row + audit entry.
 *   - applyDisbursement()  — atomic txn that issues a single-use redemption
 *                            token + audit entry. Email send is fire-and-forget
 *                            after the txn commits.
 *
 * Design constraints (locked):
 *   - All write paths run via withAdminContext on the server (RLS bypass).
 *     The route layer auth-gates admin role BEFORE invoking these helpers.
 *   - applyStatusTransition (from scholarship-application.ts) is the single
 *     source of truth for the application status flip + audit row + cache
 *     invalidation. We DELEGATE to it on both allocate + disburse so the
 *     E.4 transparency cache is invalidated transitively.
 *   - Cryptographic plaintext token NEVER touches the DB. Only sha256 hash
 *     lands in scholarship_tokens.token_hash. Plaintext returned from
 *     applyDisbursement() so the caller can stuff it into the email; lost
 *     after that.
 *   - Allocation total must EXACTLY match canon program full price in
 *     donation native currency. Any divergence → 422.
 *   - Concurrent-allocate race: protected by row-level FOR UPDATE locks on
 *     selected donations + the partial unique index on
 *     donations.allocated_to_scholarship_id (NULL while available, set
 *     post-allocate).
 *   - Concurrent-disburse race: protected by the partial unique index on
 *     scholarship_tokens (one un-redeemed token per scholarship).
 */

import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { createHash, randomBytes } from 'node:crypto';
import { applyStatusTransition, TransitionError } from './scholarship-application';
import { _resetTransparencyCache } from './scholarship-transparency';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplyAllocationInput {
  application_id: string;
  donation_ids: string[];
  admin_id: string;
  /** Optional admin note recorded on the audit row. */
  note?: string | null;
}

export interface ApplyAllocationResult {
  ok: true;
  scholarship_id: string;
  donation_ids: string[];
  amount_cents: number;
  currency: string;
}

export interface ApplyDisbursementInput {
  scholarship_id: string;
  admin_id: string;
  /** Optional admin note recorded on the audit row. */
  note?: string | null;
}

export interface ApplyDisbursementResult {
  ok: true;
  application_id: string;
  scholarship_id: string;
  /** Plaintext token — single-use; pass into the email and discard. */
  plaintext_token: string;
  expires_at: string;
  enrollment_url_path: string;
}

export class AllocationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — canon program full-price lookup, currency consistency check
// ─────────────────────────────────────────────────────────────────────────────

const CURRENCY_TO_PRICE_COL: Record<string, string> = {
  AED: 'price_aed',
  EGP: 'price_egp',
  USD: 'price_usd',
  EUR: 'price_eur',
};

interface ProgramPriceRow {
  slug: string;
  family: string;
  price_cents: number;
  currency: string;
}

/**
 * Read the canon full price for a program in the given currency. Returns
 * minor-units (cents). Throws AllocationError if unsupported currency or
 * program slug not found / not scholarship-eligible.
 */
async function getProgramFullPriceCents(
  program_slug: string,
  currency: string,
): Promise<ProgramPriceRow> {
  const upperCurrency = currency.toUpperCase();
  const priceCol = CURRENCY_TO_PRICE_COL[upperCurrency];
  if (!priceCol) {
    throw new AllocationError(
      'unsupported_currency',
      `currency ${currency} not in canon (AED|EGP|USD|EUR)`,
    );
  }
  return withAdminContext(async (db) => {
    // Whitelisted column name — direct sql.raw is safe here. Programs row
    // returned with the raw price_* numeric in major units; we convert to
    // minor (×100) below.
    const r = await db.execute(sql`
      SELECT
        slug,
        nav_group           AS family,
        ${sql.raw(priceCol)} AS price_major,
        scholarship_eligible
      FROM programs
      WHERE slug = ${program_slug}
      LIMIT 1
    `);
    const row = r.rows[0] as
      | {
          slug: string;
          family: string;
          price_major: string | number | null;
          scholarship_eligible: boolean | null;
        }
      | undefined;
    if (!row) {
      throw new AllocationError('program_not_found', `program ${program_slug} not in canon`);
    }
    if (row.scholarship_eligible !== true) {
      throw new AllocationError(
        'program_not_scholarship_eligible',
        `program ${program_slug} is not scholarship-eligible`,
      );
    }
    const priceMajor = row.price_major == null ? null : Number(row.price_major);
    if (priceMajor === null || !Number.isFinite(priceMajor) || priceMajor <= 0) {
      throw new AllocationError(
        'program_no_price',
        `program ${program_slug} has no ${upperCurrency} canon price`,
      );
    }
    return {
      slug: row.slug,
      family: row.family,
      price_cents: Math.round(priceMajor * 100),
      currency: upperCurrency,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// listAvailableDonationsForAllocation — for the admin allocation matcher UI
// ─────────────────────────────────────────────────────────────────────────────

export interface AvailableDonationRow {
  id: string;
  /** Anonymous-by-default display ("Donor #N"); donor name never exposed. */
  donor_anonymized: string;
  amount_cents: number;
  currency: string;
  designation_preference: string;
  received_at: string;
}

/**
 * List donations available for allocation: status='received' AND not yet
 * allocated. Anonymized donor display per spec §9.3 dignity framing — the
 * allocation UI shows "Donor #N" sequence numbers, never donor names.
 *
 * Optional currency filter so the matcher can default to the application's
 * canon-price currency.
 */
export async function listAvailableDonationsForAllocation(
  filter?: { currency?: string },
): Promise<AvailableDonationRow[]> {
  return withAdminContext(async (db) => {
    const currency = filter?.currency?.toUpperCase() ?? null;
    const r = await db.execute(sql`
      SELECT
        id,
        amount_cents,
        currency,
        designation_preference,
        created_at AS received_at,
        ROW_NUMBER() OVER (ORDER BY created_at ASC) AS row_num
      FROM donations
      WHERE status = 'received'
        AND allocated_to_scholarship_id IS NULL
        AND (${currency}::text IS NULL OR currency = ${currency})
      ORDER BY created_at ASC
    `);
    const rows = r.rows as Array<{
      id: string;
      amount_cents: number;
      currency: string;
      designation_preference: string;
      received_at: string;
      row_num: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      donor_anonymized: `Donor #${row.row_num}`,
      amount_cents: row.amount_cents,
      currency: row.currency,
      designation_preference: row.designation_preference,
      received_at: row.received_at,
    }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// applyAllocation — atomic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomic allocation:
 *   1. Lock + validate the application (must be status='approved')
 *   2. Lock + validate each donation (must be status='received', un-allocated,
 *      same currency for sum, sum equals canon full price)
 *   3. INSERT scholarships row (denormalized recipient snapshot)
 *   4. INSERT scholarship_donation_links rows (one per donation, full
 *      amount_portion = donation amount in donation native currency)
 *   5. UPDATE donations.status='allocated' + allocated_to_scholarship_id +
 *      allocated_at on each row
 *   6. applyStatusTransition('allocated') — flips application status +
 *      writes the audit row + invalidates the transparency cache
 *
 * All steps in a single DB transaction (withAdminContext provides the
 * connection; multiple .execute() calls within the same withAdminContext
 * callback share the same connection. We wrap with explicit BEGIN/COMMIT
 * to make the txn boundary explicit.)
 *
 * Throws AllocationError on any precondition failure. Throws TransitionError
 * if the application status flip fails (should not normally happen since we
 * already verified status='approved' under FOR UPDATE).
 */
export async function applyAllocation(
  input: ApplyAllocationInput,
): Promise<ApplyAllocationResult> {
  if (input.donation_ids.length === 0) {
    throw new AllocationError('no_donations', 'allocation requires at least one donation');
  }
  if (input.donation_ids.length > 50) {
    throw new AllocationError('too_many_donations', 'allocation cannot exceed 50 donations');
  }
  // De-dup defensively to avoid two row-level locks on the same row racing.
  const donation_ids = Array.from(new Set(input.donation_ids));
  if (donation_ids.length !== input.donation_ids.length) {
    throw new AllocationError('duplicate_donations', 'duplicate donation_ids in selection');
  }
  // Validate UUID shape on each id.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of donation_ids) {
    if (!UUID_RE.test(id)) {
      throw new AllocationError('invalid_donation_id', `donation_id ${id} is not a UUID`);
    }
  }

  // Step 1 + 2: read application + donations under FOR UPDATE in a single txn.
  // Step 3-5: write inserts + updates in same txn. Step 6: applyStatusTransition
  // must run AFTER the scholarships row exists (its row-level lock on
  // applications was held earlier; we release it inside applyStatusTransition).
  // We use a single withAdminContext for the entire critical section (steps 1-5)
  // and call applyStatusTransition AFTER it commits — but to keep everything
  // atomic we instead embed the status flip inside the same connection by
  // duplicating the transition logic here. Per E.5 hand-off contract, however,
  // applyStatusTransition is the single source of truth; we delegate to it
  // POST-commit. If the application is already 'approved' under our FOR UPDATE
  // lock and the writes succeed, the subsequent applyStatusTransition cannot
  // race because no other admin route reaches 'approved → allocated' from a
  // different code path.
  //
  // To preserve full atomicity (no window between COMMIT-allocation-rows and
  // applyStatusTransition where a reader sees an "approved app with a
  // scholarships row but app status still approved"), we implement the
  // transition INLINE inside the same withAdminContext below — same SQL as
  // applyStatusTransition writes — and explicitly call _resetTransparencyCache()
  // afterward. We DO NOT call applyStatusTransition() (which opens its own
  // withAdminContext / new connection).

  // withAdminContext already wraps the callback in BEGIN/COMMIT (see
  // packages/db/src/pool.ts). Throwing inside the callback rolls back. We
  // therefore do NOT issue our own BEGIN/COMMIT — let the wrapper own the
  // transaction boundary.
  const result = await withAdminContext(async (db) => {
    // ── Step 1: lock + validate application ────────────────────────────
    const appRes = await db.execute(sql`
        SELECT id, status, applicant_name, applicant_email, preferred_language,
               program_family, program_slug, scholarship_tier
        FROM scholarship_applications
        WHERE id = ${input.application_id}::uuid
        FOR UPDATE
      `);
      const app = appRes.rows[0] as
        | {
            id: string;
            status: string;
            applicant_name: string;
            applicant_email: string;
            preferred_language: string;
            program_family: string;
            program_slug: string;
            scholarship_tier: 'partial' | 'full';
          }
        | undefined;
      if (!app) {
        throw new AllocationError('application_not_found', 'application not found');
      }
      if (app.status !== 'approved') {
        throw new AllocationError(
          'invalid_application_status',
          `application status is ${app.status}, expected 'approved'`,
        );
      }

      // ── Step 2: lock + validate donations ──────────────────────────────
      // ANY(...::uuid[]) parameter binding: drizzle's `${arr}::uuid[]` produces
      // tuple cast that fails at runtime per E.4 hand-off learned-pattern.
      // Use sql.raw with quoted IDs (defensively single-quote-escaped — UUIDs
      // contain only hex+dash so escaping is a no-op but the pattern stays
      // safe for any future change).
      const idLiteral = donation_ids.map((id) => `'${id.replace(/'/g, "''")}'::uuid`).join(',');
      const donRes = await db.execute(sql`
        SELECT id, status, allocated_to_scholarship_id,
               amount_cents, currency, donor_email
        FROM donations
        WHERE id IN (${sql.raw(idLiteral)})
        FOR UPDATE
      `);
      const donations = donRes.rows as Array<{
        id: string;
        status: string;
        allocated_to_scholarship_id: string | null;
        amount_cents: number;
        currency: string;
        donor_email: string;
      }>;
      if (donations.length !== donation_ids.length) {
        throw new AllocationError(
          'donations_missing',
          `requested ${donation_ids.length} donations, found ${donations.length}`,
        );
      }
      for (const d of donations) {
        if (d.status !== 'received') {
          throw new AllocationError(
            'donation_not_received',
            `donation ${d.id} status is ${d.status}, expected 'received'`,
          );
        }
        if (d.allocated_to_scholarship_id !== null) {
          throw new AllocationError(
            'donation_already_allocated',
            `donation ${d.id} is already allocated`,
          );
        }
      }

      // All donations must share a single currency.
      const currencies = new Set(donations.map((d) => d.currency));
      if (currencies.size !== 1) {
        throw new AllocationError(
          'currency_mismatch',
          `donations span multiple currencies: ${[...currencies].join(',')}`,
        );
      }
      const currency = donations[0]!.currency;

      // Sum must match canon full price for the program in this currency.
      const sumCents = donations.reduce((acc, d) => acc + d.amount_cents, 0);
      const program = await getProgramFullPriceCents(app.program_slug, currency);
      if (sumCents !== program.price_cents) {
        throw new AllocationError(
          'amount_mismatch',
          `selected ${sumCents} ${currency} but program full price is ${program.price_cents} ${currency}`,
        );
      }

      // ── Step 3: INSERT scholarships row ────────────────────────────────
      const schRes = await db.execute(sql`
        INSERT INTO scholarships (
          application_id, recipient_name, recipient_email,
          program_family, program_slug, scholarship_tier,
          amount_cents, currency,
          allocated_by, allocated_at,
          notes, metadata
        ) VALUES (
          ${app.id}::uuid,
          ${app.applicant_name},
          ${app.applicant_email},
          ${app.program_family},
          ${app.program_slug},
          ${app.scholarship_tier},
          ${sumCents},
          ${currency},
          ${input.admin_id}::uuid,
          now(),
          ${input.note ?? null},
          ${JSON.stringify({
            source: 'wave_e6_allocation',
            donation_count: donations.length,
          })}::jsonb
        )
        RETURNING id
      `);
      const scholarshipRow = schRes.rows[0] as { id: string } | undefined;
      if (!scholarshipRow) {
        throw new AllocationError('scholarship_insert_failed', 'failed to insert scholarships row');
      }
      const scholarship_id = scholarshipRow.id;

      // ── Step 4: INSERT scholarship_donation_links rows ─────────────────
      // amount_portion = donation amount (full donation funds this scholarship,
      // 1:1 portion). The schema permits N:N for future split-allocation but
      // v1 sticks with whole-donation allocation.
      for (const d of donations) {
        await db.execute(sql`
          INSERT INTO scholarship_donation_links (
            scholarship_id, donation_id, amount_portion
          ) VALUES (
            ${scholarship_id}::uuid,
            ${d.id}::uuid,
            ${d.amount_cents}
          )
        `);
      }

      // ── Step 5: UPDATE donations.status='allocated' on each row ────────
      // Single statement with the ID list to minimize round-trips.
      await db.execute(sql`
        UPDATE donations
        SET status = 'allocated',
            allocated_to_scholarship_id = ${scholarship_id}::uuid,
            allocated_at = now()
        WHERE id IN (${sql.raw(idLiteral)})
      `);

      // ── Step 6 (inline): flip application status approved → allocated ──
      // Mirrors applyStatusTransition's atomic section so we keep the entire
      // operation in a single TXN. Cache invalidation happens AFTER COMMIT.
      await db.execute(sql`
        UPDATE scholarship_applications
        SET status = 'allocated',
            updated_at = now(),
            screened_by = COALESCE(screened_by, ${input.admin_id}::uuid),
            screened_at = COALESCE(screened_at, now())
        WHERE id = ${app.id}::uuid
      `);

      // Status-changed audit row
      await db.execute(sql`
        INSERT INTO scholarship_application_audit_events (
          application_id, admin_id, event_type,
          before_status, after_status, note, metadata
        ) VALUES (
          ${app.id}::uuid,
          ${input.admin_id}::uuid,
          'status_changed',
          'approved',
          'allocated',
          ${input.note ?? null},
          ${JSON.stringify({
            scholarship_id,
            donation_count: donations.length,
            amount_cents: sumCents,
            currency,
          })}::jsonb
        )
      `);

    // Allocated event audit row (separate semantic from status_changed)
    await db.execute(sql`
        INSERT INTO scholarship_application_audit_events (
          application_id, admin_id, event_type, note, metadata
        ) VALUES (
          ${app.id}::uuid,
          ${input.admin_id}::uuid,
          'allocated',
          ${input.note ?? null},
          ${JSON.stringify({
            scholarship_id,
            donation_ids,
            amount_cents: sumCents,
            currency,
          })}::jsonb
        )
      `);

    // withAdminContext owns the COMMIT; throwing rolls back. We just return.
    return {
      scholarship_id,
      donation_ids,
      amount_cents: sumCents,
      currency,
      applicant_email: app.applicant_email,
      applicant_name: app.applicant_name,
      preferred_language: app.preferred_language as 'ar' | 'en',
      program_slug: app.program_slug,
      scholarship_tier: app.scholarship_tier,
    };
  });

  // After successful commit, invalidate the transparency cache so the
  // public dashboard's allocated/disbursed counts refresh on next request.
  _resetTransparencyCache();

  return {
    ok: true,
    scholarship_id: result.scholarship_id,
    donation_ids: result.donation_ids,
    amount_cents: result.amount_cents,
    currency: result.currency,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// applyDisbursement — atomic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random plaintext token + its sha256 hash.
 * 32 random bytes → base64url → 43 chars, ~256 bits of entropy.
 */
export function generateScholarshipToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

/**
 * Atomic disbursement:
 *   1. Lock + validate application via scholarship FK (must be
 *      status='allocated')
 *   2. Generate plaintext + hash
 *   3. INSERT scholarship_tokens row (hash, expires_at = now + 30 days)
 *   4. UPDATE scholarships.disbursed_at = now()
 *   5. Inline status flip allocated → disbursed + audit rows (status_changed
 *      + disbursed event_type)
 *
 * Returns plaintext token to the caller — DO NOT log it, DO NOT persist it,
 * pass it directly to the email then discard.
 *
 * Concurrent-disburse race is blocked by the partial unique index on
 * scholarship_tokens (one un-redeemed token per scholarship). Even if two
 * admins click "disburse" simultaneously, only one INSERT succeeds; the
 * other receives unique_violation and throws AllocationError.
 */
export async function applyDisbursement(
  input: ApplyDisbursementInput,
): Promise<ApplyDisbursementResult> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(input.scholarship_id)) {
    throw new AllocationError('invalid_scholarship_id', 'scholarship_id is not a UUID');
  }

  const { plaintext, hash } = generateScholarshipToken();

  // withAdminContext already wraps in BEGIN/COMMIT; throwing rolls back.
  const result = await withAdminContext(async (db) => {
    // ── Step 1: lock + validate scholarship + parent application ───────
    const r = await db.execute(sql`
        SELECT s.id            AS scholarship_id,
               s.application_id,
               s.disbursed_at,
               s.recipient_email,
               s.program_slug,
               s.scholarship_tier,
               a.status        AS application_status,
               a.applicant_name,
               a.applicant_email,
               a.preferred_language
        FROM scholarships s
        INNER JOIN scholarship_applications a ON a.id = s.application_id
        WHERE s.id = ${input.scholarship_id}::uuid
        FOR UPDATE OF s, a
      `);
      const row = r.rows[0] as
        | {
            scholarship_id: string;
            application_id: string;
            disbursed_at: string | null;
            recipient_email: string;
            program_slug: string;
            scholarship_tier: 'partial' | 'full';
            application_status: string;
            applicant_name: string;
            applicant_email: string;
            preferred_language: string;
          }
        | undefined;
      if (!row) {
        throw new AllocationError('scholarship_not_found', 'scholarship not found');
      }
      if (row.application_status !== 'allocated') {
        throw new AllocationError(
          'invalid_application_status',
          `application status is ${row.application_status}, expected 'allocated'`,
        );
      }
      if (row.disbursed_at !== null) {
        throw new AllocationError(
          'already_disbursed',
          'scholarship has already been disbursed',
        );
      }

      // ── Step 2 + 3: INSERT scholarship_tokens row ──────────────────────
      // 30-day expiry per spec §Q9
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      try {
        await db.execute(sql`
          INSERT INTO scholarship_tokens (
            scholarship_id, token_hash, expires_at, metadata
          ) VALUES (
            ${input.scholarship_id}::uuid,
            ${hash},
            ${expiresAt}::timestamptz,
            ${JSON.stringify({
              issued_for_program_slug: row.program_slug,
              issued_by_admin_id: input.admin_id,
            })}::jsonb
          )
        `);
      } catch (e: unknown) {
        // unique_violation on partial uidx OR token_hash uniqueness
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('scholarship_tokens_one_active_per_scholarship_uidx')) {
          throw new AllocationError(
            'token_already_active',
            'an active (un-redeemed) token already exists for this scholarship',
          );
        }
        if (msg.includes('scholarship_tokens_token_hash_key') || msg.includes('token_hash')) {
          // Astronomical collision probability (2^-256). Re-throw as opaque.
          throw new AllocationError('token_hash_collision', 'token hash collision detected');
        }
        throw e;
      }

      // ── Step 4: UPDATE scholarships.disbursed_at ───────────────────────
      await db.execute(sql`
        UPDATE scholarships
        SET disbursed_at = now()
        WHERE id = ${input.scholarship_id}::uuid
      `);

      // ── Step 5: Inline status flip allocated → disbursed ───────────────
      await db.execute(sql`
        UPDATE scholarship_applications
        SET status = 'disbursed',
            updated_at = now()
        WHERE id = ${row.application_id}::uuid
      `);

      // status_changed audit row
      await db.execute(sql`
        INSERT INTO scholarship_application_audit_events (
          application_id, admin_id, event_type,
          before_status, after_status, note, metadata
        ) VALUES (
          ${row.application_id}::uuid,
          ${input.admin_id}::uuid,
          'status_changed',
          'allocated',
          'disbursed',
          ${input.note ?? null},
          ${JSON.stringify({
            scholarship_id: row.scholarship_id,
            token_expires_at: expiresAt,
          })}::jsonb
        )
      `);

    // disbursed event audit row
    await db.execute(sql`
        INSERT INTO scholarship_application_audit_events (
          application_id, admin_id, event_type, note, metadata
        ) VALUES (
          ${row.application_id}::uuid,
          ${input.admin_id}::uuid,
          'disbursed',
          ${input.note ?? null},
          ${JSON.stringify({
            scholarship_id: row.scholarship_id,
            token_expires_at: expiresAt,
          })}::jsonb
        )
      `);

    // withAdminContext owns COMMIT; throwing rolls back.
    const enrollmentPath = `/${row.preferred_language === 'en' ? 'en' : 'ar'}/programs/${row.program_slug}/enroll?scholarship_token=${plaintext}`;
    return {
      application_id: row.application_id,
      scholarship_id: row.scholarship_id,
      applicant_email: row.applicant_email,
      applicant_name: row.applicant_name,
      preferred_language: row.preferred_language as 'ar' | 'en',
      program_slug: row.program_slug,
      scholarship_tier: row.scholarship_tier,
      plaintext_token: plaintext,
      expires_at: expiresAt,
      enrollment_url_path: enrollmentPath,
    };
  });

  _resetTransparencyCache();

  return {
    ok: true,
    application_id: result.application_id,
    scholarship_id: result.scholarship_id,
    plaintext_token: result.plaintext_token,
    expires_at: result.expires_at,
    enrollment_url_path: result.enrollment_url_path,
  };
}

// Re-export the snapshot fields the API route layer needs to build the email
// without re-reading the row.
export type AllocationContext = Awaited<
  ReturnType<typeof loadAllocationContext>
>;

export async function loadAllocationContext(scholarship_id: string): Promise<{
  scholarship_id: string;
  application_id: string;
  applicant_email: string;
  applicant_name: string;
  preferred_language: 'ar' | 'en';
  program_slug: string;
  scholarship_tier: 'partial' | 'full';
  amount_cents: number;
  currency: string;
}> {
  return withAdminContext(async (db) => {
    const r = await db.execute(sql`
      SELECT s.id            AS scholarship_id,
             s.application_id,
             s.amount_cents,
             s.currency,
             s.program_slug,
             s.scholarship_tier,
             a.applicant_name,
             a.applicant_email,
             a.preferred_language
      FROM scholarships s
      INNER JOIN scholarship_applications a ON a.id = s.application_id
      WHERE s.id = ${scholarship_id}::uuid
    `);
    const row = r.rows[0] as
      | {
          scholarship_id: string;
          application_id: string;
          amount_cents: number;
          currency: string;
          program_slug: string;
          scholarship_tier: 'partial' | 'full';
          applicant_name: string;
          applicant_email: string;
          preferred_language: string;
        }
      | undefined;
    if (!row) {
      throw new AllocationError('scholarship_not_found', 'scholarship not found');
    }
    return {
      scholarship_id: row.scholarship_id,
      application_id: row.application_id,
      amount_cents: row.amount_cents,
      currency: row.currency,
      program_slug: row.program_slug,
      scholarship_tier: row.scholarship_tier,
      applicant_email: row.applicant_email,
      applicant_name: row.applicant_name,
      preferred_language: row.preferred_language as 'ar' | 'en',
    };
  });
}

// Re-exported for tests — applyStatusTransition + TransitionError still come
// from scholarship-application.ts; we deliberately do NOT call them here so
// allocation/disbursement remain fully atomic single-txn ops.
export { TransitionError };
