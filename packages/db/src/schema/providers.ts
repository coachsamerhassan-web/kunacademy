import { pgTable, boolean, text, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  profile_id: uuid("profile_id").references(() => profiles.id),
  bio_ar: text("bio_ar"),
  bio_en: text("bio_en"),
  specialties: text("specialties").array(),
  languages: text("languages").array(),
  credentials: text("credentials"),
  is_visible: boolean("is_visible").default(true),
});

export type Providers = typeof providers.$inferSelect;
export type NewProviders = typeof providers.$inferInsert;
