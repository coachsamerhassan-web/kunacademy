/**
 * email_outbox — transactional outbox for durable email delivery
 *
 * Rows are inserted INSIDE the caller's Drizzle transaction so a process crash
 * between the tx commit and an external email call can never lose a notification.
 * A 1-minute cron (/api/cron/drain-email-outbox) fetches pending rows and
 * dispatches them to the appropriate @kunacademy/email template function.
 *
 * Created in migration 0021_email_outbox.sql
 */

import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    templateKey:   text('template_key').notNull(),       // 'assessment-result' | 'recording-received' | 'assessor-assignment'
    toEmail:       text('to_email').notNull(),
    payload:       jsonb('payload').notNull(),            // template-specific params serialised as JSONB
    status:        text('status').notNull().default('pending'), // 'pending' | 'sent' | 'failed'
    attempts:      integer('attempts').notNull().default(0),
    lastError:     text('last_error'),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt:        timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    // Partial index on pending rows — keeps cron scans cheap
    pendingIdx: index('email_outbox_pending_idx').on(t.status, t.createdAt),
  }),
);
