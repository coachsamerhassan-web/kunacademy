/**
 * POST /api/membership/reactivate — Wave F.2
 *
 * Undoes a pending cancellation. Only valid before cancel_at has passed
 * (i.e. subscription still live on Stripe with cancel_at_period_end=true).
 *
 * After cancel_at passes, Stripe deletes the subscription and the user must
 * start a fresh /subscribe flow. /reactivate returns 409 in that case.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { reactivateSubscription } from '@kunacademy/payments';
import { auth } from '@/auth';

type MembershipRow = {
  id: string;
  user_id: string;
  tier_id: string;
  tier_slug: string;
  status: string;
  stripe_subscription_id: string | null;
  cancel_at: string | null;
  ended_at: string | null;
};

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  const membership = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT m.id, m.user_id, m.tier_id, t.slug AS tier_slug, m.status,
             m.stripe_subscription_id, m.cancel_at, m.ended_at
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

  if (!membership.cancel_at) {
    return NextResponse.json(
      { error: 'not_cancelled', message: 'Membership is not scheduled to cancel.' },
      { status: 409 },
    );
  }

  if (new Date(membership.cancel_at) <= new Date()) {
    return NextResponse.json(
      {
        error: 'cancel_at_passed',
        message: 'Cancellation date has passed. Start a new subscription via /subscribe.',
      },
      { status: 409 },
    );
  }

  if (!membership.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'no_stripe_subscription' },
      { status: 500 },
    );
  }

  try {
    await reactivateSubscription(membership.stripe_subscription_id);
  } catch (err: any) {
    console.error('[membership-reactivate] Stripe update failed:', err?.message);
    return NextResponse.json(
      { error: 'stripe_update_failed', detail: err?.message || 'unknown' },
      { status: 502 },
    );
  }

  await withAdminContext(async (db) => {
    await db.execute(sql`
      UPDATE memberships
         SET cancel_at = NULL,
             updated_at = now()
       WHERE id = ${membership.id}
    `);
  });

  return NextResponse.json({ reactivated: true });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
