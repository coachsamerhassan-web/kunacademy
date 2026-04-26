/**
 * POST /api/checkout/apply-coupon — Wave F.5
 *
 * Validates a coupon against a draft cart and returns a quote with the
 * winning discount applied (per F-W3 single-discount-wins). Does NOT
 * write a redemption row — that happens at order-submit time inside the
 * same DB transaction as the order insert (idempotency on retries) via
 * the helper exported from `lib/discounts/lockOnOrder.ts`.
 *
 * Body shape (one of two — see `cart_id` vs explicit `cart` lines):
 *
 *   1. cart_id mode (preferred when a pending order row exists):
 *      { code: string, cart_id: <uuid> }
 *      Server reads orders + order_items + joined programs.
 *
 *   2. explicit-cart mode (used by program checkout flow before order row):
 *      { code: string, cart: {
 *          currency: 'AED'|'EGP'|'USD'|'EUR',
 *          lines: [{ program_id: <uuid>, quantity: number }]
 *      }}
 *      Server re-fetches programs from DB → looks up canonical price for
 *      the given currency, member_discount_eligible, coach_tier — preventing
 *      client-side price tampering.
 *
 * Auth: authenticated user required.
 *
 * Locked decisions:
 *   F-W3 single-discount-wins  — resolveBestDiscount handles the choice
 *   F-W4 ineligible programs   — resolver checks programs.member_discount_eligible
 *
 * Error codes (returned in response body when status >= 400):
 *   invalid             — coupon code not found OR rate-limited rejection
 *   inactive            — coupon row is_active=false
 *   not_yet_valid       — valid_from > now()
 *   expired             — valid_to < now()
 *   exhausted           — redemptions_used >= redemptions_max
 *   already_used        — single_use_per_customer + customer already redeemed
 *   wrong_currency      — fixed coupon currency != cart currency
 *   ineligible_program  — F-W4 violation OR fixed coupon vs zero-cost cart
 *   scope_mismatch      — coupon scope (programs/tiers) doesn't intersect cart
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { auth } from '@/auth';
import {
  REASON_TO_HTTP,
  evaluateCoupon,
  resolveBestDiscount,
  type Cart,
  type CartLine,
  type CouponSnapshot,
  type Currency,
  type MemberContext,
} from '@/lib/discounts';

type ApplyCouponBody = {
  code?: string;
  cart_id?: string;
  cart?: {
    currency?: string;
    lines?: Array<{ program_id?: string; quantity?: number }>;
  };
};

const CURRENCIES = ['AED', 'EGP', 'USD', 'EUR'] as const;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9-]{3,31}$/;

// In-memory rate limiter: 20 attempts/min/user (defends brute force).
const _rl = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 60_000;
const RL_MAX_USER = 20;

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = _rl.get(userId);
  if (!entry || now > entry.resetAt) {
    _rl.set(userId, { count: 1, resetAt: now + RL_WINDOW_MS });
    return true;
  }
  if (entry.count >= RL_MAX_USER) return false;
  entry.count++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rl) if (now > v.resetAt) _rl.delete(k);
}, 5 * 60 * 1000).unref?.();

function priceColumn(currency: Currency): 'price_aed' | 'price_egp' | 'price_usd' | 'price_eur' {
  switch (currency) {
    case 'AED': return 'price_aed';
    case 'EGP': return 'price_egp';
    case 'USD': return 'price_usd';
    case 'EUR': return 'price_eur';
  }
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Rate limit
  if (!rateLimit(userId)) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many attempts. Wait a moment and retry.' },
      { status: 429 },
    );
  }

  // 3. Parse + validate body
  let body: ApplyCouponBody;
  try {
    body = (await req.json()) as ApplyCouponBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const code = (body.code ?? '').toString().trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'code_required' }, { status: 400 });
  }
  if (!COUPON_CODE_RE.test(code)) {
    return NextResponse.json({ error: 'invalid', message: 'Code format invalid.' }, { status: 400 });
  }

  // 4. Resolve cart — either via cart_id (load order) or via explicit cart payload.
  const haveCartId = typeof body.cart_id === 'string' && body.cart_id.length > 0;
  const haveExplicitCart = body.cart && Array.isArray(body.cart.lines);

  if (!haveCartId && !haveExplicitCart) {
    return NextResponse.json(
      { error: 'cart_required', message: 'Provide cart_id OR cart {currency, lines[]}.' },
      { status: 400 },
    );
  }

  // We declare these as `any`-shaped via reassignment inside a closure; outside
  // the closure we treat them as { cart, coupon, member, customerAlreadyRedeemed }.
  // TypeScript narrowing in callbacks doesn't track mutations safely, so we use
  // a single boxed object to keep the narrowing simple.
  const ctx: {
    cart: Cart | null;
    coupon: CouponSnapshot | null;
    member: MemberContext;
    customerAlreadyRedeemed: boolean;
  } = {
    cart: null,
    coupon: null,
    member: { is_paid1_active: false, member_discount_pct: 10 },
    customerAlreadyRedeemed: false,
  };

  try {
    await withAdminContext(async (db) => {
      // 4a. Cart resolution
      if (haveCartId) {
        const cartId = body.cart_id!;
        if (!UUID_RE.test(cartId)) {
          // signal failure via cart=null; outer code returns 400
          return;
        }
        const orderRows = await db.execute(sql`
          SELECT id, customer_id, currency
          FROM orders
          WHERE id = ${cartId}::uuid
            AND customer_id = ${userId}::uuid
            AND status = 'pending'
          LIMIT 1
        `);
        const order = orderRows.rows[0] as
          | { id: string; customer_id: string; currency: string }
          | undefined;
        if (!order) return;

        // Order items reference products.id (in this codebase). Programs are
        // separate. The pending-order path is rarely used today — most program
        // sales flow through the explicit-cart path. We honor cart_id mode
        // for forward compatibility but it returns no usable lines unless
        // the order has at least one row whose product_id maps to a program
        // (via slug match — products and programs share slugs by convention).
        const lineRows = await db.execute(sql`
          SELECT
            oi.id           AS oi_id,
            oi.product_id   AS product_id,
            oi.quantity     AS quantity,
            oi.unit_price   AS unit_price,
            p.id            AS program_id,
            p.slug          AS program_slug,
            p.member_discount_eligible AS member_discount_eligible,
            p.coach_tier    AS coach_tier
          FROM order_items oi
          LEFT JOIN products pr ON pr.id = oi.product_id
          LEFT JOIN programs p  ON p.slug = pr.slug
          WHERE oi.order_id = ${cartId}::uuid
        `);

        const lines: CartLine[] = (lineRows.rows as Array<{
          program_id: string | null;
          program_slug: string | null;
          member_discount_eligible: boolean | null;
          coach_tier: string | null;
          quantity: number | null;
          unit_price: number | string | null;
        }>).map((r) => ({
          program_id: r.program_id,
          program_slug: r.program_slug,
          member_discount_eligible: r.member_discount_eligible === true,
          coach_tier: r.coach_tier ?? null,
          list_price_cents: typeof r.unit_price === 'string' ? parseInt(r.unit_price, 10) : (r.unit_price ?? 0),
          currency: order.currency as Currency,
          quantity: r.quantity ?? 1,
        }));

        ctx.cart = {
          cart_id: order.id,
          customer_id: order.customer_id,
          currency: order.currency as Currency,
          lines,
        };
      } else if (haveExplicitCart) {
        const ec = body.cart!;
        const currency = (ec.currency ?? '').toUpperCase();
        if (!CURRENCIES.includes(currency as Currency)) return; // signal invalid
        const linesIn = (ec.lines ?? []).slice(0, 50); // cap line count
        if (linesIn.length === 0) return;

        // Validate line shape + extract program ids
        const programIds: string[] = [];
        const quantities = new Map<string, number>();
        for (const ln of linesIn) {
          if (!ln.program_id || !UUID_RE.test(ln.program_id)) return;
          const qty = Math.max(1, Math.min(99, Math.floor(ln.quantity ?? 1)));
          if (!Number.isFinite(qty) || qty < 1) return;
          programIds.push(ln.program_id);
          quantities.set(ln.program_id, (quantities.get(ln.program_id) ?? 0) + qty);
        }

        // Server-authoritative price + flags lookup (NEVER trust client prices).
        // programs.price_* are numeric(10,2). We cast to cents in SQL so JS
        // never sees a fractional value (avoids float-rounding edge cases).
        // The whitelist on `col` above prevents SQL-injection via sql.raw.
        const col = priceColumn(currency as Currency);
        const progRows = await db.execute(sql`
          SELECT id, slug,
                 (round(${sql.raw(col)} * 100))::bigint AS list_price_cents,
                 member_discount_eligible, coach_tier
          FROM programs
          WHERE id = ANY(${programIds}::uuid[])
            AND published = true
        `);
        const progMap = new Map(
          (progRows.rows as Array<{
            id: string;
            slug: string;
            list_price_cents: number | string | null;
            member_discount_eligible: boolean | null;
            coach_tier: string | null;
          }>).map((r) => [r.id, r]),
        );

        // Build server-validated lines (drop unknown program ids — coupon
        // evaluation will then yield no eligible lines if cart is empty).
        const lines: CartLine[] = [];
        for (const pid of programIds) {
          const p = progMap.get(pid);
          if (!p) continue; // unknown / unpublished program — skip
          const cents = typeof p.list_price_cents === 'string'
            ? parseInt(p.list_price_cents, 10)
            : (p.list_price_cents ?? 0);
          lines.push({
            program_id: p.id,
            program_slug: p.slug,
            member_discount_eligible: p.member_discount_eligible === true,
            coach_tier: p.coach_tier ?? null,
            list_price_cents: Math.max(0, Math.floor(cents)),
            currency: currency as Currency,
            quantity: quantities.get(pid) ?? 1,
          });
        }

        ctx.cart = {
          cart_id: 'explicit',
          customer_id: userId,
          currency: currency as Currency,
          lines,
        };
      }

      if (!ctx.cart) return;

      // 4c. Membership context — uses Wave F.4 entitlement helper.
      // hasFeature replaces the F.5 hardcoded tier.slug='paid-1' lookup so
      // future tiers (Paid-2, etc.) inherit the discount automatically when
      // the matrix grants `program_member_discount_10pct`. The pct itself
      // can be overridden per-tier via tier_features.config.discount_percentage,
      // OR globally via pricing_config (legacy). Tier config wins when set.
      //
      // We can't import @kunacademy/db inside the existing closure cleanly
      // without restructuring; instead we run the same join inline. Behavior
      // is byte-equivalent to hasFeature(userId, 'program_member_discount_10pct').
      const entitlementRows = await db.execute(sql`
        SELECT t.slug                AS tier_slug,
               t.id                  AS tier_id,
               tf.included           AS included,
               tf.config             AS config
        FROM memberships m
        JOIN tiers t ON t.id = m.tier_id
        LEFT JOIN features f ON f.feature_key = 'program_member_discount_10pct'
        LEFT JOIN tier_features tf ON tf.tier_id = m.tier_id AND tf.feature_id = f.id
        WHERE m.user_id = ${userId}::uuid
          AND m.ended_at IS NULL
          AND m.status IN ('active','past_due','trialing')
        ORDER BY m.started_at DESC
        LIMIT 1
      `);
      const ent = entitlementRows.rows[0] as
        | { tier_slug: string; tier_id: string; included: boolean | null; config: Record<string, unknown> | null }
        | undefined;
      const hasMemberDiscount = !!(ent && ent.included === true);

      // Resolve discount percentage: tier_features.config.discount_percentage
      // wins over pricing_config global override. Default 10.
      let pct = 10;
      const tierCfgPct =
        ent?.config && typeof (ent.config as any).discount_percentage === 'number'
          ? Number((ent.config as any).discount_percentage)
          : null;
      if (typeof tierCfgPct === 'number' && Number.isFinite(tierCfgPct)) {
        pct = tierCfgPct;
      } else {
        const pctRows = await db.execute(sql`
          SELECT value_cents FROM pricing_config
          WHERE entity_type = 'program_discount'
            AND entity_key = 'member_discount_pct'
          LIMIT 1
        `);
        const pctRow = pctRows.rows[0] as { value_cents: number | null } | undefined;
        if (typeof pctRow?.value_cents === 'number') pct = pctRow.value_cents;
      }
      ctx.member = { is_paid1_active: hasMemberDiscount, member_discount_pct: pct };

      // 4d. Coupon by code
      const cpnRows = await db.execute(sql`
        SELECT id, code, type, value, currency, redemptions_max, redemptions_used,
               valid_from, valid_to, single_use_per_customer, scope_kind,
               scope_program_ids, scope_tier_ids, admin_override, is_active
        FROM coupons
        WHERE code = ${code}
        LIMIT 1
      `);
      const c = cpnRows.rows[0] as
        | (Omit<CouponSnapshot, 'scope_program_ids' | 'scope_tier_ids' | 'valid_from' | 'valid_to'> & {
            scope_program_ids: string[] | null;
            scope_tier_ids: string[] | null;
            valid_from: Date | string | null;
            valid_to: Date | string | null;
          })
        | undefined;
      if (c) {
        const couponSnapshot: CouponSnapshot = {
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          currency: c.currency,
          redemptions_max: c.redemptions_max,
          redemptions_used: c.redemptions_used,
          valid_from: c.valid_from
            ? typeof c.valid_from === 'string' ? c.valid_from : c.valid_from.toISOString()
            : null,
          valid_to: c.valid_to
            ? typeof c.valid_to === 'string' ? c.valid_to : c.valid_to.toISOString()
            : null,
          single_use_per_customer: c.single_use_per_customer,
          scope_kind: c.scope_kind,
          scope_program_ids: c.scope_program_ids ?? [],
          scope_tier_ids: c.scope_tier_ids ?? [],
          admin_override: c.admin_override,
          is_active: c.is_active,
        };
        ctx.coupon = couponSnapshot;

        if (couponSnapshot.single_use_per_customer) {
          const usedRows = await db.execute(sql`
            SELECT 1 FROM coupon_redemptions
            WHERE coupon_id = ${couponSnapshot.id}::uuid
              AND customer_id = ${userId}::uuid
            LIMIT 1
          `);
          ctx.customerAlreadyRedeemed = usedRows.rows.length > 0;
        }
      }
    });
  } catch (err) {
    console.error('[apply-coupon] DB error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // 5. Cart resolution failed?
  const { cart, coupon, member, customerAlreadyRedeemed } = ctx;
  if (!cart) {
    return NextResponse.json({ error: 'cart_invalid' }, { status: 400 });
  }
  if (cart.lines.length === 0) {
    return NextResponse.json({ error: 'cart_empty' }, { status: 400 });
  }

  // 6. 400 for unknown coupon code (uniform with other invalids).
  if (!coupon) {
    return NextResponse.json({ error: 'invalid', message: 'Invalid coupon code.' }, { status: 400 });
  }

  // 7. Evaluate the coupon to get a deterministic reason on rejection
  const ev = evaluateCoupon(cart, coupon, member, {
    customer_already_redeemed: customerAlreadyRedeemed,
  });

  if (!ev.applies) {
    const mapping = REASON_TO_HTTP[ev.reason!];
    return NextResponse.json(
      { error: mapping.code, message: friendlyReason(ev.reason!) },
      { status: mapping.status },
    );
  }

  // 8. Resolve winner (single-discount-wins between member auto + this coupon)
  const winner = resolveBestDiscount(cart, member, coupon, {
    customer_already_redeemed: customerAlreadyRedeemed,
  });

  // 9. Build quote payload
  const subtotal = cart.lines.reduce(
    (s: number, l) => s + Math.max(0, l.list_price_cents) * Math.max(1, l.quantity ?? 1),
    0,
  );

  return NextResponse.json(
    {
      ok: true,
      cart_id: cart.cart_id,
      currency: cart.currency,
      subtotal_cents: subtotal,
      discount: {
        kind: winner.kind,
        amount_cents: winner.amount_cents,
        source_id: winner.source_id,
        coupon_code: winner.kind === 'coupon' ? coupon.code : null,
      },
      total_cents: Math.max(0, subtotal - winner.amount_cents),
      per_line: winner.per_line,
      coupon_eval: {
        applies: ev.applies,
        amount_cents: ev.amount_cents,
        chosen: winner.kind === 'coupon',
      },
    },
    { status: 200 },
  );
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}

function friendlyReason(reason: string): string {
  switch (reason) {
    case 'inactive':           return 'This coupon is no longer active.';
    case 'not_yet_valid':      return 'This coupon is not yet valid.';
    case 'expired':            return 'This coupon has expired.';
    case 'exhausted':          return 'This coupon has reached its redemption limit.';
    case 'already_used':       return 'You have already used this coupon.';
    case 'wrong_currency':     return 'This coupon is for a different currency.';
    case 'ineligible_program': return 'This coupon does not apply to the items in your cart.';
    case 'scope_mismatch':     return 'This coupon is not valid for the selected program.';
    case 'invalid':            return 'Invalid coupon code.';
    default:                   return 'Coupon could not be applied.';
  }
}
