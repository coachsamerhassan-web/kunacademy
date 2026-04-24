import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { enrollments } from './enrollments';
import { scholarship_applications } from './scholarship_applications';
import { donations } from './donations';

/**
 * Wave E.1 — Scholarship Fund: allocated awards
 *
 * Joined 1:1 to an application and 1:N to donations (via
 * scholarship_donation_links). Denormalized recipient snapshot preserves the
 * award even if the application is later withdrawn or edited.
 *
 * RLS:
 *   - scholarships_admin_all       — is_admin() full access
 *   - scholarships_recipient_read  — recipient_email matches profile email
 *
 * NO donor-view: dignity framing (spec §9.3) forbids donor↔recipient pairing
 * being queryable by either party. The scholarship_donation_links junction is
 * admin-only.
 */
export const scholarships = pgTable('scholarships', {
  id:                        uuid('id').primaryKey().defaultRandom(),

  // Forward references
  application_id:            uuid('application_id').notNull().references(() => scholarship_applications.id, { onDelete: 'restrict' }),

  // Denormalized recipient snapshot
  recipient_name:            text('recipient_name').notNull(),
  recipient_email:           text('recipient_email').notNull(),
  program_family:            text('program_family').notNull(),
  program_slug:              text('program_slug').notNull(),
  scholarship_tier:          text('scholarship_tier').notNull(),

  // Funding
  amount_cents:              integer('amount_cents').notNull(),
  currency:                  text('currency').notNull(),

  // Enrollment linkage (populated at disburse step)
  program_enrollment_id:     uuid('program_enrollment_id').references(() => enrollments.id, { onDelete: 'set null' }),
  disbursed_at:              timestamp('disbursed_at', { withTimezone: true, mode: 'string' }),

  // Admin attribution
  allocated_by:              uuid('allocated_by').references(() => profiles.id, { onDelete: 'set null' }),
  allocated_at:              timestamp('allocated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),

  // Zoho Books Projects linkage
  zoho_allocation_task_id:   text('zoho_allocation_task_id'),
  zoho_disbursement_task_id: text('zoho_disbursement_task_id'),

  // Notes + audit
  notes:                     text('notes'),
  created_at:                timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  metadata:                  jsonb('metadata').notNull().default({}),
}, (t) => ({
  appIdx:        index('idx_scholarships_app').on(t.application_id),
  familyIdx:     index('idx_scholarships_family').on(t.program_family),
  disbursedIdx:  index('idx_scholarships_disbursed').on(t.disbursed_at),
  recipientIdx:  index('idx_scholarships_recipient').on(t.recipient_email),
}));

export type Scholarship = typeof scholarships.$inferSelect;
export type NewScholarship = typeof scholarships.$inferInsert;

/**
 * Junction table: many donations can fund one scholarship; one donation CAN
 * theoretically split across multiple scholarships (v1 is 1:1-or-N:1 by policy
 * but the schema permits N:N for future flexibility).
 *
 * amount_portion is in the DONATION's native currency minor units — preserves
 * multi-currency fidelity for audit. FX normalization happens at application
 * layer for display only.
 *
 * RLS: sdl_admin_all — admin-only, no self-read (dignity framing).
 */
export const scholarship_donation_links = pgTable('scholarship_donation_links', {
  scholarship_id:  uuid('scholarship_id').notNull().references(() => scholarships.id, { onDelete: 'cascade' }),
  donation_id:     uuid('donation_id').notNull().references(() => donations.id, { onDelete: 'restrict' }),
  amount_portion:  integer('amount_portion').notNull(),
  created_at:      timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.scholarship_id, t.donation_id] }),
  donationIdx: index('idx_sdl_donation').on(t.donation_id),
}));

export type ScholarshipDonationLink = typeof scholarship_donation_links.$inferSelect;
export type NewScholarshipDonationLink = typeof scholarship_donation_links.$inferInsert;
