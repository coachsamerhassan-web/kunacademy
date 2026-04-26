/**
 * Scholarship Fund — token redemption hook for standard checkout flow.
 *
 * Wave E.6 (2026-04-26).
 *
 * Per spec §Q9 — disbursement does NOT auto-create an order. Instead, a
 * single-use plaintext token is sent to the recipient via email. At checkout,
 * the recipient passes `?scholarship_token=<token>` and this lib validates it.
 *
 * Two entry points:
 *
 *   1. validateScholarshipToken(plaintext, programSlug)
 *      - Read-only check. Hashes plaintext, looks up by hash, validates
 *        expiry + un-redeemed status + program-slug match.
 *      - Returns { valid: true, scholarship_id, full_price_offset_cents,
 *                  currency } OR { valid: false, reason }
 *      - Used at checkout-load to compute the offset BEFORE collecting payment.
 *      - Does NOT mutate; safe to call repeatedly.
 *
 *   2. redeemScholarshipToken(plaintext, programSlug, userId, enrollmentId?)
 *      - Atomic write that marks redeemed_at + redeemed_by_user_id, AND
 *        optionally fills scholarships.program_enrollment_id post-checkout.
 *      - Re-validates inside the txn (defense against TOCTOU).
 *      - On success returns the same payload as validate().
 *      - On failure (race, expired-between-validate-and-redeem) returns
 *        { valid: false, reason }.
 *
 * Failure reasons:
 *   - 'invalid'       — hash not found
 *   - 'expired'       — expires_at < now()
 *   - 'redeemed'      — redeemed_at IS NOT NULL
 *   - 'wrong_program' — token issued for a different program slug
 *
 * Plaintext is NEVER stored (only hash). Plaintext is provided only by the
 * recipient at checkout via the URL param or form field.
 */

import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { withAdminContext } from '@kunacademy/db';
import { _resetTransparencyCache } from './scholarship-transparency';

export type RedemptionFailureReason =
  | 'invalid'
  | 'expired'
  | 'redeemed'
  | 'wrong_program'
  | 'token_format';

export interface ValidatedScholarshipToken {
  valid: true;
  scholarship_id: string;
  application_id: string;
  recipient_email: string;
  program_slug: string;
  full_price_offset_cents: number;
  currency: string;
  scholarship_tier: 'partial' | 'full';
  expires_at: string;
}

export interface InvalidScholarshipToken {
  valid: false;
  reason: RedemptionFailureReason;
}

export type ValidateResult = ValidatedScholarshipToken | InvalidScholarshipToken;

/**
 * Plaintext token format: 32 random bytes → base64url → 43 chars.
 * Reject anything outside that shape early so we don't run a hash + DB
 * lookup on obviously-malformed input.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

function hashTokenPlaintext(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Read-only validation. Used by the checkout route to compute the offset
 * BEFORE creating the payment intent. Does NOT mutate.
 */
export async function validateScholarshipToken(
  plaintext: string,
  programSlug: string,
): Promise<ValidateResult> {
  if (typeof plaintext !== 'string' || !TOKEN_RE.test(plaintext)) {
    return { valid: false, reason: 'token_format' };
  }
  const hash = hashTokenPlaintext(plaintext);
  return withAdminContext(async (db) => {
    const r = await db.execute(sql`
      SELECT
        t.id              AS token_id,
        t.scholarship_id,
        t.expires_at,
        t.redeemed_at,
        s.application_id,
        s.recipient_email,
        s.program_slug,
        s.amount_cents    AS full_price_offset_cents,
        s.currency,
        s.scholarship_tier
      FROM scholarship_tokens t
      INNER JOIN scholarships s ON s.id = t.scholarship_id
      WHERE t.token_hash = ${hash}
      LIMIT 1
    `);
    const row = r.rows[0] as
      | {
          token_id: string;
          scholarship_id: string;
          expires_at: string;
          redeemed_at: string | null;
          application_id: string;
          recipient_email: string;
          program_slug: string;
          full_price_offset_cents: number;
          currency: string;
          scholarship_tier: 'partial' | 'full';
        }
      | undefined;
    if (!row) return { valid: false, reason: 'invalid' };

    if (row.redeemed_at !== null) {
      return { valid: false, reason: 'redeemed' };
    }
    const expiresAtMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      return { valid: false, reason: 'expired' };
    }
    if (row.program_slug !== programSlug) {
      return { valid: false, reason: 'wrong_program' };
    }

    return {
      valid: true,
      scholarship_id: row.scholarship_id,
      application_id: row.application_id,
      recipient_email: row.recipient_email,
      program_slug: row.program_slug,
      full_price_offset_cents: row.full_price_offset_cents,
      currency: row.currency,
      scholarship_tier: row.scholarship_tier,
      expires_at: row.expires_at,
    };
  });
}

/**
 * Atomic redemption. Re-validates inside the txn, then UPDATEs
 * scholarship_tokens.redeemed_at + redeemed_by_user_id, and optionally
 * scholarships.program_enrollment_id when an enrollment row already exists.
 *
 * Caller pattern (recommended): redeem POST-checkout-success once enrollment
 * row is created. If checkout fails, do NOT redeem (token stays valid for
 * the recipient's next attempt).
 *
 * If you must redeem PRE-enrollment-row (e.g., to lock the offset for the
 * payment intent), pass enrollmentId=null. The reconcile pattern (later
 * UPDATE scholarships.program_enrollment_id when enrollment is created) is
 * out of scope for this lib — a Stripe webhook fixup is a possible v2.
 */
export async function redeemScholarshipToken(args: {
  plaintext: string;
  programSlug: string;
  userId: string;
  enrollmentId?: string | null;
}): Promise<ValidateResult> {
  const { plaintext, programSlug, userId } = args;
  const enrollmentId = args.enrollmentId ?? null;

  if (typeof plaintext !== 'string' || !TOKEN_RE.test(plaintext)) {
    return { valid: false, reason: 'token_format' };
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    return { valid: false, reason: 'invalid' };
  }
  if (enrollmentId !== null && !UUID_RE.test(enrollmentId)) {
    return { valid: false, reason: 'invalid' };
  }
  const hash = hashTokenPlaintext(plaintext);

  // withAdminContext already wraps in BEGIN/COMMIT; throwing rolls back.
  const result: ValidateResult = await withAdminContext(async (db) => {
    // FOR UPDATE to lock the row against a parallel redeem.
    const r = await db.execute(sql`
        SELECT
          t.id              AS token_id,
          t.scholarship_id,
          t.expires_at,
          t.redeemed_at,
          s.application_id,
          s.recipient_email,
          s.program_slug,
          s.amount_cents    AS full_price_offset_cents,
          s.currency,
          s.scholarship_tier
        FROM scholarship_tokens t
        INNER JOIN scholarships s ON s.id = t.scholarship_id
        WHERE t.token_hash = ${hash}
        FOR UPDATE OF t
      `);
      const row = r.rows[0] as
        | {
            token_id: string;
            scholarship_id: string;
            expires_at: string;
            redeemed_at: string | null;
            application_id: string;
            recipient_email: string;
            program_slug: string;
            full_price_offset_cents: number;
            currency: string;
            scholarship_tier: 'partial' | 'full';
          }
        | undefined;
    if (!row) {
      // No writes happened — the read-only TXN closes cleanly.
      return { valid: false, reason: 'invalid' as const };
    }
    if (row.redeemed_at !== null) {
      return { valid: false, reason: 'redeemed' as const };
    }
    const expiresAtMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      return { valid: false, reason: 'expired' as const };
    }
    if (row.program_slug !== programSlug) {
      return { valid: false, reason: 'wrong_program' as const };
    }

    // Redeem.
    await db.execute(sql`
        UPDATE scholarship_tokens
        SET redeemed_at = now(),
            redeemed_by_user_id = ${userId}::uuid
        WHERE id = ${row.token_id}::uuid
      `);

    // Optionally bind the enrollment FK on scholarships row.
    if (enrollmentId !== null) {
      await db.execute(sql`
          UPDATE scholarships
          SET program_enrollment_id = ${enrollmentId}::uuid
          WHERE id = ${row.scholarship_id}::uuid
        `);
    }

    return {
      valid: true as const,
      scholarship_id: row.scholarship_id,
      application_id: row.application_id,
      recipient_email: row.recipient_email,
      program_slug: row.program_slug,
      full_price_offset_cents: row.full_price_offset_cents,
      currency: row.currency,
      scholarship_tier: row.scholarship_tier,
      expires_at: row.expires_at,
    };
  });

  if (result.valid) _resetTransparencyCache();
  return result;
}
