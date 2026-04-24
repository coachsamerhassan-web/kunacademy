/**
 * POST /api/membership/subscribe — Wave F.2
 *
 * Creates a Stripe Checkout Session (mode=subscription) for a user upgrading
 * from Free → Paid-1. Returns the session URL for client redirect.
 *
 * Body: { tier_slug: string, billing_frequency: 'monthly' | 'annual' }
 *
 * Auth: authenticated user required.
 *
 * Idempotency: if the user already has a non-ended non-free membership that is
 * active or trialing, 409 is returned — upgrades go through /change-tier, not here.
 *
 * On success (Stripe Checkout flow completes), the webhook handler
 * `/api/webhooks/stripe-subscription` fires on `checkout.session.completed` +
 * `customer.subscription.created`, mutating the Free membership row in place.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import {
  createStripeCustomer,
  createSubscriptionCheckoutSession,
  type BillingFrequency,
} from '@kunacademy/payments';
import { auth } from '@/auth';

type SubscribeBody = {
  tier_slug?: string;
  billing_frequency?: BillingFrequency;
};

type TierRow = {
  id: string;
  slug: string;
  name_en: string;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  currency: string;
  price_monthly_cents: number;
  price_annual_cents: number;
};

type MembershipRow = {
  id: string;
  user_id: string;
  tier_id: string;
  tier_slug: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  ended_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name_en: string | null;
  full_name_ar: string | null;
};

// Whitelist of host-header values we accept. Anything else → fallback to
// NEXT_PUBLIC_SITE_URL / configured default. Prevents host-header injection
// from redirecting the user to a phishing site after Stripe Checkout
// (DeepSeek low-#1).
const ALLOWED_ORIGINS = new Set([
  'kuncoaching.me',
  'kuncoaching.com',
  'www.kuncoaching.com',
  'kunacademy.com',
  'www.kunacademy.com',
  'localhost:3001',
  'localhost:3000',
  '127.0.0.1:3001',
  '127.0.0.1:3000',
]);

function originFromRequest(req: NextRequest): string {
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const host = rawHost.split(',')[0].trim().toLowerCase();
  const proto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');

  if (host && ALLOWED_ORIGINS.has(host)) {
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://kuncoaching.me';
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Parse + validate body
  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
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
    return NextResponse.json({ error: 'free_tier_not_purchasable' }, { status: 400 });
  }

  // 3. Lookup tier + verify Stripe provisioning
  const tier = await withAdminContext(async (db) => {
    const { rows } = await db.execute(sql`
      SELECT id, slug, name_en, stripe_product_id, stripe_price_id_monthly,
             stripe_price_id_annual, currency, price_monthly_cents, price_annual_cents
      FROM tiers
      WHERE slug = ${tierSlug} AND is_active = true
      LIMIT 1
    `);
    return rows[0] as TierRow | undefined;
  });

  if (!tier) {
    return NextResponse.json({ error: 'tier_not_found' }, { status: 404 });
  }

  const priceId =
    billingFrequency === 'monthly' ? tier.stripe_price_id_monthly : tier.stripe_price_id_annual;

  if (!priceId || !tier.stripe_product_id) {
    // Admin hasn't provisioned this tier with Stripe yet
    console.error(
      `[membership-subscribe] Tier ${tierSlug} is not Stripe-provisioned (product=${tier.stripe_product_id}, price=${priceId})`,
    );
    return NextResponse.json({ error: 'tier_not_provisioned' }, { status: 503 });
  }

  // 4. Lookup user profile + current membership (mutate-in-place pattern).
  //
  // Concurrency guard (DeepSeek critical-#1 TOCTOU): take a per-user Postgres
  // advisory lock for the duration of the subscribe flow. Two concurrent
  // requests for the same user will serialize, preventing double-charge via
  // parallel Stripe Checkout sessions. The lock is released automatically
  // when the transaction commits/rolls back (pg_try_advisory_xact_lock).
  //
  // Lock key: deterministic hash of user_id (bigint, the 64-bit key type
  // pg_advisory_xact_lock expects). hashtext() returns int4 — we double it
  // via two-arg form to reduce collision risk across users.
  const { profile, membership, lockAcquired } = await withAdminContext(async (db) => {
    const lockRows = await db.execute(sql`
      SELECT pg_try_advisory_xact_lock(hashtext('kun_membership_subscribe_' || ${userId}::text)) AS acquired
    `);
    const acquired = (lockRows.rows[0] as { acquired: boolean } | undefined)?.acquired === true;
    if (!acquired) {
      return { profile: undefined, membership: undefined, lockAcquired: false };
    }

    const profRows = await db.execute(sql`
      SELECT id, email, full_name_en, full_name_ar
      FROM profiles
      WHERE id = ${userId}
      LIMIT 1
    `);
    const memRows = await db.execute(sql`
      SELECT m.id, m.user_id, m.tier_id, t.slug AS tier_slug, m.status,
             m.stripe_customer_id, m.stripe_subscription_id, m.ended_at
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      WHERE m.user_id = ${userId}
        AND m.ended_at IS NULL
        AND m.status IN ('active', 'past_due', 'paused', 'trialing')
      ORDER BY m.started_at DESC
      LIMIT 1
    `);
    return {
      profile: profRows.rows[0] as ProfileRow | undefined,
      membership: memRows.rows[0] as MembershipRow | undefined,
      lockAcquired: true,
    };
  });

  if (!lockAcquired) {
    // Another subscribe request for this user is in flight — tell the client to retry.
    return NextResponse.json(
      { error: 'subscribe_in_progress', message: 'Another subscription request is in flight. Retry in a moment.' },
      { status: 409 },
    );
  }

  if (!profile) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
  }

  // 5. Guard: already on a paid tier
  if (membership && membership.tier_slug !== 'free' && membership.tier_slug === tierSlug) {
    return NextResponse.json(
      {
        error: 'already_on_tier',
        message: 'You already have an active membership on this tier. Use /change-tier to switch billing frequency.',
      },
      { status: 409 },
    );
  }
  if (membership && membership.tier_slug !== 'free' && membership.tier_slug !== tierSlug) {
    return NextResponse.json(
      {
        error: 'tier_change_requires_different_endpoint',
        message: 'You are on a different paid tier. Use /api/membership/change-tier.',
      },
      { status: 409 },
    );
  }

  // 6. Ensure Stripe customer exists (lazy provisioning)
  let stripeCustomerId = membership?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const displayName = profile.full_name_en || profile.full_name_ar || undefined;
    stripeCustomerId = await createStripeCustomer({
      email: profile.email,
      name: displayName,
      userId,
    });

    // Persist customer ID onto the membership row (or create a placeholder Free row if missing).
    // We store on the CURRENT membership row if it exists; otherwise, if the user somehow has
    // no Free membership (pre-F.1 signup before auto-provisioning), we DO NOT insert here —
    // the webhook handler will create the row on checkout.session.completed.
    if (membership) {
      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE memberships
             SET stripe_customer_id = ${stripeCustomerId}, updated_at = now()
           WHERE id = ${membership.id}
        `);
      });
    }
  }

  // 7. Build URLs
  const origin = originFromRequest(req);
  const successUrl = `${origin}/membership/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/membership/cancel`;

  // 8. Create Stripe Checkout Session
  let checkout;
  try {
    checkout = await createSubscriptionCheckoutSession({
      stripeCustomerId,
      stripePriceId: priceId,
      successUrl,
      cancelUrl,
      clientReferenceId: userId,
      metadata: {
        kun_user_id: userId,
        kun_membership_id: membership?.id || '',
        kun_tier_slug: tierSlug,
        kun_tier_id: tier.id,
        kun_billing_frequency: billingFrequency,
      },
      subscriptionMetadata: {
        kun_user_id: userId,
        kun_tier_slug: tierSlug,
        kun_tier_id: tier.id,
        kun_billing_frequency: billingFrequency,
      },
    });
  } catch (err: any) {
    console.error('[membership-subscribe] Stripe checkout creation failed:', err?.message || err);
    return NextResponse.json(
      { error: 'stripe_checkout_failed', detail: err?.message || 'unknown' },
      { status: 502 },
    );
  }

  if (!checkout.url) {
    return NextResponse.json({ error: 'stripe_session_url_missing' }, { status: 502 });
  }

  return NextResponse.json(
    {
      session_id: checkout.sessionId,
      checkout_url: checkout.url,
      tier_slug: tierSlug,
      billing_frequency: billingFrequency,
    },
    { status: 200 },
  );
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
