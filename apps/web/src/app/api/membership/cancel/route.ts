/**
 * POST /api/membership/cancel — Wave F.2 + F.6
 *
 * F.2: Schedules the user's active Stripe subscription for cancellation at
 *      current_period_end. User retains access through end of paid period (M6=b).
 * F.6: Wires the bilingual confirmation email + lifecycle audit row.
 *
 * Idempotent: safe to call twice; if cancel_at is already set, returns 200
 * with the existing cancel_at.
 *
 * Body (optional, JSON):
 *   {
 *     "cancel_reason"?: "no_longer_interested" | "too_expensive" | "free_text..."
 *   }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import { cancelSubscriptionAtPeriodEnd } from '@kunacademy/payments';
import {
  sendMembershipCancelConfirmationEmail,
} from '@kunacademy/email';
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
  email: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  preferred_language: string | null;
};

function trim(s: unknown, max = 280): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  // Optional cancel_reason from body — sanitised, length-capped.
  let cancelReason: string | null = null;
  try {
    const body = await req.json();
    cancelReason = trim(body?.cancel_reason ?? body?.reason ?? null);
  } catch {
    // body is optional; absent / non-JSON = no reason captured
  }

  // Find the user's active paid membership.
  // SECURITY: look up by session.user.id, NEVER by body — prevents horizontal privilege escalation.
  const membership = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT m.id, m.user_id, m.tier_id, t.slug AS tier_slug, m.status,
             m.stripe_subscription_id, m.current_period_end, m.cancel_at, m.ended_at,
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
             cancel_reason = COALESCE(${cancelReason}, cancel_reason),
             updated_at = now()
       WHERE id = ${membership.id}
    `);

    // F.6: lifecycle audit row (idempotent on retries via the unique key).
    const sendKey = `${membership.id}|${cancelAtIso}|cancel_requested`;
    await db.execute(sql`
      INSERT INTO membership_lifecycle_events (
        membership_id, user_id, event_type, send_key, metadata
      ) VALUES (
        ${membership.id}::uuid,
        ${userId}::uuid,
        'cancel_requested',
        ${sendKey},
        ${JSON.stringify({
          cancel_at: cancelAtIso,
          cancel_reason: cancelReason,
          stripe_subscription_id: membership.stripe_subscription_id,
        })}::jsonb
      )
      ON CONFLICT (event_type, send_key) DO NOTHING
    `);
  });

  // F.6: send bilingual confirmation email — non-blocking on failure.
  if (membership.email) {
    const lang: 'ar' | 'en' = membership.preferred_language === 'en' ? 'en' : 'ar';
    const recipientName =
      lang === 'en'
        ? membership.full_name_en || membership.full_name_ar || null
        : membership.full_name_ar || membership.full_name_en || null;
    const baseUrl = process.env.PUBLIC_APP_URL || 'https://kunacademy.com';
    try {
      await sendMembershipCancelConfirmationEmail({
        to: membership.email,
        recipient_name: recipientName,
        cancel_at: cancelAtIso || new Date().toISOString(),
        preferred_language: lang,
        dashboard_url: `${baseUrl}/${lang}/dashboard/membership`,
      });
    } catch (err: any) {
      console.error('[membership-cancel] email send failed (non-fatal):', err?.message || err);
    }
  }

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
