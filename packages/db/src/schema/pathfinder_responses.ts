import { pgTable, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pathfinder_tree_versions } from './pathfinder_tree_versions';

export const pathfinder_responses = pgTable("pathfinder_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  type: text("type").notNull(),
  answers_json: jsonb("answers_json").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  roi_inputs: jsonb("roi_inputs"),
  journey_stage: text("journey_stage"),
  locale: text("locale").default('ar'),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  direction: text("direction"),
  selected_benefits: jsonb("selected_benefits"),
  self_assessment: jsonb("self_assessment"),
  custom_benefits: text("custom_benefits").array(),
  proposal_pdf_url: text("proposal_pdf_url"),
  job_title: text("job_title"),
  // Migration 0045 — tree version on which this response was captured. Nullable
  // for legacy rows (pre-0045) where the tree was version-less JSON.
  tree_version_id: uuid("tree_version_id").references(() => pathfinder_tree_versions.id, {
    onDelete: 'set null',
  }),
});

export type PathfinderResponses = typeof pathfinder_responses.$inferSelect;
export type NewPathfinderResponses = typeof pathfinder_responses.$inferInsert;
