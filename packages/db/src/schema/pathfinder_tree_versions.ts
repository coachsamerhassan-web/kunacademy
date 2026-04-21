import {
  pgTable,
  boolean,
  integer,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const pathfinder_tree_versions = pgTable(
  'pathfinder_tree_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version_number: integer('version_number').notNull(),
    label: text('label').notNull(),
    published_at: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    is_active: boolean('is_active').notNull().default(false),
    created_by: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    versionNumberUnique: unique('pathfinder_tree_versions_version_number_unique').on(t.version_number),
  }),
);

export type PathfinderTreeVersion = typeof pathfinder_tree_versions.$inferSelect;
export type NewPathfinderTreeVersion = typeof pathfinder_tree_versions.$inferInsert;
