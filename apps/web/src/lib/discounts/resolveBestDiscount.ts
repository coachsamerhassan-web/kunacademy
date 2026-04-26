/**
 * Wave F.5 — single-discount-wins resolver.
 *
 * F-W3 (locked 2026-04-24): if member discount + coupon both apply, pick the
 *                            one that yields the LARGER absolute reduction
 *                            (in cart currency). Ties: prefer 'member' — it
 *                            avoids burning a coupon redemption when the
 *                            customer would have received the same value
 *                            from the auto-discount anyway. (DeepSeek QA
 *                            2026-04-26.)
 * F-W4 (locked 2026-04-24): STFC + entrepreneurs-6hr never receive member
 *                            discount NOR member-tier coupons. They CAN accept
 *                            admin-issued one-off coupons with admin_override.
 *                            The eligibility flag we read is
 *                            `programs.member_discount_eligible`. Per
 *                            PROGRAM-CANON v3.1 + migration 0058 drift fix,
 *                            STFC + gps-entrepreneurs are FALSE; everything
 *                            else flagged in canon is TRUE.
 *
 * Pure function: takes snapshots, returns the winning discount with a
 * per-line breakdown. No DB, no async, no I/O. Deterministic.
 */

import type {
  Cart,
  CartLine,
  CouponEvaluation,
  CouponSnapshot,
  Currency,
  DiscountReason,
  MemberContext,
  ResolvedDiscountWinner,
} from './types';

// ─── Public API ──────────────────────────────────────────────────────────────

export function resolveBestDiscount(
  cart: Cart,
  member: MemberContext,
  coupon: CouponSnapshot | null,
  opts?: {
    /** When the customer has already redeemed this coupon (single-use enforcement). */
    customer_already_redeemed?: boolean;
    /** "now" for deterministic tests. Defaults to Date.now(). */
    nowMs?: number;
  },
): ResolvedDiscountWinner {
  // 1. Compute the member-tier auto-discount (10% by default on eligible lines).
  const memberOption = evaluateMemberDiscount(cart, member);

  // 2. Compute the coupon application (if a coupon was provided).
  const couponOption = coupon
    ? evaluateCoupon(cart, coupon, member, opts ?? {})
    : null;

  // 3. Single-discount-wins: pick the larger amount.
  const memberAmt = memberOption.amount_cents;
  const couponAmt = couponOption?.applies ? couponOption.amount_cents : 0;

  if (couponAmt > memberAmt && couponOption?.applies) {
    return {
      kind: 'coupon',
      amount_cents: couponAmt,
      currency: cart.currency,
      source_id: coupon!.id,
      per_line: couponOption.per_line,
    };
  }

  // Tie or member > coupon → pick member when it has nonzero impact;
  // tie at zero → 'none'.
  if (memberAmt > 0 && memberAmt >= couponAmt) {
    return {
      kind: 'member',
      amount_cents: memberAmt,
      currency: cart.currency,
      source_id: null, // member discount has no row id; the membership itself is implicit
      per_line: memberOption.per_line,
    };
  }

  // Neither applies (or both zero).
  return {
    kind: 'none',
    amount_cents: 0,
    currency: cart.currency,
    source_id: null,
    per_line: cart.lines.map((l) => ({
      program_id: l.program_id,
      program_slug: l.program_slug,
      discount_cents: 0,
    })),
  };
}

// ─── Coupon evaluation (exported for the apply-coupon endpoint) ──────────────

/**
 * Evaluate whether a coupon applies to a cart, and how much it would discount.
 * Returns `applies: true` with amount + per-line breakdown, or `applies: false`
 * with a `reason` code suitable for direct API response.
 */
export function evaluateCoupon(
  cart: Cart,
  coupon: CouponSnapshot,
  member: MemberContext,
  opts: {
    customer_already_redeemed?: boolean;
    nowMs?: number;
  },
): CouponEvaluation {
  const now = opts.nowMs ?? Date.now();

  // 1. Active flag
  if (!coupon.is_active) {
    return { applies: false, reason: 'inactive', amount_cents: 0, per_line: [] };
  }

  // 2. Validity window
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    return { applies: false, reason: 'not_yet_valid', amount_cents: 0, per_line: [] };
  }
  if (coupon.valid_to && new Date(coupon.valid_to).getTime() < now) {
    return { applies: false, reason: 'expired', amount_cents: 0, per_line: [] };
  }

  // 3. Redemption cap
  if (
    typeof coupon.redemptions_max === 'number' &&
    coupon.redemptions_used >= coupon.redemptions_max
  ) {
    return { applies: false, reason: 'exhausted', amount_cents: 0, per_line: [] };
  }

  // 4. Single-use-per-customer
  if (coupon.single_use_per_customer && opts.customer_already_redeemed) {
    return { applies: false, reason: 'already_used', amount_cents: 0, per_line: [] };
  }

  // 5. Currency match (fixed coupons must match cart currency)
  if (coupon.type === 'fixed' && coupon.currency && coupon.currency !== cart.currency) {
    return { applies: false, reason: 'wrong_currency', amount_cents: 0, per_line: [] };
  }

  // 6. Filter cart lines by scope + member-tier eligibility (F-W4).
  const eligibleLines = cart.lines.filter((line) =>
    couponLineEligible(coupon, line, member),
  );

  if (eligibleLines.length === 0) {
    // Distinguish scope vs. ineligible-program for cleaner UX
    const scopeMismatch = !cart.lines.some((l) =>
      passesScopeOnly(coupon, l),
    );
    return {
      applies: false,
      reason: scopeMismatch ? 'scope_mismatch' : 'ineligible_program',
      amount_cents: 0,
      per_line: [],
    };
  }

  // 7. Compute per-line discount.
  const per_line: ResolvedDiscountWinner['per_line'] = cart.lines.map((line) => {
    if (!eligibleLines.includes(line)) {
      return { program_id: line.program_id, program_slug: line.program_slug, discount_cents: 0 };
    }
    const lineSubtotal = lineSubtotalCents(line);
    const discount = computeLineDiscount(coupon, lineSubtotal);
    return {
      program_id: line.program_id,
      program_slug: line.program_slug,
      discount_cents: discount,
    };
  });

  // 8. For fixed coupons, the *total* discount cannot exceed the value (across
  //    all eligible lines). Distribute proportionally if multiple eligible lines.
  if (coupon.type === 'fixed') {
    const eligibleSubtotal = eligibleLines.reduce(
      (sum, line) => sum + lineSubtotalCents(line),
      0,
    );
    // Cap fixed coupon at eligible subtotal (zero-cost-cart guard).
    const cappedFixedTotal = Math.min(coupon.value, eligibleSubtotal);

    // Re-distribute: each eligible line gets a proportional share, rounding
    // the last line to ensure the total matches exactly.
    let remaining = cappedFixedTotal;
    const eligibleCount = eligibleLines.length;
    for (let i = 0; i < per_line.length; i++) {
      const line = cart.lines[i];
      if (!eligibleLines.includes(line)) continue;
      // Identify if this is the last eligible line (so we can absorb rounding).
      const isLastEligible =
        eligibleLines.indexOf(line) === eligibleCount - 1;
      const share = isLastEligible
        ? remaining
        : Math.floor(
            (cappedFixedTotal * lineSubtotalCents(line)) / Math.max(eligibleSubtotal, 1),
          );
      per_line[i] = {
        program_id: line.program_id,
        program_slug: line.program_slug,
        discount_cents: Math.max(0, share),
      };
      remaining -= per_line[i].discount_cents;
    }
  }

  const totalDiscount = per_line.reduce((sum, l) => sum + l.discount_cents, 0);

  if (totalDiscount <= 0) {
    // Edge: coupon resolved to zero (e.g. fixed coupon vs zero-cost cart).
    return { applies: false, reason: 'ineligible_program', amount_cents: 0, per_line: [] };
  }

  return { applies: true, amount_cents: totalDiscount, per_line };
}

// ─── Member-tier auto-discount evaluation ────────────────────────────────────

function evaluateMemberDiscount(
  cart: Cart,
  member: MemberContext,
): { amount_cents: number; per_line: ResolvedDiscountWinner['per_line'] } {
  // Only paid-1 members get the auto-discount.
  if (!member.is_paid1_active) {
    return {
      amount_cents: 0,
      per_line: cart.lines.map((l) => ({
        program_id: l.program_id,
        program_slug: l.program_slug,
        discount_cents: 0,
      })),
    };
  }

  // Percentage discount applied per-line. F-W4: only on member_discount_eligible lines.
  const pct = clampPct(member.member_discount_pct);
  const per_line = cart.lines.map((line) => {
    if (!line.member_discount_eligible) {
      return { program_id: line.program_id, program_slug: line.program_slug, discount_cents: 0 };
    }
    const subtotal = lineSubtotalCents(line);
    const discount = Math.floor((subtotal * pct) / 100);
    return {
      program_id: line.program_id,
      program_slug: line.program_slug,
      discount_cents: discount,
    };
  });
  const total = per_line.reduce((s, l) => s + l.discount_cents, 0);
  return { amount_cents: total, per_line };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function lineSubtotalCents(line: CartLine): number {
  const qty = Math.max(1, line.quantity ?? 1);
  return Math.max(0, line.list_price_cents) * qty;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function computeLineDiscount(coupon: CouponSnapshot, lineSubtotalCentsValue: number): number {
  if (coupon.type === 'percentage') {
    const pct = clampPct(coupon.value);
    return Math.floor((lineSubtotalCentsValue * pct) / 100);
  }
  // For 'fixed', the redistribution happens upstream; per-line we tentatively
  // give the line the full value (will be capped by the proportional split).
  return Math.min(coupon.value, lineSubtotalCentsValue);
}

/** Scope check only — used to distinguish scope_mismatch vs. ineligible_program. */
function passesScopeOnly(coupon: CouponSnapshot, line: CartLine): boolean {
  if (coupon.scope_kind === 'all') return true;
  if (coupon.scope_kind === 'programs') {
    if (!line.program_id) return false;
    return coupon.scope_program_ids.includes(line.program_id);
  }
  if (coupon.scope_kind === 'tiers') {
    if (!line.coach_tier) return false;
    // scope_tier_ids holds tier UUIDs; line.coach_tier is a slug.
    // We don't have tier->slug mapping here; the apply-coupon endpoint passes
    // already-resolved program lines so the tier filter is honored at the
    // SQL layer (program.coach_tier joined to tier slug). Pure resolver
    // matches by tier slug against scope_tier_ids treated as opaque strings.
    // The caller MUST pre-translate tier UUIDs → slugs OR pass coach_tier as
    // the tier UUID. We honor whichever convention is passed.
    return coupon.scope_tier_ids.some((id) => id === line.coach_tier);
  }
  return false;
}

/**
 * Full eligibility check: scope + F-W4 program eligibility.
 * F-W4 flow:
 *   - When admin_override = false and the line is NOT member_discount_eligible:
 *     reject (F-W4 enforcement).
 *   - When admin_override = true: scope alone decides (admin can offer
 *     promotional coupons against STFC / entrepreneurs intentionally).
 */
function couponLineEligible(
  coupon: CouponSnapshot,
  line: CartLine,
  _member: MemberContext,
): boolean {
  if (!passesScopeOnly(coupon, line)) return false;
  if (!coupon.admin_override && !line.member_discount_eligible) return false;
  return true;
}

// ─── Public mapping for API error responses ─────────────────────────────────

export const REASON_TO_HTTP: Record<DiscountReason, { status: number; code: string }> = {
  invalid:             { status: 400, code: 'invalid' },
  inactive:            { status: 400, code: 'invalid' },
  not_yet_valid:       { status: 400, code: 'not_yet_valid' },
  expired:             { status: 400, code: 'expired' },
  exhausted:           { status: 400, code: 'exhausted' },
  already_used:        { status: 400, code: 'already_used' },
  wrong_currency:      { status: 400, code: 'wrong_currency' },
  ineligible_program:  { status: 400, code: 'ineligible_program' },
  scope_mismatch:      { status: 400, code: 'ineligible_program' },
};
