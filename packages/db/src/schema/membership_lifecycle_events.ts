import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { memberships } from './memberships';
import { profiles } from './profiles';

/**
 * membership_lifecycle_events — Wave F.6 (migration 0062) — audit + idempotency
 * for cron + webhook membership lifecycle events.
 *
 * Event types:
 *   - cancel_requested              (UI cancel CTA → /api/membership/cancel)
 *   - cancel_effective_grace_swept  (grace-sweep cron flipped to free + ended_at)
 *   - reactivated                   (user un-cancelled before cancel_at)
 *   - dunning_payment_failed        (past_due + email sent)
 *   - dunning_back_in_good_standing (recovery + email sent)
 *   - dunning_payment_failed_final  (Stripe smart-retry exhausted)
 *   - renewal_reminder_t7           (T-7 reminder, annual only)
 *   - renewal_reminder_t1           (T-1 reminder, annual + monthly)
 *   - winback_30d                   (30-day post-expired retention email)
 *
 * Idempotency: UNIQUE(event_type, send_key) prevents double-sends across
 * cron retries and webhook re-deliveries. send_key recipe:
 *   reminders: ${membership_id}|${current_period_end_iso}|${reminder_type}
 *   grace:     ${membership_id}|${cancel_at_iso}|grace_sweep
 *   dunning:   ${membership_id}|${invoice_id}|${event_type}
 *   winback:   ${membership_id}|winback
 */
export const membership_lifecycle_events = pgTable(
  'membership_lifecycle_events',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    membership_id: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'cascade' }),
    user_id:       uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    event_type:    text('event_type').notNull(),
    send_key:      text('send_key').notNull(),
    metadata:      jsonb('metadata'),
    created_at:    timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    idem_uidx:        uniqueIndex('membership_lifecycle_events_idem_uidx').on(t.event_type, t.send_key),
    membership_idx:   index('membership_lifecycle_events_membership_idx').on(t.membership_id, t.created_at),
    user_idx:         index('membership_lifecycle_events_user_idx').on(t.user_id, t.created_at),
    type_idx:         index('membership_lifecycle_events_type_idx').on(t.event_type, t.created_at),
  })
);

export type MembershipLifecycleEvent    = typeof membership_lifecycle_events.$inferSelect;
export type NewMembershipLifecycleEvent = typeof membership_lifecycle_events.$inferInsert;
