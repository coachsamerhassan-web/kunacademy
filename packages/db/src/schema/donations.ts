import {
  pgTable,
  boolean,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Wave E.1 — Scholarship Fund: donations ledger
 *
 * One row per discrete donation event. For recurring subscriptions, one row per
 * monthly charge sharing `stripe_subscription_id`. One-time donations carry a
 * unique `stripe_payment_intent_id`.
 *
 * RLS:
 *   - donations_admin_all        — is_admin() full access
 *   - donations_donor_self_read  — authenticated user with matching email
 *
 * Dignity boundary: anonymous donors have is_anonymous=true; the display gate
 * is application-level (transparency dashboard, spec §9.1). DB stores the
 * name + email regardless so admins can reconcile.
 *
 * metadata.source lifecycle (per B5):
 *   'stripe_webhook' → came in via Stripe webhook
 *   'manual_entry'   → entered by admin UI (corporate cheque, bank transfer,
 *                       legacy import per B5 decision)
 *
 * See migration 0054_wave_e1_scholarship_fund.sql for DDL + CHECK constraints.
 */
export const donations = pgTable('donations', {
  id:                          uuid('id').primaryKey().defaultRandom(),

  // Donor identity
  donor_name:                  text('donor_name').notNull(),
  donor_email:                 text('donor_email').notNull(),
  donor_message:               text('donor_message'),

  // Amount in minor units (e.g., 1000 = AED 10.00)
  amount_cents:                integer('amount_cents').notNull(),
  currency:                    text('currency').notNull(),

  // Stripe linkage
  stripe_payment_intent_id:    text('stripe_payment_intent_id'),
  stripe_subscription_id:      text('stripe_subscription_id'),
  stripe_customer_id:          text('stripe_customer_id'),

  // Designation preference (not hard-pin)
  designation_preference:      text('designation_preference').notNull().default('any'),

  // Flags
  is_anonymous:                boolean('is_anonymous').notNull().default(false),
  is_recurring:                boolean('is_recurring').notNull().default(false),

  // Status
  status:                      text('status').notNull().default('received'),

  // Allocation linkage (FK to scholarships, added at migration end)
  allocated_to_scholarship_id: uuid('allocated_to_scholarship_id'),

  // Zoho Books Projects linkage
  zoho_project_task_id:        text('zoho_project_task_id'),

  // Timestamps
  created_at:                  timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  allocated_at:                timestamp('allocated_at', { withTimezone: true, mode: 'string' }),
  refunded_at:                 timestamp('refunded_at', { withTimezone: true, mode: 'string' }),

  // Metadata envelope — source, locale, utm, IP, etc.
  metadata:                    jsonb('metadata').notNull().default({}),
}, (t) => ({
  statusIdx:        index('idx_donations_status').on(t.status),
  emailIdx:         index('idx_donations_email').on(t.donor_email),
  subscriptionIdx:  index('idx_donations_subscription').on(t.stripe_subscription_id),
  createdAtIdx:     index('idx_donations_created_at').on(t.created_at),
}));

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;

export type DonationCurrency = 'AED' | 'USD' | 'EUR' | 'SAR' | 'EGP' | 'GBP';
export type DonationDesignation = 'gps' | 'ihya' | 'wisal' | 'seeds' | 'any';
export type DonationStatus = 'received' | 'allocated' | 'disbursed' | 'refunded' | 'failed';
export type DonationMetadataSource = 'stripe_webhook' | 'manual_entry';
