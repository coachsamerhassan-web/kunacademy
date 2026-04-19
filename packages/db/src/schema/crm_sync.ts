/**
 * Zoho CRM sync schema — KUN Academy
 *
 * Tables:
 *   crm_sync_state                — one row per KUN profile; tracks Zoho contact_id + status
 *   crm_sync_queue                — retry queue for failed / pending CRM operations
 *   crm_deal_enqueued_for_payment — dedup sentinel; prevents double-enqueue on payment retries
 *
 * Created in migration 0016_zoho_crm_sync.sql
 * Updated in migration 0017_crm_sync_queue_dedup.sql
 *   - crm_sync_queue.dedup_key column added
 *   - UNIQUE INDEX crm_sync_queue_dedup_uniq (profile_id, operation, dedup_key) NULLS NOT DISTINCT
 *   - crm_deal_enqueued_for_payment table added
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

import { profiles } from './profiles';

// ─────────────────────────────────────────────────────────────────────────────
// crm_sync_state
// ─────────────────────────────────────────────────────────────────────────────

export const crmSyncState = pgTable(
  'crm_sync_state',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    profileId:      uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    zohoContactId:  text('zoho_contact_id'),
    zohoModule:     text('zoho_module').notNull().default('Contacts'),
    activityStatus: text('activity_status').notNull().default('New'),
    lastSyncedAt:   timestamp('last_synced_at', { withTimezone: true }),
    syncError:      text('sync_error'),
    createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdUniq:     uniqueIndex('crm_sync_state_profile_id_idx').on(t.profileId),
    zohoContactIdIdx:  index('crm_sync_state_zoho_contact_id_idx').on(t.zohoContactId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// crm_sync_queue
// ─────────────────────────────────────────────────────────────────────────────

export const crmSyncQueue = pgTable(
  'crm_sync_queue',
  {
    id:          uuid('id').primaryKey().defaultRandom(),
    profileId:   uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    operation:   text('operation').notNull(),       // 'upsert_contact' | 'create_deal' | 'update_status'
    payload:     text('payload').notNull().default('{}'),  // stored as JSONB in DB; text in Drizzle for flexibility
    attempts:    integer('attempts').notNull().default(0),
    lastError:   text('last_error'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Dedup discriminator:
     *   NULL             → upsert_contact / update_status (one pending per profile+op)
     *   payment_id text  → create_deal (one pending per payment)
     *
     * The DB carries UNIQUE INDEX crm_sync_queue_dedup_uniq on
     * (profile_id, operation, dedup_key) NULLS NOT DISTINCT, so NULLs collapse.
     */
    dedupKey:    text('dedup_key'),
  },
  (t) => ({
    profileIdIdx:   index('crm_sync_queue_profile_id_idx').on(t.profileId),
    scheduledAtIdx: index('crm_sync_queue_scheduled_at_idx').on(t.scheduledAt),
    // Dedup unique index is created in SQL migration (NULLS NOT DISTINCT not yet in Drizzle kit DSL)
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// crm_deal_enqueued_for_payment
// ─────────────────────────────────────────────────────────────────────────────

export const crmDealEnqueuedForPayment = pgTable(
  'crm_deal_enqueued_for_payment',
  {
    paymentId:  text('payment_id').primaryKey(),
    profileId:  uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
