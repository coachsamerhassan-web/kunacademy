import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './profiles';
import { scholarships } from './scholarships';

/**
 * Wave E.6 — Scholarship Fund: single-use redemption tokens
 *
 * Generated when admin marks a scholarship as 'disbursed'. Sent in plaintext
 * (one time only) via the disbursement email; only sha256 hash stored here.
 *
 * Per spec §Q9: NOT a coupon (different surface; tokens are
 * scholarship-specific, single-use, expire on enrollment OR after 30 days).
 *
 * Redemption flow:
 *   1. Recipient receives email with plaintext token + enrollment URL
 *      `/[locale]/programs/[slug]/enroll?scholarship_token=<TOKEN>`
 *   2. At checkout, the route calls validateAndRedeemToken(token, slug, userId)
 *      which sha256-hashes plaintext, looks up by hash, validates expiry +
 *      un-redeemed status + matching program_slug.
 *   3. On valid hit, returns full_price_offset; on redeem, UPDATEs
 *      redeemed_at + redeemed_by_user_id + scholarships.program_enrollment_id.
 *
 * RLS:
 *   - scholarship_tokens_admin_all          — is_admin() full access
 *   - scholarship_tokens_server_insert      — kunacademy can INSERT
 *   - scholarship_tokens_server_select      — kunacademy can SELECT (for hash lookup)
 *   - scholarship_tokens_server_redeem_update — kunacademy can UPDATE
 *     (redeemed_at, redeemed_by_user_id only via column-grant)
 *
 * UPDATE column-grant: only `redeemed_at` and `redeemed_by_user_id` are
 * mutable from kunacademy role; everything else immutable post-INSERT.
 *
 * DELETE blocked from both kunacademy + kunacademy_admin — emergency repair
 * requires SUPERUSER.
 *
 * Partial unique index: at most ONE un-redeemed token per scholarship at any
 * time (prevents accidental double-issue race).
 *
 * See migration 0064_wave_e6_scholarship_tokens.sql for DDL + CHECK
 * constraints + REVOKE statements.
 */
export const scholarship_tokens = pgTable(
  'scholarship_tokens',
  {
    id:                  uuid('id').primaryKey().defaultRandom(),
    scholarship_id:      uuid('scholarship_id')
                           .notNull()
                           .references(() => scholarships.id, { onDelete: 'cascade' }),

    /** SHA-256(plaintext) hex; plaintext NEVER stored. */
    token_hash:          text('token_hash').notNull().unique(),

    expires_at:          timestamp('expires_at', { withTimezone: true, mode: 'string' })
                           .notNull(),
    redeemed_at:         timestamp('redeemed_at', { withTimezone: true, mode: 'string' }),
    redeemed_by_user_id: uuid('redeemed_by_user_id')
                           .references(() => profiles.id, { onDelete: 'set null' }),

    created_at:          timestamp('created_at', { withTimezone: true, mode: 'string' })
                           .notNull()
                           .defaultNow(),
    metadata:            jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    scholarshipIdx: index('scholarship_tokens_scholarship_idx').on(
      t.scholarship_id,
      t.created_at,
    ),
    activeIdx: index('scholarship_tokens_active_idx')
      .on(t.expires_at)
      .where(sql`${t.redeemed_at} IS NULL`),
    oneActiveUidx: uniqueIndex('scholarship_tokens_one_active_per_scholarship_uidx')
      .on(t.scholarship_id)
      .where(sql`${t.redeemed_at} IS NULL`),
  }),
);

export type ScholarshipToken = typeof scholarship_tokens.$inferSelect;
export type NewScholarshipToken = typeof scholarship_tokens.$inferInsert;
