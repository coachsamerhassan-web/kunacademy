import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { scholarship_applications } from './scholarship_applications';

/**
 * Wave E.5 — Scholarship Fund: append-only audit log for application status
 * transitions + admin notes.
 *
 * Every status transition + admin note insertion writes a row here.
 *
 * RLS:
 *   - sch_app_audit_events_admin_all       — is_admin() full access
 *   - sch_app_audit_events_server_insert   — kunacademy can INSERT only
 *
 * Append-only: UPDATE + DELETE are REVOKED from kunacademy + kunacademy_admin
 * at the migration. Audit rows are effectively immutable from the application
 * surfaces. Emergency repair requires SUPERUSER + manual `psql -U postgres`.
 *
 * Dignity boundary: never exposed to applicants via UI. Admin-author internal
 * notes only. The applicant communication flow is outside this table — Nashit
 * writes personal emails for declines per spec §4.4.
 *
 * See migration 0063_wave_e5_application_audit_events.sql for DDL + CHECK
 * constraints + REVOKE statements.
 */
export const scholarship_application_audit_events = pgTable(
  'scholarship_application_audit_events',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    application_id: uuid('application_id')
                      .notNull()
                      .references(() => scholarship_applications.id, { onDelete: 'cascade' }),
    admin_id:       uuid('admin_id').references(() => profiles.id, { onDelete: 'set null' }),

    // Event type: 'created' | 'status_changed' | 'note_added' |
    //             'info_requested' | 'allocated' | 'disbursed'
    event_type:     text('event_type').notNull(),

    // Status transition (NULL on creation events; both required for status_changed)
    before_status:  text('before_status'),
    after_status:   text('after_status'),

    // Admin-author internal note (never shown to applicant via UI)
    note:           text('note'),

    // Free-form metadata envelope
    metadata:       jsonb('metadata').notNull().default({}),

    // Timestamp
    created_at:     timestamp('created_at', { withTimezone: true, mode: 'string' })
                      .notNull()
                      .defaultNow(),
  },
  (t) => ({
    applicationIdx: index('sch_app_audit_events_application_idx').on(
      t.application_id,
      t.created_at,
    ),
    adminIdx:       index('sch_app_audit_events_admin_idx').on(t.admin_id, t.created_at),
    typeIdx:        index('sch_app_audit_events_type_idx').on(t.event_type, t.created_at),
  }),
);

export type ScholarshipApplicationAuditEvent =
  typeof scholarship_application_audit_events.$inferSelect;
export type NewScholarshipApplicationAuditEvent =
  typeof scholarship_application_audit_events.$inferInsert;

export type ScholarshipAuditEventType =
  | 'created'
  | 'status_changed'
  | 'note_added'
  | 'info_requested'
  | 'allocated'
  | 'disbursed';
