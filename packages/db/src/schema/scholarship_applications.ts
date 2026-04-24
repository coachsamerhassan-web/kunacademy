import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/**
 * Wave E.1 — Scholarship Fund: application intake + screening state machine
 *
 * Public intake endpoint (/api/scholarships/apply) writes rows with
 * status='pending'. Admin workflow moves status through the state machine
 * to 'allocated' → 'disbursed'.
 *
 * RLS:
 *   - apps_admin_all            — is_admin() full access
 *   - apps_applicant_self_read  — user_id = app_uid() OR email match
 *
 * Dignity boundary: `rejection_reason` is stored internally and never shown
 * to applicants via UI. Per spec §4.4, Nashit writes personalized rejection
 * responses outside the system.
 *
 * See migration 0054_wave_e1_scholarship_fund.sql for DDL + CHECK constraints.
 */
export const scholarship_applications = pgTable('scholarship_applications', {
  id:                  uuid('id').primaryKey().defaultRandom(),

  // Applicant identity — user_id nullable (public submit)
  user_id:             uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  applicant_name:      text('applicant_name').notNull(),
  applicant_email:     text('applicant_email').notNull(),
  applicant_phone:     text('applicant_phone'),
  preferred_language:  text('preferred_language').notNull().default('ar'),

  // Program requested
  program_family:      text('program_family').notNull(),
  program_slug:        text('program_slug').notNull(),
  scholarship_tier:    text('scholarship_tier').notNull(),

  // Application content (open-text screening fields in structured JSON)
  application_json:    jsonb('application_json').notNull().default({}),

  // Status state machine
  status:              text('status').notNull().default('pending'),

  // Review metadata
  screened_by:         uuid('screened_by').references(() => profiles.id, { onDelete: 'set null' }),
  screened_at:         timestamp('screened_at', { withTimezone: true, mode: 'string' }),
  rejection_reason:    text('rejection_reason'), // internal only

  // Timestamps
  created_at:          timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at:          timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),

  // Metadata
  metadata:            jsonb('metadata').notNull().default({}),
}, (t) => ({
  statusIdx:    index('idx_scholarship_apps_status').on(t.status),
  familyIdx:    index('idx_scholarship_apps_family').on(t.program_family),
  userIdx:      index('idx_scholarship_apps_user').on(t.user_id),
  emailIdx:     index('idx_scholarship_apps_email').on(t.applicant_email),
  createdIdx:   index('idx_scholarship_apps_created_at').on(t.created_at),
}));

export type ScholarshipApplication = typeof scholarship_applications.$inferSelect;
export type NewScholarshipApplication = typeof scholarship_applications.$inferInsert;

export type ScholarshipProgramFamily = 'gps' | 'ihya' | 'wisal' | 'seeds';
export type ScholarshipTier = 'partial' | 'full';
export type ScholarshipAppStatus =
  | 'pending'
  | 'in_review'
  | 'info_requested'
  | 'approved'
  | 'allocated'
  | 'disbursed'
  | 'rejected'
  | 'withdrawn';

/**
 * Structured shape for application_json (loose — not enforced at DB level).
 * Admin UI renders these fields; API may add optional fields without migration.
 */
export interface ApplicationJson {
  financial_context?: string;
  readiness_signals?: string;
  what_you_will_give?: string;
  endorsement?: string;
  [key: string]: unknown;
}
