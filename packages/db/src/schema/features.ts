import {
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * features — Wave F.1 (migration 0055) — feature catalog.
 *
 * feature_key is stable (never rename post-launch; code refactor required).
 * feature_type: 'access' | 'action' | 'quota' (DB CHECK enforced).
 */
export const features = pgTable(
  'features',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    feature_key:     text('feature_key').notNull().unique(),
    name_ar:         text('name_ar').notNull(),
    name_en:         text('name_en').notNull(),
    description_ar:  text('description_ar'),
    description_en:  text('description_en'),
    feature_type:    text('feature_type').notNull().default('access'),
    created_at:      timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at:      timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  }
);

export type Feature    = typeof features.$inferSelect;
export type NewFeature = typeof features.$inferInsert;
