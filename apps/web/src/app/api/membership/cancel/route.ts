/**
 * POST /api/membership/cancel — Wave F.2
 *
 * Schedules the user's active Stripe subscription for cancellation at
 * current_period_end. User retains access through end of paid period (M6=b).
 *
 * Idempotent: safe to call twice; if cancel_at is already set, returns 200
 * with the existing cancel_at.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { cancelSubscriptionAtPeriodEnd } from '@kunacademy/payments';
import { auth } from '@/auth';

type MembershipRow = {
  id: string;
  user_id: string;
  tier_id: string;
  tier_slug: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  ended_at: string | null;
};

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  // Find the user's active paid membership.
  // SECURITY: look up by session.user.id, NEVER by body — prevents horizontal privilege escalation.
  const membership = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT m.id, m.user_id, m.tier_id, t.slug AS tier_slug, m.status,
             m.stripe_subscription_id, m.current_period_end, m.cancel_at, m.ended_at
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
      { error: 'cannot_cancel_free_tier', message: 'Free tier has no subscription to cancel.' },
      { status: 400 },
    );
  }

  if (!membership.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'no_stripe_subscription', message: 'Membership row has no Stripe subscription — cannot cancel via Stripe.' },
      { status: 500 },
    );
  }

  // Idempotent short-circuit
  if (membership.cancel_at) {
    return NextResponse.json({
      cancelled: true,
      cancel_at: membership.cancel_at,
      note: 'already_scheduled',
    });
  }

  // Call Stripe
  let stripeSubscription;
  try {
    stripeSubscription = await cancelSubscriptionAtPeriodEnd(membership.stripe_subscription_id);
  } catch (err: any) {
    console.error('[membership-cancel] Stripe update failed:', err?.message);
    return NextResponse.json(
      { error: 'stripe_update_failed', detail: err?.message || 'unknown' },
      { status: 502 },
    );
  }

  // Mirror locally (webhook will also arrive and idempotently re-confirm)
  const cancelAtUnix = (stripeSubscription as any).cancel_at as number | null;
  const currentPeriodEndUnix = (stripeSubscription as any).current_period_end as number | null;
  const cancelAtIso = cancelAtUnix
    ? new Date(cancelAtUnix * 1000).toISOString()
    : currentPeriodEndUnix
      ? new Date(currentPeriodEndUnix * 1000).toISOString()
      : membership.current_period_end;

  await withAdminContext(async (db) => {
    await db.execute(sql`
      UPDATE memberships
         SET cancel_at = ${cancelAtIso},
             updated_at = now()
       WHERE id = ${membership.id}
    `);
  });

  return NextResponse.json({
    cancelled: true,
    cancel_at: cancelAtIso,
    stripe_subscription_id: membership.stripe_subscription_id,
    note: 'access_until_cancel_at',
  });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
