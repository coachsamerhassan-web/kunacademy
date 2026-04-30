import { pgTable, text, uuid, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Phase 1d-B (2026-04-30) — admin_quick_access
 *
 * DB-backed quick-access tiles on /admin landing. Replaces the hardcoded
 * 9-tile array in apps/web/src/app/[locale]/admin/page.tsx (Phase 1b output).
 * Admins create/edit/reorder/deactivate via /admin/quick-access.
 *
 * See migration 0068_admin_quick_access.sql.
 */
export const QUICK_ACCESS_COLOR_TOKENS = [
  'mandarin',
  'sky',
  'primary',
  'charleston',
  'rose',
  'deepsky',
  'sand',
  'mist',
  'violet',
  'amber',
  'jade',
] as const;

export type QuickAccessColorToken = (typeof QUICK_ACCESS_COLOR_TOKENS)[number];

export const admin_quick_access = pgTable('admin_quick_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  label_ar: text('label_ar').notNull(),
  label_en: text('label_en').notNull(),
  href: text('href').notNull(),
  icon_path: text('icon_path').notNull(),
  color_token: text('color_token').notNull().$type<QuickAccessColorToken>(),
  sort_order: integer('sort_order').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  activeSortIdx: index('admin_quick_access_active_sort_idx').on(t.is_active, t.sort_order),
  hrefUq: uniqueIndex('admin_quick_access_href_uq').on(t.href),
}));

export type AdminQuickAccess = typeof admin_quick_access.$inferSelect;
export type NewAdminQuickAccess = typeof admin_quick_access.$inferInsert;
