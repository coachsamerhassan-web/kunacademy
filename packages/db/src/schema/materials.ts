import { pgTable, boolean, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { courses } from './courses';

export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  course_id: uuid("course_id").notNull().references(() => courses.id),
  title_ar: text("title_ar").notNull(),
  title_en: text("title_en").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  access_duration_days: integer("access_duration_days"),
  display_order: integer("display_order").default(0),
  is_published: boolean("is_published").default(true),
  created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export type Materials = typeof materials.$inferSelect;
export type NewMaterials = typeof materials.$inferInsert;
