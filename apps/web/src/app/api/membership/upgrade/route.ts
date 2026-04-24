/**
 * POST /api/membership/upgrade — Wave F.2
 *
 * Changes tier or billing frequency on an existing active paid subscription.
 * Stripe handles proration via proration_behavior='create_prorations' (default).
 *
 * Body: { tier_slug: string, billing_frequency: 'monthly' | 'annual' }
 *
 * This endpoint is for users already on a paid tier who want to switch
 * (e.g. Paid-1 monthly → Paid-1 annual, or future Paid-1 → Paid-2).
 *
 * Free → paid goes through /subscribe (Checkout Session flow), NOT here.
 * Paid → free is effectively a /cancel — we reject that here.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import {
  changeSubscriptionTier,
  retrieveSubscription,
  type BillingFrequency,
} from '@kunacademy/payments';
import { auth } from '@/auth';

type UpgradeBody = {
  tier_slug?: string;
  billing_frequency?: BillingFrequency;
};

type TierRow = {
  id: string;
  slug: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  tier_id: string;
  tier_slug: string;
  status: string;
  stripe_subscription_id: string | null;
  ended_at: string | null;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: UpgradeBody;
  try {
    body = (await req.json()) as UpgradeBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tierSlug = body.tier_slug;
  const billingFrequency = body.billing_frequency;

  if (!tierSlug || typeof tierSlug !== 'string') {
    return NextResponse.json({ error: 'tier_slug_required' }, { status: 400 });
  }
  if (billingFrequency !== 'monthly' && billingFrequency !== 'annual') {
    return NextResponse.json({ error: 'billing_frequency_invalid' }, { status: 400 });
  }
  if (tierSlug === 'free') {
    return NextResponse.json(
      { error: 'use_cancel_endpoint', message: 'To drop to free, call /api/membership/cancel.' },
      { status: 400 },
    );
  }

  // Lookup target tier
  const targetTier = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT id, slug, stripe_price_id_monthly, stripe_price_id_annual
      FROM tiers
      WHERE slug = ${tierSlug} AND is_active = true
      LIMIT 1
    `);
    return rows[0] as TierRow | undefined;
  });

  if (!targetTier) {
    return NextResponse.json({ error: 'tier_not_found' }, { status: 404 });
  }

  const newStripePriceId =
    billingFrequency === 'monthly'
      ? targetTier.stripe_price_id_monthly
      : targetTier.stripe_price_id_annual;

  if (!newStripePriceId) {
    return NextResponse.json({ error: 'tier_not_provisioned' }, { status: 503 });
  }

  // Lookup user's active paid membership (SECURITY: via session, never body)
  const membership = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT m.id, m.user_id, m.tier_id, t.slug AS tier_slug, m.status,
             m.stripe_subscription_id, m.ended_at
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      WHERE m.user_id = ${userId}
        AND m.ended_at IS NULL
        AND m.status IN ('active', 'past_due', 'trialing')
      ORDER BY m.started_at DESC
      LIMIT 1
    `);
    return rows[0] as MembershipRow | undefined;
  });

  if (!membership) {
    return NextResponse.json({ error: 'no_active_membership' }, { status: 404 });
  }

  if (membership.tier_slug === 'free') {
    return NextResponse.json(
      {
        error: 'use_subscribe_endpoint',
        message: 'Free users upgrade via /api/membership/subscribe.',
      },
      { status: 400 },
    );
  }

  if (!membership.stripe_subscription_id) {
    return NextResponse.json({ error: 'no_stripe_subscription' }, { status: 500 });
  }

  // Need the current subscription item ID for Stripe's items replacement API
  let currentSubscription;
  try {
    currentSubscription = await retrieveSubscription(membership.stripe_subscription_id);
  } catch (err: any) {
    console.error('[membership-upgrade] Retrieve failed:', err?.message);
    return NextResponse.json(
      { error: 'stripe_retrieve_failed', detail: err?.message || 'unknown' },
      { status: 502 },
    );
  }

  const currentItem = currentSubscription.items?.data?.[0];
  if (!currentItem) {
    return NextResponse.json({ error: 'stripe_subscription_has_no_items' }, { status: 500 });
  }

  // No-op if target price == current price
  if (currentItem.price.id === newStripePriceId) {
    return NextResponse.json({ upgraded: false, note: 'already_on_this_price' });
  }

  try {
    await changeSubscriptionTier({
      stripeSubscriptionId: membership.stripe_subscription_id,
      currentSubscriptionItemId: currentItem.id,
      newStripePriceId,
    });
  } catch (err: any) {
    console.error('[membership-upgrade] Stripe update failed:', err?.message);
    return NextResponse.json(
      { error: 'stripe_update_failed', detail: err?.message || 'unknown' },
      { status: 502 },
    );
  }

  // Stripe webhook (customer.subscription.updated) will sync the DB.
  // We return success here; the new tier_id/billing_frequency lands when the webhook arrives.
  return NextResponse.json({
    upgraded: true,
    note: 'stripe_update_success_webhook_pending',
    tier_slug: tierSlug,
    billing_frequency: billingFrequency,
  });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
