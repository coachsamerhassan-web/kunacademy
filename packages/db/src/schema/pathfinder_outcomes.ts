import {
  pgTable,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';
import { pathfinder_tree_versions } from './pathfinder_tree_versions';

export const pathfinder_outcomes = pgTable(
  'pathfinder_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version_id: uuid('version_id')
      .notNull()
      .references(() => pathfinder_tree_versions.id, { onDelete: 'cascade' }),
    program_slug: text('program_slug').notNull(),
    category_affinity: jsonb('category_affinity').notNull().default({}),
    min_score: integer('min_score').notNull().default(0),
    cta_label_ar: text('cta_label_ar'),
    cta_label_en: text('cta_label_en'),
    cta_type: text('cta_type').notNull().default('explore'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    versionSlugUnique: unique('pathfinder_outcomes_version_slug_unique').on(t.version_id, t.program_slug),
  }),
);

export type PathfinderOutcomeRow = typeof pathfinder_outcomes.$inferSelect;
export type NewPathfinderOutcomeRow = typeof pathfinder_outcomes.$inferInsert;
