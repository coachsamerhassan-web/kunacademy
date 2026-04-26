/**
 * POST /api/membership/reactivate — Wave F.2 + F.6
 *
 * F.2: Undoes a pending cancellation. Only valid before cancel_at has passed
 *      (i.e. subscription still live on Stripe with cancel_at_period_end=true).
 *      After cancel_at passes, Stripe deletes the subscription and the user
 *      must start a fresh /subscribe flow. /reactivate returns 409 in that case.
 * F.6: Wires the bilingual reactivation-confirmation email + lifecycle audit row.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { reactivateSubscription } from '@kunacademy/payments';
import { sendMembershipReactivationConfirmationEmail } from '@kunacademy/email';
import { auth } from '@/auth';

type MembershipRow = {
  id: string;
  user_id: string;
  tier_id: string;
  tier_slug: string;
  status: string;
  stripe_subscription_id: string | null;
  cancel_at: string | null;
  current_period_end: string | null;
  ended_at: string | null;
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  preferred_language: string | null;
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
             m.stripe_subscription_id, m.cancel_at, m.current_period_end, m.ended_at,
             p.email, p.full_name_ar, p.full_name_en, p.preferred_language
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      JOIN profiles p ON p.id = m.user_id
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

    // F.6: lifecycle audit row.
    // send_key includes the original cancel_at to allow multiple cancel→reactivate cycles.
    const sendKey = `${membership.id}|${membership.cancel_at}|reactivated`;
    await db.execute(sql`
      INSERT INTO membership_lifecycle_events (
        membership_id, user_id, event_type, send_key, metadata
      ) VALUES (
        ${membership.id}::uuid,
        ${userId}::uuid,
        'reactivated',
        ${sendKey},
        ${JSON.stringify({
          previous_cancel_at: membership.cancel_at,
          stripe_subscription_id: membership.stripe_subscription_id,
        })}::jsonb
      )
      ON CONFLICT (event_type, send_key) DO NOTHING
    `);
  });

  // F.6: bilingual reactivation confirmation email.
  if (membership.email) {
    const lang: 'ar' | 'en' = membership.preferred_language === 'en' ? 'en' : 'ar';
    const recipientName =
      lang === 'en'
        ? membership.full_name_en || membership.full_name_ar || null
        : membership.full_name_ar || membership.full_name_en || null;
    const baseUrl = process.env.PUBLIC_APP_URL || 'https://kunacademy.com';
    try {
      await sendMembershipReactivationConfirmationEmail({
        to: membership.email,
        recipient_name: recipientName,
        next_renewal: membership.current_period_end,
        preferred_language: lang,
        dashboard_url: `${baseUrl}/${lang}/dashboard/membership`,
      });
    } catch (err: any) {
      console.error('[membership-reactivate] email send failed (non-fatal):', err?.message || err);
    }
  }

  return NextResponse.json({ reactivated: true });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
