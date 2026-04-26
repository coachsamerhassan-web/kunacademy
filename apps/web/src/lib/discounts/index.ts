/**
 * Wave F.5 — discount resolver public surface.
 */
export type {
  Cart,
  CartLine,
  CouponEvaluation,
  CouponScopeKind,
  CouponSnapshot,
  CouponType,
  Currency,
  DiscountReason,
  MemberContext,
  ResolvedDiscountWinner,
} from './types';

export {
  REASON_TO_HTTP,
  evaluateCoupon,
  resolveBestDiscount,
} from './resolveBestDiscount';

export { lockCouponOnOrder, type LockResult } from './lockOnOrder';
