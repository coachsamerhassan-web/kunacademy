import { pgTable, boolean, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { course_sections } from './course_sections';
import { courses } from './courses';
import { profiles } from './profiles';

/**
 * lessons — reusable content object.
 *
 * Post-migration 0046 (Session A of LESSON-BLOCKS wave):
 *   - `video_url` / `video_provider` / `video_id` columns DROPPED (content now
 *     lives in the polymorphic `lesson_blocks` table).
 *   - `course_id` + `section_id` are now NULLABLE (deprecated) — a lesson's
 *     placement(s) in course(s) live in `lesson_placements`. These columns
 *     will be fully dropped in a follow-up session.
 *   - Added `is_global` + `scope` for team-library promotion (D4d=iii hybrid).
 *   - Added `created_by` for ownership (D4e=i sole editor).
 *   - Added `created_at` + `updated_at` timestamps.
 */
export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  // DEPRECATED — use lesson_placements. Nullable post-0046.
  course_id: uuid("course_id").references(() => courses.id),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  content_ar: text("content_ar"),
  content_en: text("content_en"),
  order: integer("order").notNull(),
  duration_minutes: integer("duration_minutes"),
  // DEPRECATED — use lesson_placements. Nullable post-0046.
  section_id: uuid("section_id").references(() => course_sections.id),
  is_preview: boolean("is_preview").default(false),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  // ─── new in 0046 ────────────────────────────────────────────────────────
  is_global: boolean("is_global").notNull().default(false),
  scope: text("scope").notNull().default('private'),  // 'private' | 'team_library'
  created_by: uuid("created_by").references(() => profiles.id),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export type Lessons = typeof lessons.$inferSelect;
export type NewLessons = typeof lessons.$inferInsert;
