import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { content_edits } from './content_edits';

/**
 * Wave 15 Wave 1 — content_page_snapshots
 *
 * Page-level snapshots fired on:
 *   - publish      (always — pre-publish check + post-publish snapshot)
 *   - archive      (always)
 *   - manual       (admin-triggered checkpoint; surfaces in editor "versions")
 *   - pre_rollback (always — before applying a rollback target)
 *   - migration    (when a structural migration changes a row in place)
 *
 * Complements `content_edits` (per-edit append-only audit). Snapshots are
 * full-row JSONB copies; `content_edits` are field-level diffs. Both stay.
 *
 * Append-only invariant enforced via:
 *   1. GRANT SELECT, INSERT only (no UPDATE / DELETE)
 *   2. BEFORE UPDATE trigger raises EXCEPTION (defense against admin role
 *      inheritance bypass per learned-pattern 2026-04-26 — column-grant
 *      restriction is silently bypassable; trigger is the real lock)
 *   3. BEFORE DELETE trigger raises EXCEPTION
 *
 * RLS: admin-only. Snapshots include unpublished/archived rows; anon must
 * never read them.
 *
 * See migration 0067_wave_15_w1_snapshots_content_edits_metadata.sql.
 */
export const content_page_snapshots = pgTable('content_page_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Which entity table this snapshot belongs to. CHECK in
  // {'landing_pages','blog_posts','static_pages'} at DB level.
  entity: text('entity').notNull(),
  entity_id: uuid('entity_id').notNull(),

  // Full-row JSONB copy at snapshot time. Shape mirrors the source row.
  snapshot: jsonb('snapshot').notNull(),

  // Why this snapshot was taken. CHECK in
  // {'publish','archive','manual','pre_rollback','migration'} at DB level.
  reason: text('reason').notNull(),

  // Who took it. taken_by_kind ∈ {'human','agent','system'}; CHECK at DB.
  taken_by_kind: text('taken_by_kind').notNull(),
  taken_by_id: uuid('taken_by_id'),
  taken_by_name: text('taken_by_name'),

  // Optional FK to the content_edits row that triggered the snapshot.
  edit_id: uuid('edit_id').references(() => content_edits.id, { onDelete: 'set null' }),

  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
}, (t) => ({
  // Match migration 0067 — created_at DESC on both indexes (sql template).
  entityIdx: index('content_page_snapshots_entity_idx').on(
    t.entity,
    t.entity_id,
    sql`${t.created_at} DESC`,
  ),
  reasonIdx: index('content_page_snapshots_reason_idx').on(
    t.reason,
    sql`${t.created_at} DESC`,
  ),
}));

export type ContentPageSnapshot = typeof content_page_snapshots.$inferSelect;
export type NewContentPageSnapshot = typeof content_page_snapshots.$inferInsert;

/** Snapshot reason whitelist — keep in sync with the DB CHECK constraint. */
export const SNAPSHOT_REASONS = [
  'publish',
  'archive',
  'manual',
  'pre_rollback',
  'migration',
] as const;
export type SnapshotReason = (typeof SNAPSHOT_REASONS)[number];

/** Entity whitelist — keep in sync with the DB CHECK constraint. */
export const SNAPSHOT_ENTITIES = ['landing_pages', 'blog_posts', 'static_pages'] as const;
export type SnapshotEntity = (typeof SNAPSHOT_ENTITIES)[number];
