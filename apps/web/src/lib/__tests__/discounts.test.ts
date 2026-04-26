/**
 * Wave F.5 — discount resolver unit tests.
 *
 * Run:
 *   cd apps/web
 *   node --import tsx --test src/lib/__tests__/discounts.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCoupon,
  resolveBestDiscount,
  type Cart,
  type CartLine,
  type CouponSnapshot,
  type MemberContext,
} from '../discounts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROGRAM_GPS = 'a0000000-0000-0000-0000-000000000001';
const PROGRAM_STFC = 'a0000000-0000-0000-0000-000000000002';
const PROGRAM_ENTREPRENEURS = 'a0000000-0000-0000-0000-000000000003';

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    program_id: PROGRAM_GPS,
    program_slug: 'gps-of-life',
    member_discount_eligible: true,
    coach_tier: null,
    list_price_cents: 100_000,         // 1,000.00 AED
    currency: 'AED',
    quantity: 1,
    ...over,
  };
}

function cart(lines: CartLine[] = [line()]): Cart {
  return {
    cart_id: 'cart-1',
    customer_id: 'cust-1',
    currency: 'AED',
    lines,
  };
}

function memberPaid1(pct = 10): MemberContext {
  return { is_paid1_active: true, member_discount_pct: pct };
}
function memberFree(): MemberContext {
  return { is_paid1_active: false, member_discount_pct: 10 };
}

function coupon(over: Partial<CouponSnapshot> = {}): CouponSnapshot {
  return {
    id: 'cpn-1',
    code: 'WELCOME20',
    type: 'percentage',
    value: 20,
    currency: null,
    redemptions_max: null,
    redemptions_used: 0,
    valid_from: null,
    valid_to: null,
    single_use_per_customer: false,
    scope_kind: 'all',
    scope_program_ids: [],
    scope_tier_ids: [],
    admin_override: false,
    is_active: true,
    ...over,
  };
}

// ─── F-W3 single-discount-wins ───────────────────────────────────────────────

describe('F-W3 single-discount-wins', () => {
  test('member 10% beats 5% coupon — picks member', () => {
    const r = resolveBestDiscount(
      cart([line({ list_price_cents: 100_000 })]),
      memberPaid1(10),
      coupon({ value: 5 }),
    );
    assert.equal(r.kind, 'member');
    assert.equal(r.amount_cents, 10_000); // 10% of 100,000
  });

  test('coupon 20% beats member 10% — picks coupon', () => {
    const r = resolveBestDiscount(
      cart([line({ list_price_cents: 100_000 })]),
      memberPaid1(10),
      coupon({ value: 20 }),
    );
    assert.equal(r.kind, 'coupon');
    assert.equal(r.amount_cents, 20_000);
    assert.equal(r.source_id, 'cpn-1');
  });

  test('no member + no coupon → none', () => {
    const r = resolveBestDiscount(cart(), memberFree(), null);
    assert.equal(r.kind, 'none');
    assert.equal(r.amount_cents, 0);
  });

  test('exact tie at non-zero → member wins (more deterministic + no coupon redemption needed)', () => {
    // coupon 10% vs member 10%: both 10,000 — member chosen (avoids unnecessary coupon redemption row).
    const r = resolveBestDiscount(
      cart([line({ list_price_cents: 100_000 })]),
      memberPaid1(10),
      coupon({ value: 10 }),
    );
    assert.equal(r.kind, 'member');
    assert.equal(r.amount_cents, 10_000);
  });

  test('coupon does not stack with member discount on the same cart', () => {
    // Both apply at separate amounts; the resolver only picks one.
    const r = resolveBestDiscount(
      cart([line({ list_price_cents: 200_000 })]),
      memberPaid1(10),
      coupon({ value: 25 }),
    );
    assert.equal(r.kind, 'coupon');
    assert.equal(r.amount_cents, 50_000); // 25% of 200,000
    // Member alone would be 20,000; coupon alone is 50,000; no combination of 70,000.
  });
});

// ─── F-W4 ineligible programs ────────────────────────────────────────────────

describe('F-W4 STFC + entrepreneurs ineligible by default', () => {
  test('STFC line + member → no auto discount on STFC', () => {
    const r = resolveBestDiscount(
      cart([
        line({
          program_id: PROGRAM_STFC,
          program_slug: 'stce-level-5-stfc',
          member_discount_eligible: false,
          list_price_cents: 100_000,
        }),
      ]),
      memberPaid1(10),
      null,
    );
    assert.equal(r.kind, 'none');
    assert.equal(r.amount_cents, 0);
  });

  test('STFC line + non-override coupon → ineligible_program', () => {
    const ev = evaluateCoupon(
      cart([
        line({
          program_id: PROGRAM_STFC,
          program_slug: 'stce-level-5-stfc',
          member_discount_eligible: false,
          list_price_cents: 100_000,
        }),
      ]),
      coupon(),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'ineligible_program');
  });

  test('STFC line + admin_override coupon → applies (escape hatch)', () => {
    const ev = evaluateCoupon(
      cart([
        line({
          program_id: PROGRAM_STFC,
          program_slug: 'stce-level-5-stfc',
          member_discount_eligible: false,
          list_price_cents: 100_000,
        }),
      ]),
      coupon({ admin_override: true, value: 15 }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, true);
    assert.equal(ev.amount_cents, 15_000);
  });

  test('mixed cart: GPS gets member discount, STFC excluded', () => {
    const r = resolveBestDiscount(
      cart([
        line({ program_id: PROGRAM_GPS, list_price_cents: 100_000, member_discount_eligible: true }),
        line({
          program_id: PROGRAM_STFC,
          program_slug: 'stce-level-5-stfc',
          list_price_cents: 200_000,
          member_discount_eligible: false,
        }),
      ]),
      memberPaid1(10),
      null,
    );
    assert.equal(r.kind, 'member');
    assert.equal(r.amount_cents, 10_000); // 10% of 100,000 only; STFC not discounted
    const stfcLine = r.per_line.find((l) => l.program_id === PROGRAM_STFC);
    assert.ok(stfcLine);
    assert.equal(stfcLine!.discount_cents, 0);
  });

  test('entrepreneurs-6hr ineligible by canon flag', () => {
    const ev = evaluateCoupon(
      cart([
        line({
          program_id: PROGRAM_ENTREPRENEURS,
          program_slug: 'gps-entrepreneurs',
          member_discount_eligible: false,
          list_price_cents: 500_000,
        }),
      ]),
      coupon(),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'ineligible_program');
  });
});

// ─── Validity checks ─────────────────────────────────────────────────────────

describe('coupon validity gates', () => {
  test('inactive coupon → inactive', () => {
    const ev = evaluateCoupon(cart(), coupon({ is_active: false }), memberPaid1(), {});
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'inactive');
  });

  test('not_yet_valid', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const ev = evaluateCoupon(cart(), coupon({ valid_from: future }), memberPaid1(), {});
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'not_yet_valid');
  });

  test('expired', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const ev = evaluateCoupon(cart(), coupon({ valid_to: past }), memberPaid1(), {});
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'expired');
  });

  test('exhausted (redemptions_max == redemptions_used)', () => {
    const ev = evaluateCoupon(
      cart(),
      coupon({ redemptions_max: 5, redemptions_used: 5 }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'exhausted');
  });

  test('already_used (single_use_per_customer + customer_already_redeemed)', () => {
    const ev = evaluateCoupon(
      cart(),
      coupon({ single_use_per_customer: true }),
      memberPaid1(),
      { customer_already_redeemed: true },
    );
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'already_used');
  });

  test('wrong_currency (fixed AED coupon vs EGP cart)', () => {
    const c: Cart = { ...cart([line({ currency: 'EGP', list_price_cents: 50_000 })]), currency: 'EGP' };
    const ev = evaluateCoupon(
      c,
      coupon({ type: 'fixed', value: 10_000, currency: 'AED' }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'wrong_currency');
  });

  test('scope_mismatch — programs scope, cart program not in list', () => {
    const ev = evaluateCoupon(
      cart([line({ program_id: PROGRAM_GPS })]),
      coupon({ scope_kind: 'programs', scope_program_ids: [PROGRAM_STFC] }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, false);
    assert.equal(ev.reason, 'scope_mismatch');
  });

  test('scope match — programs scope, cart program in list', () => {
    const ev = evaluateCoupon(
      cart([line({ program_id: PROGRAM_GPS })]),
      coupon({
        scope_kind: 'programs',
        scope_program_ids: [PROGRAM_GPS],
        value: 25,
      }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, true);
    assert.equal(ev.amount_cents, 25_000); // 25% of 100,000
  });
});

// ─── Fixed-amount edge cases ─────────────────────────────────────────────────

describe('fixed-amount coupon math', () => {
  test('fixed coupon caps at line subtotal (zero-cost-cart guard)', () => {
    const ev = evaluateCoupon(
      cart([line({ list_price_cents: 5_000 })]), // 50.00 AED
      coupon({ type: 'fixed', value: 10_000, currency: 'AED' }), // 100 AED off
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, true);
    assert.equal(ev.amount_cents, 5_000); // capped at 5,000 (line total)
  });

  test('fixed coupon distributes proportionally across multiple eligible lines', () => {
    const c = cart([
      line({ program_id: PROGRAM_GPS, list_price_cents: 100_000 }),
      line({ program_id: 'a0000000-0000-0000-0000-000000000099', program_slug: 'ihya', list_price_cents: 200_000 }),
    ]);
    const ev = evaluateCoupon(
      c,
      coupon({ type: 'fixed', value: 30_000, currency: 'AED' }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, true);
    assert.equal(ev.amount_cents, 30_000);
    // 30,000 split proportionally: 10,000 to first (1/3 share), 20,000 to second (2/3 share)
    const sumApplied = ev.per_line.reduce((s, l) => s + l.discount_cents, 0);
    assert.equal(sumApplied, 30_000);
    // First line gets floor of (30,000 * 100,000 / 300,000) = 10,000
    assert.equal(ev.per_line[0].discount_cents, 10_000);
    // Last eligible line absorbs rounding remainder: 20,000
    assert.equal(ev.per_line[1].discount_cents, 20_000);
  });

  test('fixed coupon vs zero-cost cart returns ineligible_program (cannot apply)', () => {
    const ev = evaluateCoupon(
      cart([line({ list_price_cents: 0 })]),
      coupon({ type: 'fixed', value: 10_000, currency: 'AED' }),
      memberPaid1(),
      {},
    );
    assert.equal(ev.applies, false);
    // Zero discount — categorized as ineligible_program (line provides no headroom).
    assert.equal(ev.reason, 'ineligible_program');
  });
});

// ─── Resolver determinism ────────────────────────────────────────────────────

describe('resolveBestDiscount end-to-end', () => {
  test('quantity multiplier honored', () => {
    const r = resolveBestDiscount(
      cart([line({ list_price_cents: 50_000, quantity: 3 })]),
      memberPaid1(10),
      null,
    );
    assert.equal(r.kind, 'member');
    assert.equal(r.amount_cents, 15_000); // 10% of (50,000 * 3) = 15,000
  });

  test('per_line breakdown adds up to total', () => {
    const r = resolveBestDiscount(
      cart([
        line({ program_id: PROGRAM_GPS, list_price_cents: 100_000 }),
        line({ program_id: 'a0000000-0000-0000-0000-000000000077', program_slug: 'wisal', list_price_cents: 200_000 }),
      ]),
      memberPaid1(10),
      null,
    );
    const sum = r.per_line.reduce((s, l) => s + l.discount_cents, 0);
    assert.equal(sum, r.amount_cents);
    assert.equal(r.amount_cents, 30_000); // 10% of 300,000
  });

  test('non-member + valid coupon → coupon wins', () => {
    const r = resolveBestDiscount(
      cart([line({ list_price_cents: 100_000 })]),
      memberFree(),
      coupon({ value: 15 }),
    );
    assert.equal(r.kind, 'coupon');
    assert.equal(r.amount_cents, 15_000);
  });

  test('non-member + no coupon → none', () => {
    const r = resolveBestDiscount(cart(), memberFree(), null);
    assert.equal(r.kind, 'none');
  });
});
