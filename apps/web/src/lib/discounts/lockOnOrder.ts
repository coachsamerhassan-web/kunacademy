/**
 * Wave F.5 — coupon → order linking helper.
 *
 * Used by the checkout-completion path (webhook handler when payment succeeds,
 * OR the order-create handler) to atomically:
 *   1. Re-evaluate the coupon against the (server-authoritative) order
 *   2. Insert a coupon_redemptions row inside the same DB transaction
 *      as the order creation
 *   3. Bump coupons.redemptions_used (with a CHECK that prevents over-redemption)
 *
 * Idempotency: pass a stable `idempotency_key` (e.g. webhook event_id +
 * order_id). If a redemption row already exists for (coupon_id, order_id),
 * the helper is a no-op.
 *
 * Race conditions:
 *   - Single-use-per-customer: enforced by the partial unique index on
 *     (coupon_id, customer_id) — concurrent inserts deterministically lose.
 *   - Max-redemptions: enforced by the CHECK
 *     `redemptions_used <= redemptions_max` on the UPDATE statement plus a
 *     row-level lock taken via `SELECT ... FOR UPDATE` on the coupon row.
 *     Two concurrent winners cannot both increment past the cap.
 */

import { sql } from 'drizzle-orm';
import type { Currency } from './types';

export type LockResult =
  | { kind: 'locked'; redemption_id: string }
  | { kind: 'already_locked'; redemption_id: string }            // idempotent re-call
  | { kind: 'rejected'; reason: 'exhausted' | 'already_used' | 'invalid_or_inactive' };

/**
 * Lock a coupon redemption onto an order. MUST be called inside withAdminContext.
 *
 * @param adminDb  drizzle instance from withAdminContext
 * @param input    coupon + customer + order + amount applied
 */
export async function lockCouponOnOrder(
  adminDb: any,
  input: {
    coupon_id: string;
    customer_id: string;
    order_id: string;
    amount_applied_cents: number;
    currency: Currency;
  },
): Promise<LockResult> {
  // 1. Idempotent short-circuit — if a redemption already exists for
  //    (coupon_id, order_id), return success without writing.
  const existingRows = await adminDb.execute(sql`
    SELECT id FROM coupon_redemptions
    WHERE coupon_id = ${input.coupon_id}::uuid
      AND order_id  = ${input.order_id}::uuid
    LIMIT 1
  `);
  if (existingRows.rows.length > 0) {
    return {
      kind: 'already_locked',
      redemption_id: (existingRows.rows[0] as { id: string }).id,
    };
  }

  // 2. Lock the coupon row + verify it's still valid
  const cpnRows = await adminDb.execute(sql`
    SELECT id, is_active, redemptions_max, redemptions_used,
           single_use_per_customer
    FROM coupons
    WHERE id = ${input.coupon_id}::uuid
    FOR UPDATE
  `);
  const c = cpnRows.rows[0] as
    | {
        id: string;
        is_active: boolean;
        redemptions_max: number | null;
        redemptions_used: number;
        single_use_per_customer: boolean;
      }
    | undefined;

  if (!c || !c.is_active) {
    return { kind: 'rejected', reason: 'invalid_or_inactive' };
  }
  if (typeof c.redemptions_max === 'number' && c.redemptions_used >= c.redemptions_max) {
    return { kind: 'rejected', reason: 'exhausted' };
  }

  // 3. Single-use-per-customer race-safe check: try to insert; partial
  //    unique index will reject duplicate.
  let redemptionId: string;
  try {
    const insertRows = await adminDb.execute(sql`
      INSERT INTO coupon_redemptions (
        coupon_id, customer_id, order_id, amount_applied, currency
      )
      VALUES (
        ${input.coupon_id}::uuid,
        ${input.customer_id}::uuid,
        ${input.order_id}::uuid,
        ${input.amount_applied_cents}::int,
        ${input.currency}
      )
      RETURNING id
    `);
    redemptionId = (insertRows.rows[0] as { id: string }).id;
  } catch (err: any) {
    // Unique violation on (coupon_id, customer_id) — single-use blocked.
    if (err?.code === '23505') {
      return { kind: 'rejected', reason: 'already_used' };
    }
    throw err;
  }

  // 4. Bump redemptions_used. The CHECK constraint
  //    `redemptions_used <= redemptions_max` prevents over-redemption when
  //    two winners race.
  try {
    await adminDb.execute(sql`
      UPDATE coupons
         SET redemptions_used = redemptions_used + 1,
             updated_at = now()
       WHERE id = ${input.coupon_id}::uuid
    `);
  } catch (err: any) {
    if (err?.code === '23514') {
      // CHECK constraint violation — another winner just took the last slot.
      // Roll back the redemption row by deleting it (we're inside a txn).
      await adminDb.execute(sql`
        DELETE FROM coupon_redemptions WHERE id = ${redemptionId}::uuid
      `);
      return { kind: 'rejected', reason: 'exhausted' };
    }
    throw err;
  }

  return { kind: 'locked', redemption_id: redemptionId };
}
