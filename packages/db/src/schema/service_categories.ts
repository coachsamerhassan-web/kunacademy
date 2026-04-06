import { pgTable, integer, text, uuid } from 'drizzle-orm/pg-core';

export const service_categories = pgTable("service_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en").notNull(),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  audience: text("audience").notNull(),
  display_order: integer("display_order").default(0),
});

export type ServiceCategories = typeof service_categories.$inferSelect;
export type NewServiceCategories = typeof service_categories.$inferInsert;
