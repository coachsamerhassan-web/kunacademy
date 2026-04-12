import { pgTable, text, integer, boolean } from 'drizzle-orm/pg-core';

export const badgeDefinitions = pgTable("badge_definitions", {
  slug: text("slug").primaryKey(),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  image_url: text("image_url").notNull(),
  program_slug: text("program_slug"),
  program_url_ar: text("program_url_ar"),
  program_url_en: text("program_url_en"),
  display_order: integer("display_order").notNull().default(0),
  is_active: boolean("is_active").notNull().default(true),
});

export type BadgeDefinition = typeof badgeDefinitions.$inferSelect;
export type NewBadgeDefinition = typeof badgeDefinitions.$inferInsert;
