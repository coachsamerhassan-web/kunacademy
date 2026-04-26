/**
 * GET /api/membership/me — Wave F.4 (2026-04-26)
 *
 * Returns the authenticated user's membership state + entitlement bundle.
 * Used by the member dashboard at /[locale]/dashboard/membership.
 *
 * Response shape:
 *   200 {
 *     tier: { slug, name_ar, name_en, price_monthly_cents, price_annual_cents, currency }
 *     status: 'active'|'past_due'|'paused'|'trialing'|'cancelled'|'expired'
 *     billing_frequency: 'monthly'|'annual'|null
 *     started_at: ISO
 *     current_period_start: ISO|null
 *     current_period_end: ISO|null
 *     cancel_at: ISO|null  — set if user cancelled but still in paid period
 *     features: [{ feature_key, name_ar, name_en, quota, config }]
 *     auto_coupon: { code, value, currency, valid_to } | null
 *     qa_registrations: { ar?: ISO, en?: ISO } | null
 *   }
 *   401 { error: 'auth_required' }
 *
 * Auth: authenticated user.
 *
 * No mutation. Cached per-request (the dashboard fires GET once on mount).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext, listMemberEntitlements } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { findActiveMemberAutoCouponForUser } from '@/lib/membership/memberAutoCoupon';

export async function GET(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }

  // Three independent queries; we run them sequentially inside one
  // withAdminContext so we hit the connection once.
  type TierInfo = {
    slug: string;
    name_ar: string;
    name_en: string;
    price_monthly_cents: number;
    price_annual_cents: number;
    currency: string;
  } | null;

  type MembershipInfo = {
    status: string;
    billing_frequency: string | null;
    started_at: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at: string | null;
    metadata: Record<string, unknown> | null;
  } | null;

  const data = await withAdminContext(async (db) => {
    const memRows = await db.execute(sql`
      SELECT m.status                AS status,
             m.billing_frequency     AS billing_frequency,
             m.started_at            AS started_at,
             m.current_period_start  AS current_period_start,
             m.current_period_end    AS current_period_end,
             m.cancel_at             AS cancel_at,
             m.metadata              AS metadata,
             t.slug                  AS tier_slug,
             t.name_ar               AS tier_name_ar,
             t.name_en               AS tier_name_en,
             t.price_monthly_cents   AS price_monthly_cents,
             t.price_annual_cents    AS price_annual_cents,
             t.currency              AS tier_currency
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      WHERE m.user_id = ${user.id}::uuid
        AND m.ended_at IS NULL
        AND m.status IN ('active','past_due','paused','trialing')
      ORDER BY m.started_at DESC
      LIMIT 1
    `);
    const row = memRows.rows[0] as
      | {
          status: string;
          billing_frequency: string | null;
          started_at: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          metadata: Record<string, unknown> | null;
          tier_slug: string;
          tier_name_ar: string;
          tier_name_en: string;
          price_monthly_cents: number;
          price_annual_cents: number;
          tier_currency: string;
        }
      | undefined;

    if (!row) {
      return { tier: null as TierInfo, membership: null as MembershipInfo };
    }
    return {
      tier: {
        slug: row.tier_slug,
        name_ar: row.tier_name_ar,
        name_en: row.tier_name_en,
        price_monthly_cents: row.price_monthly_cents,
        price_annual_cents: row.price_annual_cents,
        currency: row.tier_currency,
      } as TierInfo,
      membership: {
        status: row.status,
        billing_frequency: row.billing_frequency,
        started_at: row.started_at,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end,
        cancel_at: row.cancel_at,
        metadata: row.metadata,
      } as MembershipInfo,
    };
  });

  // No active membership? User may have been deleted from the table mid-session.
  // Surface as 404 (auth ok, but no membership).
  if (!data.membership || !data.tier) {
    return NextResponse.json({ error: 'no_active_membership' }, { status: 404 });
  }

  // Entitlements (separate query — uses same admin context internally)
  const entitlementBundle = await listMemberEntitlements(user.id);

  // Auto-coupon (Paid-1 only; returns null for Free)
  const autoCoupon = await findActiveMemberAutoCouponForUser(user.id);

  // Qa registrations from membership metadata
  const qa: Record<string, string> | null =
    data.membership.metadata && typeof data.membership.metadata === 'object'
      ? ((data.membership.metadata as Record<string, unknown>).qa_registrations as
          | Record<string, string>
          | undefined) ?? null
      : null;

  return NextResponse.json({
    tier: data.tier,
    status: data.membership.status,
    billing_frequency: data.membership.billing_frequency,
    started_at: data.membership.started_at,
    current_period_start: data.membership.current_period_start,
    current_period_end: data.membership.current_period_end,
    cancel_at: data.membership.cancel_at,
    features: entitlementBundle.features,
    auto_coupon: autoCoupon,
    qa_registrations: qa,
  });
}
