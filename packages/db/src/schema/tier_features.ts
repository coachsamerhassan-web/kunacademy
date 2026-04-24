import {
  pgTable,
  boolean,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { tiers } from './tiers';
import { features } from './features';

/**
 * tier_features — Wave F.1 (migration 0055) — entitlement matrix (M:N).
 *
 * Composite primary key (tier_id, feature_id) — exactly one row per
 * tier/feature pair. `config` JSONB carries per-tier feature parameters
 * (e.g. discount_percentage, stackable flag).
 */
export const tier_features = pgTable(
  'tier_features',
  {
    tier_id:     uuid('tier_id').notNull().references(() => tiers.id, { onDelete: 'cascade' }),
    feature_id:  uuid('feature_id').notNull().references(() => features.id, { onDelete: 'cascade' }),
    included:    boolean('included').notNull().default(true),
    quota:       integer('quota'),       // NULL = unlimited
    config:      jsonb('config'),
    created_at:  timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => ({
    pk:              primaryKey({ columns: [t.tier_id, t.feature_id] }),
    included_idx:    index('tier_features_included_idx').on(t.tier_id, t.feature_id),
    feature_idx:     index('tier_features_feature_idx').on(t.feature_id),
  })
);

export type TierFeature    = typeof tier_features.$inferSelect;
export type NewTierFeature = typeof tier_features.$inferInsert;
