/**
 * Wave F.5 — discount resolver types.
 *
 * Pure-TypeScript domain shapes used by `resolveBestDiscount()` and
 * the `/api/checkout/apply-coupon` route. No DB imports here so the
 * resolver stays unit-testable without a connection.
 */

export type Currency = 'AED' | 'EGP' | 'USD' | 'EUR';

export type CouponType = 'percentage' | 'fixed';

export type CouponScopeKind = 'all' | 'programs' | 'tiers';

export interface CouponSnapshot {
  id: string;
  code: string;
  type: CouponType;
  /** percentage (1..100) or fixed amount in minor units (cents). */
  value: number;
  /** Required when type='fixed'; null/undefined for percentage. */
  currency: Currency | null;
  redemptions_max: number | null;
  redemptions_used: number;
  valid_from: string | null;
  valid_to: string | null;
  single_use_per_customer: boolean;
  scope_kind: CouponScopeKind;
  scope_program_ids: string[];
  scope_tier_ids: string[];
  /** F-W4 escape hatch — bypasses programs.member_discount_eligible filter. */
  admin_override: boolean;
  is_active: boolean;
}

export interface CartLine {
  /** programs.id (preferred) — used for scope/eligibility checks. */
  program_id: string | null;
  /** programs.slug — for diagnostics + program-level overrides. */
  program_slug: string | null;
  /** Whether this line is eligible for member-tier discounts (programs.member_discount_eligible). */
  member_discount_eligible: boolean;
  /** Programs may carry a coach_tier (associate / professional / master / expert / samer). */
  coach_tier: string | null;
  /** Per-line list price in minor units (the customer-facing price). */
  list_price_cents: number;
  /** Currency of this line. All lines in a cart MUST share currency. */
  currency: Currency;
  /** Optional: how many of this line are in the cart (default 1). */
  quantity?: number;
}

export interface Cart {
  /** Identifier (a draft order id, a session id, or any opaque pointer). */
  cart_id: string;
  customer_id: string;
  currency: Currency;
  lines: CartLine[];
}

export interface MemberContext {
  /** True iff customer holds an active Paid-1 (Associate) membership. */
  is_paid1_active: boolean;
  /** Auto-discount percentage from tier_features.config (default 10). */
  member_discount_pct: number;
}

export type DiscountReason =
  | 'invalid'
  | 'expired'
  | 'not_yet_valid'
  | 'inactive'
  | 'exhausted'
  | 'already_used'
  | 'wrong_currency'
  | 'ineligible_program'
  | 'scope_mismatch';

export interface ResolvedDiscountWinner {
  kind: 'member' | 'coupon' | 'none';
  /** Total reduction applied across the cart, in minor units. 0 when kind='none'. */
  amount_cents: number;
  currency: Currency;
  /** When kind='coupon' — the coupon row id; when kind='member' — the membership id; else null. */
  source_id: string | null;
  /** Per-line breakdown of how much each line contributed (for invoice line application). */
  per_line: Array<{
    program_id: string | null;
    program_slug: string | null;
    discount_cents: number;
  }>;
}

export interface CouponEvaluation {
  /** True iff the coupon could legitimately apply to at least one cart line. */
  applies: boolean;
  /** When !applies — why? */
  reason?: DiscountReason;
  /** Total reduction in minor units (when applies). */
  amount_cents: number;
  per_line: ResolvedDiscountWinner['per_line'];
}
