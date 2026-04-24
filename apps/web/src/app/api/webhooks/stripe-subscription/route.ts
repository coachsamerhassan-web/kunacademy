/**
 * POST /api/webhooks/stripe-subscription — Wave F.2
 *
 * Dedicated Stripe webhook for subscription/invoice events.
 * Separate from /api/webhooks/payment (one-time payments) to keep
 * subscription-lifecycle code + settlement semantics isolated per Wave F §4.
 *
 * Events handled:
 * - checkout.session.completed (mode=subscription)
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - customer.subscription.trial_will_end (stub for v2)
 *
 * Idempotency: event_id uniqueness on shared `webhook_events` table
 * (gateway='stripe_subscription' discriminator).
 *
 * Signature verification: Stripe SDK constructEvent() via
 * verifyWebhookSignature() helper. Fails LOUD in production when
 * STRIPE_WEBHOOK_SECRET is missing — NEVER silently accepts unsigned.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { withAdminContext } from '@kunacademy/db';
import { verifyWebhookSignature } from '@kunacademy/payments';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type MembershipRow = {
  id: string;
  user_id: string;
  tier_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  ended_at: string | null;
};

type TierRow = {
  id: string;
  slug: string;
};

function isoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds || typeof unixSeconds !== 'number') return null;
  return new Date(unixSeconds * 1000).toISOString();
}

function billingFrequencyFromInterval(interval: string | null | undefined): 'monthly' | 'annual' | null {
  if (interval === 'month') return 'monthly';
  if (interval === 'year') return 'annual';
  return null;
}

/** Map Stripe subscription status → our membership status. */
function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'past_due';
    case 'paused':
      return 'paused';
    default:
      return 'active';
  }
}

async function findTierIdByStripePriceId(
  adminDb: any,
  stripePriceId: string,
): Promise<TierRow | null> {
  const { rows } = await adminDb.execute(sql`
    SELECT id, slug
    FROM tiers
    WHERE stripe_price_id_monthly = ${stripePriceId}
       OR stripe_price_id_annual = ${stripePriceId}
    LIMIT 1
  `);
  return (rows[0] as TierRow) || null;
}

async function findFreeTierId(adminDb: any): Promise<string | null> {
  const { rows } = await adminDb.execute(sql`
    SELECT id FROM tiers WHERE slug = 'free' LIMIT 1
  `);
  return (rows[0] as { id: string } | undefined)?.id ?? null;
}

async function findMembershipByUserId(
  adminDb: any,
  userId: string,
): Promise<MembershipRow | null> {
  const { rows } = await adminDb.execute(sql`
    SELECT id, user_id, tier_id, status, stripe_customer_id, stripe_subscription_id, ended_at
    FROM memberships
    WHERE user_id = ${userId}
      AND ended_at IS NULL
      AND status IN ('active', 'past_due', 'paused', 'trialing')
    ORDER BY started_at DESC
    LIMIT 1
  `);
  return (rows[0] as MembershipRow) || null;
}

async function findMembershipBySubscriptionId(
  adminDb: any,
  stripeSubscriptionId: string,
): Promise<MembershipRow | null> {
  const { rows } = await adminDb.execute(sql`
    SELECT id, user_id, tier_id, status, stripe_customer_id, stripe_subscription_id, ended_at
    FROM memberships
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
    LIMIT 1
  `);
  return (rows[0] as MembershipRow) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers — pure functions, caller wraps in withAdminContext transaction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * checkout.session.completed (mode=subscription):
 * This fires BEFORE customer.subscription.created sometimes. We use it for
 * client_reference_id → user_id correlation and metadata. The real state
 * (status, period, price) comes from subscription.created/updated.
 *
 * Action: stamp stripe_customer_id on the user's membership (if not yet set).
 */
async function handleCheckoutSessionCompleted(
  adminDb: any,
  event: Stripe.Event,
): Promise<{ handled: boolean; note?: string }> {
  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode !== 'subscription') {
    return { handled: false, note: 'non_subscription_session_ignored' };
  }

  const userId = session.client_reference_id;
  const customerId = typeof session.customer === 'string' ? session.customer : null;

  if (!userId) {
    console.warn('[stripe-subscription] checkout.session.completed missing client_reference_id', session.id);
    return { handled: false, note: 'missing_client_reference_id' };
  }

  if (customerId) {
    // Stamp customer_id on membership so subsequent events correlate.
    await adminDb.execute(sql`
      UPDATE memberships
         SET stripe_customer_id = ${customerId}, updated_at = now()
       WHERE user_id = ${userId}
         AND ended_at IS NULL
    `);
  }

  return { handled: true };
}

/**
 * customer.subscription.created:
 * Upgrade user from Free → paid tier (mutate-in-place per §4 decision).
 * If no membership row exists (edge case: user signed up pre-F.1 auto-provisioning),
 * INSERT a new row.
 */
async function handleSubscriptionCreatedOrUpdated(
  adminDb: any,
  event: Stripe.Event,
): Promise<{ handled: boolean; note?: string }> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

  if (!stripeCustomerId) {
    return { handled: false, note: 'missing_customer_id' };
  }

  // Concurrency guard (DeepSeek critical-#2): serialize all handlers for the
  // same subscription within a transaction via advisory lock. This prevents
  // the `checkout.session.completed` and `customer.subscription.created`
  // events from racing to INSERT a membership row. pg_advisory_xact_lock
  // releases automatically at transaction end.
  await adminDb.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext('kun_stripe_sub_' || ${stripeSubscriptionId}::text))
  `);

  // Derive user_id from subscription metadata (written by /subscribe route)
  const metadataUserId = subscription.metadata?.kun_user_id;

  // The subscription's first item carries the current price.
  const firstItem = subscription.items?.data?.[0];
  const stripePriceId = firstItem?.price?.id;
  const interval = firstItem?.price?.recurring?.interval;
  const billingFrequency = billingFrequencyFromInterval(interval);

  if (!stripePriceId) {
    return { handled: false, note: 'missing_price_id' };
  }

  // Resolve tier from Stripe price ID
  const tier = await findTierIdByStripePriceId(adminDb, stripePriceId);
  if (!tier) {
    console.error(
      `[stripe-subscription] No tier found for stripe_price_id=${stripePriceId} (event=${event.id})`,
    );
    return { handled: false, note: 'tier_not_found_for_price' };
  }

  // Try to find existing membership by subscription_id first, then by user_id
  let membership: MembershipRow | null = await findMembershipBySubscriptionId(
    adminDb,
    stripeSubscriptionId,
  );
  if (!membership && metadataUserId) {
    membership = await findMembershipByUserId(adminDb, metadataUserId);
  }

  const status = mapStripeStatus(subscription.status);
  const currentPeriodStart = isoOrNull((subscription as any).current_period_start);
  const currentPeriodEnd = isoOrNull((subscription as any).current_period_end);
  const cancelAt = subscription.cancel_at_period_end
    ? currentPeriodEnd
    : isoOrNull(subscription.cancel_at);
  const cancelledAt = isoOrNull(subscription.canceled_at);
  const metadataJson = JSON.stringify({
    stripe_price_id: stripePriceId,
    stripe_subscription_id: stripeSubscriptionId,
    last_event: event.type,
    last_event_id: event.id,
  });

  if (membership) {
    // Mutate in place
    await adminDb.execute(sql`
      UPDATE memberships
         SET tier_id = ${tier.id},
             status = ${status},
             billing_frequency = ${billingFrequency},
             stripe_customer_id = ${stripeCustomerId},
             stripe_subscription_id = ${stripeSubscriptionId},
             current_period_start = ${currentPeriodStart},
             current_period_end = ${currentPeriodEnd},
             cancel_at = ${cancelAt},
             cancelled_at = ${cancelledAt},
             metadata = COALESCE(metadata, '{}'::jsonb) || ${metadataJson}::jsonb,
             updated_at = now()
       WHERE id = ${membership.id}
    `);
    return { handled: true };
  }

  // No existing membership — insert new (rare path: pre-F.1 user or missing auto-provision).
  //
  // Extra safety (DeepSeek medium-#3): cross-reference the metadata user_id with
  // the Stripe customer. If the customer already has a DB-linked user (via any
  // other membership row), require the metadata to match that user.
  if (!metadataUserId) {
    console.error(
      `[stripe-subscription] Cannot insert new membership: no kun_user_id in subscription metadata (event=${event.id})`,
    );
    return { handled: false, note: 'no_existing_membership_and_no_user_metadata' };
  }

  const { rows: existingByCustomer } = await adminDb.execute(sql`
    SELECT user_id FROM memberships
     WHERE stripe_customer_id = ${stripeCustomerId}
     LIMIT 1
  `);
  const ownedByUserId = (existingByCustomer[0] as { user_id: string } | undefined)?.user_id;
  if (ownedByUserId && ownedByUserId !== metadataUserId) {
    console.error(
      `[stripe-subscription] Customer ${stripeCustomerId} belongs to user ${ownedByUserId}, metadata says ${metadataUserId} — rejecting to avoid cross-customer hijacking (event=${event.id})`,
    );
    return { handled: false, note: 'user_mismatch_customer_ownership' };
  }

  // ON CONFLICT via the partial unique index predicate — if a concurrent
  // event raced us, the second INSERT becomes an UPDATE on the same row
  // instead of crashing on unique-violation. The WHERE clause MUST match
  // the `memberships_user_active_uidx` predicate exactly for Postgres to
  // pick the right inference target.
  await adminDb.execute(sql`
    INSERT INTO memberships (
      user_id, tier_id, status, billing_frequency, stripe_customer_id,
      stripe_subscription_id, current_period_start, current_period_end,
      cancel_at, cancelled_at, metadata
    ) VALUES (
      ${metadataUserId}, ${tier.id}, ${status}, ${billingFrequency}, ${stripeCustomerId},
      ${stripeSubscriptionId}, ${currentPeriodStart}, ${currentPeriodEnd},
      ${cancelAt}, ${cancelledAt}, ${metadataJson}::jsonb
    )
    ON CONFLICT (user_id)
      WHERE ended_at IS NULL AND status IN ('active','past_due','paused','trialing')
    DO UPDATE SET
      tier_id = EXCLUDED.tier_id,
      status = EXCLUDED.status,
      billing_frequency = EXCLUDED.billing_frequency,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at = EXCLUDED.cancel_at,
      cancelled_at = EXCLUDED.cancelled_at,
      metadata = memberships.metadata || EXCLUDED.metadata,
      updated_at = now()
  `);
  return { handled: true };
}

/**
 * customer.subscription.deleted:
 * Stripe fires this when the subscription reaches cancel_at OR is cancelled
 * with cancel_now. Spec M6=b: access persists until cancel_at_period_end.
 *
 * If cancel_at is already set on our row, Stripe's delete arrives AFTER the
 * period ends — mark status=cancelled but DO NOT clear the row (grace-sweep
 * cron in F.5 handles tier revert at cancel_at passing).
 *
 * If delete arrives without prior cancel_at (admin force-cancelled in Stripe),
 * we set cancelled_at=now() + status=cancelled immediately.
 */
async function handleSubscriptionDeleted(
  adminDb: any,
  event: Stripe.Event,
): Promise<{ handled: boolean; note?: string }> {
  const subscription = event.data.object as Stripe.Subscription;
  const membership = await findMembershipBySubscriptionId(adminDb, subscription.id);
  if (!membership) {
    return { handled: false, note: 'membership_not_found' };
  }

  // Already cancelled? idempotency short-circuit to preserve original cancelled_at stamp
  // for audit trail (per DeepSeek low-#4).
  if (membership.status === 'cancelled') {
    return { handled: true, note: 'already_cancelled' };
  }

  const currentPeriodEnd = isoOrNull((subscription as any).current_period_end);
  const cancelledAt = isoOrNull(subscription.canceled_at) || new Date().toISOString();

  // Revenue-leak guard (DeepSeek critical-#3):
  // If subscription.deleted fires AFTER the paid period has already ended
  // (e.g. hard cancel or grace-sweep race), stamp ended_at=now() so the
  // partial unique index drops this row from the active-member pool and
  // future gating checks treat the user as not-a-member. Grace-sweep cron
  // in Wave F.5 will then enforce tier-reversion to Free.
  //
  // If cancel_at is still in the future (user cancelled mid-period and is
  // still within the paid window), DO NOT set ended_at — access must persist
  // per M6=b until cancel_at passes.
  const nowIso = new Date().toISOString();
  const shouldEnd =
    currentPeriodEnd !== null && new Date(currentPeriodEnd) <= new Date(nowIso);

  if (shouldEnd) {
    await adminDb.execute(sql`
      UPDATE memberships
         SET status = 'cancelled',
             cancel_at = COALESCE(cancel_at, ${currentPeriodEnd}),
             cancelled_at = ${cancelledAt},
             ended_at = COALESCE(ended_at, ${nowIso}),
             updated_at = now()
       WHERE id = ${membership.id}
    `);
  } else {
    await adminDb.execute(sql`
      UPDATE memberships
         SET status = 'cancelled',
             cancel_at = COALESCE(cancel_at, ${currentPeriodEnd}),
             cancelled_at = ${cancelledAt},
             updated_at = now()
       WHERE id = ${membership.id}
    `);
  }
  return { handled: true };
}

/**
 * invoice.payment_succeeded:
 * - On first charge: subscription is already active (subscription.created handler did the work).
 * - On renewal: update current_period_start/end based on the invoice's line period.
 *
 * Zoho Books invoice creation per Q4=a is scheduled for Wave F.5
 * (this handler TODO-comments the hook for now).
 */
async function handleInvoicePaymentSucceeded(
  adminDb: any,
  event: Stripe.Event,
): Promise<{ handled: boolean; note?: string }> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof (invoice as any).subscription === 'string'
    ? (invoice as any).subscription
    : (invoice as any).subscription?.id;

  if (!subscriptionId) {
    return { handled: false, note: 'non_subscription_invoice_ignored' };
  }

  const membership = await findMembershipBySubscriptionId(adminDb, subscriptionId);
  if (!membership) {
    return { handled: false, note: 'membership_not_found' };
  }

  // Pull period from the invoice's line item (for renewals, line period is the new period)
  const line = invoice.lines?.data?.[0];
  const periodStart = isoOrNull(line?.period?.start);
  const periodEnd = isoOrNull(line?.period?.end);

  if (periodStart && periodEnd) {
    await adminDb.execute(sql`
      UPDATE memberships
         SET current_period_start = ${periodStart},
             current_period_end = ${periodEnd},
             status = 'active',
             updated_at = now()
       WHERE id = ${membership.id}
    `);
  } else {
    // Period not on line — just heal status if it was past_due
    await adminDb.execute(sql`
      UPDATE memberships
         SET status = CASE WHEN status = 'past_due' THEN 'active' ELSE status END,
             updated_at = now()
       WHERE id = ${membership.id}
    `);
  }

  // TODO Wave F.5: createZohoBooksInvoice() per renewal
  // TODO Wave F.5: send bilingual receipt email via @kunacademy/email
  return { handled: true };
}

/**
 * invoice.payment_failed:
 * Stripe's default dunning (4 retries) handles collection. We just flip status → past_due
 * so gating can soft-degrade if Samer wants. No custom dunning at launch per spec.
 */
async function handleInvoicePaymentFailed(
  adminDb: any,
  event: Stripe.Event,
): Promise<{ handled: boolean; note?: string }> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof (invoice as any).subscription === 'string'
    ? (invoice as any).subscription
    : (invoice as any).subscription?.id;

  if (!subscriptionId) {
    return { handled: false, note: 'non_subscription_invoice_ignored' };
  }

  const membership = await findMembershipBySubscriptionId(adminDb, subscriptionId);
  if (!membership) {
    return { handled: false, note: 'membership_not_found' };
  }

  await adminDb.execute(sql`
    UPDATE memberships
       SET status = 'past_due',
           updated_at = now()
     WHERE id = ${membership.id}
  `);

  // TODO Wave F.5: bilingual "payment failed" email + Samer Telegram alert
  return { handled: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Secret configured?
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[stripe-subscription] STRIPE_WEBHOOK_SECRET missing in production — rejecting',
      );
      return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 500 });
    }
    console.error(
      '[stripe-subscription] STRIPE_WEBHOOK_SECRET missing. Set it in .env.local. Run: stripe listen --forward-to localhost:3001/api/webhooks/stripe-subscription',
    );
    return NextResponse.json({ error: 'webhook_misconfigured' }, { status: 500 });
  }

  // 2. Signature present?
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    console.error('[stripe-subscription] Missing stripe-signature header');
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 });
  }

  // 3. Read raw body + verify signature
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (err: any) {
    console.error('[stripe-subscription] Signature verification failed:', err?.message);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const eventId = event.id;
  const eventType = event.type;

  // 4. Idempotency — reuse webhook_events with gateway='stripe_subscription'
  try {
    const existing = await withAdminContext(async (db) => {
      const rows = await db.execute(sql`
        SELECT id, status FROM webhook_events WHERE event_id = ${eventId} LIMIT 1
      `);
      return rows.rows[0] as { id: string; status: string } | undefined;
    });

    if (existing) {
      console.log(
        `[stripe-subscription] Duplicate event ${eventId} (status=${existing.status}) — skipping`,
      );
      return NextResponse.json({ received: true, note: 'duplicate event' });
    }

    // Register event as processing — UNIQUE constraint catches races
    try {
      await withAdminContext(async (db) => {
        await db.execute(sql`
          INSERT INTO webhook_events (event_id, gateway, event_type, status)
          VALUES (${eventId}, 'stripe_subscription', ${eventType}, 'processing')
        `);
      });
    } catch {
      console.warn(`[stripe-subscription] Concurrent insert for event ${eventId} — exiting`);
      return NextResponse.json({ received: true, note: 'concurrent duplicate' });
    }
  } catch (err: any) {
    console.error('[stripe-subscription] Idempotency check failed:', err?.message);
    return NextResponse.json({ error: 'idempotency_check_failed' }, { status: 500 });
  }

  // 5. Dispatch
  let result: { handled: boolean; note?: string } = { handled: false, note: 'unhandled' };
  try {
    await withAdminContext(async (db) => {
      switch (event.type) {
        case 'checkout.session.completed':
          result = await handleCheckoutSessionCompleted(db, event);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          result = await handleSubscriptionCreatedOrUpdated(db, event);
          break;
        case 'customer.subscription.deleted':
          result = await handleSubscriptionDeleted(db, event);
          break;
        case 'invoice.payment_succeeded':
          result = await handleInvoicePaymentSucceeded(db, event);
          break;
        case 'invoice.payment_failed':
          result = await handleInvoicePaymentFailed(db, event);
          break;
        case 'customer.subscription.trial_will_end':
          // v2 stub — no trials at launch
          result = { handled: true, note: 'trial_will_end_stub' };
          break;
        default:
          result = { handled: false, note: 'event_type_not_subscribed' };
      }
    });
  } catch (err: any) {
    console.error(
      `[stripe-subscription] Handler failed for event ${eventId} (${eventType}):`,
      err?.message,
    );

    // Mark event as failed for retry
    try {
      await withAdminContext(async (db) => {
        await db.execute(sql`
          UPDATE webhook_events
             SET status = 'failed',
                 error_message = ${err?.message || 'unknown'},
                 completed_at = now()
           WHERE event_id = ${eventId}
        `);
      });
    } catch {
      // non-fatal
    }

    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'handler_failed', detail: err?.message }, { status: 500 });
  }

  // 6. Mark event as completed
  try {
    await withAdminContext(async (db) => {
      await db.execute(sql`
        UPDATE webhook_events
           SET status = ${result.handled ? 'completed' : 'skipped'},
               completed_at = now(),
               error_message = ${result.note || null}
         WHERE event_id = ${eventId}
      `);
    });
  } catch {
    // non-fatal — we already processed the event
  }

  return NextResponse.json({ received: true, handled: result.handled, note: result.note || null });
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
