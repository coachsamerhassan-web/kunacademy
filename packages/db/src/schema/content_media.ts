import { pgTable, text, timestamp, uuid, bigint, integer, index } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';
import { agent_tokens } from './agent_tokens';

/**
 * Wave 15 — content_media
 *
 * Index of uploaded images for rich content editing. VPS-stored (no S3/R2).
 * Nginx serves the files from /uploads/media/ as static; this table carries
 * the metadata admins need for alt text, reuse, and attribution.
 *
 * See migration 0057_wave_15_rich_content.sql.
 */
export const content_media = pgTable("content_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),         // storage filename (UUID.ext)
  original_name: text("original_name").notNull(), // uploader-facing name
  content_type: text("content_type").notNull(),   // image/jpeg | image/png | image/webp | image/gif
  size_bytes: bigint("size_bytes", { mode: 'number' }).notNull(),
  file_path: text("file_path").notNull(),       // absolute VPS path
  url: text("url").notNull(),                    // public /uploads/media/... URL
  alt_ar: text("alt_ar"),
  alt_en: text("alt_en"),
  width: integer("width"),
  height: integer("height"),
  uploaded_by: uuid("uploaded_by").references(() => profiles.id, { onDelete: 'set null' }),
  uploaded_at: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  uploaded_by_agent_token: uuid("uploaded_by_agent_token").references(() => agent_tokens.id, { onDelete: 'set null' }),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  uploadedAtIdx: index("idx_content_media_uploaded_at").on(t.uploaded_at),
  uploadedByIdx: index("idx_content_media_uploaded_by").on(t.uploaded_by),
}));

export type ContentMedia = typeof content_media.$inferSelect;
export type NewContentMedia = typeof content_media.$inferInsert;
