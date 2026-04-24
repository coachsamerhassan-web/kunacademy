import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Wave 15 Phase 1.5 — content_edits
 *
 * Unified audit trail. Every write to a content surface
 * (landing_pages.description_ar, programs.pitch_en, blog_posts.body, etc.)
 * lands here — regardless of whether a human clicked Save in admin UI or
 * an agent PATCHed via the Agent Content API.
 *
 * See migration 0057_wave_15_rich_content.sql.
 */
export const content_edits = pgTable("content_edits", {
  id: uuid("id").primaryKey().defaultRandom(),
  entity: text("entity").notNull(),          // 'landing_pages' | 'programs' | 'blog_posts' | ...
  entity_id: uuid("entity_id").notNull(),
  field: text("field").notNull(),            // column name on the entity table
  editor_type: text("editor_type").notNull(),// 'human' | 'agent'
  editor_id: uuid("editor_id"),              // profiles.id OR agent_tokens.id
  editor_name: text("editor_name"),          // denormalized for audit display
  previous_value: jsonb("previous_value"),
  new_value: jsonb("new_value"),
  change_kind: text("change_kind").notNull().default('scalar'),
  reason: text("reason"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  edit_source: text("edit_source").notNull(),// 'admin_ui' | 'agent_api' | 'system'
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  entityIdx: index("idx_content_edits_entity").on(t.entity, t.entity_id, t.created_at),
  editorIdx: index("idx_content_edits_editor").on(t.editor_type, t.editor_id, t.created_at),
  createdAtIdx: index("idx_content_edits_created_at").on(t.created_at),
}));

export type ContentEdit = typeof content_edits.$inferSelect;
export type NewContentEdit = typeof content_edits.$inferInsert;
