/**
 * Donation webhook handlers — Wave E.2 Scholarship Fund integration.
 *
 * Extracted from /api/webhooks/payment/route.ts to keep that file from
 * growing past its current 1494-line threshold. Called INLINE from route.ts
 * on:
 *   - payment_intent.succeeded  (one-time donation)
 *   - invoice.payment_succeeded (recurring donation charge)
 *   - customer.subscription.deleted (recurring donation canceled)
 *   - charge.refunded            (donation refund)
 *
 * All handlers are idempotent:
 *   - The webhook_events UNIQUE(event_id) constraint prevents duplicate dispatch.
 *   - donations.stripe_payment_intent_id UNIQUE prevents duplicate row inserts
 *     for one-time PIs even if the event_id check fails somehow (ON CONFLICT).
 *
 * Spec: WAVE-E-SCHOLARSHIP-FUND-SPEC.md §7.3
 */

import { sql } from 'drizzle-orm';
import { withAdminContext } from '@kunacademy/db';
import type Stripe from 'stripe';
import {
  logDonationTask,
  logReversalTask,
  resolveScholarshipFundProjectId,
  type DonationTaskInput,
} from './zoho-projects';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DonationCurrencyCode = 'AED' | 'USD' | 'EUR' | 'SAR' | 'EGP' | 'GBP';
export type DonationDesignationCode = 'gps' | 'ihya' | 'wisal' | 'seeds' | 'any';

interface DonationRowUpsert {
  donor_name: string;
  donor_email: string;
  donor_message: string | null;
  amount_cents: number;
  currency: DonationCurrencyCode;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  designation_preference: DonationDesignationCode;
  is_anonymous: boolean;
  is_recurring: boolean;
  metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — input sanitization + metadata extraction
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CURRENCIES = new Set<DonationCurrencyCode>(['AED', 'USD', 'EUR', 'SAR', 'EGP', 'GBP']);
const VALID_DESIGNATIONS = new Set<DonationDesignationCode>([
  'gps',
  'ihya',
  'wisal',
  'seeds',
  'any',
]);

function normCurrency(raw: string | null | undefined): DonationCurrencyCode {
  if (!raw) return 'AED';
  const upper = raw.toUpperCase();
  return VALID_CURRENCIES.has(upper as DonationCurrencyCode)
    ? (upper as DonationCurrencyCode)
    : 'AED';
}

function normDesignation(raw: string | null | undefined): DonationDesignationCode {
  if (!raw) return 'any';
  const lower = raw.toLowerCase();
  return VALID_DESIGNATIONS.has(lower as DonationDesignationCode)
    ? (lower as DonationDesignationCode)
    : 'any';
}

function parseBool(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'yes';
}

function clampMessage(raw: string | null | undefined, max = 280): string | null {
  if (!raw) return null;
  return raw.length > max ? raw.slice(0, max) : raw;
}

/**
 * Build a display-safe donor label. "Anonymous donor" if is_anonymous=true,
 * else "First L." (first name + initial of surname) for the Zoho Books Projects
 * task name.
 */
function donorDisplayName(fullName: string, isAnonymous: boolean): string {
  if (isAnonymous) return 'Anonymous donor';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1]?.[0] ?? '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho Projects task logger (non-blocking, best-effort)
// ─────────────────────────────────────────────────────────────────────────────

interface ZohoLogResult {
  task_id: string | null;
  mock: boolean;
  error: string | null;
}

async function tryLogDonationTaskToZoho(
  row: DonationRowUpsert & { donation_id: string },
): Promise<ZohoLogResult> {
  const projectId = resolveScholarshipFundProjectId();
  if (!projectId) {
    console.warn(
      '[donation-handler] ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID not set — skipping Zoho task log. ' +
        'DB row still persisted; Amin reconciliation script will flag the gap.',
    );
    return { task_id: null, mock: true, error: null };
  }

  const input: DonationTaskInput = {
    donation_id: row.donation_id,
    donor_display_name: donorDisplayName(row.donor_name, row.is_anonymous),
    amount_minor: row.amount_cents,
    currency: row.currency,
    designation_preference: row.designation_preference,
    is_anonymous: row.is_anonymous,
    is_recurring: row.is_recurring,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    donor_message: row.donor_message,
  };

  try {
    const res = await logDonationTask(projectId, input);
    return { task_id: res.task_id, mock: res.mock, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[donation-handler] Zoho task log failed (non-blocking):', msg);
    return { task_id: null, mock: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handler — payment_intent.succeeded (one-time donation)
// ─────────────────────────────────────────────────────────────────────────────

export interface HandleOneTimeResult {
  donation_id: string | null;
  alreadyProcessed: boolean;
  zohoTaskId: string | null;
  zohoMock: boolean;
}

/**
 * Handle a Stripe payment_intent.succeeded event for a one-time donation.
 *
 * Called from route.ts when event.type === 'payment_intent.succeeded' AND
 * event.data.object.metadata.donation_type === 'one_time'.
 *
 * Idempotency:
 *   - INSERT ... ON CONFLICT (stripe_payment_intent_id) DO NOTHING
 *   - RETURNING the row (new or existing)
 */
export async function handleDonationSucceeded(
  pi: Stripe.PaymentIntent,
): Promise<HandleOneTimeResult> {
  const md = pi.metadata ?? {};

  const row: DonationRowUpsert = {
    donor_name: md.donor_name ?? '',
    donor_email: md.donor_email ?? (pi.receipt_email ?? ''),
    donor_message: clampMessage(md.donor_message),
    amount_cents: pi.amount,
    currency: normCurrency(pi.currency?.toUpperCase() ?? md.currency ?? 'AED'),
    stripe_payment_intent_id: pi.id,
    stripe_subscription_id: null,
    stripe_customer_id: typeof pi.customer === 'string' ? pi.customer : null,
    designation_preference: normDesignation(md.designation_preference),
    is_anonymous: parseBool(md.is_anonymous),
    is_recurring: false,
    metadata: {
      source: md.source ?? 'stripe_webhook',
      locale: md.locale ?? 'ar',
      stripe_event_id: pi.id, // for future cross-ref
    },
  };

  if (!row.donor_email) {
    console.error('[donation-handler] payment_intent without donor_email — cannot persist');
    return { donation_id: null, alreadyProcessed: false, zohoTaskId: null, zohoMock: false };
  }
  if (!row.donor_name) {
    // Fall back to email-local part if donor_name missing
    row.donor_name = row.donor_email.split('@')[0] ?? 'Donor';
  }

  const inserted = await withAdminContext(async (db) => {
    const res = await db.execute(
      sql`
        INSERT INTO donations (
          donor_name, donor_email, donor_message,
          amount_cents, currency,
          stripe_payment_intent_id, stripe_subscription_id, stripe_customer_id,
          designation_preference, is_anonymous, is_recurring,
          status, metadata
        ) VALUES (
          ${row.donor_name}, ${row.donor_email}, ${row.donor_message},
          ${row.amount_cents}, ${row.currency},
          ${row.stripe_payment_intent_id}, ${row.stripe_subscription_id}, ${row.stripe_customer_id},
          ${row.designation_preference}, ${row.is_anonymous}, ${row.is_recurring},
          'received', ${JSON.stringify(row.metadata)}::jsonb
        )
        ON CONFLICT (stripe_payment_intent_id) DO NOTHING
        RETURNING id
      `,
    );
    return res.rows[0] as { id: string } | undefined;
  });

  if (!inserted) {
    // Row already existed — another webhook beat us here
    const existing = await withAdminContext(async (db) => {
      const r = await db.execute(
        sql`SELECT id, zoho_project_task_id FROM donations WHERE stripe_payment_intent_id = ${pi.id} LIMIT 1`,
      );
      return r.rows[0] as { id: string; zoho_project_task_id: string | null } | undefined;
    });
    return {
      donation_id: existing?.id ?? null,
      alreadyProcessed: true,
      zohoTaskId: existing?.zoho_project_task_id ?? null,
      zohoMock: false,
    };
  }

  // Log to Zoho Books Projects (non-blocking, best-effort)
  const zoho = await tryLogDonationTaskToZoho({ ...row, donation_id: inserted.id });

  // Persist the Zoho task_id onto the donation row for future reconciliation
  if (zoho.task_id) {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`UPDATE donations SET zoho_project_task_id = ${zoho.task_id} WHERE id = ${inserted.id}`,
      );
    });
  }

  return {
    donation_id: inserted.id,
    alreadyProcessed: false,
    zohoTaskId: zoho.task_id,
    zohoMock: zoho.mock,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handler — invoice.payment_succeeded (recurring donation charge)
// ─────────────────────────────────────────────────────────────────────────────

export interface HandleRecurringResult {
  donation_id: string | null;
  alreadyProcessed: boolean;
  isFirstCharge: boolean;
  zohoTaskId: string | null;
  zohoMock: boolean;
}

/**
 * Handle a Stripe invoice.payment_succeeded event for a recurring donation.
 *
 * Called from route.ts when event.type === 'invoice.payment_succeeded' AND
 * the underlying subscription's metadata.donation_type === 'recurring'.
 *
 * Each monthly charge produces a new donations row (unique by
 * stripe_payment_intent_id — each invoice generates a new PI).
 *
 * The recurring subscription is identified by stripe_subscription_id shared
 * across all child rows.
 */
export async function handleRecurringDonationCharge(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
): Promise<HandleRecurringResult> {
  const md = subscription.metadata ?? {};

  const piId =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent?.id ?? null;

  if (!piId) {
    console.error('[donation-handler] invoice without payment_intent id');
    return {
      donation_id: null,
      alreadyProcessed: false,
      isFirstCharge: false,
      zohoTaskId: null,
      zohoMock: false,
    };
  }

  // Determine if this is the first charge for the subscription
  const existingForSub = await withAdminContext(async (db) => {
    const r = await db.execute(
      sql`SELECT id FROM donations WHERE stripe_subscription_id = ${subscription.id} LIMIT 1`,
    );
    return r.rows.length > 0;
  });
  const isFirstCharge = !existingForSub;

  const row: DonationRowUpsert = {
    donor_name: md.donor_name ?? '',
    donor_email: md.donor_email ?? (invoice.customer_email ?? ''),
    donor_message: clampMessage(md.donor_message),
    amount_cents: invoice.amount_paid,
    currency: normCurrency(invoice.currency?.toUpperCase() ?? md.currency ?? 'AED'),
    stripe_payment_intent_id: piId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
    designation_preference: normDesignation(md.designation_preference),
    is_anonymous: parseBool(md.is_anonymous),
    is_recurring: true,
    metadata: {
      source: 'stripe_webhook',
      locale: md.locale ?? 'ar',
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscription.id,
      is_first_charge: isFirstCharge,
    },
  };

  if (!row.donor_email) {
    console.error('[donation-handler] subscription invoice without donor_email');
    return {
      donation_id: null,
      alreadyProcessed: false,
      isFirstCharge,
      zohoTaskId: null,
      zohoMock: false,
    };
  }
  if (!row.donor_name) {
    row.donor_name = row.donor_email.split('@')[0] ?? 'Donor';
  }

  const inserted = await withAdminContext(async (db) => {
    const res = await db.execute(
      sql`
        INSERT INTO donations (
          donor_name, donor_email, donor_message,
          amount_cents, currency,
          stripe_payment_intent_id, stripe_subscription_id, stripe_customer_id,
          designation_preference, is_anonymous, is_recurring,
          status, metadata
        ) VALUES (
          ${row.donor_name}, ${row.donor_email}, ${row.donor_message},
          ${row.amount_cents}, ${row.currency},
          ${row.stripe_payment_intent_id}, ${row.stripe_subscription_id}, ${row.stripe_customer_id},
          ${row.designation_preference}, ${row.is_anonymous}, ${row.is_recurring},
          'received', ${JSON.stringify(row.metadata)}::jsonb
        )
        ON CONFLICT (stripe_payment_intent_id) DO NOTHING
        RETURNING id
      `,
    );
    return res.rows[0] as { id: string } | undefined;
  });

  if (!inserted) {
    const existing = await withAdminContext(async (db) => {
      const r = await db.execute(
        sql`SELECT id, zoho_project_task_id FROM donations WHERE stripe_payment_intent_id = ${piId} LIMIT 1`,
      );
      return r.rows[0] as { id: string; zoho_project_task_id: string | null } | undefined;
    });
    return {
      donation_id: existing?.id ?? null,
      alreadyProcessed: true,
      isFirstCharge,
      zohoTaskId: existing?.zoho_project_task_id ?? null,
      zohoMock: false,
    };
  }

  const zoho = await tryLogDonationTaskToZoho({ ...row, donation_id: inserted.id });
  if (zoho.task_id) {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`UPDATE donations SET zoho_project_task_id = ${zoho.task_id} WHERE id = ${inserted.id}`,
      );
    });
  }

  return {
    donation_id: inserted.id,
    alreadyProcessed: false,
    isFirstCharge,
    zohoTaskId: zoho.task_id,
    zohoMock: zoho.mock,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handler — customer.subscription.deleted (recurring donation canceled)
// ─────────────────────────────────────────────────────────────────────────────

export interface HandleSubscriptionDeletedResult {
  rowsTouched: number;
  noted: boolean;
}

/**
 * Handle a Stripe customer.subscription.deleted event for a recurring donation.
 *
 * Per spec §4.2 step 6: existing donation rows are untouched (they represent
 * real money already donated), but we annotate metadata.subscription_canceled
 * so future queries see the cancellation context.
 *
 * No refunds — donor cannot get back months they already donated.
 */
export async function handleRecurringDonationCanceled(
  subscription: Stripe.Subscription,
): Promise<HandleSubscriptionDeletedResult> {
  const subId = subscription.id;
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : new Date().toISOString();

  // Annotate all existing rows for this subscription so admin UI can reflect
  // the cancellation state.
  const res = await withAdminContext(async (db) => {
    return db.execute(
      sql`
        UPDATE donations
        SET metadata = metadata || jsonb_build_object(
              'subscription_canceled', true,
              'subscription_canceled_at', ${canceledAt}::text
            )
        WHERE stripe_subscription_id = ${subId}
      `,
    );
  });

  const rowsTouched = (res as { rowCount?: number }).rowCount ?? 0;
  return { rowsTouched, noted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public handler — charge.refunded (donation refunded)
// ─────────────────────────────────────────────────────────────────────────────

export interface HandleRefundResult {
  donation_id: string | null;
  alreadyRefunded: boolean;
  reversalTaskId: string | null;
}

/**
 * Handle a Stripe charge.refunded event for a donation.
 *
 * Identifies the donation by the charge's payment_intent id. Updates the
 * donation status to 'refunded', sets refunded_at, and posts a reversal
 * task to Zoho Books Projects so the running total stays accurate.
 *
 * If the donation row doesn't exist yet (webhook ordering race), we log a
 * warning — the next reconciliation pass will catch it.
 */
export async function handleDonationRefund(
  charge: Stripe.Charge,
): Promise<HandleRefundResult> {
  const piId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!piId) {
    console.error('[donation-handler] charge.refunded without payment_intent');
    return { donation_id: null, alreadyRefunded: false, reversalTaskId: null };
  }

  // Locate the donation row
  const donation = await withAdminContext(async (db) => {
    const r = await db.execute(
      sql`
        SELECT id, amount_cents, currency, status, zoho_project_task_id
        FROM donations
        WHERE stripe_payment_intent_id = ${piId}
        LIMIT 1
      `,
    );
    return r.rows[0] as
      | {
          id: string;
          amount_cents: number;
          currency: string;
          status: string;
          zoho_project_task_id: string | null;
        }
      | undefined;
  });

  if (!donation) {
    console.warn(
      `[donation-handler] charge.refunded for unknown PI ${piId} — no donation row. Will flag in reconciliation.`,
    );
    return { donation_id: null, alreadyRefunded: false, reversalTaskId: null };
  }

  if (donation.status === 'refunded') {
    return { donation_id: donation.id, alreadyRefunded: true, reversalTaskId: null };
  }

  await withAdminContext(async (db) => {
    await db.execute(
      sql`
        UPDATE donations
        SET status = 'refunded',
            refunded_at = NOW(),
            metadata = metadata || jsonb_build_object(
              'refund_charge_id', ${charge.id}::text,
              'refund_amount_cents', ${charge.amount_refunded}::int
            )
        WHERE id = ${donation.id}
      `,
    );
  });

  // Post reversal task to Zoho (best-effort)
  let reversalTaskId: string | null = null;
  const projectId = resolveScholarshipFundProjectId();
  if (projectId) {
    try {
      const r = await logReversalTask(projectId, {
        donation_id: donation.id,
        original_task_id: donation.zoho_project_task_id,
        amount_minor: charge.amount_refunded,
        currency: donation.currency,
        reason: charge.refunds?.data?.[0]?.reason ?? 'requested_by_customer',
      });
      reversalTaskId = r.task_id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[donation-handler] Zoho reversal task failed (non-blocking):', msg);
    }
  }

  return { donation_id: donation.id, alreadyRefunded: false, reversalTaskId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection helper — is this webhook event a donation event?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the Stripe event object's metadata identifies it as a
 * donation event (vs. a membership or program payment).
 *
 * For invoice.payment_succeeded: caller passes subscription.metadata.
 * For payment_intent.succeeded:  caller passes paymentIntent.metadata.
 * For charge.refunded:           caller passes charge.metadata (which Stripe
 *                                mirrors from the underlying PaymentIntent).
 */
export function isDonationEvent(metadata: Record<string, string> | null | undefined): boolean {
  if (!metadata) return false;
  const t = metadata.donation_type;
  return t === 'one_time' || t === 'recurring';
}
